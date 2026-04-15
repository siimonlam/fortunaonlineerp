import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const BUYER_CHOP_DESC = "採購公司(BUD申請公司)的蓋印";
const BUYER_SIG_DESC = "採購公司(BUD申請公司)的簽名";
const SUPPLIER_SIG_DESC = "供應商簽名";
const SUPPLIER_CHOP_DESC = "供應商蓋印";
const LOWEST_PRICE_DESC = "價低者得";
const VENDOR_NA_RESULT = "N/A - Non-Selected Vendor";

function formatPrice(amount: number, currency?: string | null): string {
  const prefix = currency ? `${currency} ` : "";
  return `${prefix}${amount.toLocaleString("en-HK")}`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const body = await req.json();
    const { folder_id, project_id } = body;

    if (!folder_id || !project_id) {
      return new Response(
        JSON.stringify({ error: "folder_id and project_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Step 1: Load all Quotation files in this folder ──────────────────────
    const { data: files, error: filesError } = await supabase
      .from("project_checklist_files")
      .select("id, file_id, file_name, checklist_item_id, extracted_data, is_selected_vendor")
      .eq("drive_folder_id", folder_id)
      .eq("project_id", project_id)
      .ilike("document_type", "Quotation%");

    if (filesError) throw filesError;

    if (!files || files.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          selected_vendor_file_id: null,
          message: "No quotation files found in this folder",
          files_checked: 0,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const fileIds = files.map((f: { id: string }) => f.id);

    // ── Step 2: Load all file checks for these files ──────────────────────────
    const { data: allChecks, error: checksError } = await supabase
      .from("project_checklist_file_checks")
      .select("id, file_id, description, is_checked, is_checked_by_ai, ai_result")
      .in("file_id", fileIds);

    if (checksError) throw checksError;

    const checksByFileId = new Map<string, Array<{
      id: string;
      file_id: string;
      description: string;
      is_checked: boolean;
      is_checked_by_ai: boolean;
      ai_result: string | null;
    }>>();
    for (const check of (allChecks || [])) {
      if (!checksByFileId.has(check.file_id)) checksByFileId.set(check.file_id, []);
      checksByFileId.get(check.file_id)!.push(check);
    }

    // ── Step 3: Determine qualifying files (supplier sig + chop + sign_date) ─
    const qualifyingFiles: Array<{
      id: string;
      checklist_item_id: string | null;
      total_amount: number;
      currency: string | null;
      sign_date: string | null;
      file_name: string;
      has_buyer_sig: boolean;
      has_buyer_chop: boolean;
      has_supplier_sig: boolean;
      has_supplier_chop: boolean;
      has_sign_date: boolean;
    }> = [];

    for (const file of files) {
      const checks = checksByFileId.get(file.id) || [];
      const extractedData = (file.extracted_data || {}) as Record<string, unknown>;

      const hasBuyerSig = checks.some(
        c => c.description === BUYER_SIG_DESC && (c.is_checked || (c.is_checked_by_ai && c.ai_result && !c.ai_result.includes("N/A")))
      );
      const hasBuyerChop = checks.some(
        c => c.description === BUYER_CHOP_DESC && (c.is_checked || (c.is_checked_by_ai && c.ai_result && !c.ai_result.includes("N/A")))
      );
      const hasSupplierSig = checks.some(
        c => c.description === SUPPLIER_SIG_DESC && (c.is_checked || (c.is_checked_by_ai && c.ai_result && !c.ai_result.includes("N/A")))
      );
      const hasSupplierChop = checks.some(
        c => c.description === SUPPLIER_CHOP_DESC && (c.is_checked || (c.is_checked_by_ai && c.ai_result && !c.ai_result.includes("N/A")))
      );
      const signDate = extractedData.sign_date as string | null | undefined;
      const hasSignDate = !!signDate;

      qualifyingFiles.push({
        id: file.id,
        checklist_item_id: file.checklist_item_id,
        total_amount: typeof extractedData.total_amount === "number" ? extractedData.total_amount : Infinity,
        currency: (extractedData.currency as string | null) ?? null,
        sign_date: signDate || null,
        file_name: file.file_name,
        has_buyer_sig: hasBuyerSig,
        has_buyer_chop: hasBuyerChop,
        has_supplier_sig: hasSupplierSig,
        has_supplier_chop: hasSupplierChop,
        has_sign_date: hasSignDate,
      });
    }

    // Filter to files that meet the selection criteria
    const fullyQualified = qualifyingFiles.filter(
      f => f.has_supplier_sig && f.has_supplier_chop && f.has_sign_date
    );

    if (fullyQualified.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          selected_vendor_file_id: null,
          message: "No qualifying vendor found (requires supplier signature, supplier chop, and signed date)",
          files_checked: files.length,
          qualifying_details: qualifyingFiles.map(f => ({
            file_id: f.id,
            file_name: f.file_name,
            has_supplier_sig: f.has_supplier_sig,
            has_supplier_chop: f.has_supplier_chop,
            has_sign_date: f.has_sign_date,
            total_amount: f.total_amount === Infinity ? null : f.total_amount,
          })),
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Step 4: Pick the lowest-price qualified file as the winner ────────────
    const winner = fullyQualified.reduce((best, f) =>
      f.total_amount < best.total_amount ? f : best
    );

    const now = new Date().toISOString();

    // ── Step 5: Persist selected vendor + clear others ────────────────────────
    const checklist_item_ids = [...new Set(
      files
        .map((f: { checklist_item_id: string | null }) => f.checklist_item_id)
        .filter(Boolean) as string[]
    )];

    for (const itemId of checklist_item_ids) {
      const itemFiles = files.filter(
        (f: { checklist_item_id: string | null }) => f.checklist_item_id === itemId
      );
      const winnerInGroup = itemFiles.find((f: { id: string }) => f.id === winner.id);
      const nonWinnerIds = itemFiles
        .filter((f: { id: string }) => f.id !== winner.id)
        .map((f: { id: string }) => f.id);

      if (winnerInGroup) {
        await supabase
          .from("project_checklist_files")
          .update({ is_selected_vendor: true, selected_vendor_at: now, selected_vendor_by: null })
          .eq("id", winner.id);

        if (nonWinnerIds.length > 0) {
          await supabase
            .from("project_checklist_files")
            .update({ is_selected_vendor: false, selected_vendor_at: null, selected_vendor_by: null })
            .in("id", nonWinnerIds);

          // Mark non-winner supplier sig/chop as N/A
          const { data: checksToNA } = await supabase
            .from("project_checklist_file_checks")
            .select("id")
            .in("file_id", nonWinnerIds)
            .in("description", [SUPPLIER_SIG_DESC, SUPPLIER_CHOP_DESC]);

          if (checksToNA && checksToNA.length > 0) {
            await supabase
              .from("project_checklist_file_checks")
              .update({ is_checked_by_ai: true, ai_result: VENDOR_NA_RESULT })
              .in("id", checksToNA.map((c: { id: string }) => c.id));
          }
        }
      }
    }

    // ── Step 6: 價低者得 price comparison checks ──────────────────────────────
    const winnerPrice = winner.total_amount === Infinity ? null : winner.total_amount;
    const winnerCurrency = winner.currency;
    const lowestPriceResults: Record<string, unknown>[] = [];

    if (winnerPrice !== null) {
      const nonWinnerFiles = qualifyingFiles.filter(f => f.id !== winner.id);

      // Prices of all other files that have a price (sorted descending for display)
      const otherPrices = nonWinnerFiles
        .map(f => f.total_amount === Infinity ? null : f.total_amount)
        .filter((p): p is number => p !== null)
        .sort((a, b) => b - a);

      // Selected vendor comment: "winnerPrice < otherPrice1, otherPrice2, ..."
      const winnerComment = otherPrices.length > 0
        ? `${formatPrice(winnerPrice, winnerCurrency)} < ${otherPrices.map(p => formatPrice(p, winnerCurrency)).join(", ")}`
        : formatPrice(winnerPrice, winnerCurrency);

      const { data: winnerChecks } = await supabase
        .from("project_checklist_file_checks")
        .select("id")
        .eq("file_id", winner.id)
        .eq("description", LOWEST_PRICE_DESC);

      if (winnerChecks && winnerChecks.length > 0) {
        const ids = winnerChecks.map((c: { id: string }) => c.id);
        await supabase
          .from("project_checklist_file_checks")
          .update({ is_checked: true, is_checked_by_ai: true, ai_result: winnerComment })
          .in("id", ids);
        lowestPriceResults.push({ file: winner.file_name, role: "selected", comment: winnerComment });
      }

      // Non-selected vendor comments: "theirPrice > winnerPrice"
      for (const nf of nonWinnerFiles) {
        const nfPrice = nf.total_amount === Infinity ? null : nf.total_amount;
        const nfComment = nfPrice !== null
          ? `${formatPrice(nfPrice, nf.currency ?? winnerCurrency)} > ${formatPrice(winnerPrice, winnerCurrency)}`
          : `N/A > ${formatPrice(winnerPrice, winnerCurrency)}`;

        const { data: nfChecks } = await supabase
          .from("project_checklist_file_checks")
          .select("id")
          .eq("file_id", nf.id)
          .eq("description", LOWEST_PRICE_DESC);

        if (nfChecks && nfChecks.length > 0) {
          const ids = nfChecks.map((c: { id: string }) => c.id);
          await supabase
            .from("project_checklist_file_checks")
            .update({ is_checked_by_ai: true, ai_result: nfComment })
            .in("id", ids);
          lowestPriceResults.push({ file: nf.file_name, role: "non-selected", comment: nfComment });
        }
      }
    }

    // ── Response ──────────────────────────────────────────────────────────────
    return new Response(
      JSON.stringify({
        success: true,
        selected_vendor_file_id: winner.id,
        selected_vendor_file_name: winner.file_name,
        selected_vendor_amount: winnerPrice,
        selected_vendor_sign_date: winner.sign_date,
        files_checked: files.length,
        qualifying_count: fullyQualified.length,
        lowest_price_checks_updated: lowestPriceResults.length,
        lowest_price_details: lowestPriceResults,
        qualifying_details: qualifyingFiles.map(f => ({
          file_id: f.id,
          file_name: f.file_name,
          has_supplier_sig: f.has_supplier_sig,
          has_supplier_chop: f.has_supplier_chop,
          has_sign_date: f.has_sign_date,
          total_amount: f.total_amount === Infinity ? null : f.total_amount,
          is_winner: f.id === winner.id,
        })),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("select-vendor-by-criteria error:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

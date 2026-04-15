import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// Check descriptions that qualify a vendor as "selected" (buyer has signed + chopped)
const BUYER_CHOP_DESC = "採購公司(BUD申請公司)的蓋印";
const BUYER_SIG_DESC = "採購公司(BUD申請公司)的簽名";
const SUPPLIER_SIG_DESC = "供應商簽名";
const SUPPLIER_CHOP_DESC = "供應商蓋印";
const VENDOR_NA_RESULT = "N/A - Non-Selected Vendor";

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

    // 1. Find all Quotation files in this folder for this project
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

    // 2. Load all file checks for these files
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

    // 3. Determine which files qualify: must have supplier signature + supplier chop + extracted sign_date
    const qualifyingFiles: Array<{
      id: string;
      checklist_item_id: string | null;
      total_amount: number;
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
        sign_date: signDate || null,
        file_name: file.file_name,
        has_buyer_sig: hasBuyerSig,
        has_buyer_chop: hasBuyerChop,
        has_supplier_sig: hasSupplierSig,
        has_supplier_chop: hasSupplierChop,
        has_sign_date: hasSignDate,
      });
    }

    // Filter: must have supplier signature + supplier chop + sign_date to qualify as potential winner
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

    // 4. Among qualifying, pick the one with the lowest price
    const winner = fullyQualified.reduce((best, f) =>
      f.total_amount < best.total_amount ? f : best
    );

    const now = new Date().toISOString();

    // 5. Update all files in this folder: set winner, clear others in same checklist_item_id groups
    const checklist_item_ids = [...new Set(files
      .map((f: { checklist_item_id: string | null }) => f.checklist_item_id)
      .filter(Boolean) as string[]
    )];

    for (const itemId of checklist_item_ids) {
      const itemFiles = files.filter((f: { checklist_item_id: string | null }) => f.checklist_item_id === itemId);
      const winnerInGroup = itemFiles.find((f: { id: string }) => f.id === winner.id);
      const nonWinnerIds = itemFiles
        .filter((f: { id: string }) => f.id !== winner.id)
        .map((f: { id: string }) => f.id);

      if (winnerInGroup) {
        // Set this file as selected vendor
        await supabase
          .from("project_checklist_files")
          .update({
            is_selected_vendor: true,
            selected_vendor_at: now,
            selected_vendor_by: null,
          })
          .eq("id", winner.id);

        // Clear other files in same group
        if (nonWinnerIds.length > 0) {
          await supabase
            .from("project_checklist_files")
            .update({
              is_selected_vendor: false,
              selected_vendor_at: null,
              selected_vendor_by: null,
            })
            .in("id", nonWinnerIds);

          // Mark non-winner supplier sig/chop checks as N/A
          const { data: checksToNA } = await supabase
            .from("project_checklist_file_checks")
            .select("id")
            .in("file_id", nonWinnerIds)
            .in("description", [SUPPLIER_SIG_DESC, SUPPLIER_CHOP_DESC]);

          if (checksToNA && checksToNA.length > 0) {
            await supabase
              .from("project_checklist_file_checks")
              .update({
                is_checked_by_ai: true,
                ai_result: VENDOR_NA_RESULT,
              })
              .in("id", checksToNA.map((c: { id: string }) => c.id));
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        selected_vendor_file_id: winner.id,
        selected_vendor_file_name: winner.file_name,
        selected_vendor_amount: winner.total_amount === Infinity ? null : winner.total_amount,
        selected_vendor_sign_date: winner.sign_date,
        files_checked: files.length,
        qualifying_count: fullyQualified.length,
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
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("select-vendor-by-criteria error:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const CHECK_DESCRIPTION = "價低者得";

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

    // Get all quotation files in this folder for this project
    const { data: allFiles, error: filesError } = await supabase
      .from("project_checklist_files")
      .select("id, is_selected_vendor, file_name, extracted_data, document_type")
      .eq("drive_folder_id", folder_id)
      .eq("project_id", project_id)
      .ilike("document_type", "Quotation%");

    if (filesError) throw filesError;

    if (!allFiles || allFiles.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No quotation files found in this folder", updated: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find the selected vendor
    const selectedFile = allFiles.find(
      (f: { is_selected_vendor: boolean }) => f.is_selected_vendor === true
    );

    if (!selectedFile) {
      return new Response(
        JSON.stringify({ success: true, message: "No selected vendor found in this folder", updated: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const selectedPrice: number | null =
      typeof selectedFile.extracted_data?.total_amount === "number"
        ? selectedFile.extracted_data.total_amount
        : null;

    const selectedCurrency: string | null =
      selectedFile.extracted_data?.currency ?? null;

    if (selectedPrice === null) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "Selected vendor has no extracted total_amount — cannot compare prices",
          updated: 0,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const nonSelectedFiles = allFiles.filter(
      (f: { id: string; is_selected_vendor: boolean }) => f.id !== selectedFile.id
    );

    // Verify selected vendor truly has the lowest price among all files that have a price
    const allPrices: number[] = nonSelectedFiles
      .map((f: { extracted_data?: { total_amount?: unknown } }) =>
        typeof f.extracted_data?.total_amount === "number" ? f.extracted_data.total_amount : null
      )
      .filter((p: number | null): p is number => p !== null);

    const isLowest = allPrices.every((p: number) => selectedPrice <= p);

    if (!isLowest) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "Selected vendor does NOT have the lowest price — no checks updated",
          selected_price: selectedPrice,
          other_prices: allPrices,
          updated: 0,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let totalUpdated = 0;
    const results: Record<string, unknown>[] = [];

    // --- Update selected vendor's 價低者得 check ---
    // Build comment: selected price > other prices (sorted desc)
    const otherPricesDesc = [...allPrices].sort((a, b) => b - a);
    const othersStr = otherPricesDesc
      .map((p) => formatPrice(p, selectedCurrency))
      .join(", ");
    const selectedComment = `${formatPrice(selectedPrice, selectedCurrency)} < ${othersStr}`;

    const { data: selectedChecks, error: selectedChecksError } = await supabase
      .from("project_checklist_file_checks")
      .select("id")
      .eq("file_id", selectedFile.id)
      .eq("description", CHECK_DESCRIPTION);

    if (selectedChecksError) throw selectedChecksError;

    if (selectedChecks && selectedChecks.length > 0) {
      const ids = selectedChecks.map((c: { id: string }) => c.id);
      const { error: updateErr } = await supabase
        .from("project_checklist_file_checks")
        .update({ is_checked_by_ai: true, ai_result: selectedComment })
        .in("id", ids);
      if (updateErr) throw updateErr;
      totalUpdated += ids.length;
      results.push({ file: selectedFile.file_name, role: "selected", comment: selectedComment, ids });
    }

    // --- Update each non-selected vendor's 價低者得 check ---
    for (const nf of nonSelectedFiles) {
      const nfPrice: number | null =
        typeof nf.extracted_data?.total_amount === "number"
          ? nf.extracted_data.total_amount
          : null;

      const nfCurrency: string | null = nf.extracted_data?.currency ?? null;

      // Comment: non-selected price > selected price
      const nfComment =
        nfPrice !== null
          ? `${formatPrice(nfPrice, nfCurrency ?? selectedCurrency)} > ${formatPrice(selectedPrice, selectedCurrency)}`
          : `N/A > ${formatPrice(selectedPrice, selectedCurrency)}`;

      const { data: nfChecks, error: nfChecksError } = await supabase
        .from("project_checklist_file_checks")
        .select("id")
        .eq("file_id", nf.id)
        .eq("description", CHECK_DESCRIPTION);

      if (nfChecksError) throw nfChecksError;

      if (nfChecks && nfChecks.length > 0) {
        const ids = nfChecks.map((c: { id: string }) => c.id);
        const { error: updateErr } = await supabase
          .from("project_checklist_file_checks")
          .update({ is_checked_by_ai: true, ai_result: nfComment })
          .in("id", ids);
        if (updateErr) throw updateErr;
        totalUpdated += ids.length;
        results.push({ file: nf.file_name, role: "non-selected", comment: nfComment, ids });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        selected_price: selectedPrice,
        is_lowest: true,
        total_updated: totalUpdated,
        details: results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("check-lowest-price-vendor error:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

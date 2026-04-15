import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const NA_DESCRIPTIONS = [
  "供應商簽名",
  "供應商蓋印",
  "採購公司(BUD申請公司)的蓋印",
  "採購公司(BUD申請公司)的簽名",
];

const QUOTATION_DATE_DESC = "確立報價日期(遲過所有報價的日期)";

const NA_RESULT = "N/A - Non-Selected Vendor";

function parseDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "N/A";
  const d = parseDate(dateStr);
  if (!d) return dateStr;
  return d.toLocaleDateString("zh-HK", { year: "numeric", month: "2-digit", day: "2-digit" });
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
      .select("id, is_selected_vendor, file_name, extracted_data")
      .eq("drive_folder_id", folder_id)
      .eq("project_id", project_id)
      .ilike("document_type", "Quotation%");

    if (filesError) throw filesError;

    if (!allFiles || allFiles.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No quotation files found in this folder", na_updated: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find the selected vendor file (is_selected_vendor = true)
    const selectedFile = allFiles.find((f: { is_selected_vendor: boolean }) => f.is_selected_vendor === true);

    if (!selectedFile) {
      return new Response(
        JSON.stringify({ success: true, message: "No selected vendor found in this folder", na_updated: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Non-selected vendor files
    const nonSelectedFiles = allFiles.filter(
      (f: { id: string; is_selected_vendor: boolean }) => f.id !== selectedFile.id
    );
    const nonSelectedFileIds = nonSelectedFiles.map((f: { id: string }) => f.id);

    const results: Record<string, unknown> = {
      selected_vendor_file_id: selectedFile.id,
      non_selected_count: nonSelectedFileIds.length,
      na_updated: 0,
      quotation_date_updated: 0,
    };

    // --- NA checks for non-selected vendor signature/chop fields ---
    if (nonSelectedFileIds.length > 0) {
      const { data: checksToNA, error: checksError } = await supabase
        .from("project_checklist_file_checks")
        .select("id")
        .in("file_id", nonSelectedFileIds)
        .in("description", NA_DESCRIPTIONS);

      if (checksError) throw checksError;

      if (checksToNA && checksToNA.length > 0) {
        const idsToUpdate = checksToNA.map((c: { id: string }) => c.id);

        const { error: updateError } = await supabase
          .from("project_checklist_file_checks")
          .update({ is_checked_by_ai: true, ai_result: NA_RESULT })
          .in("id", idsToUpdate);

        if (updateError) throw updateError;

        results.na_updated = idsToUpdate.length;
        results.na_ids = idsToUpdate;
      }
    }

    // --- 確立報價日期 flow ---
    // Collect all quotation dates from non-selected vendors
    const otherQuotationDates: Array<{ file_name: string; date: Date; raw: string }> = [];
    for (const f of nonSelectedFiles) {
      const raw = f.extracted_data?.quotation_date ?? null;
      const d = parseDate(raw);
      if (d) {
        otherQuotationDates.push({ file_name: f.file_name, date: d, raw });
      }
    }

    const selectedSignDateRaw = selectedFile.extracted_data?.sign_date ?? null;
    const selectedSignDate = parseDate(selectedSignDateRaw);

    // Build the list of other quotation dates for display in comment
    const otherDatesDisplay = otherQuotationDates
      .map((o) => `${formatDate(o.raw)} (${o.file_name})`)
      .join(", ");

    // --- Selected vendor: 確立報價日期 check ---
    const { data: selectedDateChecks, error: selDateErr } = await supabase
      .from("project_checklist_file_checks")
      .select("id")
      .eq("file_id", selectedFile.id)
      .eq("description", QUOTATION_DATE_DESC);

    if (selDateErr) throw selDateErr;

    if (selectedDateChecks && selectedDateChecks.length > 0) {
      const selDateIds = selectedDateChecks.map((c: { id: string }) => c.id);

      let selComment: string;
      let selChecked: boolean;

      if (
        selectedSignDate &&
        otherQuotationDates.length > 0 &&
        otherQuotationDates.every((o) => selectedSignDate > o.date)
      ) {
        // Sign date is after ALL other quotation dates — confirmed
        const otherDatesLine = otherQuotationDates.length > 0
          ? ` | Other quotation dates: ${otherDatesDisplay}`
          : "";
        selComment = `Confirmed: Signature date ${formatDate(selectedSignDateRaw)}${otherDatesLine}`;
        selChecked = true;
      } else if (selectedSignDate && otherQuotationDates.length === 0) {
        // No other dates to compare
        selComment = `Signature date: ${formatDate(selectedSignDateRaw)} | No other quotation dates available for comparison`;
        selChecked = false;
      } else if (!selectedSignDate) {
        selComment = `No signature date found on selected vendor${otherQuotationDates.length > 0 ? ` | Other quotation dates: ${otherDatesDisplay}` : ""}`;
        selChecked = false;
      } else {
        // Sign date is NOT after all other quotation dates
        const failingDates = otherQuotationDates
          .filter((o) => selectedSignDate <= o.date)
          .map((o) => `${formatDate(o.raw)} (${o.file_name})`)
          .join(", ");
        selComment = `Signature date ${formatDate(selectedSignDateRaw)} is NOT after: ${failingDates} | All other dates: ${otherDatesDisplay}`;
        selChecked = false;
      }

      const { error: selUpdateErr } = await supabase
        .from("project_checklist_file_checks")
        .update({ is_checked_by_ai: true, is_checked: selChecked, ai_result: selComment })
        .in("id", selDateIds);

      if (selUpdateErr) throw selUpdateErr;

      results.quotation_date_updated = (results.quotation_date_updated as number) + selDateIds.length;
      results.selected_vendor_date_confirmed = selChecked;
      results.selected_vendor_date_comment = selComment;
    }

    // --- Non-selected vendors: 確立報價日期 check → mark N/A ---
    if (nonSelectedFileIds.length > 0) {
      const { data: nonSelDateChecks, error: nonSelDateErr } = await supabase
        .from("project_checklist_file_checks")
        .select("id")
        .in("file_id", nonSelectedFileIds)
        .eq("description", QUOTATION_DATE_DESC);

      if (nonSelDateErr) throw nonSelDateErr;

      if (nonSelDateChecks && nonSelDateChecks.length > 0) {
        const nonSelDateIds = nonSelDateChecks.map((c: { id: string }) => c.id);

        const { error: nonSelUpdateErr } = await supabase
          .from("project_checklist_file_checks")
          .update({ is_checked_by_ai: true, ai_result: "Non-Selected vendor" })
          .in("id", nonSelDateIds);

        if (nonSelUpdateErr) throw nonSelUpdateErr;

        results.quotation_date_updated = (results.quotation_date_updated as number) + nonSelDateIds.length;
      }
    }

    return new Response(JSON.stringify({ success: true, ...results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("mark-vendor-signature-checks error:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

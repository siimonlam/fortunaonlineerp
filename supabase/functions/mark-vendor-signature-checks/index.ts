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

const NA_RESULT = "N/A - Non-Selected Vendor";

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
      .select("id, is_selected_vendor, file_name")
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

    // Non-selected vendor file ids
    const nonSelectedFileIds = allFiles
      .filter((f: { id: string; is_selected_vendor: boolean }) => f.id !== selectedFile.id)
      .map((f: { id: string }) => f.id);

    const results: Record<string, unknown> = {
      selected_vendor_file_id: selectedFile.id,
      non_selected_count: nonSelectedFileIds.length,
      na_updated: 0,
    };

    if (nonSelectedFileIds.length > 0) {
      // Find all matching checks on non-selected vendor files
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
          .update({
            is_checked_by_ai: true,
            ai_result: NA_RESULT,
          })
          .in("id", idsToUpdate);

        if (updateError) throw updateError;

        results.na_updated = idsToUpdate.length;
        results.na_ids = idsToUpdate;
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

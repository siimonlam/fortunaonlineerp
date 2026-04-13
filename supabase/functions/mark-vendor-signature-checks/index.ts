import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const VENDOR_DESCRIPTIONS = ["供應商簽名", "供應商蓋印"];
const QUOTATION_DOCUMENT = "Quotation 報價";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const { file_id, checklist_item_id } = body;

    if (!file_id || !checklist_item_id) {
      return new Response(
        JSON.stringify({ error: "file_id and checklist_item_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get all files for this checklist_item_id to find non-selected vendors
    const { data: allFiles, error: filesError } = await supabase
      .from("project_checklist_files")
      .select("id, is_selected_vendor")
      .eq("checklist_item_id", checklist_item_id);

    if (filesError) throw filesError;

    // Identify non-selected vendor file ids (all except the triggered file)
    const nonSelectedFileIds = (allFiles || [])
      .filter((f: { id: string; is_selected_vendor: boolean }) => f.id !== file_id)
      .map((f: { id: string }) => f.id);

    const results: Record<string, unknown> = {
      triggered_file_id: file_id,
      non_selected_count: nonSelectedFileIds.length,
      na_updated: 0,
    };

    if (nonSelectedFileIds.length > 0) {
      // Find 供應商簽名 and 供應商蓋印 checks for non-selected vendor files
      const { data: checksToNA, error: checksError } = await supabase
        .from("project_checklist_file_checks")
        .select("id")
        .in("file_id", nonSelectedFileIds)
        .eq("document_type", QUOTATION_DOCUMENT)
        .in("description", VENDOR_DESCRIPTIONS);

      if (checksError) throw checksError;

      if (checksToNA && checksToNA.length > 0) {
        const idsToUpdate = checksToNA.map((c: { id: string }) => c.id);

        const { error: updateError } = await supabase
          .from("project_checklist_file_checks")
          .update({
            is_checked_by_ai: true,
            ai_result: "N/A - Non-Selected Vendor",
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

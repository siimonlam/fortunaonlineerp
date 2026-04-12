import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const DATE_CHECK_DESCRIPTION = '日期(項目日期期間/早於)';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const body = await req.json();
    const { file_id, project_id, checklist_item_id } = body;

    if (!file_id && !project_id && !checklist_item_id) {
      return new Response(
        JSON.stringify({ error: 'file_id, checklist_item_id, or project_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let filesToCheck: Array<{
      id: string;
      project_id: string;
      document_type: string | null;
      extracted_data: Record<string, unknown> | null;
      checklist_item_id: string | null;
    }> = [];

    if (file_id) {
      const { data, error } = await supabase
        .from('project_checklist_files')
        .select('id, project_id, document_type, extracted_data, checklist_item_id')
        .eq('id', file_id)
        .maybeSingle();
      if (error) throw error;
      if (data) {
        // If file belongs to a checklist_item, expand to all files in that item
        if (data.checklist_item_id && data.document_type?.startsWith('Quotation')) {
          const { data: siblingFiles, error: sibErr } = await supabase
            .from('project_checklist_files')
            .select('id, project_id, document_type, extracted_data, checklist_item_id')
            .eq('checklist_item_id', data.checklist_item_id)
            .ilike('document_type', 'Quotation%');
          if (sibErr) throw sibErr;
          filesToCheck = siblingFiles || [];
        } else {
          filesToCheck = [data];
        }
      }
    } else if (checklist_item_id) {
      const { data, error } = await supabase
        .from('project_checklist_files')
        .select('id, project_id, document_type, extracted_data, checklist_item_id')
        .eq('checklist_item_id', checklist_item_id)
        .ilike('document_type', 'Quotation%');
      if (error) throw error;
      filesToCheck = data || [];
    } else {
      const { data, error } = await supabase
        .from('project_checklist_files')
        .select('id, project_id, document_type, extracted_data, checklist_item_id')
        .eq('project_id', project_id)
        .ilike('document_type', 'Quotation%');
      if (error) throw error;
      filesToCheck = data || [];
    }

    // Filter to only Quotation files with extracted quotation_date
    filesToCheck = filesToCheck.filter(
      f => f.document_type?.startsWith('Quotation') && f.extracted_data?.quotation_date
    );

    if (filesToCheck.length === 0) {
      return new Response(
        JSON.stringify({ success: true, processed: 0, message: 'No quotation files with extracted dates found' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Collect unique project IDs to fetch project dates
    const projectIds = [...new Set(filesToCheck.map(f => f.project_id))];
    const { data: projects, error: projErr } = await supabase
      .from('projects')
      .select('id, project_start_date, start_date, project_end_date')
      .in('id', projectIds);
    if (projErr) throw projErr;

    const projectMap: Record<string, {
      project_start_date: string | null;
      start_date: string | null;
      project_end_date: string | null;
    }> = {};
    for (const p of (projects || [])) {
      projectMap[p.id] = p;
    }

    let processed = 0;
    let updated = 0;

    for (const file of filesToCheck) {
      processed++;
      const proj = projectMap[file.project_id];
      if (!proj) continue;

      const effectiveStartDate = proj.project_start_date || proj.start_date;
      const effectiveEndDate = proj.project_end_date;

      if (!effectiveStartDate) continue;

      const quotationDateStr = file.extracted_data?.quotation_date as string;
      const quotationDate = new Date(quotationDateStr);
      if (isNaN(quotationDate.getTime())) continue;

      const startDate = new Date(effectiveStartDate);
      // Allow up to 1 month before project start date
      const allowedFrom = new Date(startDate);
      allowedFrom.setMonth(allowedFrom.getMonth() - 1);

      let endDate: Date | null = null;
      if (effectiveEndDate) {
        endDate = new Date(effectiveEndDate);
      }

      // Valid if: quotation date >= 1 month before start AND <= end date (if exists)
      const afterAllowedFrom = quotationDate >= allowedFrom;
      const beforeEndDate = endDate ? quotationDate <= endDate : true;
      const isValid = afterAllowedFrom && beforeEndDate;

      let aiResult = '';
      if (isValid) {
        aiResult = `Quotation date ${quotationDateStr} is within the valid period (from ${allowedFrom.toISOString().slice(0, 10)}${endDate ? ' to ' + effectiveEndDate : ''}).`;
      } else if (!afterAllowedFrom) {
        aiResult = `Quotation date ${quotationDateStr} is more than 1 month before the project start date (${effectiveStartDate}). Earliest allowed: ${allowedFrom.toISOString().slice(0, 10)}.`;
      } else if (!beforeEndDate) {
        aiResult = `Quotation date ${quotationDateStr} is after the project end date (${effectiveEndDate}).`;
      }

      // Find the date check row for this file
      const { data: checkRow, error: checkErr } = await supabase
        .from('project_checklist_file_checks')
        .select('id')
        .eq('file_id', file.id)
        .eq('description', DATE_CHECK_DESCRIPTION)
        .maybeSingle();

      if (checkErr) {
        console.error('Error finding check row:', checkErr);
        continue;
      }

      if (checkRow) {
        const { error: updateErr } = await supabase
          .from('project_checklist_file_checks')
          .update({
            is_checked_by_ai: isValid,
            ai_result: aiResult,
          })
          .eq('id', checkRow.id);
        if (updateErr) {
          console.error('Error updating check:', updateErr);
        } else {
          updated++;
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed,
        updated,
        message: `Processed ${processed} quotation files, updated ${updated} date checks`,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('check-quotation-dates error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

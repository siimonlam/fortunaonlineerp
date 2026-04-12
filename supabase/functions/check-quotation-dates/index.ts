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
        // Expand to all sibling quotation files in the same checklist item
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

    // Only process Quotation files (with or without extracted date — we still update "no date" cases)
    filesToCheck = filesToCheck.filter(f => f.document_type?.startsWith('Quotation'));

    if (filesToCheck.length === 0) {
      return new Response(
        JSON.stringify({ success: true, processed: 0, message: 'No quotation files found' }),
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
      const proj = projectMap[file.project_id];
      if (!proj) continue;

      const effectiveStartDate = proj.project_start_date || proj.start_date;
      const effectiveEndDate = proj.project_end_date;

      // Find the date check row for this file — must exist to update
      const { data: checkRow, error: checkErr } = await supabase
        .from('project_checklist_file_checks')
        .select('id')
        .eq('file_id', file.id)
        .eq('description', DATE_CHECK_DESCRIPTION)
        .maybeSingle();

      if (checkErr) {
        console.error('Error finding check row for file', file.id, checkErr);
        continue;
      }

      if (!checkRow) continue;

      processed++;

      // Case 1: project has no start date — cannot validate
      if (!effectiveStartDate) {
        const { error: updateErr } = await supabase
          .from('project_checklist_file_checks')
          .update({
            is_checked_by_ai: false,
            ai_result: '無法核對：項目未設定開始日期。請在項目資料中填寫項目開始日期後，系統將自動重新核對。(Cannot validate: project start date is not set. Set the project start date and the check will re-run automatically.)',
          })
          .eq('id', checkRow.id);
        if (!updateErr) updated++;
        continue;
      }

      const quotationDateStr = file.extracted_data?.quotation_date as string | undefined;

      // Case 2: file has no extracted quotation date
      if (!quotationDateStr) {
        const { error: updateErr } = await supabase
          .from('project_checklist_file_checks')
          .update({
            is_checked_by_ai: false,
            ai_result: '無法核對：未能從文件中提取報價日期。請確認文件含有清晰的報價日期，或手動核對。(Cannot validate: quotation date could not be extracted from the document.)',
          })
          .eq('id', checkRow.id);
        if (!updateErr) updated++;
        continue;
      }

      const quotationDate = new Date(quotationDateStr);
      if (isNaN(quotationDate.getTime())) {
        const { error: updateErr } = await supabase
          .from('project_checklist_file_checks')
          .update({
            is_checked_by_ai: false,
            ai_result: `無法核對：報價日期格式無效 (${quotationDateStr})。(Cannot validate: extracted quotation date has invalid format.)`,
          })
          .eq('id', checkRow.id);
        if (!updateErr) updated++;
        continue;
      }

      const startDate = new Date(effectiveStartDate);
      // Allow up to 1 month before project start date
      const allowedFrom = new Date(startDate);
      allowedFrom.setMonth(allowedFrom.getMonth() - 1);

      let endDate: Date | null = null;
      if (effectiveEndDate) {
        endDate = new Date(effectiveEndDate);
      }

      // Valid if: quotation date >= 1 month before start AND (no end date OR <= end date)
      const afterAllowedFrom = quotationDate >= allowedFrom;
      const beforeEndDate = endDate ? quotationDate <= endDate : true;
      const isValid = afterAllowedFrom && beforeEndDate;

      const fmtDate = (d: Date) => d.toISOString().slice(0, 10);

      let aiResult = '';
      if (isValid) {
        const windowEnd = endDate ? ` 至 ${effectiveEndDate}` : '（無指定結束日期）';
        aiResult = `合格：報價日期 ${quotationDateStr} 符合項目期間要求。有效範圍：${fmtDate(allowedFrom)}${windowEnd}。(Valid: quotation date ${quotationDateStr} is within the allowed window [from ${fmtDate(allowedFrom)}${endDate ? ' to ' + effectiveEndDate : ''}].)`;
      } else if (!afterAllowedFrom) {
        aiResult = `不合格：報價日期 ${quotationDateStr} 早於項目開始日期超過一個月。項目開始日期：${effectiveStartDate}，最早允許日期：${fmtDate(allowedFrom)}。(Invalid: quotation date is more than 1 month before the project start date ${effectiveStartDate}. Earliest allowed: ${fmtDate(allowedFrom)}.)`;
      } else {
        aiResult = `不合格：報價日期 ${quotationDateStr} 晚於項目結束日期 ${effectiveEndDate}。(Invalid: quotation date is after the project end date ${effectiveEndDate}.)`;
      }

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

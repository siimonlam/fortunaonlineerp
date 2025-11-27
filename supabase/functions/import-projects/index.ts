import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface CSVRow {
  title?: string;
  description?: string;
  status_id?: string;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
  project_type_id?: string;
  client_id?: string;
  company_name?: string;
  contact_name?: string;
  contact_number?: string;
  email?: string;
  address?: string;
  sales_source?: string;
  upload_link?: string;
  source_client_id?: string;
  start_date?: string;
  sales_person_id?: string;
  attachment?: string;
  deposit_paid?: string;
  deposit_amount?: string;
  project_name?: string;
  service_fee_percentage?: string;
  whatsapp_group_id?: string;
  invoice_number?: string;
  agreement_ref?: string;
  abbreviation?: string;
  project_size?: string;
  project_start_date?: string;
  project_end_date?: string;
  submission_date?: string;
  application_number?: string;
  approval_date?: string;
  next_hkpc_due_date?: string;
  next_due_date?: string;
  project_reference?: string;
  company_name_chinese?: string;
  google_drive_folder_id?: string;
  funding_scheme?: string;
  brand_name?: string;
  agreement_sign_date?: string;
  hkpc_officer_name?: string;
  hkpc_officer_email?: string;
  hkpc_officer_phone?: string;
  parent_client_id?: string;
  parent_company_name?: string;
  client_number?: string;
}

function parseBoolean(value?: string): boolean {
  if (!value) return false;
  const str = String(value).toUpperCase();
  return str === 'TRUE' || str === '1' || str === 'YES';
}

function parseNumber(value?: string): number | null {
  if (!value) return null;
  const str = String(value).replace(/[$,]/g, '');
  const num = parseFloat(str);
  return isNaN(num) ? null : num;
}

function parseDate(value?: string): string | null {
  if (!value || value === '') return null;
  const date = new Date(value);
  return isNaN(date.getTime()) ? null : date.toISOString();
}

function cleanString(value?: string): string | null {
  if (!value || value === '') return null;
  return String(value).trim();
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { projects } = await req.json() as { projects: CSVRow[] };

    if (!projects || !Array.isArray(projects)) {
      return new Response(
        JSON.stringify({ error: "Invalid request. Expected 'projects' array." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const results = {
      total: projects.length,
      successful: 0,
      failed: 0,
      errors: [] as any[],
    };

    for (let i = 0; i < projects.length; i++) {
      const row = projects[i];

      try {
        const projectData: any = {
          title: cleanString(row.title) || `Project ${i + 1}`,
          description: cleanString(row.description),
          status_id: cleanString(row.status_id),
          created_by: cleanString(row.created_by),
          project_type_id: cleanString(row.project_type_id),
          client_id: cleanString(row.client_id),
          company_name: cleanString(row.company_name),
          contact_name: cleanString(row.contact_name),
          contact_number: cleanString(row.contact_number),
          email: cleanString(row.email),
          address: cleanString(row.address),
          sales_source: cleanString(row.sales_source),
          upload_link: cleanString(row.upload_link),
          source_client_id: cleanString(row.source_client_id),
          start_date: parseDate(row.start_date),
          sales_person_id: cleanString(row.sales_person_id),
          attachment: cleanString(row.attachment),
          deposit_paid: parseBoolean(row.deposit_paid),
          deposit_amount: parseNumber(row.deposit_amount),
          project_name: cleanString(row.project_name),
          service_fee_percentage: parseNumber(row.service_fee_percentage),
          whatsapp_group_id: cleanString(row.whatsapp_group_id),
          invoice_number: cleanString(row.invoice_number),
          agreement_ref: cleanString(row.agreement_ref),
          abbreviation: cleanString(row.abbreviation),
          project_size: cleanString(row.project_size),
          project_start_date: parseDate(row.project_start_date),
          project_end_date: parseDate(row.project_end_date),
          submission_date: parseDate(row.submission_date),
          application_number: cleanString(row.application_number),
          approval_date: parseDate(row.approval_date),
          next_hkpc_due_date: parseDate(row.next_hkpc_due_date),
          next_due_date: parseDate(row.next_due_date),
          project_reference: cleanString(row.project_reference),
          company_name_chinese: cleanString(row.company_name_chinese),
          google_drive_folder_id: cleanString(row.google_drive_folder_id),
          funding_scheme: cleanString(row.funding_scheme),
          brand_name: cleanString(row.brand_name),
          agreement_sign_date: parseDate(row.agreement_sign_date),
          hkpc_officer_name: cleanString(row.hkpc_officer_name),
          hkpc_officer_email: cleanString(row.hkpc_officer_email),
          hkpc_officer_phone: cleanString(row.hkpc_officer_phone),
          parent_client_id: cleanString(row.parent_client_id),
          parent_company_name: cleanString(row.parent_company_name),
          client_number: cleanString(row.client_number),
        };

        if (row.created_at) {
          projectData.created_at = parseDate(row.created_at);
        }
        if (row.updated_at) {
          projectData.updated_at = parseDate(row.updated_at);
        }

        const { error } = await supabase
          .from("projects")
          .insert(projectData);

        if (error) throw error;

        results.successful++;
      } catch (error) {
        results.failed++;
        results.errors.push({
          row: i + 1,
          title: row.title,
          error: error.message,
        });
      }
    }

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import { parse } from 'csv-parse/sync';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Helper to parse boolean values
function parseBoolean(value) {
  if (!value) return false;
  const str = String(value).toUpperCase();
  return str === 'TRUE' || str === '1' || str === 'YES';
}

// Helper to parse numbers
function parseNumber(value) {
  if (!value) return null;
  const str = String(value).replace(/[$,]/g, '');
  const num = parseFloat(str);
  return isNaN(num) ? null : num;
}

// Helper to parse dates
function parseDate(value) {
  if (!value || value === '') return null;
  const date = new Date(value);
  return isNaN(date.getTime()) ? null : date.toISOString();
}

// Helper to clean string values
function cleanString(value) {
  if (!value || value === '') return null;
  return String(value).trim();
}

async function importProjects() {
  try {
    console.log('Reading CSV file...');
    const csvContent = fs.readFileSync('./projects_rows_upload.csv', 'utf-8');

    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });

    console.log(`Found ${records.length} projects to import`);

    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    for (const [index, row] of records.entries()) {
      try {
        const projectNumber = index + 1;
        console.log(`\nProcessing project ${projectNumber}/${records.length}: ${row.title || 'Untitled'}`);

        // Map CSV columns to database columns
        const projectData = {
          title: cleanString(row.title) || `Project ${projectNumber}`,
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
          client_number: cleanString(row.client_number)
        };

        // Override created_at and updated_at if provided
        if (row.created_at) {
          projectData.created_at = parseDate(row.created_at);
        }
        if (row.updated_at) {
          projectData.updated_at = parseDate(row.updated_at);
        }

        // Insert project
        const { data, error } = await supabase
          .from('projects')
          .insert(projectData)
          .select()
          .single();

        if (error) {
          throw error;
        }

        console.log(`✓ Successfully imported: ${projectData.title}`);
        successCount++;

      } catch (err) {
        console.error(`✗ Error importing project ${projectNumber}:`, err.message);
        errors.push({
          row: projectNumber,
          title: row.title,
          error: err.message
        });
        errorCount++;
      }
    }

    console.log('\n=== Import Summary ===');
    console.log(`Total projects: ${records.length}`);
    console.log(`Successfully imported: ${successCount}`);
    console.log(`Failed: ${errorCount}`);

    if (errors.length > 0) {
      console.log('\n=== Errors ===');
      errors.forEach(err => {
        console.log(`Row ${err.row} (${err.title}): ${err.error}`);
      });
    }

  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

importProjects();

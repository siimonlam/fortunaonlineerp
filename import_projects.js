const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
require('dotenv').config();
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

// Excel file parsing using a simple approach
// Since this is a one-time import, we'll use a library
const XLSX = require('xlsx');

async function importProjects() {
  console.log('Starting project import...');

  // Read the Excel file
  const workbook = XLSX.readFile('projects_rows_upload.xlsx');
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  // Convert to JSON
  const data = XLSX.utils.sheet_to_json(worksheet);

  console.log(`Found ${data.length} projects to import`);

  // Get default values for required fields
  const { data: projectTypes } = await supabase
    .from('project_types')
    .select('id, name');

  const { data: statuses } = await supabase
    .from('statuses')
    .select('id, name, project_type_id');

  const { data: users } = await supabase.auth.admin.listUsers();
  const defaultUserId = users.users[0]?.id;

  if (!defaultUserId) {
    throw new Error('No users found. Please create a user first.');
  }

  console.log('Default user ID:', defaultUserId);

  let successCount = 0;
  let errorCount = 0;
  const errors = [];

  // Import in batches of 50 to avoid timeouts
  const batchSize = 50;
  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize);
    console.log(`Processing batch ${Math.floor(i / batchSize) + 1} (${batch.length} projects)...`);

    for (const row of batch) {
      try {
        // Map Excel columns to database fields
        const projectData = {
          title: row.title || '',
          description: row.description || null,
          status_id: row.status_id || statuses[0]?.id,
          project_type_id: row.project_type_id || projectTypes.find(pt => pt.name === 'Funding Project')?.id,
          created_by: row.created_by || defaultUserId,
          client_id: row.client_id || null,
          company_name: row.company_name || null,
          company_name_chinese: row.company_name_chinese || null,
          contact_name: row.contact_name || null,
          contact_number: row.contact_number || null,
          email: row.email || null,
          address: row.address || null,
          sales_source: row.sales_source || null,
          upload_link: row.upload_link || null,
          start_date: row.start_date || null,
          sales_person_id: row.sales_person_id || null,
          attachment: row.attachment || null,
          deposit_paid: row.deposit_paid || false,
          deposit_amount: row.deposit_amount || null,
          project_name: row.project_name || null,
          service_fee_percentage: row.service_fee_percentage || null,
          whatsapp_group_id: row.whatsapp_group_id || null,
          invoice_number: row.invoice_number || null,
          agreement_ref: row.agreement_ref || null,
          abbreviation: row.abbreviation || null,
          project_size: row.project_size || null,
          project_start_date: row.project_start_date || null,
          project_end_date: row.project_end_date || null,
          submission_date: row.submission_date || null,
          application_number: row.application_number || null,
          approval_date: row.approval_date || null,
          next_hkpc_due_date: row.next_hkpc_due_date || null,
          next_due_date: row.next_due_date || null,
          project_reference: row.project_reference || null,
          google_drive_folder_id: row.google_drive_folder_id || null,
          funding_scheme: row.funding_scheme || 25,
          brand_name: row.brand_name || null,
          agreement_sign_date: row.agreement_sign_date || null,
          hkpc_officer_name: row.hkpc_officer_name || null,
          hkpc_officer_email: row.hkpc_officer_email || null,
          hkpc_officer_phone: row.hkpc_officer_phone || null,
          parent_client_id: row.parent_client_id || null,
          parent_company_name: row.parent_company_name || null,
          client_number: row.client_number || null
        };

        const { error } = await supabase
          .from('projects')
          .insert(projectData);

        if (error) {
          throw error;
        }

        successCount++;
      } catch (error) {
        errorCount++;
        errors.push({
          row: i + successCount + errorCount,
          data: row,
          error: error.message
        });
        console.error(`Error importing row ${i + successCount + errorCount}:`, error.message);
      }
    }
  }

  console.log('\n=== Import Summary ===');
  console.log(`Total projects: ${data.length}`);
  console.log(`Successfully imported: ${successCount}`);
  console.log(`Failed: ${errorCount}`);

  if (errors.length > 0) {
    console.log('\nErrors:');
    errors.forEach(err => {
      console.log(`Row ${err.row}: ${err.error}`);
    });

    // Save errors to file
    fs.writeFileSync('import_errors.json', JSON.stringify(errors, null, 2));
    console.log('\nDetailed errors saved to import_errors.json');
  }

  console.log('\nImport completed!');
}

// Run the import
importProjects().catch(console.error);

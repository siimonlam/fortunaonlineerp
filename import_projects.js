import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import XLSX from 'xlsx';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Initialize Supabase client
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function importProjects() {
  console.log('Starting project import...');

  // Read the Excel file
  const workbook = XLSX.readFile('projects_rows_upload.xlsx');
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  // Convert to JSON
  const data = XLSX.utils.sheet_to_json(worksheet);

  console.log(`Found ${data.length} projects to import`);

  // Show first row to understand column names
  if (data.length > 0) {
    console.log('\nExcel columns found:', Object.keys(data[0]).join(', '));
    console.log('\nFirst row sample:');
    console.log(JSON.stringify(data[0], null, 2));
  }

  // Get default values for required fields
  const { data: projectTypes } = await supabase
    .from('project_types')
    .select('id, type_name');

  const { data: statuses } = await supabase
    .from('project_status')
    .select('id, name, project_type_id')
    .limit(1);

  // Get current authenticated user
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('No authenticated user. Please log in first.');
  }

  console.log('Importing as user:', user.email);
  console.log('Default status:', statuses?.[0]?.name);
  console.log('Available project types:', projectTypes?.map(pt => pt.type_name).join(', '));

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
        // NOTE: Adjust these column names based on your actual Excel columns
        const projectData = {
          // Required fields
          status_id: statuses[0]?.id,
          created_by: user.id,

          // Try multiple possible column name variations
          title: row.title || row.Title || row.PROJECT_NAME || row['Project Name'] || `Project ${i + successCount + errorCount + 1}`,
          description: row.description || row.Description || row.DESCRIPTION || null,
          project_type_id: projectTypes?.find(pt => pt.type_name === 'Funding Project')?.id || projectTypes?.[0]?.id,

          // Company info
          company_name: row.company_name || row['Company Name'] || row.COMPANY_NAME || null,
          company_name_chinese: row.company_name_chinese || row['Company Name Chinese'] || row['公司名稱'] || null,
          contact_name: row.contact_name || row['Contact Name'] || row.CONTACT_NAME || null,
          contact_number: row.contact_number || row['Contact Number'] || row.CONTACT_NUMBER || null,
          email: row.email || row.Email || row.EMAIL || null,
          address: row.address || row.Address || row.ADDRESS || null,

          // Project details
          project_name: row.project_name || row['Project Name'] || row.PROJECT_NAME || null,
          project_reference: row.project_reference || row['Project Reference'] || row.PROJECT_REFERENCE || null,
          abbreviation: row.abbreviation || row.Abbreviation || row.ABBREVIATION || null,
          project_size: row.project_size || row['Project Size'] || row.PROJECT_SIZE || null,
          brand_name: row.brand_name || row['Brand Name'] || row.BRAND_NAME || null,

          // Dates (Excel dates might need conversion)
          start_date: row.start_date || row['Start Date'] || row.START_DATE || null,
          project_start_date: row.project_start_date || row['Project Start Date'] || row.PROJECT_START_DATE || null,
          project_end_date: row.project_end_date || row['Project End Date'] || row.PROJECT_END_DATE || null,
          submission_date: row.submission_date || row['Submission Date'] || row.SUBMISSION_DATE || null,
          approval_date: row.approval_date || row['Approval Date'] || row.APPROVAL_DATE || null,
          next_hkpc_due_date: row.next_hkpc_due_date || row['Next HKPC Due Date'] || row.NEXT_HKPC_DUE_DATE || null,
          next_due_date: row.next_due_date || row['Next Due Date'] || row.NEXT_DUE_DATE || null,
          agreement_sign_date: row.agreement_sign_date || row['Agreement Sign Date'] || row.AGREEMENT_SIGN_DATE || null,

          // Financial
          deposit_paid: row.deposit_paid === true || row.deposit_paid === 'Yes' || row.deposit_paid === 'TRUE' || false,
          deposit_amount: row.deposit_amount || row['Deposit Amount'] || row.DEPOSIT_AMOUNT || null,
          service_fee_percentage: row.service_fee_percentage || row['Service Fee %'] || row.SERVICE_FEE_PERCENTAGE || null,
          funding_scheme: row.funding_scheme || row['Funding Scheme'] || row.FUNDING_SCHEME || 25,

          // References
          sales_source: row.sales_source || row['Sales Source'] || row.SALES_SOURCE || null,
          application_number: row.application_number || row['Application Number'] || row.APPLICATION_NUMBER || null,
          invoice_number: row.invoice_number || row['Invoice Number'] || row.INVOICE_NUMBER || null,
          agreement_ref: row.agreement_ref || row['Agreement Ref'] || row.AGREEMENT_REF || null,

          // HKPC Officer
          hkpc_officer_name: row.hkpc_officer_name || row['HKPC Officer Name'] || row.HKPC_OFFICER_NAME || null,
          hkpc_officer_email: row.hkpc_officer_email || row['HKPC Officer Email'] || row.HKPC_OFFICER_EMAIL || null,
          hkpc_officer_phone: row.hkpc_officer_phone || row['HKPC Officer Phone'] || row.HKPC_OFFICER_PHONE || null,

          // Links
          upload_link: row.upload_link || row['Upload Link'] || row.UPLOAD_LINK || null,
          attachment: row.attachment || row.Attachment || row.ATTACHMENT || null,
          whatsapp_group_id: row.whatsapp_group_id || row['WhatsApp Group'] || row.WHATSAPP_GROUP_ID || null,
          google_drive_folder_id: row.google_drive_folder_id || row['Google Drive Folder'] || row.GOOGLE_DRIVE_FOLDER_ID || null,

          // Parent company
          parent_client_id: row.parent_client_id || row['Parent Client ID'] || row.PARENT_CLIENT_ID || null,
          parent_company_name: row.parent_company_name || row['Parent Company Name'] || row.PARENT_COMPANY_NAME || null,

          // Client number
          client_number: row.client_number || row['Client Number'] || row.CLIENT_NUMBER || null,
        };

        // Remove undefined/null fields to avoid inserting empty strings
        Object.keys(projectData).forEach(key => {
          if (projectData[key] === null || projectData[key] === undefined || projectData[key] === '') {
            delete projectData[key];
          }
        });

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

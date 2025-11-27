import fs from 'fs';
import { parse } from 'csv-parse/sync';

console.log('=== CSV Import Preview ===\n');

try {
  const csvContent = fs.readFileSync('./projects_rows_upload.csv', 'utf-8');

  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  });

  console.log(`Total projects in CSV: ${records.length}\n`);

  // Show first 5 projects
  console.log('First 5 projects:');
  records.slice(0, 5).forEach((row, index) => {
    console.log(`\n${index + 1}. ${row.title || 'Untitled'}`);
    console.log(`   Company: ${row.company_name || 'N/A'}`);
    console.log(`   Project Reference: ${row.project_reference || 'N/A'}`);
    console.log(`   Project Name: ${row.project_name || 'N/A'}`);
    console.log(`   Deposit Paid: ${row.deposit_paid || 'N/A'}`);
    console.log(`   Client Number: ${row.client_number || 'N/A'}`);
  });

  // Show statistics
  console.log('\n\n=== Statistics ===');

  const withDepositPaid = records.filter(r => r.deposit_paid?.toUpperCase() === 'TRUE').length;
  const withProjectReference = records.filter(r => r.project_reference).length;
  const withClientNumber = records.filter(r => r.client_number).length;
  const withCompanyName = records.filter(r => r.company_name).length;

  console.log(`Projects with deposit paid: ${withDepositPaid}`);
  console.log(`Projects with reference number: ${withProjectReference}`);
  console.log(`Projects with client number: ${withClientNumber}`);
  console.log(`Projects with company name: ${withCompanyName}`);

  // Check for required fields
  console.log('\n=== Data Validation ===');
  const missingTitle = records.filter(r => !r.title).length;
  const missingStatusId = records.filter(r => !r.status_id).length;
  const missingCreatedBy = records.filter(r => !r.created_by).length;
  const missingProjectTypeId = records.filter(r => !r.project_type_id).length;

  console.log(`Records missing title: ${missingTitle}`);
  console.log(`Records missing status_id: ${missingStatusId}`);
  console.log(`Records missing created_by: ${missingCreatedBy}`);
  console.log(`Records missing project_type_id: ${missingProjectTypeId}`);

  if (missingTitle > 0 || missingStatusId > 0 || missingCreatedBy > 0 || missingProjectTypeId > 0) {
    console.log('\n⚠️  Warning: Some records are missing required fields!');
  } else {
    console.log('\n✓ All records have required fields');
  }

  console.log('\n=== Ready to Import ===');
  console.log('Run: npm run import:projects');

} catch (error) {
  console.error('Error reading CSV:', error.message);
}

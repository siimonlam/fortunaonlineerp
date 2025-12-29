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

// Helper to clean string values
function cleanString(value) {
  if (!value || value === '') return null;
  return String(value).trim();
}

async function updateProjectsSales() {
  try {
    console.log('Reading CSV file...');
    const csvContent = fs.readFileSync('./projects_rows_upload.csv', 'utf-8');

    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });

    console.log(`Found ${records.length} projects to update`);

    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;
    const errors = [];

    for (const [index, row] of records.entries()) {
      try {
        const projectNumber = index + 1;
        const projectId = cleanString(row.id);

        if (!projectId) {
          console.log(`⊘ Skipping row ${projectNumber}: No ID provided`);
          skippedCount++;
          continue;
        }

        console.log(`\nProcessing project ${projectNumber}/${records.length}: ID ${projectId}`);

        // Build update data - only include fields that are present in the CSV
        const updateData = {};

        if (row.sales_source !== undefined) {
          updateData.sales_source = cleanString(row.sales_source);
        }

        if (row.sales_person_id !== undefined) {
          updateData.sales_person_id = cleanString(row.sales_person_id);
        }

        // Check if there's anything to update
        if (Object.keys(updateData).length === 0) {
          console.log(`⊘ Skipping project ${projectId}: No sales_source or sales_person_id provided`);
          skippedCount++;
          continue;
        }

        // Update project
        const { data, error } = await supabase
          .from('projects')
          .update(updateData)
          .eq('id', projectId)
          .select('id, title')
          .single();

        if (error) {
          throw error;
        }

        if (!data) {
          console.log(`⊘ Project ${projectId} not found in database`);
          skippedCount++;
          continue;
        }

        console.log(`✓ Successfully updated: ${data.title || data.id}`);
        console.log(`  Updated fields: ${Object.keys(updateData).join(', ')}`);
        successCount++;

      } catch (err) {
        console.error(`✗ Error updating project ${projectNumber}:`, err.message);
        errors.push({
          row: projectNumber,
          id: row.id,
          error: err.message
        });
        errorCount++;
      }
    }

    console.log('\n=== Update Summary ===');
    console.log(`Total records: ${records.length}`);
    console.log(`Successfully updated: ${successCount}`);
    console.log(`Skipped: ${skippedCount}`);
    console.log(`Failed: ${errorCount}`);

    if (errors.length > 0) {
      console.log('\n=== Errors ===');
      errors.forEach(err => {
        console.log(`Row ${err.row} (ID: ${err.id}): ${err.error}`);
      });
    }

  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

updateProjectsSales();

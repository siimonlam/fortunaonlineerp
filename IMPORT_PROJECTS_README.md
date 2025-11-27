# Project CSV Import Guide

This guide explains how to import your 429 projects from the CSV file into your Supabase database.

## Prerequisites

1. Your CSV file named `projects_rows_upload.csv` should be in the project root directory
2. Your `.env` file must contain valid Supabase credentials:
   ```
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

## Installation

First, install the required dependency:

```bash
npm install
```

This will install the `csv-parse` package needed for parsing the CSV file.

## Running the Import

Simply run:

```bash
npm run import:projects
```

This will:
1. Read the `projects_rows_upload.csv` file
2. Parse each row and map it to your database schema
3. Insert each project into the `projects` table
4. Display progress and results

## What the Script Does

The import script (`import_projects_from_csv.js`):

- **Parses CSV data** correctly, handling quotes and commas
- **Cleans and validates** all data fields:
  - Converts TRUE/FALSE strings to booleans
  - Parses currency values (removes $ and commas)
  - Converts date strings to ISO format
  - Trims whitespace from text fields
  - Handles empty values as NULL

- **Maps CSV columns** to database columns:
  - All standard project fields
  - Custom funding-related fields
  - Client information
  - Dates and timestamps
  - Financial data

- **Provides detailed feedback**:
  - Shows progress for each project
  - Reports successful imports
  - Lists any errors with details
  - Displays a summary at the end

## Expected Output

You'll see output like:

```
Reading CSV file...
Found 429 projects to import

Processing project 1/429: Famkools - BUD-CN
✓ Successfully imported: Famkools - BUD-CN

Processing project 2/429: Cheerful Luck Limited - BUD-CN
✓ Successfully imported: Cheerful Luck Limited - BUD-CN

...

=== Import Summary ===
Total projects: 429
Successfully imported: 429
Failed: 0
```

## Troubleshooting

### If you see errors:

1. **Authentication errors**: Check your `.env` file has correct Supabase credentials

2. **Permission errors**: Ensure your Supabase user has INSERT permissions on the projects table

3. **Foreign key errors**: Make sure referenced IDs (status_id, project_type_id, etc.) exist in their respective tables

4. **Data validation errors**: The script will show which field caused the error

### Common Issues

**Missing required fields**: The script will show which fields are required but missing

**Invalid UUIDs**: Status IDs and other UUID fields must be valid UUIDs from your database

**Date format issues**: Dates should be in a standard format (YYYY-MM-DD or similar)

## Data Mapping

The CSV columns are mapped as follows:

| CSV Column | Database Column | Type | Notes |
|------------|----------------|------|-------|
| title | title | text | Project title |
| status_id | status_id | uuid | Must exist in statuses table |
| created_by | created_by | uuid | User UUID |
| project_type_id | project_type_id | uuid | Must exist in project_types table |
| client_id | client_id | uuid | Optional client reference |
| company_name | company_name | text | Company name |
| deposit_paid | deposit_paid | boolean | TRUE/FALSE |
| deposit_amount | deposit_amount | numeric | Currency values cleaned |
| project_start_date | project_start_date | date | ISO date format |
| ... | ... | ... | (and many more fields) |

## After Import

After successful import:

1. **Verify the data** in your Supabase dashboard
2. **Check project counts** match expected 429 projects
3. **Review any failed imports** and fix data issues
4. **Re-run for failed rows** if needed

## Notes

- The script processes projects **one at a time** to provide clear error messages
- Existing projects won't be updated (inserts only)
- The CSV file should remain in the project root directory
- All timestamps are preserved from the CSV if provided
- Empty values become NULL in the database

## Need Help?

If you encounter issues:
1. Check the error messages - they indicate which field caused the problem
2. Verify your CSV file format matches the expected columns
3. Ensure all referenced IDs (UUIDs) exist in your database
4. Check Supabase Row Level Security (RLS) policies aren't blocking inserts

# Project Import Guide

This guide will help you import 429 projects from your Excel file into the Supabase database.

## Prerequisites

1. ✅ Excel file: `projects_rows_upload.xlsx` (already provided)
2. ✅ Node.js installed
3. ✅ Dependencies installed (`npm install`)
4. ✅ `.env` file with Supabase credentials
5. ⚠️ **You must be logged in** to the application before running the import

## Steps to Import

### 1. Place the Excel File

Save your `projects_rows_upload.xlsx` file in the project root directory:
```bash
/tmp/cc-agent/58876889/project/projects_rows_upload.xlsx
```

### 2. Install Dependencies

The `xlsx` package is already installed, but if needed:
```bash
npm install xlsx dotenv
```

### 3. Log In to the Application

**IMPORTANT:** Before running the import, you MUST:
1. Open your application in a browser
2. Log in with your credentials
3. The script will use your authenticated session to import projects

### 4. Run the Import Script

```bash
node import_projects.js
```

## What the Script Does

1. **Reads the Excel file** - Parses all 429 rows
2. **Shows column names** - Displays detected Excel columns to verify mapping
3. **Gets default values** - Fetches available project types and statuses
4. **Imports in batches** - Processes 50 projects at a time to avoid timeouts
5. **Maps columns** - Intelligently maps Excel columns to database fields
6. **Handles errors** - Logs any failed imports and continues processing
7. **Saves error log** - Creates `import_errors.json` if any imports fail

## Expected Output

```
Starting project import...
Found 429 projects to import

Excel columns found: title, company_name, project_name, ...

First row sample:
{
  "title": "...",
  "company_name": "...",
  ...
}

Importing as user: your-email@example.com
Default status: Pending
Available project types: Funding Project, Marketing, ...

Processing batch 1 (50 projects)...
Processing batch 2 (50 projects)...
...

=== Import Summary ===
Total projects: 429
Successfully imported: 429
Failed: 0

Import completed!
```

## Column Mapping

The script automatically detects and maps these column names (case-insensitive):

| Excel Column | Database Field |
|-------------|----------------|
| Title / title / PROJECT_NAME | title |
| Company Name / company_name | company_name |
| 公司名稱 | company_name_chinese |
| Contact Name / contact_name | contact_name |
| Email / email | email |
| Project Name / project_name | project_name |
| Start Date / start_date | start_date |
| Deposit Paid / deposit_paid | deposit_paid |
| ... | ... |

The script tries multiple variations of column names to ensure compatibility.

## Troubleshooting

### Error: "No authenticated user"
**Solution:** Log in to the application in your browser before running the script.

### Error: "No status found in database"
**Solution:** Ensure you have at least one status in the `project_status` table.

### Error: "ENOENT: no such file or directory"
**Solution:** Make sure `projects_rows_upload.xlsx` is in the project root directory.

### Some projects failed to import
**Solution:** Check `import_errors.json` for detailed error messages for each failed row.

## After Import

1. **Verify in database:**
   ```sql
   SELECT COUNT(*) FROM projects;
   ```

2. **Check imported projects in the app:**
   - Open your application
   - Navigate to the Projects page
   - You should see all 429 projects

3. **Review errors (if any):**
   - Open `import_errors.json`
   - Fix issues in the Excel file
   - Re-run the import script for failed rows only

## Tips

- The script processes 50 projects at a time to avoid timeouts
- All required fields (status_id, created_by) are automatically filled
- Dates are imported as-is from Excel (ensure they're in correct format)
- Empty cells in Excel will be stored as NULL in the database
- The `client_number` field will be automatically synced if `client_id` is provided

## Need Help?

If you encounter issues:
1. Check the console output for error messages
2. Review `import_errors.json` for specific row errors
3. Verify your Excel file has the expected column names
4. Ensure you're logged in to the application

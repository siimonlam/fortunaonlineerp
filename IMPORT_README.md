# Project Import Guide

This guide explains how to import your 429 projects into Supabase. Two methods are available: **Cloud-Based** (no files needed) and **Local** (CSV file on computer).

---

## 🌐 Method 1: Cloud-Based Import (Recommended)

**Perfect for you since you don't have files on your computer!**

A Supabase Edge Function has been deployed that accepts your project data via HTTP request and imports it directly into your database.

### How to Use

#### Step 1: Prepare Your Data as JSON

Convert your CSV to JSON format. Each project should look like this:

```json
{
  "projects": [
    {
      "title": "Famkools - BUD-CN",
      "company_name": "Famkools",
      "status_id": "47638168-85d2-45dc-b4f5-b79a6a07215f",
      "created_by": "140bc2ca-95bb-496a-8891-93d32e856766",
      "project_type_id": "49c17e80-db14-4e13-b03f-537771270696",
      "deposit_paid": "TRUE",
      "deposit_amount": "20000",
      "project_reference": "FP00100",
      "client_number": "C0341"
    }
  ]
}
```

#### Step 2: Call the Edge Function

**Option A: Browser JavaScript Console**

1. Open your browser's developer console (F12)
2. Paste and run this code:

```javascript
const projects = [
  // Paste your project data here
];

fetch('${import.meta.env.VITE_SUPABASE_URL}/functions/v1/import-projects', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ projects })
})
.then(r => r.json())
.then(result => {
  console.log('Import complete!');
  console.log(`Successful: ${result.successful}`);
  console.log(`Failed: ${result.failed}`);
  if (result.errors.length > 0) {
    console.log('Errors:', result.errors);
  }
});
```

**Option B: Using curl (if you have a terminal)**

```bash
curl -X POST \
  'YOUR_SUPABASE_URL/functions/v1/import-projects' \
  -H 'Content-Type: application/json' \
  -d @projects.json
```

**Option C: Online API Tool (Postman, Insomnia, etc.)**

1. Create POST request to: `YOUR_SUPABASE_URL/functions/v1/import-projects`
2. Set header: `Content-Type: application/json`
3. Paste JSON body with your projects
4. Send request

#### Step 3: View Results

The function returns:

```json
{
  "total": 429,
  "successful": 429,
  "failed": 0,
  "errors": []
}
```

### Converting CSV to JSON

**Online Tools:**
- https://csvjson.com/csv2json
- https://www.convertcsv.com/csv-to-json.htm

Simply upload your CSV and it will convert to JSON for you!

---

## 💻 Method 2: Local Import (CSV File)

If you have the CSV file on your computer, use this method.

## Prerequisites

1. ✅ CSV file: `projects_rows_upload.csv` in project root
2. ✅ Node.js installed
3. ✅ Dependencies installed (`npm install`)
4. ✅ `.env` file with Supabase credentials

## Steps to Import

### 1. Place the CSV File

Save your `projects_rows_upload.csv` file in the project root directory.

### 2. Run the Import Script

```bash
npm run import:projects
```

Or preview first:

```bash
npm run preview:import
```

## What the Script Does

1. **Reads the CSV file** - Parses all 429 rows
2. **Cleans data** - Converts booleans, numbers, dates to proper formats
3. **Maps columns** - Maps all CSV columns to database fields
4. **Imports one by one** - Processes each project with detailed feedback
5. **Handles errors** - Shows which rows failed and why
6. **Provides summary** - Total, successful, and failed counts

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

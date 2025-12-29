# Update Projects Sales Information

This script allows you to update the `sales_source` and `sales_person_id` fields for existing projects in the database.

## CSV Format

Your CSV file should have the following columns:

- `id` (required): The UUID of the project to update
- `sales_source` (optional): The sales source to set
- `sales_person_id` (optional): The sales person ID to set

Example CSV:

```csv
id,sales_source,sales_person_id
725b94bf-98ec-46d1-a8a9-0967e3d37723,Referral,user-123-abc
8a2c3d4e-5f6g-7h8i-9j0k-1l2m3n4o5p6q,Website,user-456-def
```

## How to Use

1. Prepare your CSV file with the columns: `id`, `sales_source`, `sales_person_id`
2. Save it as `projects_rows_upload.csv` in the project root
3. Run the update script:

```bash
npm run update:sales
```

## What It Does

- Reads the CSV file
- For each row with a valid ID, updates the matching project in the database
- Only updates the fields provided in the CSV (sales_source and/or sales_person_id)
- Skips rows without an ID
- Shows a summary of successful updates, skipped rows, and errors

## Notes

- This script UPDATES existing projects, it does not create new ones
- If a project ID doesn't exist in the database, it will be skipped
- You can provide just `sales_source`, just `sales_person_id`, or both
- Empty values will set the field to NULL

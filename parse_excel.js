import XLSX from 'xlsx';
import fs from 'fs';

// Read the Excel file from the attachment
const workbook = XLSX.readFile('/tmp/tmp.AJWxJWEZU8/projects_rows_upload.xlsx');
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];

// Convert to JSON
const data = XLSX.utils.sheet_to_json(worksheet);

console.log(`Found ${data.length} rows in the Excel file`);
console.log('Sample row:', JSON.stringify(data[0], null, 2));

// Generate SQL statements
let sqlStatements = [];

data.forEach((row, index) => {
  // Map Excel columns to database fields
  const project = {
    title: row['公司名稱'] || row['Company Name'] || null,
    project_name: row['項目名稱'] || row['Project Name'] || null,
    client_id: row['客戶編號'] || row['Client Number'] || null,
    status: row['狀態'] || row['Status'] || null,
    project_type: row['項目類型'] || row['Project Type'] || null,
    // Add more field mappings as needed
  };

  // Create INSERT statement
  const values = [];
  const fields = [];

  Object.keys(project).forEach(key => {
    if (project[key] !== null && project[key] !== undefined) {
      fields.push(key);
      values.push(`'${String(project[key]).replace(/'/g, "''")}'`);
    }
  });

  if (fields.length > 0) {
    const sql = `INSERT INTO projects (${fields.join(', ')}) VALUES (${values.join(', ')});`;
    sqlStatements.push(sql);
  }
});

// Save to file
fs.writeFileSync('/tmp/cc-agent/58876889/project/import_projects.sql', sqlStatements.join('\n'));
console.log(`\nGenerated ${sqlStatements.length} SQL statements`);
console.log('Saved to import_projects.sql');

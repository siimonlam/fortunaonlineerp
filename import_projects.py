#!/usr/bin/env python3
import openpyxl
import requests
import json
import os
from datetime import datetime
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

SUPABASE_URL = os.getenv('VITE_SUPABASE_URL')
SUPABASE_ANON_KEY = os.getenv('VITE_SUPABASE_ANON_KEY')

def parse_excel(filename):
    """Parse Excel file and return rows as list of dictionaries"""
    print(f"Reading Excel file: {filename}")
    workbook = openpyxl.load_workbook(filename, data_only=True)
    sheet = workbook.active

    # Get headers from first row
    headers = []
    for cell in sheet[1]:
        headers.append(cell.value)

    print(f"Found {len(headers)} columns: {', '.join(headers[:5])}...")

    # Get data rows
    data = []
    for row_idx, row in enumerate(sheet.iter_rows(min_row=2, values_only=True), start=2):
        row_dict = {}
        for i, value in enumerate(row):
            if i < len(headers) and headers[i]:
                # Convert datetime objects to ISO string
                if isinstance(value, datetime):
                    row_dict[headers[i]] = value.isoformat()
                else:
                    row_dict[headers[i]] = value
        data.append(row_dict)

    print(f"Parsed {len(data)} rows")
    return data

def get_supabase_data(table, select='*'):
    """Fetch data from Supabase"""
    headers = {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': f'Bearer {SUPABASE_ANON_KEY}',
        'Content-Type': 'application/json'
    }

    url = f"{SUPABASE_URL}/rest/v1/{table}?select={select}"
    response = requests.get(url, headers=headers)
    response.raise_for_status()
    return response.json()

def insert_project(project_data):
    """Insert a single project into Supabase"""
    headers = {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': f'Bearer {SUPABASE_ANON_KEY}',
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
    }

    url = f"{SUPABASE_URL}/rest/v1/projects"
    response = requests.post(url, headers=headers, json=project_data)
    return response

def import_projects(excel_file):
    """Main import function"""
    print("Starting project import...")

    # Parse Excel
    rows = parse_excel(excel_file)

    print("\nImporting projects to Supabase...")
    success_count = 0
    error_count = 0
    errors = []

    for idx, row in enumerate(rows, start=1):
        try:
            # Clean up the data - remove None values and empty strings for optional fields
            cleaned_row = {}
            for key, value in row.items():
                if value is not None and value != '':
                    cleaned_row[key] = value

            response = insert_project(cleaned_row)

            if response.status_code in [200, 201]:
                success_count += 1
                if idx % 50 == 0:
                    print(f"Progress: {idx}/{len(rows)} projects processed...")
            else:
                error_count += 1
                error_msg = response.text
                errors.append({
                    'row': idx,
                    'error': error_msg,
                    'data': cleaned_row
                })
                print(f"Error on row {idx}: {error_msg[:100]}")

        except Exception as e:
            error_count += 1
            errors.append({
                'row': idx,
                'error': str(e),
                'data': row
            })
            print(f"Exception on row {idx}: {str(e)}")

    # Print summary
    print("\n" + "="*50)
    print("IMPORT SUMMARY")
    print("="*50)
    print(f"Total rows: {len(rows)}")
    print(f"Successfully imported: {success_count}")
    print(f"Failed: {error_count}")

    if errors:
        print(f"\nSaving {len(errors)} errors to import_errors.json...")
        with open('import_errors.json', 'w') as f:
            json.dump(errors, f, indent=2)
        print("Error details saved!")

    print("\nImport completed!")
    return success_count, error_count

if __name__ == '__main__':
    import sys

    filename = 'projects_rows_upload.xlsx'
    if len(sys.argv) > 1:
        filename = sys.argv[1]

    try:
        success, errors = import_projects(filename)
        sys.exit(0 if errors == 0 else 1)
    except Exception as e:
        print(f"Fatal error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

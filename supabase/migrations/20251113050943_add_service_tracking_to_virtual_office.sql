/*
  # Add service tracking fields to virtual_office table

  1. Changes
    - Add `company_code` field to store the company code
    - Add `company_name` field to store the company name
    - Add `service_name` field to store the service name
    - Add `service_description` field to store the service description
    - Add `invoice_number` field to link to the invoice
    - Add `service_id` field to reference the master service

  2. Purpose
    - Track individual services from invoices in the virtual_office table
    - Allow linking between invoices and virtual office services
    - Store complete service information for reporting
*/

-- Add new columns to virtual_office table
ALTER TABLE virtual_office
  ADD COLUMN IF NOT EXISTS company_code text,
  ADD COLUMN IF NOT EXISTS company_name text,
  ADD COLUMN IF NOT EXISTS service_name text,
  ADD COLUMN IF NOT EXISTS service_description text,
  ADD COLUMN IF NOT EXISTS invoice_number text,
  ADD COLUMN IF NOT EXISTS service_id uuid REFERENCES comsec_services(id);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_virtual_office_invoice_number ON virtual_office(invoice_number);
CREATE INDEX IF NOT EXISTS idx_virtual_office_service_id ON virtual_office(service_id);
CREATE INDEX IF NOT EXISTS idx_virtual_office_company_code ON virtual_office(company_code);
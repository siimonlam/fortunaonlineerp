/*
  # Migrate Service Subscriptions to Invoices

  1. Changes
    - Add service-related fields to comsec_invoices table
    - Migrate data from comsec_client_service_subscriptions to comsec_invoices
    - Drop the comsec_client_service_subscriptions table

  2. New Fields in comsec_invoices
    - service_id (uuid, references comsec_services)
    - company_code (text)
    - service_date (date) - for one-time services
    - start_date (date) - for recurring services
    - end_date (date) - for recurring services

  3. Important Notes
    - Existing invoices without service links remain unchanged
    - Service subscription data is preserved in comsec_invoices
    - payment_date field maps to paid_date from subscriptions
*/

-- Add service-related fields to comsec_invoices
ALTER TABLE comsec_invoices
ADD COLUMN IF NOT EXISTS service_id uuid REFERENCES comsec_services(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS company_code text,
ADD COLUMN IF NOT EXISTS service_date date,
ADD COLUMN IF NOT EXISTS start_date date,
ADD COLUMN IF NOT EXISTS end_date date;

-- Create indexes for new fields
CREATE INDEX IF NOT EXISTS idx_comsec_invoices_service ON comsec_invoices(service_id);
CREATE INDEX IF NOT EXISTS idx_comsec_invoices_company_code ON comsec_invoices(company_code);

-- Migrate data from comsec_client_service_subscriptions to comsec_invoices
-- Only migrate records that have an invoice_number and don't already exist in comsec_invoices
INSERT INTO comsec_invoices (
  comsec_client_id,
  invoice_number,
  service_id,
  company_code,
  service_date,
  start_date,
  end_date,
  issue_date,
  due_date,
  amount,
  status,
  description,
  payment_date,
  payment_method,
  remarks,
  created_by,
  created_at,
  updated_at
)
SELECT
  sub.comsec_client_id,
  COALESCE(sub.invoice_number, 'SVC-' || SUBSTRING(sub.id::text FROM 1 FOR 8)) as invoice_number,
  sub.service_id,
  sub.company_code,
  sub.service_date,
  sub.start_date,
  sub.end_date,
  COALESCE(sub.start_date, sub.service_date, sub.created_at::date) as issue_date,
  COALESCE(sub.end_date, sub.start_date, sub.service_date, sub.created_at::date) as due_date,
  0 as amount,
  CASE
    WHEN sub.is_paid THEN 'Paid'
    ELSE 'Draft'
  END as status,
  svc.service_name as description,
  sub.paid_date as payment_date,
  NULL as payment_method,
  sub.remarks,
  sub.created_by,
  sub.created_at,
  sub.updated_at
FROM comsec_client_service_subscriptions sub
JOIN comsec_services svc ON svc.id = sub.service_id
WHERE NOT EXISTS (
  SELECT 1
  FROM comsec_invoices inv
  WHERE inv.invoice_number = COALESCE(sub.invoice_number, 'SVC-' || SUBSTRING(sub.id::text FROM 1 FOR 8))
    AND inv.comsec_client_id = sub.comsec_client_id
)
ON CONFLICT DO NOTHING;

-- Drop the old table and related objects
DROP TRIGGER IF EXISTS update_comsec_subscriptions_updated_at ON comsec_client_service_subscriptions;
DROP FUNCTION IF EXISTS update_comsec_subscriptions_updated_at();
DROP TABLE IF EXISTS comsec_client_service_subscriptions CASCADE;

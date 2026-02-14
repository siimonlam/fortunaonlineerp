/*
  # Fix Existing Service Statuses
  
  1. Updates
    - Set all services to correct status based on invoice payment
    - Remove duplicate services
    - Clean up services without valid invoices
  
  2. Status Logic
    - Invoice unpaid → status 'pending'
    - Invoice paid → status 'active'
    - End date passed → status 'inactive'
    - No invoice or draft → delete service
*/

-- First, remove duplicate services (keep the most recent one per invoice_number)
DELETE FROM virtual_office
WHERE id IN (
  SELECT id FROM (
    SELECT id, 
           ROW_NUMBER() OVER (PARTITION BY invoice_number ORDER BY created_at DESC, start_date DESC NULLS LAST) as rn
    FROM virtual_office
  ) t
  WHERE rn > 1
);

-- Delete services that have no invoice or draft invoice (no PDF)
DELETE FROM virtual_office vo
WHERE NOT EXISTS (
  SELECT 1 FROM comsec_invoices ci
  WHERE ci.invoice_number = vo.invoice_number
    AND ci.pdf_url IS NOT NULL
    AND ci.pdf_url != ''
);

-- Update all remaining services to correct status based on invoice payment
UPDATE virtual_office vo
SET 
  status = CASE
    -- If end date has passed, set to inactive
    WHEN vo.end_date IS NOT NULL AND vo.end_date < CURRENT_DATE THEN 'inactive'
    -- If invoice is paid, set to active
    WHEN ci.status = 'paid' THEN 'active'
    -- Otherwise set to pending (unpaid)
    ELSE 'pending'
  END,
  updated_at = NOW()
FROM comsec_invoices ci
WHERE ci.invoice_number = vo.invoice_number;

-- Add a check constraint to ensure status values are lowercase
ALTER TABLE virtual_office DROP CONSTRAINT IF EXISTS virtual_office_status_check;
ALTER TABLE virtual_office 
  ADD CONSTRAINT virtual_office_status_check 
  CHECK (status IN ('active', 'inactive', 'pending'));

COMMENT ON CONSTRAINT virtual_office_status_check ON virtual_office IS 'Ensure status is lowercase: active, inactive, or pending';

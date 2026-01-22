/*
  # Add Receivable Calculation Function

  1. New Functions
    - `calculate_project_receivable(project_id uuid)` - Calculates the receivable amount for a project
      - Formula: (Project Size × Funding Scheme % × Service Fee %) - Total Paid Invoices

  2. Purpose
    - Provides a reusable way to calculate receivable amounts across the application
    - Used by project cards and list views to display receivable information
*/

-- Create function to calculate project receivable
CREATE OR REPLACE FUNCTION calculate_project_receivable(p_project_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_project_size numeric;
  v_funding_scheme numeric;
  v_service_fee numeric;
  v_total_paid numeric;
  v_receivable numeric;
BEGIN
  -- Get project details
  SELECT
    COALESCE(CAST(project_size AS numeric), 0),
    COALESCE(funding_scheme, 0),
    COALESCE(service_fee_percentage, 0)
  INTO
    v_project_size,
    v_funding_scheme,
    v_service_fee
  FROM projects
  WHERE id = p_project_id;

  -- If project not found, return 0
  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  -- Calculate total paid invoices
  SELECT COALESCE(SUM(CAST(amount AS numeric)), 0)
  INTO v_total_paid
  FROM funding_invoice
  WHERE project_id = p_project_id
    AND payment_status = 'Paid';

  -- Calculate receivable: (Project Size × Funding Scheme % × Service Fee %) - Total Paid Invoices
  v_receivable := (v_project_size * v_funding_scheme / 100 * v_service_fee / 100) - v_total_paid;

  RETURN v_receivable;
END;
$$;
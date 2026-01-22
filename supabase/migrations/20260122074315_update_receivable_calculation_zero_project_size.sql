/*
  # Update Receivable Calculation Function

  1. Changes
    - Update `calculate_project_receivable()` function to return 0 when project_size is 0
    - Prevents negative receivables when there's no project size
*/

-- Update function to return 0 when project size is 0
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

  -- If project size is 0, return 0
  IF v_project_size = 0 THEN
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
/*
  # Update Receivable Calculation Function

  1. Changes
    - Update `calculate_project_receivable()` function to consider `all_balance_settled` flag
    - If `all_balance_settled` is true, return 0
    - If `granted_amount` is set, use: (Granted Amount × Service Fee %) - Total Paid
    - Otherwise use: (Project Size × Funding Scheme % × Service Fee %) - Total Paid
  
  2. Purpose
    - Allow manual override to mark project balance as fully settled
    - Support granted amount calculation for more accurate receivables
*/

CREATE OR REPLACE FUNCTION calculate_project_receivable(p_project_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_all_balance_settled boolean;
  v_project_size numeric;
  v_funding_scheme numeric;
  v_service_fee numeric;
  v_granted_amount numeric;
  v_total_paid numeric;
  v_receivable numeric;
BEGIN
  -- Get project details
  SELECT
    COALESCE(all_balance_settled, false),
    COALESCE(CAST(project_size AS numeric), 0),
    COALESCE(funding_scheme, 0),
    COALESCE(service_fee_percentage, 0),
    COALESCE(CAST(granted_amount AS numeric), 0)
  INTO
    v_all_balance_settled,
    v_project_size,
    v_funding_scheme,
    v_service_fee,
    v_granted_amount
  FROM projects
  WHERE id = p_project_id;

  -- If project not found, return 0
  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  -- If all balance settled flag is true, return 0
  IF v_all_balance_settled THEN
    RETURN 0;
  END IF;

  -- Calculate total paid invoices
  SELECT COALESCE(SUM(CAST(amount AS numeric)), 0)
  INTO v_total_paid
  FROM funding_invoice
  WHERE project_id = p_project_id
    AND payment_status = 'Paid';

  -- Calculate receivable based on whether granted_amount is set
  IF v_granted_amount > 0 THEN
    -- If Granted Amount is set: (Granted Amount × Service Fee %) - Total Paid
    v_receivable := (v_granted_amount * v_service_fee / 100) - v_total_paid;
  ELSE
    -- If project size is 0, return 0
    IF v_project_size = 0 THEN
      RETURN 0;
    END IF;
    
    -- Otherwise: (Project Size × Funding Scheme % × Service Fee %) - Total Paid
    v_receivable := (v_project_size * v_funding_scheme / 100 * v_service_fee / 100) - v_total_paid;
  END IF;

  RETURN v_receivable;
END;
$$;

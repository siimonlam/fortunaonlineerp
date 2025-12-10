/*
  # Add Finance Permissions to Invoice RLS Policies

  1. Changes
    - Drop existing UPDATE and DELETE policies for funding_invoice
    - Recreate them with finance_permissions checks added
    
  2. Purpose
    - Allow users with finance permissions to update/delete invoices
    - This enables mark paid, void, and delete actions for finance users
    
  3. Security
    - Users can update/delete invoices if they have:
      - Project access (creator, sales person, project permissions, admin), OR
      - Finance permissions
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can update invoices for projects they have access" ON funding_invoice;
DROP POLICY IF EXISTS "Users can delete invoices for projects they have access" ON funding_invoice;

-- Recreate UPDATE policy with finance permissions
CREATE POLICY "Users can update invoices for projects they have access"
  ON funding_invoice
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = funding_invoice.project_id
      AND (
        p.created_by = auth.uid()
        OR p.sales_person_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM project_permissions pp
          WHERE pp.project_id = p.id
          AND pp.user_id = auth.uid()
          AND pp.can_edit = true
        )
        OR EXISTS (
          SELECT 1 FROM user_roles ur
          WHERE ur.user_id = auth.uid()
          AND ur.role = 'admin'
        )
      )
    )
    OR EXISTS (
      SELECT 1 FROM finance_permissions fp
      WHERE fp.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = funding_invoice.project_id
      AND (
        p.created_by = auth.uid()
        OR p.sales_person_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM project_permissions pp
          WHERE pp.project_id = p.id
          AND pp.user_id = auth.uid()
          AND pp.can_edit = true
        )
        OR EXISTS (
          SELECT 1 FROM user_roles ur
          WHERE ur.user_id = auth.uid()
          AND ur.role = 'admin'
        )
      )
    )
    OR EXISTS (
      SELECT 1 FROM finance_permissions fp
      WHERE fp.user_id = auth.uid()
    )
  );

-- Recreate DELETE policy with finance permissions
CREATE POLICY "Users can delete invoices for projects they have access"
  ON funding_invoice
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = funding_invoice.project_id
      AND EXISTS (
        SELECT 1 FROM user_roles ur
        WHERE ur.user_id = auth.uid()
        AND ur.role = 'admin'
      )
    )
    OR EXISTS (
      SELECT 1 FROM finance_permissions fp
      WHERE fp.user_id = auth.uid()
    )
  );

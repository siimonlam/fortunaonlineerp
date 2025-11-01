/*
  # Add Automatic Project History Tracking

  1. Purpose
    - Automatically track all changes to project fields
    - Record old and new values with user and timestamp
    
  2. Changes
    - Create trigger function to compare OLD and NEW values
    - Add trigger on projects table for UPDATE operations
    - Track all relevant project fields
    
  3. Implementation
    - Function iterates through changed fields
    - Inserts history record for each changed field
    - Uses auth.uid() to identify the user making changes
*/

-- Create function to track project changes
CREATE OR REPLACE FUNCTION track_project_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  changed_fields TEXT[] := ARRAY[
    'title', 'description', 'status_id', 'project_type_id', 'client_id',
    'company_name', 'contact_name', 'contact_number', 'email', 'address',
    'sales_source', 'sales_person_id', 'project_name', 'abbreviation',
    'application_number', 'project_size', 'agreement_ref', 'invoice_number',
    'whatsapp_group_id', 'upload_link', 'attachment', 'deposit_paid',
    'deposit_amount', 'service_fee_percentage', 'start_date',
    'project_start_date', 'project_end_date', 'submission_date',
    'approval_date', 'next_due_date', 'next_hkpc_due_date'
  ];
  field_name TEXT;
  old_val TEXT;
  new_val TEXT;
BEGIN
  -- Only track changes on UPDATE
  IF (TG_OP = 'UPDATE') THEN
    -- Loop through each field we want to track
    FOREACH field_name IN ARRAY changed_fields
    LOOP
      -- Get old and new values as text for comparison
      EXECUTE format('SELECT ($1).%I::TEXT', field_name) INTO old_val USING OLD;
      EXECUTE format('SELECT ($1).%I::TEXT', field_name) INTO new_val USING NEW;
      
      -- If the field changed, insert a history record
      IF old_val IS DISTINCT FROM new_val THEN
        INSERT INTO project_history (
          project_id,
          user_id,
          field_name,
          old_value,
          new_value,
          changed_at
        ) VALUES (
          NEW.id,
          auth.uid(),
          field_name,
          old_val,
          new_val,
          now()
        );
      END IF;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Drop trigger if it exists
DROP TRIGGER IF EXISTS track_project_changes_trigger ON projects;

-- Create trigger on projects table
CREATE TRIGGER track_project_changes_trigger
AFTER UPDATE ON projects
FOR EACH ROW
EXECUTE FUNCTION track_project_changes();

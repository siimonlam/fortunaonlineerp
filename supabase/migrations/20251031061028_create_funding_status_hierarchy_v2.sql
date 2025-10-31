/*
  # Create Funding Project Status Hierarchy

  1. Status Structure
    Main Statuses (order 1-4):
    - Hi-Po (order 1)
    - Presubmission (order 2)
    - Q&A (order 3) with sub-statuses:
      - Q&A
      - 已上委員會
      - Q&A-EMF
    - Final Report (order 4) with sub-statuses:
      - Approved
      - Final Report
      - Conditional Approval
      - Final Report-Q&A
      - Extension/Change Request
      - Final Report-Final Stage
      - Withdraw
      - Rejected
      - Ended

  2. Migration Strategy
    - Update existing main statuses with proper order
    - Create sub-statuses under Q&A and Final Report
    - Move existing projects to appropriate sub-statuses
*/

DO $$
DECLARE
  funding_project_type_id uuid;
  old_hipo_id uuid;
  old_presubmission_id uuid;
  old_qa_id uuid;
  old_final_report_id uuid;
  new_qa_substatus_id uuid;
  new_final_report_substatus_id uuid;
BEGIN
  -- Get Funding Project type ID
  SELECT id INTO funding_project_type_id 
  FROM project_types 
  WHERE name = 'Funding Project';

  IF funding_project_type_id IS NULL THEN
    RAISE NOTICE 'Funding Project type not found';
    RETURN;
  END IF;

  -- Get existing status IDs
  SELECT id INTO old_hipo_id FROM statuses WHERE name = 'Hi-Po' AND project_type_id = funding_project_type_id AND parent_status_id IS NULL;
  SELECT id INTO old_presubmission_id FROM statuses WHERE name = 'Presubmission' AND project_type_id = funding_project_type_id AND parent_status_id IS NULL;
  SELECT id INTO old_qa_id FROM statuses WHERE name = 'Q&A' AND project_type_id = funding_project_type_id AND parent_status_id IS NULL;
  SELECT id INTO old_final_report_id FROM statuses WHERE name = 'Final Report' AND project_type_id = funding_project_type_id AND parent_status_id IS NULL;

  -- Update existing main statuses with proper ordering
  IF old_hipo_id IS NOT NULL THEN
    UPDATE statuses SET order_index = 1, is_substatus = false WHERE id = old_hipo_id;
  END IF;
  
  IF old_presubmission_id IS NOT NULL THEN
    UPDATE statuses SET order_index = 2, is_substatus = false WHERE id = old_presubmission_id;
  END IF;
  
  IF old_qa_id IS NOT NULL THEN
    UPDATE statuses SET order_index = 3, is_substatus = false WHERE id = old_qa_id;
  END IF;
  
  IF old_final_report_id IS NOT NULL THEN
    UPDATE statuses SET order_index = 4, is_substatus = false WHERE id = old_final_report_id;
  END IF;

  -- Create Q&A sub-statuses if they don't exist
  IF old_qa_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM statuses WHERE name = 'Q&A' AND parent_status_id = old_qa_id) THEN
      INSERT INTO statuses (name, project_type_id, parent_status_id, order_index, is_substatus)
      VALUES ('Q&A', funding_project_type_id, old_qa_id, 1, true)
      RETURNING id INTO new_qa_substatus_id;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM statuses WHERE name = '已上委員會' AND parent_status_id = old_qa_id) THEN
      INSERT INTO statuses (name, project_type_id, parent_status_id, order_index, is_substatus)
      VALUES ('已上委員會', funding_project_type_id, old_qa_id, 2, true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM statuses WHERE name = 'Q&A-EMF' AND parent_status_id = old_qa_id) THEN
      INSERT INTO statuses (name, project_type_id, parent_status_id, order_index, is_substatus)
      VALUES ('Q&A-EMF', funding_project_type_id, old_qa_id, 3, true);
    END IF;
  END IF;

  -- Create Final Report sub-statuses if they don't exist
  IF old_final_report_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM statuses WHERE name = 'Approved' AND parent_status_id = old_final_report_id) THEN
      INSERT INTO statuses (name, project_type_id, parent_status_id, order_index, is_substatus)
      VALUES ('Approved', funding_project_type_id, old_final_report_id, 1, true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM statuses WHERE name = 'Final Report' AND parent_status_id = old_final_report_id) THEN
      INSERT INTO statuses (name, project_type_id, parent_status_id, order_index, is_substatus)
      VALUES ('Final Report', funding_project_type_id, old_final_report_id, 2, true)
      RETURNING id INTO new_final_report_substatus_id;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM statuses WHERE name = 'Conditional Approval' AND parent_status_id = old_final_report_id) THEN
      INSERT INTO statuses (name, project_type_id, parent_status_id, order_index, is_substatus)
      VALUES ('Conditional Approval', funding_project_type_id, old_final_report_id, 3, true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM statuses WHERE name = 'Final Report-Q&A' AND parent_status_id = old_final_report_id) THEN
      INSERT INTO statuses (name, project_type_id, parent_status_id, order_index, is_substatus)
      VALUES ('Final Report-Q&A', funding_project_type_id, old_final_report_id, 4, true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM statuses WHERE name = 'Extension/Change Request' AND parent_status_id = old_final_report_id) THEN
      INSERT INTO statuses (name, project_type_id, parent_status_id, order_index, is_substatus)
      VALUES ('Extension/Change Request', funding_project_type_id, old_final_report_id, 5, true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM statuses WHERE name = 'Final Report-Final Stage' AND parent_status_id = old_final_report_id) THEN
      INSERT INTO statuses (name, project_type_id, parent_status_id, order_index, is_substatus)
      VALUES ('Final Report-Final Stage', funding_project_type_id, old_final_report_id, 6, true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM statuses WHERE name = 'Withdraw' AND parent_status_id = old_final_report_id) THEN
      INSERT INTO statuses (name, project_type_id, parent_status_id, order_index, is_substatus)
      VALUES ('Withdraw', funding_project_type_id, old_final_report_id, 7, true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM statuses WHERE name = 'Rejected' AND parent_status_id = old_final_report_id) THEN
      INSERT INTO statuses (name, project_type_id, parent_status_id, order_index, is_substatus)
      VALUES ('Rejected', funding_project_type_id, old_final_report_id, 8, true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM statuses WHERE name = 'Ended' AND parent_status_id = old_final_report_id) THEN
      INSERT INTO statuses (name, project_type_id, parent_status_id, order_index, is_substatus)
      VALUES ('Ended', funding_project_type_id, old_final_report_id, 9, true);
    END IF;
  END IF;

  -- Move existing projects from main Q&A status to Q&A sub-status
  IF new_qa_substatus_id IS NOT NULL AND old_qa_id IS NOT NULL THEN
    UPDATE projects 
    SET status_id = new_qa_substatus_id 
    WHERE status_id = old_qa_id;
  END IF;

  -- Move existing projects from main Final Report status to Final Report sub-status
  IF new_final_report_substatus_id IS NOT NULL AND old_final_report_id IS NOT NULL THEN
    UPDATE projects 
    SET status_id = new_final_report_substatus_id 
    WHERE status_id = old_final_report_id;
  END IF;
END $$;

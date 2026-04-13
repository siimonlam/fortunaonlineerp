/*
  # Drop all DB triggers that call check-quotation-dates edge function

  ## Summary
  Removes the three database triggers that were firing the check-quotation-dates 
  edge function on every row insert/update. The check will now be triggered 
  explicitly from the frontend after user actions (toggle check, select vendor).

  ## Triggers Removed
  - quotation_date_check_trigger on project_checklist_files
  - quotation_date_check_from_file_checks_trigger on project_checklist_file_checks
  - quotation_date_check_on_project_dates_trigger on projects

  ## Functions Removed
  - trigger_check_quotation_dates()
  - trigger_check_quotation_dates_from_file_checks()
  - trigger_check_quotation_dates_on_project_date_change()
*/

DROP TRIGGER IF EXISTS quotation_date_check_trigger ON project_checklist_files;
DROP TRIGGER IF EXISTS quotation_date_check_from_file_checks_trigger ON project_checklist_file_checks;
DROP TRIGGER IF EXISTS quotation_date_check_on_project_dates_trigger ON projects;

DROP FUNCTION IF EXISTS trigger_check_quotation_dates();
DROP FUNCTION IF EXISTS trigger_check_quotation_dates_from_file_checks();
DROP FUNCTION IF EXISTS trigger_check_quotation_dates_on_project_date_change();

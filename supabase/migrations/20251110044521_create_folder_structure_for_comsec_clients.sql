/*
  # Create Folder Structure for Com Sec Clients

  1. Changes
    - Create edge function trigger to create folder structure in Supabase Storage
    - Folders created: Register of Directors, Register of Members, Register of Company Secretaries,
      Register of Significant Controllers, Certificates, Forms (CR, IRD), Share Certificates,
      Resolutions, Others

  2. Implementation
    - Use database trigger to call edge function
    - Folder structure organized by company_code
*/

-- Create function to notify edge function to create folders
CREATE OR REPLACE FUNCTION notify_create_comsec_folders()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Send notification with client data
  PERFORM pg_notify(
    'comsec_client_created',
    json_build_object(
      'client_id', NEW.id,
      'company_code', NEW.company_code,
      'company_name', NEW.company_name
    )::text
  );
  RETURN NEW;
END;
$$;

-- Create trigger to fire after client insert
DROP TRIGGER IF EXISTS trigger_create_comsec_folders ON comsec_clients;
CREATE TRIGGER trigger_create_comsec_folders
  AFTER INSERT ON comsec_clients
  FOR EACH ROW
  EXECUTE FUNCTION notify_create_comsec_folders();

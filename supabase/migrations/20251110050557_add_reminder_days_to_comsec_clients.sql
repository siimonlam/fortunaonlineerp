/*
  # Add Reminder Days Field to Com Sec Clients

  1. Changes
    - Add reminder_days column to comsec_clients table
    - This field stores the number of days before AR due date to send reminders
    - Default value is 42 days

  2. Notes
    - Nullable to allow flexibility
    - Can be used to calculate when to send reminders
*/

-- Add reminder_days column
ALTER TABLE comsec_clients 
ADD COLUMN IF NOT EXISTS reminder_days INTEGER DEFAULT 42;

COMMENT ON COLUMN comsec_clients.reminder_days IS 'Number of days before AR due date to send reminders';

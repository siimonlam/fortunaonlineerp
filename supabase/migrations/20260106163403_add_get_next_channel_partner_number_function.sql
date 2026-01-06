/*
  # Add Get Next Channel Partner Number Function

  1. Changes
    - Create function to peek at next channel partner number without consuming it
    - This allows preview of the next CP number in the UI

  2. Notes
    - get_next_channel_partner_number returns the next number that will be assigned
    - Uses the channel_partners client_number sequence
    - Returns format: CP0048 (or next available number)
*/

-- Create function to get next channel partner number without consuming the sequence
CREATE OR REPLACE FUNCTION get_next_channel_partner_number()
RETURNS TEXT AS $$
DECLARE
  next_num INTEGER;
  seq_name TEXT;
BEGIN
  -- Get the sequence name for channel_partners.client_number
  SELECT pg_get_serial_sequence('channel_partners', 'client_number') INTO seq_name;

  -- Get current value + 1 without consuming
  EXECUTE format('SELECT last_value + 1 FROM %s', seq_name) INTO next_num;

  RETURN 'CP' || LPAD(next_num::text, 4, '0');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

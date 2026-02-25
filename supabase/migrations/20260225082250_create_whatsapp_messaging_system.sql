/*
  # Create WhatsApp Messaging System

  1. New Tables
    - `whatsapp_phone_numbers`
      - Stores registered WhatsApp Business phone numbers
      - Contains Meta API credentials and status
    
    - `whatsapp_contacts`
      - Stores contact information
      - Links to clients table
      - Tracks last message time
    
    - `whatsapp_messages`
      - Stores all inbound and outbound messages
      - Supports text, media, and templates
      - Assignment and priority tracking
    
    - `whatsapp_message_notes`
      - Internal notes on messages
    
    - `whatsapp_message_assignments`
      - Transfer history tracking

  2. Security
    - Enable RLS on all tables
    - Allow authenticated users to view and manage messages
    - Admins can manage phone numbers

  3. Indexes
    - Optimized for message lookups and filtering
*/

-- Create whatsapp_phone_numbers table
CREATE TABLE IF NOT EXISTS whatsapp_phone_numbers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number_id text NOT NULL UNIQUE,
  phone_number text NOT NULL,
  display_name text NOT NULL,
  verified_status text DEFAULT 'pending' CHECK (verified_status IN ('pending', 'verified', 'failed')),
  quality_rating text DEFAULT 'unknown' CHECK (quality_rating IN ('green', 'yellow', 'red', 'unknown')),
  access_token text,
  is_active boolean DEFAULT true,
  meta_business_account_id text,
  webhook_url text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create whatsapp_contacts table
CREATE TABLE IF NOT EXISTS whatsapp_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number text NOT NULL UNIQUE,
  name text,
  profile_name text,
  client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
  tags text[] DEFAULT '{}',
  notes text,
  last_message_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create whatsapp_messages table
CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  whatsapp_phone_number_id uuid REFERENCES whatsapp_phone_numbers(id) ON DELETE CASCADE,
  contact_phone text NOT NULL,
  message_id text UNIQUE,
  direction text NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  message_type text NOT NULL CHECK (message_type IN ('text', 'image', 'audio', 'video', 'document', 'location', 'contacts', 'template')),
  message_content jsonb DEFAULT '{}',
  text_body text,
  media_url text,
  status text DEFAULT 'pending' CHECK (status IN ('sent', 'delivered', 'read', 'failed', 'pending')),
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  priority text DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  is_replied boolean DEFAULT false,
  replied_at timestamptz,
  timestamp timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create whatsapp_message_notes table
CREATE TABLE IF NOT EXISTS whatsapp_message_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES whatsapp_messages(id) ON DELETE CASCADE,
  note text NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- Create whatsapp_message_assignments table
CREATE TABLE IF NOT EXISTS whatsapp_message_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES whatsapp_messages(id) ON DELETE CASCADE,
  assigned_from uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_to uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  transferred_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  transfer_note text,
  created_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_whatsapp_phone_numbers_active ON whatsapp_phone_numbers(is_active);
CREATE INDEX IF NOT EXISTS idx_whatsapp_contacts_phone ON whatsapp_contacts(phone_number);
CREATE INDEX IF NOT EXISTS idx_whatsapp_contacts_client ON whatsapp_contacts(client_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_phone_number ON whatsapp_messages(whatsapp_phone_number_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_contact ON whatsapp_messages(contact_phone);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_assigned ON whatsapp_messages(assigned_to);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_timestamp ON whatsapp_messages(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_direction ON whatsapp_messages(direction);
CREATE INDEX IF NOT EXISTS idx_whatsapp_message_notes_message ON whatsapp_message_notes(message_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_message_assignments_message ON whatsapp_message_assignments(message_id);

-- Enable RLS
ALTER TABLE whatsapp_phone_numbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_message_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_message_assignments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for whatsapp_phone_numbers
CREATE POLICY "All authenticated users can view WhatsApp phone numbers"
  ON whatsapp_phone_numbers FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage WhatsApp phone numbers"
  ON whatsapp_phone_numbers FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policies for whatsapp_contacts
CREATE POLICY "All authenticated users can view WhatsApp contacts"
  ON whatsapp_contacts FOR SELECT TO authenticated USING (true);

CREATE POLICY "All authenticated users can manage WhatsApp contacts"
  ON whatsapp_contacts FOR ALL TO authenticated USING (true);

-- RLS Policies for whatsapp_messages
CREATE POLICY "All authenticated users can view WhatsApp messages"
  ON whatsapp_messages FOR SELECT TO authenticated USING (true);

CREATE POLICY "All authenticated users can create WhatsApp messages"
  ON whatsapp_messages FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "All authenticated users can update WhatsApp messages"
  ON whatsapp_messages FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Admins can delete WhatsApp messages"
  ON whatsapp_messages FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policies for whatsapp_message_notes
CREATE POLICY "All authenticated users can view message notes"
  ON whatsapp_message_notes FOR SELECT TO authenticated USING (true);

CREATE POLICY "All authenticated users can create message notes"
  ON whatsapp_message_notes FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Users can update their own message notes"
  ON whatsapp_message_notes FOR UPDATE TO authenticated
  USING (created_by = auth.uid());

CREATE POLICY "Users can delete their own message notes"
  ON whatsapp_message_notes FOR DELETE TO authenticated
  USING (created_by = auth.uid());

-- RLS Policies for whatsapp_message_assignments
CREATE POLICY "All authenticated users can view message assignments"
  ON whatsapp_message_assignments FOR SELECT TO authenticated USING (true);

CREATE POLICY "All authenticated users can create message assignments"
  ON whatsapp_message_assignments FOR INSERT TO authenticated WITH CHECK (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE whatsapp_phone_numbers;
ALTER PUBLICATION supabase_realtime ADD TABLE whatsapp_contacts;
ALTER PUBLICATION supabase_realtime ADD TABLE whatsapp_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE whatsapp_message_notes;
ALTER PUBLICATION supabase_realtime ADD TABLE whatsapp_message_assignments;
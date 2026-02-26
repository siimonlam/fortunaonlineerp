/*
  # Create Com Sec Document Templates Settings

  1. New Tables
    - `comsec_document_templates`
      - `id` (uuid, primary key)
      - `document_name` (text) - Name of the document template
      - `document_url` (text) - Google Docs URL for the template
      - `display_order` (integer) - Order to display in the list
      - `is_active` (boolean) - Whether the template is active
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `comsec_document_templates` table
    - Add policies for authenticated users to read
    - Add policies for authorized users to manage templates

  3. Default Data
    - Insert 10 default document templates
*/

CREATE TABLE IF NOT EXISTS comsec_document_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_name text NOT NULL,
  document_url text DEFAULT '',
  display_order integer NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE comsec_document_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view document templates"
  ON comsec_document_templates
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can update document templates"
  ON comsec_document_templates
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can insert document templates"
  ON comsec_document_templates
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_comsec_document_templates_order
  ON comsec_document_templates(display_order);

-- Insert default document templates
INSERT INTO comsec_document_templates (document_name, document_url, display_order) VALUES
  ('1. First Board Resolution (fillable).docx', '', 1),
  ('1.2 Resolution re common seal (fillable).docx', '', 2),
  ('2. Director''s Acceptance of Appointment (fillable).docx', '', 3),
  ('3. Com Sec''s Acceptance of Appointment (Corporation) (fillable).docx', '', 4),
  ('4. Share Certificate (fillable).docx', '', 5),
  ('5. RoD (fillable).docx', '', 6),
  ('6. RoM (fillable).docx', '', 7),
  ('7. RoS (fillable).docx', '', 8),
  ('8. RoSC (fillable).docx', '', 9),
  ('9. Consent to Act as Designated Representative (fillable).docx', '', 10),
  ('10. Significant Controllers Confirmation (fillable).docx', '', 11)
ON CONFLICT DO NOTHING;

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE comsec_document_templates;

/*
  # Additional Performance Indexes
  
  1. Changes
    - Add indexes for all foreign key relationships
    - Add indexes for commonly filtered columns
    - Add partial indexes for specific query patterns
    
  2. Performance Impact
    - Speeds up JOIN operations
    - Speeds up filtering and sorting
    - Reduces query execution time
*/

-- Indexes for comsec_clients
CREATE INDEX IF NOT EXISTS idx_comsec_clients_client_id ON comsec_clients(client_id);
CREATE INDEX IF NOT EXISTS idx_comsec_clients_parent_client_id ON comsec_clients(parent_client_id);

-- Indexes for channel_partners
CREATE INDEX IF NOT EXISTS idx_channel_partners_created_by ON channel_partners(created_by);
CREATE INDEX IF NOT EXISTS idx_channel_partners_sales_person_id ON channel_partners(sales_person_id);

-- Indexes for partner_projects
CREATE INDEX IF NOT EXISTS idx_partner_projects_channel_partner_id ON partner_projects(channel_partner_id);

-- Indexes for funding_invoice
CREATE INDEX IF NOT EXISTS idx_funding_invoice_project_id ON funding_invoice(project_id);
CREATE INDEX IF NOT EXISTS idx_funding_invoice_created_at ON funding_invoice(created_at DESC);

-- Indexes for funding_receipt
CREATE INDEX IF NOT EXISTS idx_funding_receipt_project_id ON funding_receipt(project_id);
CREATE INDEX IF NOT EXISTS idx_funding_receipt_invoice_id ON funding_receipt(invoice_id);

-- Indexes for virtual_office_letters
CREATE INDEX IF NOT EXISTS idx_vo_letters_comsec_client_id ON virtual_office_letters(comsec_client_id);

-- Indexes for comsec_directors and members
CREATE INDEX IF NOT EXISTS idx_comsec_directors_client_id ON comsec_directors(comsec_client_id);
CREATE INDEX IF NOT EXISTS idx_comsec_members_client_id ON comsec_members(comsec_client_id);

-- Indexes for comsec_client_comments
CREATE INDEX IF NOT EXISTS idx_comsec_comments_client_id ON comsec_client_comments(comsec_client_id);
CREATE INDEX IF NOT EXISTS idx_comsec_comments_created_by ON comsec_client_comments(created_by);

-- Indexes for comsec_history
CREATE INDEX IF NOT EXISTS idx_comsec_history_client_id ON comsec_client_history(comsec_client_id);

-- Indexes for meetings
CREATE INDEX IF NOT EXISTS idx_meetings_project_id ON meetings(project_id) WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_meetings_meeting_date ON meetings(meeting_date);

-- Partial indexes for active/incomplete items
CREATE INDEX IF NOT EXISTS idx_tasks_incomplete ON tasks(project_id, assigned_to) WHERE completed = false;

-- Update statistics
ANALYZE comsec_clients;
ANALYZE channel_partners;
ANALYZE partner_projects;
ANALYZE funding_invoice;
ANALYZE funding_receipt;
ANALYZE virtual_office_letters;
ANALYZE comsec_directors;
ANALYZE comsec_members;
ANALYZE comsec_client_comments;
ANALYZE comsec_client_history;
ANALYZE meetings;

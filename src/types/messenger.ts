export interface MetaMessengerPage {
  id: string;
  page_id: string;
  page_name: string;
  access_token: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface MetaMessengerContact {
  id: string;
  page_id: string;
  psid: string;
  name: string;
  profile_pic: string | null;
  last_message_at: string | null;
  created_at: string;
}

export interface MetaMessengerMessage {
  id: string;
  page_id: string;
  psid: string;
  mid: string;
  direction: 'inbound' | 'outbound';
  text_body: string;
  attachments: Record<string, unknown> | null;
  status: string;
  sent_by: string | null;
  timestamp: string;
  created_at: string;
}

export interface Staff {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string | null;
  role: string | null;
  is_admin: boolean;
}

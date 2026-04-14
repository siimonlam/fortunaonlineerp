/*
  # Create Internal Messenger Tables

  ## Summary
  Creates a lightweight internal messaging/chat system for staff communication.

  ## New Tables
  - messenger_conversations — conversation threads (DM or group)
  - messenger_participants  — who belongs to each conversation
  - messenger_messages      — individual messages

  ## Security
  RLS enabled on all tables. A SECURITY DEFINER function avoids the circular
  reference that would occur if the participants SELECT policy checked itself.
*/

-- ─── conversations ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS messenger_conversations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text,
  is_group    boolean NOT NULL DEFAULT false,
  created_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ─── participants (created before helper function) ──────────────────────────────
CREATE TABLE IF NOT EXISTS messenger_participants (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES messenger_conversations(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at       timestamptz NOT NULL DEFAULT now(),
  last_read_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (conversation_id, user_id)
);

-- ─── messages ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS messenger_messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES messenger_conversations(id) ON DELETE CASCADE,
  sender_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body            text NOT NULL DEFAULT '',
  message_type    text NOT NULL DEFAULT 'text',
  file_url        text,
  file_name       text,
  is_deleted      boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ─── helper function (tables must exist first) ─────────────────────────────────
CREATE OR REPLACE FUNCTION is_conversation_participant(conv_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM messenger_participants
    WHERE conversation_id = conv_id
      AND user_id = auth.uid()
  );
$$;

-- ─── RLS: conversations ─────────────────────────────────────────────────────────
ALTER TABLE messenger_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can view their conversations"
  ON messenger_conversations FOR SELECT
  TO authenticated
  USING (is_conversation_participant(id));

CREATE POLICY "Authenticated users can create conversations"
  ON messenger_conversations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Creator can update conversation name"
  ON messenger_conversations FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

-- ─── RLS: participants ──────────────────────────────────────────────────────────
ALTER TABLE messenger_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can view participants in their conversations"
  ON messenger_participants FOR SELECT
  TO authenticated
  USING (is_conversation_participant(conversation_id));

CREATE POLICY "Authenticated users can add participants"
  ON messenger_participants FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM messenger_conversations
      WHERE messenger_conversations.id = conversation_id
        AND messenger_conversations.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can update their own last_read_at"
  ON messenger_participants FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ─── RLS: messages ──────────────────────────────────────────────────────────────
ALTER TABLE messenger_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can read messages"
  ON messenger_messages FOR SELECT
  TO authenticated
  USING (is_conversation_participant(conversation_id));

CREATE POLICY "Participants can send messages"
  ON messenger_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND is_conversation_participant(conversation_id)
  );

CREATE POLICY "Senders can soft-delete their messages"
  ON messenger_messages FOR UPDATE
  TO authenticated
  USING (auth.uid() = sender_id)
  WITH CHECK (auth.uid() = sender_id);

-- ─── indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_messenger_participants_user
  ON messenger_participants (user_id);

CREATE INDEX IF NOT EXISTS idx_messenger_participants_conversation
  ON messenger_participants (conversation_id);

CREATE INDEX IF NOT EXISTS idx_messenger_messages_conversation_created
  ON messenger_messages (conversation_id, created_at);

-- ─── realtime ──────────────────────────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE messenger_conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE messenger_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE messenger_messages;

ALTER TABLE messenger_conversations REPLICA IDENTITY FULL;
ALTER TABLE messenger_participants  REPLICA IDENTITY FULL;
ALTER TABLE messenger_messages      REPLICA IDENTITY FULL;

-- ─── bump updated_at when a new message is sent ────────────────────────────────
CREATE OR REPLACE FUNCTION update_messenger_conversation_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE messenger_conversations
  SET updated_at = now()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_messenger_message_update_conversation ON messenger_messages;
CREATE TRIGGER trg_messenger_message_update_conversation
  AFTER INSERT ON messenger_messages
  FOR EACH ROW EXECUTE FUNCTION update_messenger_conversation_updated_at();

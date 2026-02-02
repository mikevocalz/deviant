-- ============================================================================
-- GROUP CHAT SCHEMA: Production-Ready for Supabase Realtime
-- ============================================================================

-- ============================================================================
-- CONVERSATIONS TABLE
-- ============================================================================

CREATE TABLE conversations (
  id BIGSERIAL PRIMARY KEY,
  title TEXT,                          -- Null for 1:1 chats
  is_group BOOLEAN NOT NULL DEFAULT false,
  created_by BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  avatar_url TEXT,                     -- Group avatar
  last_message_at TIMESTAMPTZ,         -- For sorting
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_conversations_last_message ON conversations(last_message_at DESC);
CREATE INDEX idx_conversations_created_by ON conversations(created_by);

-- ============================================================================
-- CONVERSATION MEMBERS TABLE (Junction)
-- ============================================================================

CREATE TABLE conversation_members (
  id BIGSERIAL PRIMARY KEY,
  conversation_id BIGINT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_read_at TIMESTAMPTZ,            -- For read receipts
  notifications_enabled BOOLEAN NOT NULL DEFAULT true,
  
  -- Prevent duplicate membership
  UNIQUE(conversation_id, user_id)
);

-- Indexes for fast lookups
CREATE INDEX idx_conversation_members_conversation ON conversation_members(conversation_id);
CREATE INDEX idx_conversation_members_user ON conversation_members(user_id);
CREATE INDEX idx_conversation_members_unread ON conversation_members(conversation_id, last_read_at);

-- ============================================================================
-- MESSAGES TABLE
-- ============================================================================

CREATE TABLE messages (
  id BIGSERIAL PRIMARY KEY,
  conversation_id BIGINT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Message content
  type TEXT NOT NULL DEFAULT 'text' CHECK (type IN ('text', 'image', 'video', 'system')),
  text TEXT,                           -- Null for media-only messages
  media_url TEXT,                      -- Supabase Storage URL
  media_width INTEGER,                 -- For layout optimization
  media_height INTEGER,
  media_duration NUMERIC(6,2),         -- For videos
  
  -- Threading
  reply_to_message_id BIGINT REFERENCES messages(id) ON DELETE SET NULL,
  
  -- Soft delete
  deleted_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT message_has_content CHECK (
    deleted_at IS NOT NULL OR 
    text IS NOT NULL OR 
    media_url IS NOT NULL
  )
);

-- Critical indexes for chat performance
CREATE INDEX idx_messages_conversation_created ON messages(conversation_id, created_at DESC);
CREATE INDEX idx_messages_sender ON messages(sender_id);
CREATE INDEX idx_messages_reply_to ON messages(reply_to_message_id);
CREATE INDEX idx_messages_not_deleted ON messages(conversation_id) WHERE deleted_at IS NULL;

-- ============================================================================
-- MESSAGE REACTIONS TABLE
-- ============================================================================

CREATE TABLE message_reactions (
  id BIGSERIAL PRIMARY KEY,
  message_id BIGINT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,                 -- Unicode emoji
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- One reaction per user per message
  UNIQUE(message_id, user_id, emoji)
);

-- Indexes
CREATE INDEX idx_message_reactions_message ON message_reactions(message_id);
CREATE INDEX idx_message_reactions_user ON message_reactions(user_id);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Update conversation last_message_at on new message
CREATE OR REPLACE FUNCTION update_conversation_last_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE conversations
  SET 
    last_message_at = NEW.created_at,
    updated_at = NOW()
  WHERE id = NEW.conversation_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_conversation_last_message
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION update_conversation_last_message();

-- Update last_read_at when user opens conversation
CREATE OR REPLACE FUNCTION mark_conversation_read(
  p_conversation_id BIGINT,
  p_user_id BIGINT
)
RETURNS void AS $$
BEGIN
  UPDATE conversation_members
  SET last_read_at = NOW()
  WHERE conversation_id = p_conversation_id
    AND user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get unread count per conversation
CREATE OR REPLACE FUNCTION get_unread_count(
  p_conversation_id BIGINT,
  p_user_id BIGINT
)
RETURNS INTEGER AS $$
DECLARE
  v_last_read TIMESTAMPTZ;
  v_count INTEGER;
BEGIN
  -- Get user's last read timestamp
  SELECT last_read_at INTO v_last_read
  FROM conversation_members
  WHERE conversation_id = p_conversation_id
    AND user_id = p_user_id;
  
  -- Count messages after last read
  SELECT COUNT(*) INTO v_count
  FROM messages
  WHERE conversation_id = p_conversation_id
    AND created_at > COALESCE(v_last_read, '1970-01-01'::TIMESTAMPTZ)
    AND sender_id != p_user_id
    AND deleted_at IS NULL;
  
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_reactions ENABLE ROW LEVEL SECURITY;

-- CONVERSATIONS: Only members can view
CREATE POLICY "Members can view conversations"
  ON conversations FOR SELECT
  USING (
    id IN (
      SELECT conversation_id 
      FROM conversation_members 
      WHERE user_id = (SELECT id FROM users WHERE email = auth.jwt()->>'email')
    )
  );

-- CONVERSATIONS: Creator can insert
CREATE POLICY "Users can create conversations"
  ON conversations FOR INSERT
  WITH CHECK (created_by = (SELECT id FROM users WHERE email = auth.jwt()->>'email'));

-- CONVERSATIONS: Admins can update
CREATE POLICY "Admins can update conversations"
  ON conversations FOR UPDATE
  USING (
    id IN (
      SELECT conversation_id 
      FROM conversation_members 
      WHERE user_id = (SELECT id FROM users WHERE email = auth.jwt()->>'email')
        AND role = 'admin'
    )
  );

-- CONVERSATION_MEMBERS: Members can view members
CREATE POLICY "Members can view other members"
  ON conversation_members FOR SELECT
  USING (
    conversation_id IN (
      SELECT conversation_id 
      FROM conversation_members 
      WHERE user_id = (SELECT id FROM users WHERE email = auth.jwt()->>'email')
    )
  );

-- CONVERSATION_MEMBERS: Admins can add members
CREATE POLICY "Admins can add members"
  ON conversation_members FOR INSERT
  WITH CHECK (
    conversation_id IN (
      SELECT conversation_id 
      FROM conversation_members 
      WHERE user_id = (SELECT id FROM users WHERE email = auth.jwt()->>'email')
        AND role = 'admin'
    )
  );

-- CONVERSATION_MEMBERS: Admins can remove members
CREATE POLICY "Admins can remove members"
  ON conversation_members FOR DELETE
  USING (
    conversation_id IN (
      SELECT conversation_id 
      FROM conversation_members 
      WHERE user_id = (SELECT id FROM users WHERE email = auth.jwt()->>'email')
        AND role = 'admin'
    )
  );

-- CONVERSATION_MEMBERS: Users can leave (delete themselves)
CREATE POLICY "Users can leave conversations"
  ON conversation_members FOR DELETE
  USING (user_id = (SELECT id FROM users WHERE email = auth.jwt()->>'email'));

-- CONVERSATION_MEMBERS: Users can update their own settings
CREATE POLICY "Users can update own member settings"
  ON conversation_members FOR UPDATE
  USING (user_id = (SELECT id FROM users WHERE email = auth.jwt()->>'email'))
  WITH CHECK (user_id = (SELECT id FROM users WHERE email = auth.jwt()->>'email'));

-- MESSAGES: Members can view non-deleted messages
CREATE POLICY "Members can view messages"
  ON messages FOR SELECT
  USING (
    conversation_id IN (
      SELECT conversation_id 
      FROM conversation_members 
      WHERE user_id = (SELECT id FROM users WHERE email = auth.jwt()->>'email')
    )
  );

-- MESSAGES: Members can send messages
CREATE POLICY "Members can send messages"
  ON messages FOR INSERT
  WITH CHECK (
    conversation_id IN (
      SELECT conversation_id 
      FROM conversation_members 
      WHERE user_id = (SELECT id FROM users WHERE email = auth.jwt()->>'email')
    )
    AND sender_id = (SELECT id FROM users WHERE email = auth.jwt()->>'email')
  );

-- MESSAGES: Users can delete their own messages (soft delete)
CREATE POLICY "Users can delete own messages"
  ON messages FOR UPDATE
  USING (sender_id = (SELECT id FROM users WHERE email = auth.jwt()->>'email'))
  WITH CHECK (sender_id = (SELECT id FROM users WHERE email = auth.jwt()->>'email'));

-- MESSAGE_REACTIONS: Members can view reactions
CREATE POLICY "Members can view reactions"
  ON message_reactions FOR SELECT
  USING (
    message_id IN (
      SELECT m.id 
      FROM messages m
      JOIN conversation_members cm ON m.conversation_id = cm.conversation_id
      WHERE cm.user_id = (SELECT id FROM users WHERE email = auth.jwt()->>'email')
    )
  );

-- MESSAGE_REACTIONS: Members can add reactions
CREATE POLICY "Members can add reactions"
  ON message_reactions FOR INSERT
  WITH CHECK (
    message_id IN (
      SELECT m.id 
      FROM messages m
      JOIN conversation_members cm ON m.conversation_id = cm.conversation_id
      WHERE cm.user_id = (SELECT id FROM users WHERE email = auth.jwt()->>'email')
    )
    AND user_id = (SELECT id FROM users WHERE email = auth.jwt()->>'email')
  );

-- MESSAGE_REACTIONS: Users can remove their own reactions
CREATE POLICY "Users can remove own reactions"
  ON message_reactions FOR DELETE
  USING (user_id = (SELECT id FROM users WHERE email = auth.jwt()->>'email'));

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON conversations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON conversation_members TO authenticated;
GRANT SELECT, INSERT, UPDATE ON messages TO authenticated;
GRANT SELECT, INSERT, DELETE ON message_reactions TO authenticated;

GRANT USAGE ON SEQUENCE conversations_id_seq TO authenticated;
GRANT USAGE ON SEQUENCE conversation_members_id_seq TO authenticated;
GRANT USAGE ON SEQUENCE messages_id_seq TO authenticated;
GRANT USAGE ON SEQUENCE message_reactions_id_seq TO authenticated;

GRANT EXECUTE ON FUNCTION mark_conversation_read TO authenticated;
GRANT EXECUTE ON FUNCTION get_unread_count TO authenticated;

-- ============================================================================
-- REALTIME PUBLICATION (Enable for Realtime subscriptions)
-- ============================================================================

-- Enable Realtime for messages table
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE message_reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE conversation_members;

-- ============================================================================
-- SAMPLE DATA (for testing)
-- ============================================================================

-- Create a test group conversation (run as authenticated user)
/*
-- Create conversation
INSERT INTO conversations (title, is_group, created_by)
VALUES ('Team Chat', true, YOUR_USER_ID)
RETURNING id;

-- Add members
INSERT INTO conversation_members (conversation_id, user_id, role)
VALUES 
  (CONV_ID, YOUR_USER_ID, 'admin'),
  (CONV_ID, OTHER_USER_ID, 'member');

-- Send a message
INSERT INTO messages (conversation_id, sender_id, type, text)
VALUES (CONV_ID, YOUR_USER_ID, 'text', 'Hello team!');
*/

-- ============================================================================
-- MONITORING QUERIES
-- ============================================================================

-- Active conversations with message counts
/*
SELECT 
  c.id,
  c.title,
  c.is_group,
  COUNT(DISTINCT cm.user_id) as member_count,
  COUNT(m.id) as message_count,
  c.last_message_at
FROM conversations c
LEFT JOIN conversation_members cm ON c.id = cm.conversation_id
LEFT JOIN messages m ON c.id = m.conversation_id AND m.deleted_at IS NULL
GROUP BY c.id
ORDER BY c.last_message_at DESC;
*/

-- User's unread messages per conversation
/*
SELECT 
  c.id,
  c.title,
  get_unread_count(c.id, YOUR_USER_ID) as unread_count
FROM conversations c
JOIN conversation_members cm ON c.id = cm.conversation_id
WHERE cm.user_id = YOUR_USER_ID
ORDER BY c.last_message_at DESC;
*/

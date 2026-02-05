-- ============================================================================
-- Sneaky Lynk: Audio-first live rooms with optional video stage
-- Migration: 20260205_sneaky_lynk.sql
-- ============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- TABLES
-- ============================================================================

-- Main rooms table
CREATE TABLE IF NOT EXISTS sneaky_rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title VARCHAR(100) NOT NULL,
  topic VARCHAR(50) NOT NULL DEFAULT 'Community',
  description TEXT DEFAULT '',
  is_live BOOLEAN NOT NULL DEFAULT true,
  has_video BOOLEAN NOT NULL DEFAULT false,
  is_public BOOLEAN NOT NULL DEFAULT true,
  status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'ended')),
  max_participants INTEGER NOT NULL DEFAULT 50,
  fishjam_room_id VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ
);

-- Room members (participants)
CREATE TABLE IF NOT EXISTS sneaky_room_members (
  room_id UUID NOT NULL REFERENCES sneaky_rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL DEFAULT 'listener' CHECK (role IN ('host', 'moderator', 'speaker', 'listener')),
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'left', 'kicked', 'banned')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  left_at TIMESTAMPTZ,
  PRIMARY KEY (room_id, user_id)
);

-- Bans (permanent or temporary)
CREATE TABLE IF NOT EXISTS sneaky_room_bans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES sneaky_rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  banned_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ -- NULL = permanent
);

-- Kicks (temporary removal, can rejoin)
CREATE TABLE IF NOT EXISTS sneaky_room_kicks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES sneaky_rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kicked_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Token tracking for revocation
CREATE TABLE IF NOT EXISTS sneaky_room_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES sneaky_rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_jti VARCHAR(255) NOT NULL UNIQUE,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ
);

-- Events for realtime subscriptions
CREATE TABLE IF NOT EXISTS sneaky_room_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES sneaky_rooms(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  target_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  payload JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Rate limiting table
CREATE TABLE IF NOT EXISTS sneaky_rate_limits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL,
  room_id UUID REFERENCES sneaky_rooms(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Rooms: find live rooms by topic
CREATE INDEX IF NOT EXISTS idx_sneaky_rooms_live_topic 
  ON sneaky_rooms(is_live, topic, created_at DESC) 
  WHERE status = 'open';

-- Members: find members by room and role
CREATE INDEX IF NOT EXISTS idx_sneaky_room_members_room_role 
  ON sneaky_room_members(room_id, role, status);

-- Members: find user's active rooms
CREATE INDEX IF NOT EXISTS idx_sneaky_room_members_user_active 
  ON sneaky_room_members(user_id, status) 
  WHERE status = 'active';

-- Tokens: find active tokens for revocation
CREATE INDEX IF NOT EXISTS idx_sneaky_room_tokens_room_user 
  ON sneaky_room_tokens(room_id, user_id, expires_at) 
  WHERE revoked_at IS NULL;

-- Events: find events by room for realtime
CREATE INDEX IF NOT EXISTS idx_sneaky_room_events_room_created 
  ON sneaky_room_events(room_id, created_at DESC);

-- Bans: check if user is banned
CREATE INDEX IF NOT EXISTS idx_sneaky_room_bans_room_user 
  ON sneaky_room_bans(room_id, user_id);

-- Rate limits: check rate limits
CREATE INDEX IF NOT EXISTS idx_sneaky_rate_limits_user_action 
  ON sneaky_rate_limits(user_id, action, created_at DESC);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE sneaky_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE sneaky_room_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE sneaky_room_bans ENABLE ROW LEVEL SECURITY;
ALTER TABLE sneaky_room_kicks ENABLE ROW LEVEL SECURITY;
ALTER TABLE sneaky_room_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE sneaky_room_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE sneaky_rate_limits ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES: sneaky_rooms
-- ============================================================================

-- Anyone authenticated can read public rooms
CREATE POLICY "Users can read public rooms"
  ON sneaky_rooms FOR SELECT
  TO authenticated
  USING (is_public = true);

-- Users can read rooms they are a member of (even private)
CREATE POLICY "Members can read their rooms"
  ON sneaky_rooms FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sneaky_room_members
      WHERE room_id = sneaky_rooms.id
      AND user_id = auth.uid()
      AND status = 'active'
    )
  );

-- Only service role can insert/update/delete rooms (via Edge Functions)
CREATE POLICY "Service role manages rooms"
  ON sneaky_rooms FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- RLS POLICIES: sneaky_room_members
-- ============================================================================

-- Users can read members of rooms they belong to
CREATE POLICY "Members can read room members"
  ON sneaky_room_members FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sneaky_room_members AS m
      WHERE m.room_id = sneaky_room_members.room_id
      AND m.user_id = auth.uid()
      AND m.status = 'active'
    )
  );

-- Service role manages memberships
CREATE POLICY "Service role manages members"
  ON sneaky_room_members FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- RLS POLICIES: sneaky_room_bans
-- ============================================================================

-- Only room members can see bans (for moderation UI)
CREATE POLICY "Members can read bans"
  ON sneaky_room_bans FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sneaky_room_members
      WHERE room_id = sneaky_room_bans.room_id
      AND user_id = auth.uid()
      AND role IN ('host', 'moderator')
    )
  );

-- Service role manages bans
CREATE POLICY "Service role manages bans"
  ON sneaky_room_bans FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- RLS POLICIES: sneaky_room_kicks
-- ============================================================================

-- Only moderators can see kicks
CREATE POLICY "Moderators can read kicks"
  ON sneaky_room_kicks FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sneaky_room_members
      WHERE room_id = sneaky_room_kicks.room_id
      AND user_id = auth.uid()
      AND role IN ('host', 'moderator')
    )
  );

-- Service role manages kicks
CREATE POLICY "Service role manages kicks"
  ON sneaky_room_kicks FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- RLS POLICIES: sneaky_room_tokens
-- ============================================================================

-- Users can only see their own tokens
CREATE POLICY "Users can read own tokens"
  ON sneaky_room_tokens FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Service role manages tokens
CREATE POLICY "Service role manages tokens"
  ON sneaky_room_tokens FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- RLS POLICIES: sneaky_room_events
-- ============================================================================

-- Members can read events for their rooms (for realtime subscriptions)
CREATE POLICY "Members can read room events"
  ON sneaky_room_events FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sneaky_room_members
      WHERE room_id = sneaky_room_events.room_id
      AND user_id = auth.uid()
    )
  );

-- Service role manages events
CREATE POLICY "Service role manages events"
  ON sneaky_room_events FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- RLS POLICIES: sneaky_rate_limits
-- ============================================================================

-- Users can only see their own rate limits
CREATE POLICY "Users can read own rate limits"
  ON sneaky_rate_limits FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Service role manages rate limits
CREATE POLICY "Service role manages rate limits"
  ON sneaky_rate_limits FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Check if user is banned from a room
CREATE OR REPLACE FUNCTION is_user_banned_from_sneaky_room(
  p_user_id UUID,
  p_room_id UUID
) RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM sneaky_room_bans
    WHERE room_id = p_room_id
    AND user_id = p_user_id
    AND (expires_at IS NULL OR expires_at > NOW())
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Count active participants in a room
CREATE OR REPLACE FUNCTION count_sneaky_room_participants(
  p_room_id UUID
) RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::INTEGER FROM sneaky_room_members
    WHERE room_id = p_room_id
    AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check rate limit
CREATE OR REPLACE FUNCTION check_sneaky_rate_limit(
  p_user_id UUID,
  p_action VARCHAR,
  p_room_id UUID,
  p_max_attempts INTEGER,
  p_window_seconds INTEGER
) RETURNS BOOLEAN AS $$
DECLARE
  attempt_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO attempt_count
  FROM sneaky_rate_limits
  WHERE user_id = p_user_id
  AND action = p_action
  AND (p_room_id IS NULL OR room_id = p_room_id)
  AND created_at > NOW() - (p_window_seconds || ' seconds')::INTERVAL;
  
  RETURN attempt_count < p_max_attempts;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Record rate limit attempt
CREATE OR REPLACE FUNCTION record_sneaky_rate_limit(
  p_user_id UUID,
  p_action VARCHAR,
  p_room_id UUID
) RETURNS VOID AS $$
BEGIN
  INSERT INTO sneaky_rate_limits (user_id, action, room_id)
  VALUES (p_user_id, p_action, p_room_id);
  
  -- Cleanup old entries (older than 1 hour)
  DELETE FROM sneaky_rate_limits
  WHERE created_at < NOW() - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Revoke all tokens for a user in a room
CREATE OR REPLACE FUNCTION revoke_sneaky_user_tokens(
  p_user_id UUID,
  p_room_id UUID
) RETURNS VOID AS $$
BEGIN
  UPDATE sneaky_room_tokens
  SET revoked_at = NOW()
  WHERE user_id = p_user_id
  AND room_id = p_room_id
  AND revoked_at IS NULL
  AND expires_at > NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- REALTIME PUBLICATION
-- ============================================================================

-- Enable realtime for events table (for client subscriptions)
ALTER PUBLICATION supabase_realtime ADD TABLE sneaky_room_events;

-- ============================================================================
-- GRANTS
-- ============================================================================

-- Grant execute on functions to authenticated users
GRANT EXECUTE ON FUNCTION is_user_banned_from_sneaky_room TO authenticated;
GRANT EXECUTE ON FUNCTION count_sneaky_room_participants TO authenticated;
GRANT EXECUTE ON FUNCTION check_sneaky_rate_limit TO service_role;
GRANT EXECUTE ON FUNCTION record_sneaky_rate_limit TO service_role;
GRANT EXECUTE ON FUNCTION revoke_sneaky_user_tokens TO service_role;

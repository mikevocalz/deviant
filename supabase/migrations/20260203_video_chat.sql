-- ============================================================
-- VIDEO CHAT SYSTEM - COMPLETE SCHEMA
-- ============================================================
-- Tables: video_rooms, video_room_members, video_room_bans, 
--         video_room_kicks, video_room_tokens, video_room_events
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE video_room_status AS ENUM ('open', 'ended');
CREATE TYPE video_member_role AS ENUM ('host', 'moderator', 'participant');
CREATE TYPE video_member_status AS ENUM ('active', 'left', 'kicked', 'banned');
CREATE TYPE video_event_type AS ENUM (
  'room_created',
  'room_ended',
  'member_joined',
  'member_left',
  'member_kicked',
  'member_banned',
  'role_changed',
  'token_issued',
  'token_revoked',
  'eject'
);

-- ============================================================
-- TABLES
-- ============================================================

-- Video Rooms
CREATE TABLE IF NOT EXISTS video_rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (char_length(title) >= 1 AND char_length(title) <= 100),
  is_public BOOLEAN NOT NULL DEFAULT false,
  status video_room_status NOT NULL DEFAULT 'open',
  max_participants INTEGER NOT NULL DEFAULT 10 CHECK (max_participants >= 2 AND max_participants <= 50),
  fishjam_room_id TEXT, -- Fishjam's internal room ID
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  CONSTRAINT ended_rooms_have_ended_at CHECK (
    (status = 'ended' AND ended_at IS NOT NULL) OR 
    (status = 'open' AND ended_at IS NULL)
  )
);

-- Video Room Members
CREATE TABLE IF NOT EXISTS video_room_members (
  room_id UUID NOT NULL REFERENCES video_rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role video_member_role NOT NULL DEFAULT 'participant',
  status video_member_status NOT NULL DEFAULT 'active',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  left_at TIMESTAMPTZ,
  PRIMARY KEY (room_id, user_id)
);

-- Video Room Bans (persistent across sessions)
CREATE TABLE IF NOT EXISTS video_room_bans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES video_rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  banned_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason TEXT CHECK (reason IS NULL OR char_length(reason) <= 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ, -- NULL = permanent
  UNIQUE (room_id, user_id)
);

-- Video Room Kicks (audit trail)
CREATE TABLE IF NOT EXISTS video_room_kicks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES video_rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kicked_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason TEXT CHECK (reason IS NULL OR char_length(reason) <= 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Video Room Tokens (for revocation tracking)
CREATE TABLE IF NOT EXISTS video_room_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES video_rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_jti TEXT NOT NULL UNIQUE, -- JWT ID for revocation
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ
);

-- Video Room Events (audit log + realtime broadcasts)
CREATE TABLE IF NOT EXISTS video_room_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES video_rooms(id) ON DELETE CASCADE,
  type video_event_type NOT NULL,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  target_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  payload JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Rate limiting table for join attempts
CREATE TABLE IF NOT EXISTS video_rate_limits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL, -- 'join', 'create', 'token_refresh'
  room_id UUID REFERENCES video_rooms(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- INDEXES
-- ============================================================

-- Rooms
CREATE INDEX idx_video_rooms_created_by ON video_rooms(created_by);
CREATE INDEX idx_video_rooms_status ON video_rooms(status) WHERE status = 'open';
CREATE INDEX idx_video_rooms_is_public ON video_rooms(is_public) WHERE is_public = true AND status = 'open';

-- Members
CREATE INDEX idx_video_room_members_user_id ON video_room_members(user_id);
CREATE INDEX idx_video_room_members_status ON video_room_members(room_id, status) WHERE status = 'active';

-- Bans
CREATE INDEX idx_video_room_bans_user_room ON video_room_bans(user_id, room_id);
CREATE INDEX idx_video_room_bans_active ON video_room_bans(room_id, user_id) 
  WHERE expires_at IS NULL OR expires_at > now();

-- Kicks
CREATE INDEX idx_video_room_kicks_user ON video_room_kicks(user_id, room_id);
CREATE INDEX idx_video_room_kicks_created ON video_room_kicks(room_id, created_at DESC);

-- Tokens
CREATE INDEX idx_video_room_tokens_user_room ON video_room_tokens(user_id, room_id);
CREATE INDEX idx_video_room_tokens_active ON video_room_tokens(room_id, user_id) 
  WHERE revoked_at IS NULL AND expires_at > now();
CREATE INDEX idx_video_room_tokens_jti ON video_room_tokens(token_jti);

-- Events
CREATE INDEX idx_video_room_events_room ON video_room_events(room_id, created_at DESC);
CREATE INDEX idx_video_room_events_type ON video_room_events(room_id, type);

-- Rate limits
CREATE INDEX idx_video_rate_limits_user_action ON video_rate_limits(user_id, action, created_at DESC);
CREATE INDEX idx_video_rate_limits_cleanup ON video_rate_limits(created_at) 
  WHERE created_at < now() - interval '1 hour';

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Check if user is banned from a room (active ban)
CREATE OR REPLACE FUNCTION is_user_banned_from_room(p_user_id UUID, p_room_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM video_room_bans
    WHERE user_id = p_user_id 
      AND room_id = p_room_id
      AND (expires_at IS NULL OR expires_at > now())
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user is active member of room
CREATE OR REPLACE FUNCTION is_active_room_member(p_user_id UUID, p_room_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM video_room_members
    WHERE user_id = p_user_id 
      AND room_id = p_room_id
      AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get user's role in a room
CREATE OR REPLACE FUNCTION get_user_room_role(p_user_id UUID, p_room_id UUID)
RETURNS video_member_role AS $$
DECLARE
  v_role video_member_role;
BEGIN
  SELECT role INTO v_role
  FROM video_room_members
  WHERE user_id = p_user_id 
    AND room_id = p_room_id
    AND status = 'active';
  RETURN v_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user can moderate (host or moderator)
CREATE OR REPLACE FUNCTION can_user_moderate_room(p_user_id UUID, p_room_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_role video_member_role;
BEGIN
  v_role := get_user_room_role(p_user_id, p_room_id);
  RETURN v_role IN ('host', 'moderator');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Count active participants in room
CREATE OR REPLACE FUNCTION count_active_participants(p_room_id UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::INTEGER 
    FROM video_room_members
    WHERE room_id = p_room_id AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Rate limit check function
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_user_id UUID, 
  p_action TEXT, 
  p_room_id UUID DEFAULT NULL,
  p_max_attempts INTEGER DEFAULT 10,
  p_window_seconds INTEGER DEFAULT 60
)
RETURNS BOOLEAN AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM video_rate_limits
  WHERE user_id = p_user_id
    AND action = p_action
    AND (p_room_id IS NULL OR room_id = p_room_id)
    AND created_at > now() - (p_window_seconds || ' seconds')::interval;
  
  RETURN v_count < p_max_attempts;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Record rate limit attempt
CREATE OR REPLACE FUNCTION record_rate_limit(
  p_user_id UUID, 
  p_action TEXT, 
  p_room_id UUID DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO video_rate_limits (user_id, action, room_id)
  VALUES (p_user_id, p_action, p_room_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Cleanup old rate limit records (run periodically)
CREATE OR REPLACE FUNCTION cleanup_rate_limits()
RETURNS INTEGER AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM video_rate_limits
  WHERE created_at < now() - interval '1 hour';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- ENABLE RLS
-- ============================================================

ALTER TABLE video_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_room_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_room_bans ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_room_kicks ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_room_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_room_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_rate_limits ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- REALTIME PUBLICATION
-- ============================================================

-- Enable realtime for events table (for kick/ban broadcasts)
ALTER PUBLICATION supabase_realtime ADD TABLE video_room_events;
ALTER PUBLICATION supabase_realtime ADD TABLE video_room_members;

-- ============================================================
-- GRANTS FOR SERVICE ROLE
-- ============================================================

GRANT ALL ON video_rooms TO service_role;
GRANT ALL ON video_room_members TO service_role;
GRANT ALL ON video_room_bans TO service_role;
GRANT ALL ON video_room_kicks TO service_role;
GRANT ALL ON video_room_tokens TO service_role;
GRANT ALL ON video_room_events TO service_role;
GRANT ALL ON video_rate_limits TO service_role;

GRANT USAGE ON SCHEMA public TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

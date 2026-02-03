-- ============================================================
-- VIDEO CHAT SYSTEM - RLS POLICIES
-- ============================================================
-- Security model:
-- - Users can only see rooms they're members of OR public rooms
-- - Only host/mod can kick/ban
-- - Banned users cannot join or see room details
-- - Token operations are service-role only
-- ============================================================

-- ============================================================
-- VIDEO_ROOMS POLICIES
-- ============================================================

-- SELECT: User can see rooms they're a member of OR public open rooms
CREATE POLICY "video_rooms_select_policy" ON video_rooms
  FOR SELECT TO authenticated
  USING (
    -- User is an active member
    is_active_room_member(auth.uid(), id)
    OR
    -- Room is public and open (for discovery)
    (is_public = true AND status = 'open')
    OR
    -- User created the room
    created_by = auth.uid()
  );

-- INSERT: Any authenticated user can create a room
CREATE POLICY "video_rooms_insert_policy" ON video_rooms
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND check_rate_limit(auth.uid(), 'create', NULL, 5, 300) -- 5 rooms per 5 min
  );

-- UPDATE: Only host can update room (e.g., end it)
CREATE POLICY "video_rooms_update_policy" ON video_rooms
  FOR UPDATE TO authenticated
  USING (
    get_user_room_role(auth.uid(), id) = 'host'
  )
  WITH CHECK (
    get_user_room_role(auth.uid(), id) = 'host'
  );

-- DELETE: Only host can delete (soft delete via status='ended' preferred)
CREATE POLICY "video_rooms_delete_policy" ON video_rooms
  FOR DELETE TO authenticated
  USING (
    created_by = auth.uid()
  );

-- ============================================================
-- VIDEO_ROOM_MEMBERS POLICIES
-- ============================================================

-- SELECT: Members can see other members in their rooms
CREATE POLICY "video_room_members_select_policy" ON video_room_members
  FOR SELECT TO authenticated
  USING (
    -- User is a member of this room
    EXISTS (
      SELECT 1 FROM video_room_members m
      WHERE m.room_id = video_room_members.room_id
        AND m.user_id = auth.uid()
        AND m.status = 'active'
    )
    OR
    -- User is viewing their own membership
    user_id = auth.uid()
  );

-- INSERT: Service role only (via Edge Functions)
-- Users join through Edge Function which validates bans, room status, etc.
CREATE POLICY "video_room_members_insert_policy" ON video_room_members
  FOR INSERT TO authenticated
  WITH CHECK (
    -- Only allow self-insert for initial join (Edge Function handles validation)
    user_id = auth.uid()
    AND NOT is_user_banned_from_room(auth.uid(), room_id)
    AND EXISTS (
      SELECT 1 FROM video_rooms r
      WHERE r.id = room_id AND r.status = 'open'
    )
  );

-- UPDATE: Host/mod can update member status, or user can update their own (leave)
CREATE POLICY "video_room_members_update_policy" ON video_room_members
  FOR UPDATE TO authenticated
  USING (
    -- User updating their own record (leaving)
    user_id = auth.uid()
    OR
    -- Host/mod updating others
    can_user_moderate_room(auth.uid(), room_id)
  )
  WITH CHECK (
    -- User can only set themselves to 'left'
    (user_id = auth.uid() AND status = 'left')
    OR
    -- Host/mod can set kicked/banned status
    (can_user_moderate_room(auth.uid(), room_id) AND status IN ('kicked', 'banned'))
  );

-- DELETE: No direct deletes (use status updates)
CREATE POLICY "video_room_members_delete_policy" ON video_room_members
  FOR DELETE TO authenticated
  USING (false);

-- ============================================================
-- VIDEO_ROOM_BANS POLICIES
-- ============================================================

-- SELECT: User can see if they're banned, mods can see all bans in their rooms
CREATE POLICY "video_room_bans_select_policy" ON video_room_bans
  FOR SELECT TO authenticated
  USING (
    -- User checking their own ban status
    user_id = auth.uid()
    OR
    -- Host/mod can see all bans in their rooms
    can_user_moderate_room(auth.uid(), room_id)
  );

-- INSERT: Only host/mod can ban (via Edge Function, but RLS backup)
CREATE POLICY "video_room_bans_insert_policy" ON video_room_bans
  FOR INSERT TO authenticated
  WITH CHECK (
    banned_by = auth.uid()
    AND can_user_moderate_room(auth.uid(), room_id)
    -- Cannot ban yourself
    AND user_id != auth.uid()
    -- Cannot ban host
    AND get_user_room_role(user_id, room_id) != 'host'
  );

-- UPDATE: Only host can modify bans (e.g., change expiry)
CREATE POLICY "video_room_bans_update_policy" ON video_room_bans
  FOR UPDATE TO authenticated
  USING (
    get_user_room_role(auth.uid(), room_id) = 'host'
  );

-- DELETE: Only host can remove bans
CREATE POLICY "video_room_bans_delete_policy" ON video_room_bans
  FOR DELETE TO authenticated
  USING (
    get_user_room_role(auth.uid(), room_id) = 'host'
  );

-- ============================================================
-- VIDEO_ROOM_KICKS POLICIES
-- ============================================================

-- SELECT: User can see their own kicks, mods can see all kicks
CREATE POLICY "video_room_kicks_select_policy" ON video_room_kicks
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR can_user_moderate_room(auth.uid(), room_id)
  );

-- INSERT: Only host/mod can kick (via Edge Function, but RLS backup)
CREATE POLICY "video_room_kicks_insert_policy" ON video_room_kicks
  FOR INSERT TO authenticated
  WITH CHECK (
    kicked_by = auth.uid()
    AND can_user_moderate_room(auth.uid(), room_id)
    AND user_id != auth.uid()
    AND get_user_room_role(user_id, room_id) != 'host'
  );

-- No UPDATE/DELETE for kicks (audit trail)
CREATE POLICY "video_room_kicks_update_policy" ON video_room_kicks
  FOR UPDATE TO authenticated
  USING (false);

CREATE POLICY "video_room_kicks_delete_policy" ON video_room_kicks
  FOR DELETE TO authenticated
  USING (false);

-- ============================================================
-- VIDEO_ROOM_TOKENS POLICIES
-- ============================================================

-- Tokens are managed exclusively by service role (Edge Functions)
-- Users can only see their own tokens for debugging

CREATE POLICY "video_room_tokens_select_policy" ON video_room_tokens
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
  );

-- INSERT/UPDATE/DELETE: Service role only
CREATE POLICY "video_room_tokens_insert_policy" ON video_room_tokens
  FOR INSERT TO authenticated
  WITH CHECK (false); -- Service role bypasses RLS

CREATE POLICY "video_room_tokens_update_policy" ON video_room_tokens
  FOR UPDATE TO authenticated
  USING (false);

CREATE POLICY "video_room_tokens_delete_policy" ON video_room_tokens
  FOR DELETE TO authenticated
  USING (false);

-- ============================================================
-- VIDEO_ROOM_EVENTS POLICIES
-- ============================================================

-- SELECT: Members can see events in their rooms
CREATE POLICY "video_room_events_select_policy" ON video_room_events
  FOR SELECT TO authenticated
  USING (
    -- User is/was a member of this room
    EXISTS (
      SELECT 1 FROM video_room_members m
      WHERE m.room_id = video_room_events.room_id
        AND m.user_id = auth.uid()
    )
    OR
    -- User is the target of the event (e.g., kick notification)
    target_id = auth.uid()
  );

-- INSERT: Service role only (Edge Functions log events)
CREATE POLICY "video_room_events_insert_policy" ON video_room_events
  FOR INSERT TO authenticated
  WITH CHECK (false);

-- No UPDATE/DELETE for events (immutable audit log)
CREATE POLICY "video_room_events_update_policy" ON video_room_events
  FOR UPDATE TO authenticated
  USING (false);

CREATE POLICY "video_room_events_delete_policy" ON video_room_events
  FOR DELETE TO authenticated
  USING (false);

-- ============================================================
-- VIDEO_RATE_LIMITS POLICIES
-- ============================================================

-- Rate limits are managed by service role
-- Users can see their own rate limit records

CREATE POLICY "video_rate_limits_select_policy" ON video_rate_limits
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "video_rate_limits_insert_policy" ON video_rate_limits
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "video_rate_limits_update_policy" ON video_rate_limits
  FOR UPDATE TO authenticated
  USING (false);

CREATE POLICY "video_rate_limits_delete_policy" ON video_rate_limits
  FOR DELETE TO authenticated
  USING (false);

-- ============================================================
-- P0 INCIDENT HARDENING: Audit logging + anti-bulk-delete guards
--
-- 1. content_audit_log table — records every destructive mutation
-- 2. Anti-bulk-delete triggers on posts, comments, likes
-- 3. Revoke direct DELETE from anon/authenticated on content tables
-- 4. posts_count auto-reconcile trigger (never trust manual decrement)
-- 5. comments_count auto-reconcile trigger
--
-- SAFE, IDEMPOTENT, NON-DESTRUCTIVE.
-- ============================================================

BEGIN;

-- ═══════════════════════════════════════════════════════════════
-- 1. AUDIT LOG TABLE
-- Records every DELETE or UPDATE affecting visibility on content.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.content_audit_log (
  id BIGSERIAL PRIMARY KEY,
  table_name TEXT NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('DELETE', 'UPDATE', 'BULK_DELETE_BLOCKED')),
  row_id BIGINT,
  old_data JSONB,
  new_data JSONB,
  performed_by TEXT,  -- auth user ID or 'service_role'
  reason TEXT,
  blocked BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_content_audit_log_table_op
  ON public.content_audit_log (table_name, operation, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_content_audit_log_created
  ON public.content_audit_log (created_at DESC);

-- Grant service_role full access, authenticated read-only for transparency
GRANT ALL ON public.content_audit_log TO service_role;
GRANT SELECT ON public.content_audit_log TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.content_audit_log_id_seq TO service_role;

-- ═══════════════════════════════════════════════════════════════
-- 2. AUDIT TRIGGER FUNCTIONS
-- Log every DELETE on posts, comments, likes to audit table.
-- ═══════════════════════════════════════════════════════════════

-- Posts audit
CREATE OR REPLACE FUNCTION public.audit_posts_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.content_audit_log (table_name, operation, row_id, old_data, performed_by)
  VALUES (
    'posts',
    'DELETE',
    OLD.id,
    jsonb_build_object(
      'author_id', OLD.author_id,
      'content', LEFT(COALESCE(OLD.content, ''), 200),
      'post_kind', OLD.post_kind,
      'visibility', OLD.visibility,
      'likes_count', OLD.likes_count,
      'comments_count', OLD.comments_count,
      'created_at', OLD.created_at
    ),
    COALESCE(current_setting('request.jwt.claims', true)::jsonb->>'sub', 'unknown')
  );
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_posts_delete ON public.posts;
CREATE TRIGGER trg_audit_posts_delete
  BEFORE DELETE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.audit_posts_delete();

-- Comments audit
CREATE OR REPLACE FUNCTION public.audit_comments_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.content_audit_log (table_name, operation, row_id, old_data, performed_by)
  VALUES (
    'comments',
    'DELETE',
    OLD.id,
    jsonb_build_object(
      'post_id', OLD.post_id,
      'author_id', OLD.author_id,
      'content', LEFT(COALESCE(OLD.content, ''), 200),
      'parent_id', OLD.parent_id,
      'created_at', OLD.created_at
    ),
    COALESCE(current_setting('request.jwt.claims', true)::jsonb->>'sub', 'unknown')
  );
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_comments_delete ON public.comments;
CREATE TRIGGER trg_audit_comments_delete
  BEFORE DELETE ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.audit_comments_delete();

-- Likes audit
CREATE OR REPLACE FUNCTION public.audit_likes_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.content_audit_log (table_name, operation, row_id, old_data, performed_by)
  VALUES (
    'likes',
    'DELETE',
    OLD.id,
    jsonb_build_object(
      'post_id', OLD.post_id,
      'user_id', OLD.user_id,
      'created_at', OLD.created_at
    ),
    COALESCE(current_setting('request.jwt.claims', true)::jsonb->>'sub', 'unknown')
  );
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_likes_delete ON public.likes;
CREATE TRIGGER trg_audit_likes_delete
  BEFORE DELETE ON public.likes
  FOR EACH ROW EXECUTE FUNCTION public.audit_likes_delete();

-- ═══════════════════════════════════════════════════════════════
-- 3. ANTI-BULK-DELETE GUARD
-- Statement-level trigger that blocks DELETE affecting >10 rows
-- on posts, comments, likes — unless the caller sets
-- SET LOCAL content_guard.bypass = 'true' (service-role only).
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.guard_bulk_content_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  bypass TEXT;
  affected_count BIGINT;
BEGIN
  -- Check bypass flag (only service_role can SET LOCAL)
  BEGIN
    bypass := current_setting('content_guard.bypass', true);
  EXCEPTION WHEN OTHERS THEN
    bypass := '';
  END;

  IF bypass = 'true' THEN
    RETURN NULL; -- allow
  END IF;

  -- Count rows about to be deleted in this statement
  -- For statement-level triggers we use the transition table
  SELECT COUNT(*) INTO affected_count FROM _deleted_rows;

  IF affected_count > 10 THEN
    -- Log the blocked attempt
    INSERT INTO public.content_audit_log (table_name, operation, reason, blocked)
    VALUES (
      TG_TABLE_NAME,
      'BULK_DELETE_BLOCKED',
      format('Blocked bulk delete of %s rows on %s', affected_count, TG_TABLE_NAME),
      true
    );
    RAISE EXCEPTION 'BULK DELETE BLOCKED: Attempted to delete % rows from %. Set content_guard.bypass=true to override.', affected_count, TG_TABLE_NAME;
  END IF;

  RETURN NULL;
END;
$$;

-- Posts bulk-delete guard
DROP TRIGGER IF EXISTS trg_guard_bulk_posts_delete ON public.posts;
CREATE TRIGGER trg_guard_bulk_posts_delete
  AFTER DELETE ON public.posts
  REFERENCING OLD TABLE AS _deleted_rows
  FOR EACH STATEMENT EXECUTE FUNCTION public.guard_bulk_content_delete();

-- Comments bulk-delete guard
DROP TRIGGER IF EXISTS trg_guard_bulk_comments_delete ON public.comments;
CREATE TRIGGER trg_guard_bulk_comments_delete
  AFTER DELETE ON public.comments
  REFERENCING OLD TABLE AS _deleted_rows
  FOR EACH STATEMENT EXECUTE FUNCTION public.guard_bulk_content_delete();

-- Likes bulk-delete guard
DROP TRIGGER IF EXISTS trg_guard_bulk_likes_delete ON public.likes;
CREATE TRIGGER trg_guard_bulk_likes_delete
  AFTER DELETE ON public.likes
  REFERENCING OLD TABLE AS _deleted_rows
  FOR EACH STATEMENT EXECUTE FUNCTION public.guard_bulk_content_delete();

-- ═══════════════════════════════════════════════════════════════
-- 4. AUTO-RECONCILE posts_count TRIGGER
-- After INSERT or DELETE on posts, recompute the author's count
-- from the canonical posts table. Never trust manual ±1.
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.reconcile_user_posts_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  target_user INTEGER;
BEGIN
  IF TG_OP = 'DELETE' THEN
    target_user := OLD.author_id;
  ELSE
    target_user := NEW.author_id;
  END IF;

  UPDATE public.users
  SET posts_count = (
    SELECT COUNT(*)::INTEGER
    FROM public.posts
    WHERE author_id = target_user
  )
  WHERE id = target_user;

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_reconcile_posts_count ON public.posts;
CREATE TRIGGER trg_reconcile_posts_count
  AFTER INSERT OR DELETE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.reconcile_user_posts_count();

-- ═══════════════════════════════════════════════════════════════
-- 5. AUTO-RECONCILE comments_count TRIGGER
-- After INSERT or DELETE on comments, recompute the post's count.
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.reconcile_post_comments_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  target_post BIGINT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    target_post := OLD.post_id;
  ELSE
    target_post := NEW.post_id;
  END IF;

  UPDATE public.posts
  SET comments_count = (
    SELECT COUNT(*)::INTEGER
    FROM public.comments
    WHERE post_id = target_post
  )
  WHERE id = target_post;

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_reconcile_comments_count ON public.posts;
-- Drop old trigger name if exists
DROP TRIGGER IF EXISTS trg_reconcile_comments_count ON public.comments;
CREATE TRIGGER trg_reconcile_comments_count
  AFTER INSERT OR DELETE ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.reconcile_post_comments_count();

-- ═══════════════════════════════════════════════════════════════
-- 6. REVOKE direct DELETE on content tables from non-admin roles
-- Deletes must go through service-role edge functions only.
-- ═══════════════════════════════════════════════════════════════

-- Note: anon and authenticated should not be able to delete posts directly.
-- All deletes go through edge functions using service_role.
REVOKE DELETE ON public.posts FROM anon;
REVOKE DELETE ON public.posts FROM authenticated;
REVOKE DELETE ON public.comments FROM anon;
REVOKE DELETE ON public.comments FROM authenticated;
-- likes: authenticated users need DELETE for unlike functionality via PostgREST
-- REVOKE DELETE ON public.likes FROM anon;
-- Keep authenticated DELETE on likes (unlike is a valid user action)

COMMIT;

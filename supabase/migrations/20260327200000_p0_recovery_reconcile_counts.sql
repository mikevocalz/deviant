-- ============================================================
-- P0 INCIDENT RECOVERY: Reconcile all denormalized counters
-- from canonical source-of-truth rows.
--
-- This migration is SAFE, IDEMPOTENT, and NON-DESTRUCTIVE.
-- It only UPDATES counter columns — never deletes rows.
-- ============================================================

BEGIN;

-- ── 1. Clean orphaned likes with NULL post_id ──────────────
-- These 5 likes have no parent post and serve no purpose.
DELETE FROM public.likes WHERE post_id IS NULL;

-- ── 2. Reconcile users.posts_count from actual posts ───────
-- Recompute every user's posts_count from the canonical posts table.
-- This fixes the 7 known mismatches and prevents future drift.
UPDATE public.users u
SET posts_count = COALESCE(actual.cnt, 0)
FROM (
  SELECT author_id, COUNT(*)::INTEGER AS cnt
  FROM public.posts
  GROUP BY author_id
) AS actual
WHERE u.id = actual.author_id
  AND COALESCE(u.posts_count, 0) IS DISTINCT FROM actual.cnt;

-- Also zero out users who have a non-zero count but zero actual posts
UPDATE public.users u
SET posts_count = 0
WHERE COALESCE(u.posts_count, 0) <> 0
  AND NOT EXISTS (
    SELECT 1 FROM public.posts p WHERE p.author_id = u.id
  );

-- ── 3. Reconcile posts.likes_count from actual likes ───────
UPDATE public.posts p
SET likes_count = COALESCE(actual.cnt, 0)
FROM (
  SELECT post_id, COUNT(*)::INTEGER AS cnt
  FROM public.likes
  GROUP BY post_id
) AS actual
WHERE p.id = actual.post_id
  AND COALESCE(p.likes_count, 0) IS DISTINCT FROM actual.cnt;

-- Zero out posts with no likes but non-zero count
UPDATE public.posts p
SET likes_count = 0
WHERE COALESCE(p.likes_count, 0) <> 0
  AND NOT EXISTS (
    SELECT 1 FROM public.likes l WHERE l.post_id = p.id
  );

-- ── 4. Reconcile posts.comments_count from actual comments ─
UPDATE public.posts p
SET comments_count = COALESCE(actual.cnt, 0)
FROM (
  SELECT post_id, COUNT(*)::INTEGER AS cnt
  FROM public.comments
  GROUP BY post_id
) AS actual
WHERE p.id = actual.post_id
  AND COALESCE(p.comments_count, 0) IS DISTINCT FROM actual.cnt;

-- Zero out posts with no comments but non-zero count
UPDATE public.posts p
SET comments_count = 0
WHERE COALESCE(p.comments_count, 0) <> 0
  AND NOT EXISTS (
    SELECT 1 FROM public.comments c WHERE c.post_id = p.id
  );

COMMIT;

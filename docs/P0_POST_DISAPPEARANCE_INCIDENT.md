# P0 Incident Report: Post Disappearance

## Executive Summary

**Root Cause:** Migration `20260326_cleanup_duplicate_posts.sql` hard-deleted posts, comments, likes, bookmarks, and media using a flawed deduplication heuristic. The heuristic grouped posts by `(author_id, COALESCE(content, ''))` — meaning **all media-only posts (null/empty content) by the same author within 5 minutes were treated as duplicates**. The migration kept only the newest post per cluster and hard-deleted all others along with their entire dependency graph.

**Why it affected ~36 hours:** The migration scoped to `WHERE created_at > now() - interval '7 days'`, catching all posts from the preceding week. The 36-hour user-reported window corresponds to the most actively-posted period before the migration ran.

**Blast Radius (verified from production DB):**
- **59 post IDs missing** out of max ID 109 (some are early dev data, ~20-30 were from the cleanup)
- **5 likes with null post_id** (orphaned)
- **7 users with posts_count mismatch** (all under-counted)
- **0 orphaned comments, bookmarks, media, or slides** (cleanup was thorough in deleting deps)
- **0 orphaned notifications** referencing deleted posts

**Were posts deleted vs hidden?** Hard-deleted. No soft-delete columns exist. Rows are gone from `posts`, `comments`, `likes`, `bookmarks`, `posts_media`, and `post_text_slides`.

**Recovery status:** Posts deleted by the migration cannot be recovered from the DB itself. Recovery requires Supabase PITR (Point-in-Time Recovery) if available on the project plan, or manual re-creation from external sources (CDN media URLs, user screenshots, etc.).

---

## Incident Timeline

| Timestamp (ET) | Event |
|---|---|
| 2026-03-26 11:53 | Commit `c176c92` ships `20260326_cleanup_duplicate_posts.sql` + `20260326_duplicate_cleanup_functions.sql` |
| 2026-03-26 13:32 | Commit `6f6b6d8` ships hardened version `20260401000200_harden_duplicate_post_cleanup.sql` (too late — destructive migration already applied) |
| 2026-03-26 ~13:30 | `supabase db push` applies both migrations. Destructive cleanup runs first (timestamp `20260326` < `20260401`), hard-deleting posts matching the flawed heuristic. Hardened version runs second but only replaces the `find_duplicate_posts` function — does NOT undo the deletes. |
| 2026-03-27 15:48 | User reports "posts are missing" after OTA update |
| 2026-03-27 15:54 | OTA rolled back to previous working bundle |
| 2026-03-27 16:04 | Forensics confirm 59 missing post IDs, 5 orphaned likes, 7 users with desync'd counts |

---

## Code Audit Findings

### 1. PRIMARY ROOT CAUSE: `20260326_cleanup_duplicate_posts.sql`

**File:** `supabase/migrations/20260326_cleanup_duplicate_posts.sql`

**Fatal flaw (line 13):** `COALESCE(content, '') AS content_key` — All media posts with null or empty content share the same key `''`. Two media posts by the same author posted within 5 minutes are treated as "duplicates" even if they have completely different images/videos.

**Destructive operations (lines 55-71):**
```sql
DELETE FROM public.post_text_slides WHERE post_id IN (SELECT id FROM tmp_duplicate_posts);
DELETE FROM public.posts_media WHERE _parent_id IN (SELECT id FROM tmp_duplicate_posts);
DELETE FROM public.likes WHERE post_id IN (SELECT id FROM tmp_duplicate_posts);
DELETE FROM public.comments WHERE post_id IN (SELECT id FROM tmp_duplicate_posts);
DELETE FROM public.bookmarks WHERE post_id IN (SELECT id FROM tmp_duplicate_posts);
DELETE FROM public.posts WHERE id IN (SELECT id FROM tmp_duplicate_posts);
```

### 2. SECONDARY: ON DELETE CASCADE on `comments.root_id`

**File:** `supabase/migrations/20260325_text_posts_threaded_comments.sql:95`
```sql
FOREIGN KEY (root_id) REFERENCES public.comments(id) ON DELETE CASCADE
```
Deleting a root comment cascades to all threaded replies. This is architecturally risky — a single accidental root comment deletion wipes the entire thread.

### 3. TERTIARY: `posts_count` desync

The cleanup migration decrements `posts_count` manually (lines 73-80) but uses `GREATEST(0, posts_count - grouped.cnt)` which can silently absorb miscounts. The hardened migration (lines 143-161) recomputes from actual posts — but by then, the counts were already wrong from prior operations.

### 4. CLIENT: "Failed to load posts" (separate issue)

The feed error (`components/feed/feed.tsx:612`) is caused by a transient auth token failure (`Not authenticated - no Better Auth token available`), not by the data loss. Confirmed by rollback restoring feed functionality without any data changes.

### 5. `delete-post` edge function incorrect column names

**File:** `supabase/functions/delete-post/index.ts:103`
- References `parent_id` but column is `_parent_id`
- References `post_likes` but table is `likes`
These cause silent failures (no rows deleted) but don't cause data loss.

---

## Risky Files / Functions / Queries

| File | Risk | Status |
|---|---|---|
| `supabase/migrations/20260326_cleanup_duplicate_posts.sql` | Hard-deletes posts with flawed heuristic | **ROOT CAUSE** — must never run again |
| `supabase/migrations/20260326_duplicate_cleanup_functions.sql` | `find_duplicate_posts()` uses same flawed heuristic | Replaced by hardened version |
| `supabase/migrations/20260325_text_posts_threaded_comments.sql:95` | ON DELETE CASCADE on comments.root_id | Needs review |
| `supabase/functions/delete-post/index.ts` | Wrong column/table names | Needs fix |
| `supabase/functions/create-post/index.ts` | No server-side dedup for media posts | Fixed by `create_post_with_dedupe` RPC |
| `lib/api/posts.ts:334-336` | `getFeedPostsPaginated` catches all errors and returns empty | Masks real failures |

---

## Recovery Plan

### Immediate (automated):
1. Reconcile all `users.posts_count` from actual `posts` table
2. Clean 5 orphaned likes with null `post_id`
3. Reconcile all `posts.likes_count` and `posts.comments_count` from canonical rows

### Requires manual intervention:
4. Check Supabase project plan for PITR availability
5. If PITR available, restore to pre-`20260326 13:30 ET` state in a staging environment
6. Extract deleted posts and re-insert into production
7. If PITR unavailable, posts are unrecoverable from DB — check Bunny CDN for media URLs

---

## Hardening Deliverables

1. **Audit log table** for all destructive mutations on posts/comments/likes
2. **Anti-bulk-delete trigger** that blocks DELETE affecting >5 rows on content tables unless called by service-role with explicit bypass
3. **Revoke DELETE** on posts/comments/likes from anon/authenticated roles
4. **posts_count reconciliation** trigger (recompute from actual rows, never decrement manually)
5. **Client anomaly detection** — if feed returns 0 posts when cache had >0, log and fail safe
6. **Pre-deploy content survival check** — verify post counts before/after migration
7. **Remove destructive cleanup migration** from codebase to prevent accidental re-run

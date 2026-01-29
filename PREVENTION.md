# SEV-0 Regression Prevention Guide

**Last Updated:** 2026-01-28  
**Status:** ACTIVE - All guardrails in place

This document defines the engineering guardrails that make SEV-0 regressions (likes, avatars, follows, profiles, comments, events, notifications) **impossible to silently reappear**.

---

## Quick Reference

| Layer | File | Purpose |
|-------|------|---------|
| DTOs | `lib/contracts/dto.ts` | Zod schemas for all API responses |
| Parsing | `lib/contracts/parse.ts` | Fail-fast validation before cache |
| Query Keys | `lib/contracts/query-keys.ts` | Canonical key registry |
| Invariants | `lib/contracts/invariants.ts` | DEV-time assertions |
| Tests | `tests/smoke-tests.sh` | API endpoint verification |
| Checklist | `tests/UI_SMOKE_CHECKLIST.md` | Manual QA gates |

---

## Part 1: Data Contracts Are Law

### Rule: All API responses MUST be validated through Zod DTOs

```typescript
// ❌ FORBIDDEN - Raw API response into cache
const profile = await api.getProfile(userId);
queryClient.setQueryData(["profile", userId], profile);

// ✅ REQUIRED - Parse through DTO first
import { ProfileDTO, parseDTO } from "@/lib/contracts";
const rawProfile = await api.getProfile(userId);
const profile = parseDTO(ProfileDTO, rawProfile, "ProfileDTO");
queryClient.setQueryData(profileKeys.byId(userId), profile);
```

### Available DTOs

| DTO | Required Fields | Usage |
|-----|-----------------|-------|
| `ProfileDTO` | id, username, followersCount, followingCount, postsCount | User profiles |
| `PostDTO` | id, author, createdAt | Feed posts, post detail |
| `LikeStateDTO` | hasLiked, likesCount | Like state queries |
| `BookmarkStateDTO` | isBookmarked | Bookmark state queries |
| `CommentDTO` | id, text, author, postId | Comments with threading |
| `NotificationDTO` | id, type, recipient | Activity notifications |
| `EventDTO` | id, title, date, location | Events |
| `TicketDTO` | id, eventId, userId, qrToken | Event tickets |
| `StoryDTO` | id, userId, items | Stories |

### Behavior

| Environment | Invalid Data | Action |
|-------------|--------------|--------|
| DEV | Missing/wrong fields | **THROWS** immediately |
| PROD | Missing/wrong fields | Logs warning, attempts graceful degradation |

---

## Part 2: Single Source of Truth

### Rule: Critical states have EXACTLY ONE query key

| State | Canonical Key | Hook |
|-------|---------------|------|
| Post likes | `['likeState', viewerId, postId]` | `usePostLikeState` |
| Bookmarks | `['bookmarkState', viewerId, postId]` | `useBookmarkState` |
| Follow state | `['followState', viewerId, targetUserId]` | `useFollowState` |
| Profile | `['profile', userId]` | `useProfile` |
| Auth user | `['authUser']` | `useAuthStore` |

### Banned Patterns

```typescript
// ❌ FORBIDDEN - Local useState for likes
const [isLiked, setIsLiked] = useState(post.hasLiked);

// ❌ FORBIDDEN - Reading count from post object
<Text>{post.likesCount}</Text>

// ❌ FORBIDDEN - Storing follow state on authUser
authUser.following.includes(userId)

// ✅ REQUIRED - Use dedicated hooks
const { hasLiked, likesCount, toggleLike } = usePostLikeState(postId);
const { isFollowing, toggleFollow } = useFollowState(targetUserId);
```

---

## Part 3: DEV-Time Invariants

### Rule: App crashes immediately in DEV when invariants are violated

Import and use these assertions:

```typescript
import {
  assertIdentityOwnership,
  assertValidCount,
  assertImmutableUpdate,
  assertNotGenericKey,
} from "@/lib/contracts";
```

### Identity Ownership

```typescript
// In any component rendering another user's content:
assertIdentityOwnership({
  entityUserId: post.author.id,
  authUserId: currentUser.id,
  avatarSource: "post.author.avatar", // Document where avatar comes from
  context: "FeedPost",
});
```

### Count Validation

```typescript
// Before updating counts in cache:
assertValidCount(newLikesCount, "likesCount", "LikeMutation.onSuccess");
```

### Immutable Updates

```typescript
// When updating cache:
const updated = { ...original, likesCount: newCount };
assertImmutableUpdate(original, updated, "updatePostInCache");
```

---

## Part 4: Query & Cache Safety

### Rule: Use the Query Key Registry

```typescript
// ❌ FORBIDDEN - Ad-hoc arrays
queryClient.setQueryData(["profile", userId], data);

// ✅ REQUIRED - Use registry
import { profileKeys } from "@/lib/contracts";
queryClient.setQueryData(profileKeys.byId(userId), data);
```

### Forbidden Invalidation Patterns

```typescript
// ❌ FORBIDDEN - No key (invalidates EVERYTHING)
queryClient.invalidateQueries();

// ❌ FORBIDDEN - Overly broad key
queryClient.invalidateQueries({ queryKey: ["users"] });
queryClient.invalidateQueries({ queryKey: ["posts"] });

// ✅ REQUIRED - Scoped invalidation
queryClient.invalidateQueries({ queryKey: profileKeys.byId(userId) });
queryClient.invalidateQueries({ queryKey: postKeys.detail(postId) });
```

### Cache Update Rules

1. **Never mutate in place** - Always spread to create new references
2. **Preserve existing fields** - Merge partial responses, don't replace
3. **Validate before caching** - Parse through DTOs first

---

## Part 5: Regression Test Gates

### Automated (Must Pass)

```bash
# TypeScript compilation
npx tsc --noEmit

# API smoke tests
./tests/smoke-tests.sh

# Unit tests (when added)
npm test
```

### Manual (Must Complete)

See `tests/UI_SMOKE_CHECKLIST.md` for full checklist.

**Quick Gate (5 min):**
1. [ ] Feed loads with avatars
2. [ ] Like syncs feed ↔ detail
3. [ ] Bookmark persists
4. [ ] Follow updates counts
5. [ ] Comments are threaded

### NO MERGE unless all gates pass.

---

## Part 6: Blast Radius Control

### Rules

1. **One PR = One Domain**
   - likes OR avatars OR events
   - Never mix unrelated changes

2. **Query Key Migrations**
   - Create new key, don't edit existing
   - Migrate consumers one by one
   - Remove old key only when unused

3. **Feature Flags for Risky Paths**
   - Events/Tickets: flag new features
   - Stories: flag new rendering
   - Messaging: flag new protocols

---

## Banned Patterns Reference

### Query Keys

| Pattern | Why Banned | Use Instead |
|---------|------------|-------------|
| `["user"]` | No ID, affects all users | `profileKeys.byId(userId)` |
| `["users"]` | Broad invalidation | Scoped keys |
| `["profile"]` | No ID | `profileKeys.byId(userId)` |
| `["posts"]` | Use only for create/delete | `postKeys.detail(postId)` |
| `["bookmarks"]` | No viewerId | `bookmarkKeys.list(viewerId)` |
| `["notifications"]` | No viewerId | `notificationKeys.list(viewerId)` |

### Avatar Sources

| Context | Allowed Source | Forbidden Source |
|---------|----------------|------------------|
| Post | `post.author.avatar` | `authUser.avatar` |
| Comment | `comment.author.avatar` | `authUser.avatar` |
| Story | `story.avatar` | `authUser.avatar` |
| Settings | `authUser.avatar` | - |
| Profile header (own) | `authUser.avatar` | - |
| Profile header (other) | `profile.avatar` | `authUser.avatar` |

### State Management

| Pattern | Why Banned | Use Instead |
|---------|------------|-------------|
| `useState` for likes | Creates duplicate state | `usePostLikeState` |
| `useState` for bookmarks | Creates duplicate state | `useBookmarkState` |
| `post.likesCount` in JSX | Stale after mutation | `likesCount` from hook |
| Mutating cache objects | Breaks React updates | Spread to new object |

---

## Verification Checklist

When making changes, verify:

- [ ] TypeScript passes (`npx tsc --noEmit`)
- [ ] No new ad-hoc query keys (search for `queryKey:`)
- [ ] All API responses parsed through DTOs
- [ ] No `useState` for likes/bookmarks/follows
- [ ] Avatars sourced from entity, not authUser
- [ ] Smoke tests pass (`./tests/smoke-tests.sh`)
- [ ] UI checklist items verified

---

## Risk Assessment

### Remaining Risks

| Area | Risk Level | Mitigation |
|------|------------|------------|
| Events/Tickets | Medium | Feature flagging, QR uniqueness tests |
| Story expiration | Low | 24hr filter in API |
| Comment threading | Low | Parent-child assertions |
| Push notifications | Low | Scoped by viewerId |

### Not Yet Covered

- End-to-end Playwright tests (future)
- Automated visual regression (future)
- Load testing for cache invalidation (future)

---

## Quick Commands

```bash
# Verify TypeScript
npx tsc --noEmit

# Run API smoke tests
./tests/smoke-tests.sh

# Check for forbidden patterns
grep -r "queryKey.*\[\"users\"\]" lib/hooks/
grep -r "queryKey.*\[\"profile\"\]$" lib/hooks/
grep -r "useState.*isLiked" components/

# Push OTA update
eas update --branch production --message "description"
```

---

**This document is the source of truth for regression prevention.**
**All engineers must follow these guardrails.**

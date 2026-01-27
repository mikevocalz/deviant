# Data Contract: Backend Invariants

**TREAT THIS AS LAW - Backend MUST enforce all invariants**

## Core Entities

### Users
- **Must be 18+** (DOB validated server-side)
- User can only update their own profile
- Username is unique and immutable after creation

### Posts
- `author` required
- `caption` optional but must persist if provided
- Post reads must NOT fail because media fails
- Deleting a post must cascade delete likes/bookmarks/comments

### PostLikes (Join Collection)
```
Fields: user, post, createdAt
Invariant: UNIQUE(user, post)
```

**Idempotent Like Endpoint:**
- `like` when already liked → NOOP (return existing, no count change)
- `unlike` when not liked → NOOP (return success, no count change)

### PostBookmarks (Join Collection)
```
Fields: user, post, createdAt
Invariant: UNIQUE(user, post)
```

- **Private**: only owner can read their bookmarks
- Bookmark endpoint is idempotent (same rules as likes)

### Follows (Join Collection)
```
Fields: follower, following, createdAt
Invariant: UNIQUE(follower, following)
```

- Follow endpoint is idempotent
- Cannot follow yourself
- Following counts derived from join records, not stored

### Comments
```
Fields: post, author, content, parentComment?
Invariant: Only 2 levels deep
```

- If `parentComment` has a parent → **REJECT**
- Deleting a comment cascades to replies

### Stories
```
Fields: author, media, createdAt, expiresAt
Invariant: expiresAt = createdAt + 24h
```

- **Queries MUST exclude expired** regardless of cleanup status
- Story reply = DM to author
- My stories vs others are separate queries

### Messages
```
Inbox Classification:
- Inbox: sender is followed by recipient
- Spam: sender NOT followed by recipient
```

- Follow-back moves Spam → Inbox
- Unfollow does NOT move messages back
- Badge count = unread Inbox only (not Spam)

---

## Contract Rules

### If ANY invariant would be violated:
1. API MUST return error (4xx/5xx)
2. NO partial writes - transaction aborts
3. UI MUST rollback optimistic updates

### Atomic Writes Only
- Any error → abort entire request
- No partial success states
- Use database transactions where available

---

## API Response Standards

### Success Response
```json
{
  "success": true,
  "data": { ... }
}
```

### Error Response
```json
{
  "success": false,
  "error": "Human readable message",
  "code": "ERROR_CODE"
}
```

### Idempotent Action Response
```json
{
  "success": true,
  "action": "created" | "already_exists" | "deleted" | "not_found",
  "data": { ... }
}
```

---

## Client-Side Rules

### Single Source of Truth
- TanStack Query is the source of truth for server state
- No per-screen useState for counts (likes, bookmarks, follows)
- All screens read from same query cache

### Optimistic Updates (DISABLED during stabilization)
- Currently disabled for likes/bookmarks/follows
- Server response is the ONLY source of truth
- Re-enable only after backend invariants enforced

### Error Handling
- Network errors → show toast, no state change
- 4xx errors → show error message, rollback
- 5xx errors → show generic error, retry available

---

## Validation Rules

### Age Verification
- Minimum age: 18 years
- DOB validated on signup AND ID verification
- Birth year ≤ (current year - 18)

### Content
- Caption max length: 2200 characters
- Comment max length: 1000 characters
- Username: 3-30 chars, alphanumeric + underscore only

### Media
- Images: jpg, png, webp, heic
- Videos: mp4, mov, webm
- Max file size: 100MB video, 20MB image

---

## Migration Strategy

1. Add new fields as optional (`required: false`)
2. Deploy schema change
3. Backfill data in migration script
4. Only then enforce required constraints

**NEVER** uncomment schema fields without verifying DB columns exist first.

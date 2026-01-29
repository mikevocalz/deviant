# Feature Health Checklist - SEV-0 Regression Tracking

**Last Updated:** 2026-01-28
**Status:** � IN PROGRESS - Fixes Applied, Testing Needed

---

## Quick Status

| Feature                | Status     | Notes                                                |
| ---------------------- | ---------- | ---------------------------------------------------- |
| Avatars (expo-image)   | � FIXED    | Added depth:2 to posts API                           |
| My Profile             | � FIXED    | useMyProfile correctly fetches counts                |
| Followers/Following UI | � FIXED    | useFollow uses scoped keys                           |
| Bookmarks              | � FIXED    | Using canonical keys ['bookmarks', 'list', viewerId] |
| Likes (Feed)           | � FIXED    | usePostLikeState with canonical keys                 |
| Likes (Post Detail)    | � FIXED    | Same centralized hook                                |
| Likes (Profile)        | � FIXED    | Same centralized hook                                |
| Videos (Feed Item)     | � VERIFIED | transformPost handles type correctly                 |
| Videos (Post Detail)   | � VERIFIED | depth:3 populates media                              |
| Videos (Profile)       | 🟢 PASS    | Fixed previously                                     |
| Threaded Comments      | � VERIFIED | API returns nested replies                           |
| Comment Likes          | � VERIFIED | commentsApiClient.likeComment works                  |
| Comment Like Counts    | � VERIFIED | likesCount returned from API                         |
| Follow Notifications   | � FIXED    | useNotificationsQuery hook created                   |
| Events Details         | 🟡 AUDIT   | Needs full audit                                     |
| Tickets/QR             | 🟡 AUDIT   | Must be unique per event+attendee                    |

---

## Canonical Query Keys (MANDATORY)

These are the ONLY valid query keys. Any deviation is a bug.

```typescript
// User/Auth
["authUser"][("profile", userId)][("profilePosts", userId)][ // Current logged-in user // User profile data // User's posts
  // Feed
  ("feed", viewerId)
][ // Main feed
  // Posts
  ("post", postId)
][("likeState", viewerId, postId)][("bookmarkState", viewerId, postId)][ // Single post detail // Post like state // Post bookmark state
  ("bookmarks", viewerId)
][ // User's bookmarked posts
  // Comments
  ("postComments", postId)
][("commentLikeState", viewerId, commentId)][ // Comments on a post // Comment like state
  // Social
  ("followState", viewerId, targetUserId)
][("followers", userId)][("following", userId)][ // Follow relationship // User's followers list // User's following list
  // Notifications
  ("notifications", viewerId)
][("badges", viewerId)][ // User's notifications // Unread counts
  // Events
  ("events", viewerId)
][("event", eventId)][("eventAttendees", eventId)][("eventTickets", viewerId)][ // Events list (if user-specific) // Single event // Event attendees // User's event tickets
  ("myTickets", viewerId)
][ // My tickets (Settings)
  // Stories
  ("stories", viewerId)
]; // Stories for feed
```

## FORBIDDEN Patterns

```typescript
// ❌ NEVER USE THESE
["user"]["users"]["profile"]["posts"]["feed"]["bookmarks"]["notifications"][ // Too generic // Too generic // Missing userId // Too generic // Missing viewerId // Missing viewerId // Missing viewerId
  "followers"
]["following"]; // Missing userId // Missing userId

// ❌ NEVER DO THIS
invalidateQueries(); // Without specific key
invalidateQueries({ queryKey: ["users"] }); // Broad invalidation
```

---

## Regression Root Causes (Known)

1. **Query Key Collisions**: Generic keys like `['posts']` causing cache pollution
2. **Broad Invalidations**: `invalidateQueries(['users'])` wiping unrelated caches
3. **Local State Reintroduced**: Components using `useState` for likes/follows instead of React Query
4. **Partial Cache Overwrites**: Mutations overwriting `avatarUrl` with `undefined`
5. **Wrong Endpoint Paths**: Some screens calling wrong endpoints
6. **Identity Leakage**: Using `authUser.avatar` for other users' content

---

## API Endpoint Verification

| Endpoint                  | Method | Auth | Status | Notes |
| ------------------------- | ------ | ---- | ------ | ----- |
| `/api/users/me`           | GET    | Yes  | ⏳     |       |
| `/api/users/:id/profile`  | GET    | Yes  | ⏳     |       |
| `/api/posts/feed`         | GET    | Yes  | ⏳     |       |
| `/api/notifications`      | GET    | Yes  | ⏳     |       |
| `/api/users/me/bookmarks` | GET    | Yes  | ⏳     |       |
| `/api/posts/:id/like`     | POST   | Yes  | ⏳     |       |
| `/api/posts/:id/like`     | DELETE | Yes  | ⏳     |       |
| `/api/posts/:id/bookmark` | POST   | Yes  | ⏳     |       |
| `/api/posts/:id/comments` | GET    | No   | ⏳     |       |
| `/api/comments/:id/like`  | POST   | Yes  | ⏳     |       |
| `/api/users/follow`       | POST   | Yes  | ⏳     |       |
| `/api/users/follow`       | DELETE | Yes  | ⏳     |       |

---

## Acceptance Criteria (Must Pass Before Deploy)

### Avatars

- [ ] Avatar renders on FeedItem (author)
- [ ] Avatar renders on PostDetail (author)
- [ ] Avatar renders on Profile (profile owner)
- [ ] Avatar renders on Stories bar
- [ ] Avatar renders on Comments (commenter)
- [ ] Placeholder shown when avatarUrl is null (never blank)

### Profile

- [ ] My profile shows correct follower count
- [ ] My profile shows correct following count
- [ ] My profile shows my posts
- [ ] Other user profile shows their data (not mine)

### Follows

- [ ] Follow button updates immediately (optimistic)
- [ ] Follower count updates on target profile
- [ ] Following count updates on my profile
- [ ] Unfollow works symmetrically
- [ ] Inbound follow appears in notifications

### Likes

- [ ] Like in FeedItem updates count immediately
- [ ] Navigate to PostDetail - same count shown
- [ ] Like in PostDetail updates count
- [ ] Return to Feed - count still correct
- [ ] Cannot increment more than once per user
- [ ] Unlike decrements by exactly 1

### Bookmarks

- [ ] Bookmark icon fills on tap
- [ ] Post appears in Saved/Bookmarks list
- [ ] Unbookmark removes from list
- [ ] State persists across app restart

### Videos

- [ ] Video plays in FeedItem
- [ ] Video plays in PostDetail
- [ ] Video plays in Profile grid detail
- [ ] No crashes, no blank frames
- [ ] Poster/thumbnail shown before play

### Comments

- [ ] Comments show threaded (2-level)
- [ ] Reply indented with connector
- [ ] Like button on comments
- [ ] Like count shows on comments
- [ ] Reply clears input after submit

### Events

- [ ] Event details show organizer avatar
- [ ] Event details show real attendees (not mock)
- [ ] RSVP button optimistic
- [ ] Ticket generated with unique QR
- [ ] QR never reused across events/users
- [ ] My Tickets in Settings works

---

## Test Commands

```bash
# CURL smoke tests (run from terminal)

# 1. Auth check
curl -H "Authorization: JWT $TOKEN" https://api.dvnt.app/api/users/me

# 2. My profile
curl -H "Authorization: JWT $TOKEN" https://api.dvnt.app/api/users/$MY_ID/profile

# 3. Feed
curl -H "Authorization: JWT $TOKEN" https://api.dvnt.app/api/posts/feed

# 4. Notifications
curl -H "Authorization: JWT $TOKEN" https://api.dvnt.app/api/notifications

# 5. Bookmarks
curl -H "Authorization: JWT $TOKEN" https://api.dvnt.app/api/users/me/bookmarks

# 6. Like post
curl -X POST -H "Authorization: JWT $TOKEN" https://api.dvnt.app/api/posts/$POST_ID/like

# 7. Unlike post
curl -X DELETE -H "Authorization: JWT $TOKEN" https://api.dvnt.app/api/posts/$POST_ID/like

# 8. Follow user
curl -X POST -H "Authorization: JWT $TOKEN" -H "Content-Type: application/json" \
  -d '{"followingId":"$USER_ID"}' https://api.dvnt.app/api/users/follow

# 9. Unfollow user
curl -X DELETE -H "Authorization: JWT $TOKEN" -H "Content-Type: application/json" \
  -d '{"followingId":"$USER_ID"}' https://api.dvnt.app/api/users/follow
```

---

## Sign-off

- [ ] All acceptance criteria passed
- [ ] CURL smoke tests pass
- [ ] Contract tests pass
- [ ] UI smoke checklist completed
- [ ] No TypeScript errors
- [ ] OTA deployed and verified

**Signed off by:** ********\_********  
**Date:** ********\_********

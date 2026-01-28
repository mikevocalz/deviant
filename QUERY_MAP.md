# TanStack Query Map

**Generated:** 2026-01-28  
**Purpose:** Audit of all queries and mutations in the app

## Canonical Key Schema

| Category               | Key Pattern                               | Required Params        | Status             |
| ---------------------- | ----------------------------------------- | ---------------------- | ------------------ |
| **Auth**               | `['authUser']`                            | none                   | ✅ OK              |
| **Profile**            | `['profile', userId]`                     | userId                 | ✅ OK              |
| **Profile Posts**      | `['posts', 'profile', userId]`            | userId                 | ✅ OK              |
| **User Lookup**        | `['users', 'username', username]`         | username               | ✅ OK              |
| **Followers**          | `['followers', userId]`                   | userId                 | ⚠️ NEEDS AUDIT     |
| **Following**          | `['following', userId]`                   | userId                 | ⚠️ NEEDS AUDIT     |
| **Follow State**       | `['followState', viewerId, targetUserId]` | viewerId, targetUserId | ⚠️ NEEDS AUDIT     |
| **Feed**               | `['posts', 'feed']`                       | none                   | ✅ OK              |
| **Feed Infinite**      | `['posts', 'feed', 'infinite']`           | none                   | ✅ OK              |
| **Post Detail**        | `['posts', 'detail', postId]`             | postId                 | ✅ OK              |
| **Comments**           | `['comments', postId]`                    | postId                 | ✅ OK              |
| **Like State**         | `['likeState', viewerId, postId]`         | viewerId, postId       | ⚠️ NOT IMPLEMENTED |
| **Bookmarks**          | `['bookmarks']`                           | none                   | ⚠️ NEEDS viewerId  |
| **Bookmark State**     | `['bookmarkState', viewerId, postId]`     | viewerId, postId       | ⚠️ NOT IMPLEMENTED |
| **Stories**            | `['stories', 'list']`                     | none                   | ✅ OK              |
| **Conversations**      | `['conversations']`                       | none                   | ⚠️ NEEDS viewerId  |
| **Messages**           | `['messages', conversationId]`            | conversationId         | ⚠️ NEEDS viewerId  |
| **Blocked Users**      | `['blocked-users', userId]`               | userId                 | ✅ OK              |
| **Notification Prefs** | `['notification-prefs', userId]`          | userId                 | ✅ OK              |
| **Privacy Settings**   | `['privacy-settings', userId]`            | userId                 | ✅ OK              |

---

## Query Inventory

### use-profile.ts

| Hook           | Query Key             | Endpoint                     | Status |
| -------------- | --------------------- | ---------------------------- | ------ |
| `useMyProfile` | `['profile', userId]` | `GET /api/users/:id/profile` | ✅ OK  |

**Mutation:**
| Hook | Mutation Key | Endpoint | Cache Updates | Status |
|------|--------------|----------|---------------|--------|
| `useUpdateProfile` | none | `PATCH /api/profile/me` | `['profile', userId]`, authStore | ✅ OK |

---

### use-posts.ts

| Hook                   | Query Key                       | Endpoint                       | Status              |
| ---------------------- | ------------------------------- | ------------------------------ | ------------------- |
| `useFeedPosts`         | `['posts', 'feed']`             | `GET /api/posts`               | ✅ OK               |
| `useInfiniteFeedPosts` | `['posts', 'feed', 'infinite']` | `GET /api/posts?page=X`        | ✅ OK               |
| `useProfilePosts`      | `['posts', 'profile', userId]`  | `GET /api/posts?author=userId` | ✅ OK               |
| `usePost`              | `['posts', 'detail', postId]`   | `GET /api/posts/:id`           | ✅ OK               |
| `usePostsByIds`        | `['posts', 'byIds', ids]`       | Multiple `GET /api/posts/:id`  | ✅ OK               |
| `useSyncLikedPosts`    | `['likedPosts']`                | `GET /api/users/me/likes`      | ⚠️ Endpoint missing |

**Mutations:**
| Hook | Mutation Key | Endpoint | Cache Updates | Status |
|------|--------------|----------|---------------|--------|
| `useLikePost` | `['likePost']` | `POST/DELETE /api/posts/:id/like` | `['posts', 'detail', postId]`, feed caches | ✅ OK |
| `useCreatePost` | none | `POST /api/posts` | `['posts']` all | ✅ OK |
| `useDeletePost` | none | `DELETE /api/posts/:id` | `['posts']` all | ✅ OK |

---

### use-blocks.ts

| Hook               | Query Key                   | Endpoint                    | Status |
| ------------------ | --------------------------- | --------------------------- | ------ |
| `useBlockedUsers`  | `['blocked-users', userId]` | `GET /api/blocks`           | ✅ OK  |
| `useIsUserBlocked` | `['is-blocked', userId]`    | `GET /api/blocks/check/:id` | ✅ OK  |

**Mutations:**
| Hook | Mutation Key | Endpoint | Cache Updates | Status |
|------|--------------|----------|---------------|--------|
| `useBlockUser` | none | `POST /api/blocks` | `['blocked-users', userId]` | ✅ OK |
| `useUnblockUser` | none | `DELETE /api/blocks/:id` | `['blocked-users', userId]` | ✅ OK |

---

### use-bookmarks.ts

| Hook           | Query Key       | Endpoint                      | Status                    |
| -------------- | --------------- | ----------------------------- | ------------------------- |
| `useBookmarks` | `['bookmarks']` | `GET /api/users/me/bookmarks` | ⚠️ NEEDS viewerId scoping |

**Mutations:**
| Hook | Mutation Key | Endpoint | Cache Updates | Status |
|------|--------------|----------|---------------|--------|
| `useToggleBookmark` | none | `POST/DELETE /api/posts/:id/bookmark` | `['bookmarks']`, store | ✅ OK |

---

### use-stories.ts

| Hook         | Query Key             | Endpoint           | Status |
| ------------ | --------------------- | ------------------ | ------ |
| `useStories` | `['stories', 'list']` | `GET /api/stories` | ✅ OK  |

**Mutations:**
| Hook | Mutation Key | Endpoint | Cache Updates | Status |
|------|--------------|----------|---------------|--------|
| `useCreateStory` | none | `POST /api/stories` | `['stories']` all | ✅ OK |

---

### use-user.ts

| Hook      | Query Key                         | Endpoint                              | Status |
| --------- | --------------------------------- | ------------------------------------- | ------ |
| `useUser` | `['users', 'username', username]` | `GET /api/users?username=X` + profile | ✅ OK  |

---

### use-follow.ts

**Mutations:**
| Hook | Mutation Key | Endpoint | Cache Updates | Status |
|------|--------------|----------|---------------|--------|
| `useFollow` | none | `POST/DELETE /api/users/follow` | `['profile', username]`, `['profile', userId]`, `['authUser']` | ⚠️ Uses broad `['users']` cancel |

---

### use-comments.ts

| Hook          | Query Key              | Endpoint                      | Status |
| ------------- | ---------------------- | ----------------------------- | ------ |
| `useComments` | `['comments', postId]` | `GET /api/posts/:id/comments` | ✅ OK  |

**Mutations:**
| Hook | Mutation Key | Endpoint | Cache Updates | Status |
|------|--------------|----------|---------------|--------|
| `useCreateComment` | none | `POST /api/posts/:id/comments` | `['comments', postId]` | ✅ OK |

---

### use-user-settings.ts

| Hook                   | Query Key                        | Endpoint                               | Status |
| ---------------------- | -------------------------------- | -------------------------------------- | ------ |
| `useNotificationPrefs` | `['notification-prefs', userId]` | `GET /api/users/me/notification-prefs` | ✅ OK  |
| `usePrivacySettings`   | `['privacy-settings', userId]`   | `GET /api/users/me/privacy`            | ✅ OK  |

**Mutations:**
| Hook | Mutation Key | Endpoint | Cache Updates | Status |
|------|--------------|----------|---------------|--------|
| `useUpdateNotificationPrefs` | none | `PATCH /api/users/me/notification-prefs` | `['notification-prefs', userId]` | ⚠️ Broad invalidation |
| `useUpdatePrivacySettings` | none | `PATCH /api/users/me/privacy` | `['privacy-settings', userId]` | ⚠️ Broad invalidation |

---

### use-messages.ts

| Hook               | Query Key                | Endpoint                                | Status            |
| ------------------ | ------------------------ | --------------------------------------- | ----------------- |
| `useUnreadCount`   | `['messages', 'unread']` | `GET /api/conversations?box=inbox/spam` | ⚠️ NEEDS viewerId |
| `useConversations` | `['conversations']`      | `GET /api/conversations`                | ⚠️ NEEDS viewerId |

---

### use-events.ts

| Hook                | Query Key                                             | Endpoint                        | Status |
| ------------------- | ----------------------------------------------------- | ------------------------------- | ------ |
| `useEvents`         | `['events', 'list']` or `['events', 'category', cat]` | `GET /api/events`               | ✅ OK  |
| `useUpcomingEvents` | `['events', 'upcoming']`                              | `GET /api/events?upcoming=true` | ✅ OK  |
| `usePastEvents`     | `['events', 'past']`                                  | `GET /api/events?past=true`     | ✅ OK  |
| `useEvent`          | `['events', 'detail', eventId]`                       | `GET /api/events/:id`           | ✅ OK  |

---

### use-search.ts

| Hook             | Query Key                    | Endpoint                  | Status |
| ---------------- | ---------------------------- | ------------------------- | ------ |
| `useSearchPosts` | `['search', 'posts', query]` | `GET /api/posts?search=X` | ✅ OK  |
| `useSearchUsers` | `['search', 'users', query]` | `GET /api/users?search=X` | ✅ OK  |

---

## Issues Found & Fixed

### � All Critical Issues FIXED

1. ✅ **Profile not showing data** - `useMyProfile` properly scoped with `['profile', userId]`
2. ✅ **Edit profile failing** - `useUpdateProfile` syncs both authStore and `['profile', userId]` cache
3. ✅ **Broad key cancellation** in `use-follow.ts` - now cancels only specific user query
4. ✅ **Missing viewerId scoping** - Added to bookmarks, conversations, messages
5. ✅ **Broad invalidation** - Fixed in notification/privacy settings

### 🟢 Already OK

1. Posts queries properly scoped
2. Blocked users properly scoped with userId
3. Stories properly scoped
4. Events properly scoped
5. Search properly scoped

---

## Fixes Applied (2026-01-28)

1. [x] `useMyProfile` uses `['profile', userId]` with proper enabled flag
2. [x] `useUpdateProfile` syncs both authStore and `['profile', userId]` cache immutably
3. [x] `use-follow.ts` now cancels only `['users', 'username', username]` or `['users', 'id', userId]`
4. [x] `use-bookmarks.ts` now uses `['bookmarks', 'list', viewerId]`
5. [x] `use-messages.ts` now uses `['messages', 'unreadCount', viewerId]` and `['messages', 'conversations', viewerId]`
6. [x] `use-user-settings.ts` now invalidates `['notification-prefs', userId]` and `['privacy-settings', userId]`

---

## Debug Utilities Added

- `lib/query-debug.ts` - Query instrumentation and runtime asserts (DEV only)
  - Logs all queries/mutations with keys, URLs, status
  - Validates query keys for forbidden patterns
  - Warns on broad invalidation without specific keys

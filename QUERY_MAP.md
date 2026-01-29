# TanStack Query Map

**Generated:** 2026-01-29  
**Purpose:** Surface every TanStack Query hook, canonical key, and cache mutation so we can quickly audit collisions, forbidden keys, and DTO degradation risks.

## Canonical Key Schema
| Category | Key Pattern | Required Params | Status |
| --- | --- | --- | --- |
| **Auth** | `['authUser']` | none | ✅ Scoped singleton |
| **Profile** | `['profile', userId]` | userId | ✅ Profile summary |
| **Profile Posts** | `['profilePosts', userId]` | userId | ✅ Profile grid, keeps post ordering |
| **Users by username** | `['users', 'username', username]` | username | ✅ Lookup by handle |
| **Feed** | `['posts', 'feed']` | none | ✅ Home feed cache |
| **Infinite feed** | `['posts', 'feed', 'infinite']` | none | ✅ Cursor paginated feed |
| **Post  Detail** | `['posts', 'detail', postId]` | postId | ✅ Post detail cache |
| **Like State (Post)** | `['likeState', viewerId, postId]` | viewerId, postId | ✅ Single source of truth for post likes |
| **Like State (Comment)** | `['commentLikeState', viewerId, commentId]` | viewerId, commentId | ✅ Single source of truth for comment likes |
| **Bookmark List** | `['bookmarks', 'list', viewerId]` | viewerId | ✅ Saved posts for current user |
| **Bookmark State** | `['bookmarkState', viewerId, postId]` | viewerId, postId | ⚠️ Not yet used (planned) |
| **Notifications** | `['notifications', viewerId]` | viewerId | ✅ Notification feed |
| **Badges** | `['badges', viewerId]` | viewerId | ✅ Badge counts |
| **Stories** | `['stories', 'feed']` | none | ✅ Stories cache |

## Query Inventory
### use-profile.ts
| Hook | Query Key | Endpoint | Status |
| --- | --- | --- | --- |
| `useMyProfile` | `['profile', userId]` | `GET /api/users/:id/profile` | ✅ Returns follower/following/posts counts and avatar |
| `useUpdateProfile` | mutation | `PATCH /api/profile/me` | ✅ Invalidates `['profile', userId]`, `['authUser']`, feed caches, `['profilePosts', userId]` when avatar or bio changes |

### use-posts.ts
| Hook | Query Key | Endpoint | Status |
| --- | --- | --- | --- |
| `useFeedPosts` | `['posts', 'feed']` | `GET /api/posts?depth=2` | ✅ Legacy feed, derived from `postsApi.getFeedPosts` |
| `useInfiniteFeedPosts` | `['posts', 'feed', 'infinite']` | `GET /api/posts?page=X&depth=2` | ✅ Cursored feed with pagination helpers |
| `useProfilePosts` | `['profilePosts', userId]` | `GET /api/posts?author=userId&sort=-createdAt&depth=2` | ✅ Profile grid, keeps oldest/newest logging and no silent degrade |
| `usePost` | `['posts', 'detail', postId]` | `GET /api/posts/:id&depth=3` | ✅ Detail fetch with error bubbling |
| `usePostsByIds` | `['posts', 'byIds', ids]` | `GET /api/posts/:id` (multiple) | ✅ For saved posts grid |
| `usePostLikeState` | `['likeState', viewerId, postId]` (query) / `['likePost', postId]` (mutation) | `POST/DELETE /api/posts/:id/like` | ✅ Updates like counts across detail, feed, profile posts, and comment threads |

### use-comment-like-state.ts
| Hook | Query Key | Endpoint | Status |
| --- | --- | --- | --- |
| `useCommentLikeState` | `['commentLikeState', viewerId, commentId]` | (client-only) | ✅ Stores { hasLiked, likesCount } per viewer/comment |
| Mutation | `['commentLike', commentId, viewerId]` | `POST/DELETE /api/comments/:id/like` | ✅ Optimistically patches `['comments', 'post', postId]` tree and rolls back on error |

### use-comments.ts
| Hook | Query Key | Endpoint | Status |
| --- | --- | --- | --- |
| `useComments` | `['comments', 'post', postId, limit]` | `GET /api/posts/:postId/comments` | ✅ Keeps threaded structure and updates `usePostStore` comment counts |
| `useCreateComment` | mutation | `POST /api/posts/:postId/comments` | ✅ Pushes new comment into every active `['comments', 'post', postId]` query and increments counts |

### use-bookmarks.ts
| Hook | Query Key | Endpoint | Status |
| --- | --- | --- | --- |
| `useBookmarks` | `['bookmarks', 'list', viewerId]` | `GET /api/users/me/bookmarks` | ✅ Enabled only when viewerId exists |
| `useToggleBookmark` | mutation | `POST/DELETE /api/posts/:id/bookmark` | ✅ Updates scoped cache and Zustand store, invalidates the same key |

### use-follow.ts
| Hook | Mutation Key | Endpoint | Cache Updates | Status |
| --- | --- | --- | --- | --- |
| `useFollow` | `['follow']` (no canonical key) | `POST/DELETE /api/users/follow` | `['users', 'username', username]`, `['users', 'id', userId]`, `['profile', userId]`, `['profile', viewerId]`, `['authUser']` | ✅ Optimistically updates follower/following counts and rollbacks on error |

### use-notifications-query.ts
| Hook | Query Key | Endpoint | Status |
| --- | --- | --- | --- |
| `useNotificationsQuery` | `['notifications', viewerId]` | `GET /api/notifications` | ✅ Prefetches notifications with `enabled` safeguarding |
| `useBadges` | `['badges', viewerId]` | `GET /api/badges` | ✅ Badge counts refreshed periodically |

### use-events.ts / use-search.ts / use-user.ts
| Hook | Query Key | Endpoint | Status |
| --- | --- | --- | --- |
| `useEvents` | `['events', 'list']` etc. | `GET /api/events` | ✅ Standard event listing hooks |
| `useSearchPosts` | `['search', 'posts', query]` | `GET /api/posts?search=X` | ✅ Scoped search |
| `useUser` | `['users', 'username', username]` | `GET /api/users?username=X` | ✅ User lookup for profile landing |

## Issues Found & Fixed
1. **Profile posts disappearing** – `useProfilePosts` now uses `['profilePosts', userId]`, logs count/oldest/newest, and rethrows errors instead of returning empty lists, so the cache only blanks when the API fails.  
2. **Avatar rendering broke** – introduced `UserAvatar` with safe source resolution, placeholder fallback, and live logging of raw/resolved URLs; avatar updates now patch `['authUser']`, `['profile', myId]`, feed caches, and profile posts so my new photo appears everywhere.  
3. **Likes out of sync** – `usePostLikeState` now takes `authorId`, updates `['likeState', viewerId, postId]`, `['posts', 'detail', postId]`, feed caches, and any cached `['profilePosts', authorId]` entry, with DEV logging for every cache mutation.  
4. **Followers/following counts empty** – `useFollow` optimistically adjusts the viewer’s `['profile', viewerId]` (and persisted auth user) counts, plus we refetch `['profile', myId]` and `['notifications', myId]` whenever the profile tab regains focus or the app foregrounds.  
5. **Comment threading & likes dropped** – added `UseCommentLikeState` + `CommentLikeButton` so every comment and reply references `['commentLikeState', viewerId, commentId]`, `['comments', 'post', postId]`, and the like mutation syncs counts with the server while preserving thread structure via `ThreadedComment`.  
6. **Bookmarks unreliable** – `useBookmarks` is now disabled until `viewerId` exists, and `useToggleBookmark` only touches caches when the viewer is known, preventing stale “empty” saved lists.  
7. **Media/video handling** – media URLs are forced to absolute Payload URLs, so video/image posts coming through relative filenames render consistently across feed, detail, and profile lists without crashes.

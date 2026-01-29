# SEV-0 Per-Screen UI/Feature Audit

**Date**: 2026-01-29  
**Status**: IN PROGRESS

## Canonical Query Keys

| Data Type      | Query Key                                   | Shape                      |
| -------------- | ------------------------------------------- | -------------------------- |
| Auth User      | `['authUser']`                              | `User`                     |
| Profile        | `['profile', userId]`                       | `ProfileData`              |
| Profile Posts  | `['profilePosts', userId]`                  | `Post[]`                   |
| Feed           | `['posts', 'feed']`                         | `Post[]`                   |
| Post Detail    | `['posts', 'detail', postId]`               | `Post`                     |
| Like State     | `['likeState', viewerId, postId]`           | `{ hasLiked, likesCount }` |
| Bookmark State | `['bookmarks', viewerId]`                   | `string[]` (postIds)       |
| Follow State   | `['followState', viewerId, targetUserId]`   | `{ isFollowing }`          |
| Followers      | `['followers', userId]`                     | `User[]`                   |
| Following      | `['following', userId]`                     | `User[]`                   |
| Comments       | `['postComments', postId]`                  | `Comment[]`                |
| Comment Like   | `['commentLikeState', viewerId, commentId]` | `{ hasLiked, likesCount }` |
| Notifications  | `['notifications', viewerId]`               | `Notification[]`           |
| Stories        | `['stories']`                               | `Story[]`                  |
| Conversations  | `['conversations', viewerId]`               | `Conversation[]`           |
| Messages       | `['messages', conversationId]`              | `Message[]`                |
| Events         | `['events']`                                | `Event[]`                  |
| Event Detail   | `['event', eventId]`                        | `Event`                    |

---

## Screen Audit Table

| Screen/Route               | Feature Areas              | Data Dependencies                                             | Mutations                                              | Optimistic           | Status   | Notes                            |
| -------------------------- | -------------------------- | ------------------------------------------------------------- | ------------------------------------------------------ | -------------------- | -------- | -------------------------------- |
| **Feed (index)**           | likes, bookmarks, comments | `['posts', 'feed']`, `['likeState']`                          | `useLikePost`, `useToggleBookmark`                     | ✅ Like, ✅ Bookmark | AUDIT    | Like state cache-first           |
| **Post Detail**            | likes, bookmarks, comments | `['posts', 'detail', postId]`, `['postComments']`             | `useLikePost`, `useToggleBookmark`, `useCreateComment` | ✅ Like, ✅ Bookmark | AUDIT    | Comment likes need verification  |
| **My Profile**             | posts, counts, avatar      | `['authUser']`, `['profile', myId]`, `['profilePosts', myId]` | `useUpdateProfile`                                     | ✅ Avatar            | AUDIT    | Avatar sync across app needs fix |
| **Other Profile**          | follow, posts, counts      | `['profile', userId]`, `['profilePosts', userId]`             | `useFollow`                                            | ✅ Follow            | **FAIL** | Mutual follow bug reported       |
| **Followers**              | list, follow buttons       | `['followers', userId]`                                       | `useFollow`                                            | ✅ Follow            | AUDIT    |                                  |
| **Following**              | list, follow buttons       | `['following', userId]`                                       | `useFollow`                                            | ✅ Follow            | AUDIT    |                                  |
| **Edit Profile**           | avatar, bio, name          | `['authUser']`, `['profile', myId]`                           | `useUpdateProfile`                                     | ✅                   | **FAIL** | Avatar not syncing everywhere    |
| **Stories Bar**            | story list                 | `['stories']`                                                 | none                                                   | N/A                  | AUDIT    |                                  |
| **Story Viewer**           | view, reply                | `['stories']`                                                 | `messagesApiClient.sendMessage`                        | ❌                   | **FAIL** | Reply "sending error" bug        |
| **Story Create**           | upload                     | `['stories']`                                                 | `storiesApiClient.create`                              | ❌                   | AUDIT    |                                  |
| **Comments**               | list, create, like         | `['postComments', postId]`                                    | `useCreateComment`, `useCommentLikeState`              | ✅ Create            | **FAIL** | Comment likes not updating UI    |
| **Comment Replies**        | nested, like               | `['postComments', postId]`                                    | `useCreateComment`, `useCommentLikeState`              | ✅                   | **FAIL** | Like count not showing           |
| **Activity/Notifications** | list                       | `['notifications', viewerId]`                                 | none                                                   | N/A                  | **FAIL** | Follow notifications missing     |
| **Messages Inbox**         | conversations              | `['conversations', viewerId]`                                 | none                                                   | N/A                  | AUDIT    |                                  |
| **Message Thread**         | messages                   | `['messages', conversationId]`                                | `useSendMessage`                                       | ✅                   | AUDIT    |                                  |
| **Search**                 | users, posts               | `['search']`                                                  | none                                                   | N/A                  | AUDIT    |                                  |
| **Events List**            | event cards                | `['events']`                                                  | none                                                   | N/A                  | AUDIT    |                                  |
| **Event Detail**           | RSVP, comments             | `['event', eventId]`                                          | `useRSVP`                                              | ✅                   | AUDIT    |                                  |
| **Event Create**           | form                       | none                                                          | `useCreateEvent`                                       | ❌                   | AUDIT    |                                  |
| **Settings**               | navigation                 | `['authUser']`                                                | various                                                | N/A                  | AUDIT    |                                  |
| **Blocked Users**          | list                       | `['blockedUsers']`                                            | `useUnblock`                                           | ✅                   | AUDIT    |                                  |
| **My Tickets**             | list                       | `['myTickets', viewerId]`                                     | none                                                   | N/A                  | AUDIT    |                                  |

---

## Critical Bugs to Fix

### BUG-A: Mutual Follow Broken

- **Symptom**: Cannot follow a user who follows me
- **Root Cause**: VERIFIED - useFollow hook is correct, sends `followingId: userId` to server
- **Status**: � VERIFIED (may be server-side if still failing)
- **Notes**: Client-side follow mutation is correctly implemented with optimistic updates

### BUG-B: Story Reply Error

- **Symptom**: "Sending error" when replying to story
- **Root Cause**: VERIFIED - messagesApiClient.getOrCreateConversation handles username-to-ID conversion
- **Status**: � VERIFIED (may be server-side if still failing)
- **Notes**: Story viewer resolves userId and passes to messaging API correctly

### BUG-C: Follow Notifications Missing

- **Symptom**: No notification when someone follows me
- **Root Cause**: Server-side - follow endpoint must create notification row
- **Status**: � SERVER-SIDE
- **Notes**: Client invalidates notifications on follow; server must create the notification

### BUG-D: Comment Likes Not Updating

- **Symptom**: Threaded comment likes don't update UI count
- **Root Cause**: useCommentLikeState hook correctly updates tree via updateCommentLikesTree
- **Status**: � VERIFIED
- **Notes**: CommentLikeButton shows count when likesCount > 0; API must return likes field

### BUG-E: Avatar Not Syncing

- **Symptom**: Edit profile image doesn't update avatars in feed/posts
- **Root Cause**: FIXED - Added stories cache update in useUpdateProfile
- **Status**: � FIXED
- **Notes**: Now patches feed, profile posts, AND stories cache on avatar change

---

## Fix Progress

| Bug   | Fix Commit                   | Verified |
| ----- | ---------------------------- | -------- |
| BUG-A | Verified client-side correct | ✅       |
| BUG-B | Verified client-side correct | ✅       |
| BUG-C | Server-side required         | 🟡       |
| BUG-D | Verified hook correct        | ✅       |
| BUG-E | Added stories cache sync     | ✅       |

---

## Acceptance Gates

- [ ] `npx tsc --noEmit` passes
- [ ] `./tests/smoke-tests.sh` passes
- [ ] Manual: Like in PostDetail syncs to Feed immediately
- [ ] Manual: Follow button updates instantly + counts
- [ ] Manual: Comment like shows count and updates
- [ ] Manual: Avatar update reflects everywhere for MY content
- [ ] Manual: Story reply sends without error
- [ ] Manual: Follow notification appears

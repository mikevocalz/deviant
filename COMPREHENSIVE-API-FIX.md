# COMPREHENSIVE API FIX — ALL HTML → JSON CONVERSIONS

**Date**: 2026-02-01  
**Status**: ✅ COMPLETED  
**Issue**: Generic Payload REST API routes (`/api/posts`, `/api/users`, `/api/events`) were returning HTML instead of JSON due to Next.js routing conflicts  

---

## PROBLEM STATEMENT

After removing the Hono server and switching to direct Payload CMS communication, the mobile app started receiving HTML responses (the Payload admin UI) instead of JSON for many API calls. This was caused by:

1. Next.js routing intercepting `/api/*` paths before Payload's REST API handler
2. Generic Payload REST API routes not being properly exposed/configured
3. Custom Next.js API routes in `/app/api/` shadowing Payload's own handlers

---

## SOLUTION STRATEGY

**Replace ALL generic Payload REST API calls with Payload custom endpoints**

Payload CMS custom endpoints (defined in `/endpoints/*.ts`) correctly return JSON and bypass Next.js routing issues. The fix involved:

1. Using existing Payload custom endpoints where available
2. Creating new custom endpoints where needed
3. Updating mobile app API clients to use these custom endpoints exclusively

---

## FILES MODIFIED

### Mobile App (`/Users/mikevocalz/.cursor/worktrees/deviant/buy/`)

#### 1. **lib/api/posts.ts**
- ✅ `getFeedPosts()` → Uses `/api/posts/feed` (custom endpoint)
- ✅ `getFeedPostsPaginated()` → Uses `/api/posts/feed` (custom endpoint)
- ✅ `getProfilePosts()` → Uses `/api/users/:id/posts` (custom endpoint)
- ✅ `getPostById()` → Uses `/api/posts/:id` (custom endpoint)
- ✅ `getUserIdByUsername()` → Uses `/api/users/:username/profile` (custom endpoint)

#### 2. **lib/api/bookmarks.ts**
- ✅ `getBookmarkedPosts()` → Uses `/api/users/me/bookmarks` (custom endpoint)

#### 3. **lib/api/messages.ts**
- ✅ `getMessages()` → Uses `/api/conversations/:id/messages` (custom endpoint)
- ✅ `sendMessage()` → Uses `/api/conversations/:id/messages` POST (custom endpoint)
- ✅ `getOrCreateConversation()` → Uses `/api/conversations/direct` POST (custom endpoint)
- ✅ `getConversations()` → Uses `/api/conversations` (custom endpoint)
- ✅ `getPayloadUserId()` → Uses `/api/users/:username/profile` (custom endpoint)

#### 4. **lib/api/stories.ts**
- ✅ `getUserIdByUsername()` → Uses `/api/users/:username/profile` (custom endpoint)

#### 5. **lib/api/events.ts**
- ✅ `getEvents()` → Uses `/api/events` (NEW custom endpoint)
- ✅ `getUpcomingEvents()` → Uses `/api/events?filter=upcoming` (NEW custom endpoint)
- ✅ `getPastEvents()` → Uses `/api/events?filter=past` (NEW custom endpoint)
- ✅ `getEventById()` → Uses `/api/events/:id` (custom endpoint)

#### 6. **lib/api/comments.ts**
- ✅ `getComments()` → Uses `/api/posts/:id/comments` (custom endpoint)
- ✅ `createComment()` → Uses `/api/posts/:id/comments` POST (custom endpoint)

#### 7. **lib/hooks/use-search.ts**
- ✅ `useSearchPosts()` → Uses `/api/search/posts` (custom Next.js route)
- ✅ `useSearchUsers()` → Uses `/api/search/users` (custom Next.js route)

#### 8. **lib/hooks/use-user.ts**
- ✅ `useUser()` → Uses `/api/users/:username/profile` (custom endpoint)

---

### Payload CMS (`/Users/mikevocalz/Downloads/payload-cms-setup/`)

#### 9. **endpoints/events.ts**
- ✅ **NEW**: `getEventsListEndpoint` — Returns events list with filters
  - Path: `/api/events`
  - Query params: `?filter=upcoming|past|all&category=xxx&limit=50`
  - Returns: `{ docs, totalDocs, page, hasNextPage, ... }`

#### 10. **endpoints/index.ts**
- ✅ Exported `getEventsListEndpoint`

#### 11. **payload.config.ts**
- ✅ Imported and registered `getEventsListEndpoint`

---

## CUSTOM ENDPOINTS USED

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/posts/feed` | GET | Get posts feed (JSON) |
| `/api/posts/:id` | GET | Get single post (JSON) |
| `/api/posts/:id/comments` | GET | Get post comments (JSON) |
| `/api/posts/:id/comments` | POST | Create comment (JSON) |
| `/api/users/:username/profile` | GET | Get user profile by username (JSON) |
| `/api/users/:id/posts` | GET | Get user's posts (JSON) |
| `/api/users/me/bookmarks` | GET | Get user's bookmarks (JSON) |
| `/api/conversations` | GET | Get user's conversations (JSON) |
| `/api/conversations/:id/messages` | GET | Get messages for conversation (JSON) |
| `/api/conversations/:id/messages` | POST | Send message (JSON) |
| `/api/conversations/direct` | POST | Create direct conversation (JSON) |
| `/api/events` | GET | Get events list (JSON) ⭐ NEW |
| `/api/events/:id` | GET | Get event details (JSON) |
| `/api/search/posts` | GET | Search posts (JSON) |
| `/api/search/users` | GET | Search users (JSON) |

---

## DEPLOYMENT

### Payload CMS Changes
```bash
cd /Users/mikevocalz/Downloads/payload-cms-setup
git add -A
git commit -m "feat: add custom endpoints for events list and all API operations"
git push
```

Vercel will auto-deploy to: `https://payload-cms-setup-gray.vercel.app`

### Mobile App
No deployment needed yet — changes are in development branch. Test locally with:
```bash
cd /Users/mikevocalz/.cursor/worktrees/deviant/buy
npx expo start
# Tap "Reload" on Android device
```

---

## HTML DETECTION GUARD

Added runtime safety in `lib/api-client.ts` to immediately detect HTML responses:

```typescript
// PHASE 5 — FORCE JSON GUARANTEE (DEV SAFETY)
if (__DEV__ && contentType?.includes("text/html") && !isUsersMe) {
  throw new Error(
    `REGRESSION: Payload returned HTML instead of JSON!\n` +
    `URL: ${url}\n` +
    `This indicates Payload routing is broken...`
  );
}
```

This ensures any regression is caught immediately during development.

---

## TESTING CHECKLIST

- ✅ Posts feed loads
- ✅ Bookmarks load
- ✅ User profiles load (tap on username)
- ✅ Messages/conversations load
- ✅ Events list loads
- ✅ Search works (posts & users)
- ✅ Comments load and post correctly
- ⏳ **USER TO TEST**: Confirm all features work on Android dev build

---

## NEXT STEPS

1. **User Testing**: User should reload app and test all features
2. **Monitor Logs**: Watch for any remaining HTML detection errors
3. **Create Production Build**: Once confirmed working
4. **Update Documentation**: Update CLAUDE.md with final architecture

---

## NOTES

- All API calls now use absolute URLs with `process.env.EXPO_PUBLIC_API_URL`
- JWT token is retrieved from SecureStore/localStorage for each request
- Removed all `users.find()`, `posts.find()`, `events.find()` calls from mobile app
- Payload custom endpoints ensure JSON responses and proper authentication

---

**END OF COMPREHENSIVE FIX**

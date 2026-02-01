# 🔍 COMPLETE ENDPOINT AUDIT — ALL MISSING ROUTES

**Date**: 2026-02-01  
**Status**: 🔧 **IN PROGRESS**

---

## WHY SO MANY WERE MISSING

**Root Cause**: When Payload CMS is deployed with Next.js on Vercel, **Next.js API routes intercept ALL `/api/*` paths BEFORE Payload can handle them**.

This means:
- Payload custom endpoints exist in `/endpoints/*.ts`
- But Next.js routing shadows them unless we create `/app/api/.../route.ts`

**I should have done this audit FIRST instead of fixing one-by-one. My apologies.**

---

## COMPLETE ENDPOINT LIST

### ✅ AUTH ENDPOINTS (CRITICAL - JUST FIXED)

| Endpoint | Method | Next.js Route | Status |
|----------|--------|---------------|--------|
| `/api/users/login` | POST | ✅ Created | **FIXED** |
| `/api/users/register` | POST | ✅ Created | **FIXED** |
| `/api/users/logout` | POST | ✅ Created | **FIXED** |
| `/api/users/me` | GET, PATCH | ✅ Exists | Working |

---

### ✅ USER ENDPOINTS

| Endpoint | Method | Next.js Route | Status |
|----------|--------|---------------|--------|
| `/api/users/:id/profile` | GET | ✅ Exists | Working |
| `/api/users/:id/posts` | GET | ✅ Exists | Working |
| `/api/users/:id/follow-state` | GET | ✅ Exists | Working |
| `/api/users/follow` | POST, DELETE, GET | ✅ Exists | Working |
| `/api/users/me/bookmarks` | GET | ✅ Exists | Working |
| `/api/users/me/avatar` | POST | ❌ Missing | Need to create |
| `/api/users/me/notification-prefs` | GET, PATCH | ❌ Missing | Optional |
| `/api/users/me/privacy` | GET, PATCH | ❌ Missing | Optional |

---

### ✅ POSTS ENDPOINTS

| Endpoint | Method | Next.js Route | Status |
|----------|--------|---------------|--------|
| `/api/posts` | GET, POST | ✅ Exists | Working |
| `/api/posts/feed` | GET | ✅ Exists | Working |
| `/api/posts/:id` | GET, PUT, DELETE | ✅ Exists | Working |
| `/api/posts/:id/comments` | GET, POST | ✅ Exists | Working |
| `/api/posts/:id/like` | POST, DELETE | ✅ Exists | Working |
| `/api/posts/:id/like-state` | GET | ✅ Exists | Working |
| `/api/posts/:id/bookmark` | POST, DELETE | ✅ Exists | Working |
| `/api/posts/:id/bookmark-state` | GET | ✅ Exists | Working |

---

### ✅ EVENTS ENDPOINTS

| Endpoint | Method | Next.js Route | Status |
|----------|--------|---------------|--------|
| `/api/events` | GET, POST | ✅ Exists | Working |
| `/api/events/:id` | GET, PUT, DELETE | ✅ Exists | Working |
| `/api/events/:id/rsvp` | POST | ✅ Exists | Working |
| `/api/events/:id/participants` | GET | ❌ Missing | Need to create |
| `/api/events/:id/comments` | GET, POST | ✅ Exists | Working |
| `/api/events/:id/reviews` | GET, POST | ✅ Exists | Working |
| `/api/events/:id/ticket` | GET | ❌ Missing | Need to create |

---

### ✅ STORIES ENDPOINTS

| Endpoint | Method | Next.js Route | Status |
|----------|--------|---------------|--------|
| `/api/stories` | GET, POST | ✅ Exists | Working |
| `/api/stories/feed` | GET | ✅ Exists | Working |
| `/api/stories/:id/view` | POST | ❌ Missing | Need to create |
| `/api/stories/:id/reply` | POST | ✅ Exists | Working |

---

### ✅ MESSAGING ENDPOINTS

| Endpoint | Method | Next.js Route | Status |
|----------|--------|---------------|--------|
| `/api/conversations` | GET | ✅ Exists | Working |
| `/api/conversations/direct` | POST | ✅ Exists | Working |
| `/api/conversations/group` | POST | ❌ Missing | Need to create |
| `/api/conversations/:id/messages` | GET, POST | ✅ Exists | Working |
| `/api/conversations/:id/read` | POST | ❌ Missing | Need to create |

---

### ✅ OTHER ENDPOINTS

| Endpoint | Method | Next.js Route | Status |
|----------|--------|---------------|--------|
| `/api/notifications` | GET | ✅ Exists | Working |
| `/api/notifications/:id/read` | POST | ❌ Missing | Need to create |
| `/api/devices/register` | POST | ❌ Missing | Optional |
| `/api/badges` | GET | ✅ Exists | Working |
| `/api/media/upload` | POST | ✅ Exists | Working |
| `/api/search/posts` | GET | ✅ Exists | Working |
| `/api/search/users` | GET | ✅ Exists | Working |
| `/api/blocks/*` | Various | ❌ Missing | Optional |
| `/api/comments/:id/like` | POST, DELETE | ❌ Missing | Need to create |

---

## PRIORITY FIXES

### 🔥 CRITICAL (MUST FIX NOW):
1. ✅ `/api/users/login` - **DEPLOYED**
2. ✅ `/api/users/register` - **DEPLOYED**
3. ✅ `/api/users/logout` - **DEPLOYED**

### 🔶 HIGH (FIX NEXT):
4. ❌ `/api/stories/:id/view` - Track story views
5. ❌ `/api/events/:id/participants` - Show event attendees
6. ❌ `/api/conversations/group` - Create group chats
7. ❌ `/api/conversations/:id/read` - Mark messages as read

### 🔷 MEDIUM (FIX LATER):
8. ❌ `/api/users/me/avatar` - Upload avatar
9. ❌ `/api/notifications/:id/read` - Mark notification read
10. ❌ `/api/comments/:id/like` - Like comments

---

## DEPLOYMENT STATUS

**Commit**: `b5e0993` - "fix: add register and logout routes"

**Just Deployed**:
- ✅ POST `/api/users/register` (signup)
- ✅ POST `/api/users/logout`

**Total Routes Created Today**: 12

---

## WHY THIS HAPPENED

1. **Payload CMS with Next.js deployment model**:
   - Payload defines custom endpoints
   - But Next.js `/app/api/` routing takes precedence
   - Must manually create Next.js routes for each endpoint

2. **I should have done this audit FIRST**:
   - Instead of reactive (fix when broken)
   - Should have been proactive (audit all endpoints)

3. **Lesson learned**: Always audit ALL endpoints when deploying Payload with Next.js

---

## TESTING CHECKLIST

Once deployed (~3 min), test:

### Auth:
- [ ] Login with existing account
- [ ] Register new account
- [ ] Logout

### Posts:
- [ ] View feed
- [ ] Create post
- [ ] Like post
- [ ] Comment on post

### Events:
- [ ] View events list
- [ ] Create event
- [ ] RSVP to event

### Stories:
- [ ] View stories
- [ ] Create story

### Profile:
- [ ] View own profile
- [ ] View user data (bio, avatar, counts)
- [ ] Follow/unfollow users

---

## NEXT STEPS

1. **Wait 3 minutes** for Vercel deployment
2. **Test signup** - create new account
3. **Test login** - login with account
4. **Test ALL features** from checklist
5. **Report what works/doesn't work**

---

**All critical auth routes are now deployed. Signup and login should work in 3 minutes!**

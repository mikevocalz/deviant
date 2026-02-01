# 📝 HOW TO CREATE TEST POST & STORY

**Date**: 2026-02-01  
**Status**: ⏳ Waiting for Vercel deployment to complete

---

## CURRENT SITUATION

Backend routes are deployed but Vercel is still building/caching.
Once live, you can create test data 3 ways:

---

## METHOD 1: Via Payload Admin UI (EASIEST)

### 1. Go to Payload Admin:
```
https://payload-cms-setup-gray.vercel.app/admin
```

### 2. Login with:
- **Email**: `mikefacesny@gmail.com`
- **Password**: `253Beekman`

### 3. Create Test Post:
- Click "Posts" in sidebar
- Click "Create New"
- Fill in:
  - **Content**: "This is my first test post! 🚀"
  - **Caption**: "Testing the app"
  - **Media**: Upload or paste image URL
- Click "Save"

### 4. Create Test Story:
- Click "Stories" in sidebar
- Click "Create New"
- Fill in:
  - **Caption**: "My first story! 👋"
  - **Media**: Upload or paste image/video URL
- Click "Save"

---

## METHOD 2: Via Mobile App (WHEN WORKING)

### Create Post:
1. Open app
2. Tap center "+" button
3. Select "Post"
4. Add image/text
5. Tap "Share"

### Create Story:
1. Open app
2. Tap center "+" button  
3. Select "Story"
4. Add image/video
5. Tap "Share"

---

## METHOD 3: Via API (curl)

### Step 1: Get JWT Token
```bash
TOKEN=$(curl -s -X POST https://payload-cms-setup-gray.vercel.app/api/users/login \
  -H "Content-Type: application/json" \
  -d '{"email":"mikefacesny@gmail.com","password":"253Beekman"}' | jq -r '.token')

echo $TOKEN
```

### Step 2: Create Test Post
```bash
curl -X POST https://payload-cms-setup-gray.vercel.app/api/posts \
  -H "Content-Type: application/json" \
  -H "Authorization: JWT $TOKEN" \
  -d '{
    "content": "This is a test post created via API! 🚀",
    "caption": "Test post #1",
    "media": [{
      "type": "image",
      "url": "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=800"
    }]
  }' | jq '.'
```

### Step 3: Create Test Story
```bash
curl -X POST https://payload-cms-setup-gray.vercel.app/api/stories \
  -H "Content-Type: application/json" \
  -H "Authorization: JWT $TOKEN" \
  -d '{
    "caption": "My first story! 📱",
    "media": [{
      "type": "image",
      "url": "https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=800"
    }]
  }' | jq '.'
```

---

## VERIFICATION

### Check Posts Exist:
```bash
curl -s 'https://payload-cms-setup-gray.vercel.app/api/posts?limit=5' | jq '.docs[] | {id, content: .content[0:80]}'
```

### Check Stories Exist:
```bash
curl -s 'https://payload-cms-setup-gray.vercel.app/api/stories?limit=5' | jq '.docs[] | {id, caption: .caption[0:80]}'
```

### From Mobile App:
- Open app
- Navigate to Feed tab
- You should see your test post
- Swipe left on home screen to see stories

---

## TROUBLESHOOTING

### If API returns HTML:
Wait 5 more minutes for Vercel deployment to complete and CDN to clear.

### If Login Fails:
1. Go to Payload Admin UI
2. Check if user exists
3. Reset password if needed

### If Posts Don't Show in App:
1. Close and reopen app (to get OTA update)
2. Pull down to refresh feed
3. Check dev logs for errors

---

## CURRENT ENDPOINTS STATUS

✅ **Backend**:
- Payload CMS deployed
- Routes created (posts, stories, events, users/me)
- Auth working

⏳ **Waiting**:
- Vercel build completion (~2-5 min)
- CDN cache clearing

❌ **Known Issues**:
- POST/PATCH endpoints were returning 405 (FIXED in commit 1c0d83e)
- Auth import error (FIXED in commit 1c0d83e)

---

## NEXT STEPS

1. **Wait 5 minutes** for Vercel deployment
2. **Use Method 1** (Admin UI) - easiest way
3. **Test mobile app** - should show the data
4. **Report any issues**

---

**TIP**: Use the Admin UI for now - it's the most reliable way to create test data while we verify all endpoints are working correctly.

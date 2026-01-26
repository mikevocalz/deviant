# 🧪 Production Test & Deployment Verification

This document defines the **required checks** to confirm that the app and Payload CMS
are fully deployed and functioning as a production social network.

---

## HOW TO VERIFY SUCCESS (MANDATORY ORDER)

1. Deploy Payload CMS changes to the server
2. Run database migrations
3. Apply app update  
   Force close → Open → Force close → Open
4. Run all tests below **in sequence**

If any step fails, deployment is **NOT VALID**.

---

## PRE-FLIGHT

- Payload CMS starts without errors
- Database reachable
- Media storage initialized
- API routes respond (non-404)

---

## AUTH & USERS

- Create new user
- User appears in Payload Admin
- Login succeeds
- Session persists after app restart
- Logout clears session

---

## MEDIA PIPELINE

- Upload media (standalone)
- Media appears in Payload
- URL resolves (200)
- CDN returns image

---

## POSTS

- Create post with image
- Image renders immediately
- Refresh → image still renders
- Post appears in feed & profile

---

## STORIES & COMMENTS

- Create story
- Add comment
- Comment persists after refresh
- Comment linked to correct user & story

---

## MESSAGING

- User A → User B message
- Message persists
- Ordering correct
- Refresh → messages persist
- No cross-user leakage

---

## EVENTS (WITH IMAGE URLS)

- Create event with image
- Event saves
- Image URL stored
- Image renders after refresh
- Event visible in list & detail

---

## NOTIFICATIONS

- Message triggers notification
- Story comment triggers notification
- Event triggers notification
- No duplicates

---

## LEGAL & COMPLIANCE

- Terms page loads
- Privacy page loads
- Acceptance required for new users
- Acceptance stored
- Returning users not re-blocked

---

## FINAL PASS CRITERIA

ALL sections must pass.  
No network errors.  
No silent failures.

Only then may deployment be considered successful.

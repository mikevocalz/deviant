# UI Smoke Checklist - SEV-0 Regression Testing

**Last Updated:** 2026-01-28

Run through this checklist after any major changes to verify no regressions.

---

## Pre-flight Checks

- [ ] App builds without TypeScript errors (`npx tsc --noEmit`)
- [ ] CURL smoke tests pass (`./tests/smoke-tests.sh`)
- [ ] No console errors on app launch

---

## 1. Feed Screen

- [ ] Feed loads posts
- [ ] **Avatars render** (not fallback ui-avatars)
- [ ] Post images/videos display
- [ ] Like button toggles (heart fills/unfills)
- [ ] Like count updates immediately
- [ ] Bookmark button toggles
- [ ] Comments count shows
- [ ] Tap post navigates to detail
- [ ] Pull-to-refresh works

## 2. Post Detail Screen

- [ ] Post loads with media
- [ ] **Avatar renders** for author
- [ ] Like state syncs with feed (if liked in feed, shows liked here)
- [ ] Like/unlike works
- [ ] Bookmark works
- [ ] Comments load (threaded if replies exist)
- [ ] Comment input works
- [ ] Comment likes work
- [ ] Back navigation returns to feed

## 3. Stories

- [ ] Stories bar appears on feed
- [ ] **Story avatars render**
- [ ] Tap story opens viewer
- [ ] Story media plays/displays
- [ ] Progress bar advances
- [ ] Swipe to next story works
- [ ] Close button works

## 4. Profile Screen (Own)

- [ ] Profile loads
- [ ] **Avatar renders**
- [ ] Followers count shows
- [ ] Following count shows
- [ ] Posts count shows
- [ ] Posts grid loads
- [ ] Edit profile opens
- [ ] Avatar change works
- [ ] Bio update saves

## 5. Profile Screen (Other User)

- [ ] Profile loads for other users
- [ ] **Avatar renders**
- [ ] Follow/Unfollow button works
- [ ] Follower count updates on follow
- [ ] Posts grid loads

## 6. Activity/Notifications

- [ ] Activity screen loads
- [ ] Notifications appear
- [ ] Follow notifications show
- [ ] Like notifications show
- [ ] Comment notifications show
- [ ] Tap notification navigates correctly

## 7. Bookmarks

- [ ] Bookmarks tab shows on profile
- [ ] Bookmarked posts appear
- [ ] Unbookmark removes from list
- [ ] Bookmark persists across sessions

## 8. Events

- [ ] Events screen loads
- [ ] Event cards display
- [ ] Event detail shows all info
- [ ] Attendees list loads
- [ ] Ticket purchase flow works
- [ ] QR code displays on ticket
- [ ] QR code is unique per ticket

## 9. Videos

- [ ] Videos play in feed
- [ ] Videos play in post detail
- [ ] Mute/unmute works
- [ ] Seek bar works
- [ ] Videos pause when scrolled away

## 10. Comments

- [ ] Comments load on post detail
- [ ] Threaded replies show (indented)
- [ ] Reply to comment works
- [ ] Like comment works
- [ ] Comment like count updates

---

## Quick Regression Test (5 min)

If short on time, verify these critical paths:

1. [ ] Open app → Feed loads with avatars
2. [ ] Like a post → Heart fills, count increments
3. [ ] Open post detail → Same like state shown
4. [ ] Unlike in detail → Returns to feed, heart unfilled
5. [ ] Bookmark a post → Check profile saved tab
6. [ ] Follow a user → Count updates
7. [ ] Post a comment → Appears in list

---

## Notes

- If avatars show `ui-avatars.com` fallback, check `depth` parameter in API calls
- If likes don't sync, check query keys in `usePostLikeState`
- If bookmarks don't persist, check `useBookmarks` query key includes `viewerId`

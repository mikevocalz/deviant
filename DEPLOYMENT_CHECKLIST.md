# Deployment Checklist

**PHASE 4: Deployment Discipline**

Use this checklist for EVERY release. Do not skip steps.

---

## Pre-Deployment

### 1. Code Quality
- [ ] All TypeScript errors resolved (`npx tsc --noEmit`)
- [ ] No `localhost` or `127.0.0.1` in codebase
- [ ] No `console.log` spam (only structured logging)
- [ ] No `any` types in new code
- [ ] No disabled ESLint rules without justification

### 2. Environment Configuration
- [ ] `eas.json` has all env vars in ALL profiles (development, preview, production)
- [ ] Required env vars:
  - `EXPO_PUBLIC_AUTH_URL` = `https://server-zeta-lovat.vercel.app`
  - `EXPO_PUBLIC_API_URL` = `https://payload-cms-setup-gray.vercel.app`
  - `EXPO_PUBLIC_BUNNY_CDN_URL` = `https://dvnt.b-cdn.net`
  - `EXPO_PUBLIC_BUNNY_API_KEY` (set in EAS secrets)
  - `EXPO_PUBLIC_BUNNY_STORAGE_ZONE` = `dvnt`
- [ ] No empty string fallbacks for required env vars

### 3. Database / Backend
- [ ] Payload CMS deployed and healthy
- [ ] Database migrations applied (if any)
- [ ] New schema fields added as optional first
- [ ] Backend invariants enforced:
  - PostLikes: UNIQUE(user, post)
  - PostBookmarks: UNIQUE(user, post)
  - Follows: UNIQUE(follower, following)
  - Comments: max 2 levels deep
  - Stories: expired excluded from queries

---

## Testing

### 4. Automated Tests
- [ ] Smoke tests pass locally: `runSmokeTests()`
- [ ] API health check returns OK
- [ ] Auth endpoint reachable
- [ ] Feed endpoint returns data

### 5. Manual Testing (REQUIRED)
- [ ] Signup (18+) - DOB validation works
- [ ] Login - Auth flow completes
- [ ] Open profile - No crash
- [ ] Create post with caption
- [ ] Like twice → count only +1
- [ ] Bookmark twice → only one bookmark
- [ ] Follow/unfollow works
- [ ] Comments threaded (2 levels)
- [ ] Comment input clears after submit
- [ ] Video post detail - No crash
- [ ] Stories work (my vs others, no double-play)
- [ ] Messages inbox/spam classification works

---

## Build & Deploy

### 6. Build
- [ ] `eas build --profile production --platform ios`
- [ ] `eas build --profile production --platform android`
- [ ] Build succeeds without errors
- [ ] App bundle size reasonable (<100MB)

### 7. OTA Update (if applicable)
- [ ] `eas update --branch production --message "v{version}"`
- [ ] Update published successfully
- [ ] Verify update shows in EAS dashboard

### 8. Store Submission (if applicable)
- [ ] `eas submit --platform ios`
- [ ] `eas submit --platform android`
- [ ] Screenshots updated (if UI changed)
- [ ] Release notes written
- [ ] Privacy policy URL valid

---

## Post-Deployment

### 9. Verification
- [ ] App launches on fresh install
- [ ] Existing users can update without data loss
- [ ] Auth tokens still valid after update
- [ ] No crash spikes in logs
- [ ] API error rate stable

### 10. Monitoring
- [ ] Check error logs for 30 minutes post-deploy
- [ ] Monitor:
  - 401/403 spikes
  - 500 error spikes
  - "Network request failed" occurrences
  - Crash rate on Profile / PostDetail
- [ ] Rollback plan ready if issues found

---

## Rollback Procedure

If critical issues found:

1. **OTA Update**: `eas update --branch production --message "rollback"`
2. **Store Build**: Submit previous working build
3. **Backend**: Revert Payload CMS to last known good commit
4. **Database**: DO NOT rollback schema - only data if absolutely necessary

---

## Release Discipline Rules

### One Change Per Release
- Ship fixes in small batches
- One risky area per release
- Feature flags for experimental features

### Feature Flags
```typescript
// Use for risky changes
const FEATURE_FLAGS = {
  NEW_VIDEO_PLAYER: false,
  OPTIMISTIC_LIKES: false, // Re-enable after backend invariants
  NEW_STORIES_UI: false,
};
```

### Migration Strategy
1. Add new fields as OPTIONAL (`required: false`)
2. Deploy schema change
3. Backfill data via script
4. Only then enforce required constraints

---

## Emergency Contacts

- **On-Call Engineer**: [Add contact]
- **Backend Team**: [Add contact]
- **DevOps**: [Add contact]

---

## Version History

| Version | Date | Changes | Status |
|---------|------|---------|--------|
| 1.0.0 | YYYY-MM-DD | Initial release | ✅ |

---

**Remember: Do not stop until the Core Smoke Suite passes 100%**

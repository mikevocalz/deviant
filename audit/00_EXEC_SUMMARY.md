# DVNT (Deviant) — Production Audit Executive Summary

**Date**: 2026-02-23
**Auditor Role**: Corporate Fellow / Chief Architect + Principal Product Designer + Security Lead
**Repo**: github.com/mikevocalz/deviant
**Commit**: 0ec2ac8 (main)

---

## Verdict: SHIP WITH FIXES

The app is functional and well-architected for its stage. Three **critical** findings require immediate action before the next release. The codebase shows strong patterns (Zustand stores, edge function isolation, RLS everywhere) but has security gaps in media upload auth and missing guardrails that will compound as the team grows.

---

## Scorecard

| Dimension                 | Grade | Critical Issues                                              |
| ------------------------- | ----- | ------------------------------------------------------------ |
| **Security & Privacy**    | C+    | 1 critical (Bunny API key client-side), 2 medium             |
| **Performance**           | B     | 109 setTimeout violations, 1 banned FlatList                 |
| **Reliability**           | B-    | Error boundaries on 3/96 screens, no retry on edge functions |
| **Frontend Architecture** | B+    | Clean Expo Router + Zustand + TanStack Query                 |
| **Backend Architecture**  | A-    | 69 edge functions, all auth-gated, solid RLS                 |
| **UX/Product Design**     | B     | Good invariants documented, missing loading/empty states     |
| **Migration Safety**      | B-    | 58 active + 18 skipped migrations, no rollback scripts       |

---

## Critical Findings (Fix Before Next Release)

### SEC-01: Bunny Storage API Key Exposed Client-Side

- **Severity**: CRITICAL
- **File**: `lib/bunny-storage.ts:24-25`
- **Impact**: Anyone who extracts the JS bundle can upload/delete arbitrary files to your CDN
- **Fix**: Move uploads through an edge function (like `media-upload`) that holds the key server-side

### SEC-02: No Rate Limiting on Write Edge Functions

- **Severity**: MEDIUM
- **Evidence**: Only video functions (`video_create_room`, `video_join_room`, `video_refresh_token`) have rate limiting. Auth, messaging, likes, follows, comments — none.
- **Fix**: Add per-user rate limiting via Redis/Upstash or in-memory map in edge functions

### REL-01: Error Boundaries Cover Only 3 of 96 Screens

- **Severity**: MEDIUM
- **Evidence**: Only `(tabs)/index.tsx`, `post/[id].tsx`, `(tabs)/profile.tsx` have error boundaries
- **Fix**: Add a global error boundary in `app/_layout.tsx` wrapping the slot

---

## Device Validation

| Check                | Result                                        |
| -------------------- | --------------------------------------------- |
| iOS device detected  | ✅ Mike V. iPhone (iOS 26.0.1)                |
| Android device       | ❌ None connected                             |
| WDA running          | ✅ Connected via go-ios tunnel + port forward |
| App launches         | ✅ Cold launch → splash → feed in ~3s         |
| Auth persisted       | ✅ User stays logged in across restarts       |
| Feed loads           | ✅ Real posts with images visible             |
| Post detail          | ✅ Likes, caption, comments rendered          |
| Messages             | ✅ 9+ real conversations loaded               |
| Profile (deep link)  | ✅ @mikevocalz — 2 posts, 12 followers        |
| Settings (deep link) | ✅ All sections render correctly              |
| Deep linking         | ✅ dvnt:// scheme works                       |

See `audit/DEVICE_SMOKE_TEST.md` for full results and WDA limitations.

---

## Metrics

| Metric               | Value           |
| -------------------- | --------------- |
| TypeScript errors    | **0**           |
| Screen files (app/)  | 96              |
| Library files (lib/) | 185             |
| Component files      | 110             |
| Feature files (src/) | 143             |
| Edge functions       | 69 (15,806 LOC) |
| Active migrations    | 58              |
| Skipped migrations   | 18              |
| Package manager      | pnpm 10.28.0    |
| Expo SDK             | 55 (preview)    |
| React Native         | 0.84.0          |
| Node                 | 25.2.1          |

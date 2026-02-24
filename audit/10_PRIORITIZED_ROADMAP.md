# Prioritized Roadmap

## P0 — Fix Before Next Release (This Week)

| # | Finding | Effort | Impact |
|---|---------|--------|--------|
| 1 | **SEC-01**: Move Bunny uploads through edge function, remove client API key | 4h | Prevents CDN abuse |
| 2 | **REL-01**: Add global ErrorBoundary in `app/_layout.tsx` | 30min | Prevents full-app crashes |
| 3 | **FE-01**: Remove stale Payload CMS sections from CLAUDE.md | 1h | Prevents AI assistant confusion |

## P1 — Next Sprint

| # | Finding | Effort | Impact |
|---|---------|--------|--------|
| 4 | **SEC-02**: Add rate limiting to auth + write edge functions | 8h | Prevents spam/abuse |
| 5 | **BE-01**: Add shared `withRetry` wrapper for edge function DB queries | 2h | Handles transient failures |
| 6 | **REL-03**: Add `users.id` auto-increment sequence | 1h | Prevents race condition on concurrent signups |
| 7 | **PERF-02**: Replace FlatList in ChatSheet with LegendList | 30min | Consistency + performance |

## P2 — Next Month

| # | Finding | Effort | Impact |
|---|---------|--------|--------|
| 8 | **PERF-01**: Audit 109 setTimeout usages, replace debounce patterns | 8h | Memory leak prevention |
| 9 | **PERF-03**: Replace rAF polling with AbortSignal.timeout | 30min | CPU savings |
| 10 | **REL-02**: Document or remove 18 `.sql.skip` migration files | 2h | Migration hygiene |
| 11 | **SEC-03**: Document anon key rotation procedure | 1h | Operational readiness |
| 12 | **UX-01**: Create shared ScreenSkeleton + EmptyState components | 4h | Consistent UX |

## P3 — Backlog

| # | Finding | Effort | Impact |
|---|---------|--------|--------|
| 13 | **SEC-04**: Restrict CORS to specific origins | 1h | Defense in depth |
| 14 | **BE-02**: Decide on send-email edge function (keep/remove) | 30min | Code hygiene |
| 15 | **FE-02**: Upgrade to stable Expo SDK when available | 4h | Stability |
| 16 | Accessibility audit with VoiceOver/TalkBack | 16h | Inclusivity |
| 17 | CI pipeline: typecheck + guardrails + migration health | 8h | Prevent regressions |

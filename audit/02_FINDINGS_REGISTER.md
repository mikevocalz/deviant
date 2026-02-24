# Findings Register

| ID | Severity | Category | Title | File | Status |
|----|----------|----------|-------|------|--------|
| SEC-01 | CRITICAL | Security | Bunny Storage API key exposed client-side | `lib/bunny-storage.ts:24-25` | OPEN |
| SEC-02 | MEDIUM | Security | No rate limiting on write edge functions | `supabase/functions/*/index.ts` | OPEN |
| SEC-03 | MEDIUM | Security | Hardcoded Supabase anon key fallback | `lib/supabase/client.ts:13-14` | OPEN |
| SEC-04 | LOW | Security | CORS wildcard on all edge functions | `supabase/functions/_shared/verify-session.ts:47` | OPEN |
| SEC-05 | INFO | Security | Session token stored as raw DB lookup (no HMAC) | `supabase/functions/_shared/verify-session.ts:23-27` | OPEN |
| PERF-01 | MEDIUM | Performance | 109 setTimeout usages (banned per project rules) | Various app/lib/src files | OPEN |
| PERF-02 | LOW | Performance | FlatList usage in sneaky-lynk ChatSheet | `src/sneaky-lynk/ui/ChatSheet.tsx` | OPEN |
| PERF-03 | LOW | Performance | Upload timeout uses rAF polling instead of AbortSignal.timeout | `lib/bunny-storage.ts:289-299` | OPEN |
| REL-01 | MEDIUM | Reliability | Error boundaries on only 3 of 96 screens | `app/(protected)/` | OPEN |
| REL-02 | LOW | Reliability | 18 skipped migrations (.sql.skip) with no cleanup plan | `supabase/migrations/` | OPEN |
| REL-03 | LOW | Reliability | users.id has no auto-increment sequence | `supabase/` (known issue) | OPEN |
| FE-01 | LOW | Frontend | CLAUDE.md contains stale Payload CMS references | `CLAUDE.md:257-493` | OPEN |
| FE-02 | INFO | Frontend | Expo SDK 55 preview — not yet GA | `package.json:63` | OPEN |
| BE-01 | MEDIUM | Backend | Edge functions don't retry on transient DB errors | `supabase/functions/*/index.ts` | OPEN |
| BE-02 | LOW | Backend | send-email edge function is dead code (auth sends directly) | `supabase/functions/send-email/` | OPEN |
| UX-01 | LOW | UX | No global loading skeleton / empty state pattern | Various screens | OPEN |

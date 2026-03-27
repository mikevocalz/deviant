# Evidence Index

All findings are backed by specific file paths, line numbers, and commands.

## SEC-01: Bunny API Key Client-Side

- **File**: `lib/bunny-storage.ts:24-25`
- **Command**: `grep -rn "EXPO_PUBLIC_BUNNY_STORAGE_API_KEY" lib/ app/ --include="*.ts"`
- **Proof**: `EXPO_PUBLIC_` prefix = bundled into JS, extractable from Hermes bytecode

## SEC-02: No Rate Limiting

- **Command**: `grep -r "rateLimit\|rate.limit\|throttle\|MAX_REQUESTS" supabase/functions/ --include="*.ts"`
- **Result**: Only 3 matches in `video_create_room`, `video_join_room`, `video_refresh_token`
- **Missing**: All other 66 edge functions

## SEC-03: Hardcoded Anon Key

- **File**: `lib/supabase/client.ts:13-14`
- **Value**: Full JWT starting with `eyJhbGciOiJIUzI1NiIs...`

## SEC-04: CORS Wildcard

- **File**: `supabase/functions/_shared/verify-session.ts:47`
- **Value**: `"Access-Control-Allow-Origin": "*"`

## SEC-05: Session Raw DB Lookup

- **File**: `supabase/functions/_shared/verify-session.ts:23-27`

## PERF-01: setTimeout Count

- **Command**: `grep -rn "setTimeout" lib/ app/ components/ src/ --include="*.ts" --include="*.tsx" | grep -v node_modules | wc -l`
- **Result**: 109

## PERF-02: Banned FlatList

- **File**: `src/sneaky-lynk/ui/ChatSheet.tsx`
- **Command**: `grep -r "FlatList" app/ components/ src/ --include="*.tsx" | grep -v node_modules`

## PERF-03: rAF Polling Timeout

- **File**: `lib/bunny-storage.ts:289-299`

## REL-01: Error Boundary Coverage

- **Command**: `grep -rn "ErrorBoundary" app/ --include="*.tsx" | grep -v node_modules`
- **Result**: 3 screens out of 96

## REL-02: Skipped Migrations

- **Command**: `find supabase/migrations -name "*.sql.skip" | wc -l`
- **Result**: 18

## REL-03: users.id No Sequence

- **Source**: Previous session memory — confirmed via `INSERT` failures and `max(id)+1` workarounds in edge functions

## FE-01: Stale CLAUDE.md Sections

- **File**: `CLAUDE.md:257-303` (Payload CMS Database Optimization)
- **File**: `CLAUDE.md:366-493` (Database Schema Sync with Payload)
- **File**: `CLAUDE.md:1230-1326` (Payload CMS Integration)

## BE-01: No Retry in Edge Functions

- **Pattern**: `const { data, error } = await supabase.from(...).select(...)` — single attempt, no retry wrapper
- **Scope**: All 69 edge functions

## BE-02: Dead send-email Function

- **File**: `supabase/functions/send-email/index.ts` (280 LOC)
- **Evidence**: `auth/index.ts` sends emails directly via Resend; no caller invokes `send-email`

## UX-01: No Shared Loading/Empty Components

- **Command**: `grep -rn "ScreenSkeleton\|EmptyState" app/ components/ --include="*.tsx" | grep -v node_modules`
- **Result**: 0 matches

## Device Validation

- **go-ios**: `ios list` → `{"deviceList":["00008120-001C31990198201E"]}`
- **Tunnel**: Port 60105 bound (already running)
- **Port forward**: Port 8100 bound (already running)
- **WDA**: Built and signed, but timed out on automation mode (UI Automation not enabled on device)
- **Blocker doc**: `audit/DEVICE_BLOCKERS.md`

# Backend Architecture Audit

## Overview

- **Database**: Supabase PostgreSQL with RLS enabled on ALL tables
- **Auth**: Better Auth hosted in Supabase Edge Function (`auth`)
- **Edge Functions**: 69 Deno functions (15,806 total LOC)
- **Media Storage**: Bunny.net CDN (⚠️ key exposed client-side — see SEC-01)
- **Payments**: Stripe (secret key server-side only)
- **Email**: Resend (via auth edge function + send-email function)
- **Realtime**: Supabase Realtime for messaging subscriptions
- **Video**: Fishjam Cloud for WebRTC rooms

## Auth Flow

```
Client → Better Auth Client (lib/auth-client.ts)
       → Supabase Edge Function: auth
       → betterAuth() handler with pg Pool
       → session table (Better Auth)
       → user table (Better Auth)

Edge Functions verify auth via:
  verify-session.ts → SELECT from session WHERE token = ? AND expiresAt > now()
```

## RLS Policy Design

- Every table has `anon_select` policy: `FOR SELECT TO anon USING (true)`
- No INSERT/UPDATE/DELETE policies for `anon` — all writes via edge functions
- Edge functions use `service_role` which bypasses RLS
- This is a clean pattern: client reads are safe, all mutations are server-validated

## BE-01: MEDIUM — Edge Functions Don't Retry on Transient DB Errors

**Observation**: Edge functions make a single Supabase query attempt. Transient errors (connection pool exhaustion, brief network blip) cause immediate failure.

**Example** (common pattern across all 69 functions):

```typescript
const { data, error } = await supabase.from("posts").select("*").eq("id", postId);
if (error) throw error; // No retry
```

**Fix**: Create a shared `withRetry` wrapper:

```typescript
// supabase/functions/_shared/retry.ts
export async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  for (let i = 0; i < attempts; i++) {
    try { return await fn(); }
    catch (e) { if (i === attempts - 1) throw e; await new Promise(r => setTimeout(r, 100 * (i + 1))); }
  }
  throw new Error("unreachable");
}
```

## BE-02: LOW — send-email Edge Function Is Dead Code

**File**: `supabase/functions/send-email/index.ts` (280 LOC)

Nobody calls this function. The `auth` edge function handles its own emails directly via Resend. The `send-email` function has templates for `welcome`, `confirm-email`, `reset-password` but is never invoked.

**Decision**: User chose to leave as-is for now (2026-02-23).

## Positive Findings

- ✅ All 69 edge functions verify Authorization header
- ✅ Stripe secrets server-side only
- ✅ `--no-verify-jwt` correctly used for Better Auth token compatibility
- ✅ `createClient` uses `{ auth: { persistSession: false } }` in edge functions
- ✅ COUNT(*) triggers replace racy RPC increment/decrement for all counters
- ✅ Shared `verify-session.ts` + `CORS_HEADERS` prevent duplication
- ✅ `resolveOrProvisionUser` shared helper for user auto-creation
- ✅ Webhook signature verification on Stripe endpoints
- ✅ Batched queries in conversations (O(4) not O(N×4))
- ✅ Edge function email URLs now correctly route through gateway (fixEmailUrl)

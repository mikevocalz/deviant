# Security & Privacy Audit

## SEC-01: CRITICAL — Bunny Storage API Key Exposed Client-Side

**File**: `lib/bunny-storage.ts:24-25`

```typescript
const BUNNY_STORAGE_API_KEY =
  process.env.EXPO_PUBLIC_BUNNY_STORAGE_API_KEY || "";
```

**Impact**: The `EXPO_PUBLIC_` prefix means this key is bundled into the JS bundle shipped to every user's device. Anyone who extracts the Hermes bytecode (trivial with `hermes-dec`) gets a write-capable storage key that can:

- Upload arbitrary files to your CDN (malware hosting, illegal content)
- Delete existing media files (user content destruction)
- Overwrite existing paths (content injection)

**Fix**: Create a `media-upload` edge function proxy (one already exists at `supabase/functions/media-upload/index.ts`). Route ALL client uploads through it. Remove `EXPO_PUBLIC_BUNNY_STORAGE_API_KEY` from client env vars entirely.

**Verification**: `grep -r "EXPO_PUBLIC_BUNNY_STORAGE_API_KEY" --include="*.ts" --include="*.tsx" lib/ app/ components/ src/` should return 0 results after fix.

---

## SEC-02: MEDIUM — No Rate Limiting on Write Edge Functions

**Evidence**: Searched all 69 edge functions for `rateLimit|rate.limit|throttle|MAX_REQUESTS`. Only 3 video functions have rate limiting:

- `video_create_room/index.ts`
- `video_join_room/index.ts`
- `video_refresh_token/index.ts`

**Missing rate limits on**:

- `auth/index.ts` — login/signup brute force
- `send-message/index.ts` — message spam
- `toggle-like/index.ts` — like/unlike spam
- `toggle-follow/index.ts` — follow/unfollow spam
- `add-comment/index.ts` — comment spam
- `create-post/index.ts` — post spam

**Fix**: Add per-user rate limiting using Upstash Redis or an in-memory map with TTL. Recommended limits:

- Auth: 5 attempts per minute per IP
- Writes: 30 per minute per user
- Messages: 60 per minute per user

---

## SEC-03: MEDIUM — Hardcoded Supabase Anon Key Fallback

**File**: `lib/supabase/client.ts:13-14`

```typescript
const FALLBACK_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...";
```

**Impact**: While Supabase anon keys are designed to be public (they only grant RLS-gated SELECT access), hardcoding prevents key rotation. If the key is ever compromised or needs rotation, you'd need a native build to update the fallback.

**Fix**: Keep the fallback for resilience but add a comment documenting key rotation requires a native build. Consider fetching the key from a config endpoint as a future improvement.

---

## SEC-04: LOW — CORS Wildcard on All Edge Functions

**File**: `supabase/functions/_shared/verify-session.ts:47`

```typescript
"Access-Control-Allow-Origin": "*",
```

**Impact**: Any website can make authenticated requests to your edge functions if the user has a valid session token. For a mobile-only app this is low risk, but if you ever serve a web client, this becomes medium.

**Fix**: Restrict to `dvnt://` and your web domain when applicable.

---

## SEC-05: INFO — Session Verification via Raw DB Lookup

**File**: `supabase/functions/_shared/verify-session.ts:23-27`

```typescript
const { data: session, error } = await supabase
  .from("session")
  .select("userId, expiresAt")
  .eq("token", token)
  .single();
```

**Observation**: Session tokens are looked up by exact match against the `session` table. This is Better Auth's design. The token itself is opaque but not HMAC-signed server-side — compromise of the DB leaks all sessions.

**Mitigation**: This is inherent to Better Auth's architecture. Ensure the `session` table has RLS that only `service_role` can read it.

---

## Positive Findings

- ✅ No hardcoded secrets (Stripe, Resend, etc.) in client code
- ✅ All 69 edge functions verify Authorization header
- ✅ Stripe secret keys only in edge functions (server-side)
- ✅ Service role key never appears in `lib/` client code
- ✅ `persistSession: false` on Supabase client (no Supabase auth tokens stored)
- ✅ SecureStore used for Better Auth tokens (not AsyncStorage)
- ✅ No `eval()`, `dangerouslySetInnerHTML`, or `innerHTML` in app code
- ✅ Share-page edge function properly escapes HTML output (`escapeHtml`)
- ✅ RLS enabled on all tables with `anon_select` policies

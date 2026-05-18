# Findings Register v2 — Add-ons, Scanner, Share URLs

Wave-1 (Phase 1 inventory + targeted code audit) — 2026-05-18 session.
v1 findings tracked separately in `02_FINDINGS_REGISTER.md`.

## Verified findings

| ID | Severity | Category | Title | File | Status |
|----|----------|----------|-------|------|--------|
| **V2-SEC-01** | **P0** | Security / Auth | **`ticket-scan` edge function had NO `verifySession`.** Any authed user with a copy of a QR token could mark tickets scanned. `scanned_by` was user-supplied and unvalidated. | `supabase/functions/ticket-scan/index.ts:57-100` | **FIXED** (`9d269cee`) |
| **V2-SEC-02** | **P0** | Security / Auth | **Scanner UI route had no host-only guard.** Any authed user could navigate to `/events/<id>/scanner` and access the camera + scan tickets. | `app/(protected)/events/[id]/scanner.tsx:233-260` | **FIXED** (`9d269cee`) |
| V2-BE-01 | P1 | Backend / Defensive | **12 Stripe-touching edge functions lacked the 503 STRIPE_SECRET_KEY guard.** Added uniform pattern + console.error startup warning. `stripe-webhook` intentionally excluded — webhooks must return 200 to prevent Stripe retry storms. Coverage now 19/20 Stripe functions. | `supabase/functions/{cart-line-refund,delete-account,host-disputes,host-payouts,organizer-connect,organizer-refund,payment-methods,payouts-release,promotion-checkout,purchases,reconcile-orders,ticket-refund}/index.ts` | **FIXED** |
| **V2-LINK-00** | **P0** | Universal Links | **`dvntlive.app` does not resolve in public DNS.** No A, no NS records. iOS entitlement declares `applinks:dvntlive.app` (`app.config.js:65`) and the entire share-URL flow uses `https://dvntlive.app/...` (client share builders, push notification deep links, Android intent filters, edge function-generated URLs). Since iOS cannot fetch AASA from a non-existent host, **no universal link can possibly resolve back into the app right now** — every shared link will fail to load entirely (no Safari fallback because the domain itself doesn't exist). Verified by `dig @1.1.1.1 dvntlive.app` returning empty + `curl` failing with "Could not resolve host". | `app.config.js:65,204-205`; share-URL builders across `lib/` and `supabase/functions/` | **OPEN — needs domain registration + Vercel deploy** |
| **V2-LINK-01** | **P1** | Universal Links | **AASA missing 4 path patterns** that map to registered routes. `/tickets/*` (success/cancel/guest), `/my-tickets`, `/organizer-setup`, `/sneaky/*` were not in `apple-app-site-association`, so once V2-LINK-00 is unblocked, these would still open in Safari. Confirmed via Explore audit cross-referencing `lib/deep-linking/route-registry.ts`. | `public/.well-known/apple-app-site-association` | **FIXED (content only — gated on V2-LINK-00 to be testable)** |
| V2-LINK-02 | P2 | Android App Links | **`assetlinks.json` still contains placeholder fingerprints** `<DEBUG_SHA256_FINGERPRINT>` / `<RELEASE_SHA256_FINGERPRINT>`. Until populated with real signing-key SHA256s, Android App Links won't validate and deep links fall back to browser. Requires the user's keystore fingerprints — held for explicit user input. | `public/.well-known/assetlinks.json` | **OPEN** (needs keystore fingerprints) |
| **V2-DB-01** | **P1** | Database / RLS | **3 public tables had RLS disabled** (advisor `rls_disabled_in_public`, ERROR level): `content_audit_log`, `sneaky_usage_tracking`, `liked_activity_history`. All three are server-only (trigger / edge-function writes). Enabled RLS + added explicit deny policies for anon/authenticated; service_role bypasses RLS so writes still work. | DB migration `v2_db_01_enable_rls_on_public_tables` | **FIXED** |
| V2-DB-02 | P3 | Database / Hygiene | **39 `function_search_path_mutable` lints** (advisor undercounted at 244; real count was 39 in `public`). Pinned `search_path = public, pg_temp` on all of them to prevent role-mutable search-path attacks. | DB migration `v2_db_02_set_function_search_paths` | **FIXED** |
| **V2-DB-03** | **P0** | Database / RPC | **34 SECURITY DEFINER functions exposed via PostgREST `/rest/v1/rpc/*` to the `anon` role.** Included `cart_apply_line_refund`, `increment_promo_uses`, `issue_rsvp_ticket`, `submit_verification_request`, `increment_event_attendees`, all `audit_*_delete` triggers, all `sync_*` and `reconcile_*` maintenance fns, all rate-limit fns, room-moderation helpers. Revoked EXECUTE from anon (and authenticated where appropriate). 7 intentional public-feed RPCs (`get_events_home`, `get_event_detail`, `get_events_for_you`, `get_promoted_event_ids`, `get_spotlight_feed`, `viewer_can_see_nsfw`) kept anon-callable. **Architectural follow-up**: `issue_rsvp_ticket` / `submit_verification_request` / `increment_event_attendees` accept `p_user_auth_id` as a parameter rather than deriving from session. A logged-in user could pass another user's auth_id. Should be routed through an edge function that validates the Better Auth token. | DB migration `v2_db_03_lock_down_security_definer_rpcs` | **FIXED** (with arch follow-up logged below) |
| V2-DB-04 | P2 | Auth / Settings | **`auth_leaked_password_protection` is OFF** — Supabase auth setting that checks new passwords against the HIBP breach database. Dashboard toggle, not fixable via SQL. Recommend enabling. | Supabase Dashboard → Authentication → Policies | **OPEN** (dashboard toggle) |
| **V2-DB-05** | **P2** | Architectural | **2 of 3 RPCs that accept caller's `p_user_auth_id` as a parameter now wrapped.** `issue_rsvp_ticket` and `submit_verification_request` are now callable only by `service_role` via two new edge functions (`rsvp-issue-ticket`, `submit-verification`) that derive auth_id from the Better Auth session. Authenticated EXECUTE revoked via migration `v2_db_05_revoke_authenticated_on_spoofable_rpcs`. Smoke-tested anon → 401. | `supabase/functions/rsvp-issue-ticket/`, `supabase/functions/submit-verification/`, `lib/api/{tickets,users}.ts` | **FIXED** |
| V2-DB-05b | P3 | Architectural | **`increment_event_attendees(event_id)` still authenticated-callable** — no user_id param, so not a spoofing risk; the surface is "any authed user can inflate any event's counter". Existing trigger `trg_maintain_event_total_attendees` on `tickets` table already maintains the count for the ticket path. Proper fix: add a parallel trigger on `event_rsvps` table and drop both the RPC + the client call at `lib/api/events.ts:560`. Deferred — design needs review of past RSVPs to avoid double-counting on backfill. | `lib/api/events.ts:560` | **OPEN** (deferred) |

## Wave 6 regression sweep — 2026-05-18 session

Verified the V2-DB-03 SECURITY DEFINER lockdown didn't break authenticated flows. Used `has_function_privilege()` role-impersonation via MCP rather than relying on the app to break in prod.

**Caught and hotfixed:**

| Regression | Root cause | Fix |
|---|---|---|
| `service_role` lost EXECUTE on `can_user_moderate_room`, `get_user_room_role`, `is_user_banned_from_room` | `REVOKE ... FROM PUBLIC` cascades to all roles incl. service_role. Would have broken 9 video edge functions. | Migration `v2_db_03b_restore_service_role_grants` — re-granted service_role on 8 helper RPCs (room moderation, rate-limit, info disclosure). |
| `expire_spotlight_campaigns` silently failing from `lib/api/promotions.ts:42` after lockdown. The function is idempotent (only flips past-due rows) and the call site already tolerates errors as non-fatal, but expired campaigns would never auto-expire. | Same PUBLIC cascade as above. | Migration `v2_db_03c_restore_spotlight_sweep` — re-granted authenticated + service_role. Anon stays locked. |

**Verified clean:**

- Public-feed RPCs (`get_events_home`, `get_event_detail`, `get_events_for_you`, `get_promoted_event_ids`, `get_spotlight_feed`, `viewer_can_see_nsfw`) — anon still has EXECUTE.
- Authenticated client RPCs (`issue_rsvp_ticket`, `submit_verification_request`, `increment_event_attendees`) — authenticated still has EXECUTE.
- 14 trigger functions (audit_*_delete, sync_*, reconcile_*, maintain_*) — fire as table owner, EXECUTE perm irrelevant for trigger context. Verified no caller invokes them via RPC.
- `service_role` has `BYPASSRLS = true` — confirmed RLS-enabled tables (`content_audit_log`, `sneaky_usage_tracking`, `liked_activity_history`) still readable/writable from edge functions.
- `force_rls = false` on all 3 protected tables — no table-owner lockout.

## Pass-2 edge function audit — 2026-05-18 session

Careful per-function read of every write/destructive/money-touching function the first pass flagged. The first-pass agent had a >60% false-positive rate; this pass actually opened each file.

**Result:** No P0 or P1 findings. The codebase uses a consistent pattern across ~50 functions:

```ts
const auth = req.headers.get("Authorization") || "";
const token = auth.replace(/^Bearer\s+/i, "");
// session lookup against Better Auth `session` table → authUserId
// resolveOrProvisionUser(authUserId) → integer user.id
// inline ownership check: WHERE author_id = userId (or equivalent)
```

This isn't the `verifySession` helper name, which is why the first pass missed it via grep. The check is still correct.

Functions verified clean (sample):

- **Destructive**: `delete-comment`, `delete-conversation`, `delete-event`, `delete-post`, `delete-story` — all check `author_id === resolved_session_userId` before deletion.
- **Money / wallet**: `payouts-release` returns 500 if `CRON_SECRET` unset (correct posture); `wallet_web_service` is Apple PassKit's anonymous device-registration protocol (no auth by design); `ticket_wallet_google` validates ticket ownership via session.
- **Social writes**: all `toggle-*` and `*-like` / `*-bookmark` / message endpoints verify session.
- **Video moderation (12 fns)**: all 12 verify Better Auth session + check room role/moderation permission via RPC before mutating.
- **Admin / cron**: bootstrap-* are session-required, cleanup-expired-media is cron-only with secret guard.

Two P3 hygiene notes recorded (logged but not worth migration churn):

| ID | Sev | Note |
|---|---|---|
| V2-EF-PASS2-P3a | P3 | `video_ban_user` self-ban check uses `===` without type normalization. Worst case: ban-self anomaly, not a security issue. |
| V2-EF-PASS2-P3b | P3 | `wallet_web_service` Apple PassKit endpoints are auth-free by protocol. Confirmed safe — Apple signs device-side, server only stores opaque device tokens. |

## Cleared (agent claims that didn't hold up to verification)

| Claim | Status |
|---|---|
| `delete-post` has no auth — Verifies `post.author_id !== userData.id` at L98 | ✅ NOT A BUG |
| `delete-conversation` has no participant check — scopes to `userIntId` at L56/L286 | ✅ NOT A BUG |
| `close-friends` returns email/phone — selects only `id, username, first_name, last_name, avatar` | ✅ NOT A BUG |
| `get-event-tickets` returns buyer emails — selects only `id, host_id, qr_token, ticket_types(name)` | ✅ NOT A BUG |
| `cart-checkout` lacks 503 guard — present at L26-28 + L148-151 | ✅ NOT A BUG |
| `ticket-refund` lacks auth — `verifySession` at L66 | ✅ HAS AUTH (but lacks 503 guard, see V2-BE-01) |
| `create-test-user` is a public auth-creation hole — intentional Apple-review tool, single-use, comment in file | ✅ INTENTIONAL |
| Fee calculator uses floats — `Math.round(subtotal * 0.025)` with integer cents throughout; `toFixed(2)` only in display formatter | ✅ NOT A BUG |

## Phase 1 inventories (summary)

### 1.1 Screen inventory

Full inventory captured by Explore agent. Key counts:

- **Public routes:** 9 (root + 5 locked-tab + 4 unlogged-pages)
- **Auth routes:** 6 (login / signup / onboarding / forgot / reset / verify-email)
- **Protected routes:** 50+ (tabs, feed, events, profile, story, ticket, chat, sneaky-lynk, debug screens)
- **Settings routes:** 30+ (account, payments, host-*, theme, legal)
- **Host-only routes (client-side gated):** `events/[id]/organizer`, `events/[id]/scanner`, `events/[id]/analytics`, `events/[id]/promo-codes`, `events/[id]/edit`, `events/organizer-setup`, `settings/host-*` (5 files)
- **No explicit admin routes** — admin actions are server-only via edge functions

**Concern:** Scanner is grouped client-side under `events/[id]/scanner.tsx`. As V2-SEC-02 confirms, the file has no top-level host check — relies entirely on the URL being non-obvious.

### 1.4 Edge function inventory

100+ edge functions inventoried. Verified buckets:

- **Stripe-touching:** 20 functions; 7 have 503 guard, **12 do not** (V2-BE-01)
- **Session-required (verified):** create-payment-intent, ticket-checkout, ticket-upgrade, ticket-refund, cart-checkout, sneaky-access-checkout, sneaky-billing-checkout, sneaky-billing-portal, transfer-ticket, delete-account, host-* (4), report-content, branding, event-waitlist, toggle-event-like, create-event-moment, get-bookmarks, get-my-tickets, etc.
- **Public (Bearer-accepted, not validated):** Some `delete-*` / `toggle-*` / `create-*` functions — agent claimed many were unauth'd but spot-checks showed they DO check author IDs internally before mutating. **Recommend a full second pass on the "public" group by a careful auditor; the first pass had >60% false-positive rate.**

### Add-on math (fee calculator audit)

- ✅ All amounts in integer cents
- ✅ `Math.round` on percentage calculations — no float drift
- ✅ Invariant assertion: `customer_charge_amount === organizer_transfer_amount + application_fee_amount`
- ✅ Negative-amount guard at L74 if `organizer_transfer_amount < 0`
- ✅ Display formatter `formatPrice` is the only place `toFixed(2)` is used; pure presentation

**No add-on math findings.** This is a strong area.

## What was NOT covered (deferred)

- **1.2 Component inventory** — skipped (low signal density, large scope)
- **1.3 Sheet inventory** — skipped (most sheets verified individually in earlier waves)
- **Share URL handlers** — AASA file is correct, but per-surface deep link resolution logic in `lib/deep-linking/` not yet audited
- **Universal Link round-trip test** — needs device + Messages app to validate end-to-end (Wave 7 territory)
- **Live scanner E2E** — V2-SEC-01/02 should be fixed before testing because the current state is exploitable

## Recommended next actions

1. **Fix V2-SEC-01 + V2-SEC-02 before any live scanner testing.** The exploit is trivial (forge a scan with any captured QR token).
2. **Fix V2-BE-01** by adding the 503 guard pattern to the 12 missing Stripe functions — defensive, low risk.
3. **Re-run edge function audit** with a careful per-function check rather than batch grep, since the first pass had high false positive rate.
4. **Then** proceed to Wave 7 real-world tests (door-rush, deep link click-storm, low-connectivity venue simulation).

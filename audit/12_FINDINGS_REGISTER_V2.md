# Findings Register v2 — Add-ons, Scanner, Share URLs

Wave-1 (Phase 1 inventory + targeted code audit) — 2026-05-18 session.
v1 findings tracked separately in `02_FINDINGS_REGISTER.md`.

## Verified findings

| ID | Severity | Category | Title | File | Status |
|----|----------|----------|-------|------|--------|
| **V2-SEC-01** | **P0** | Security / Auth | **`ticket-scan` edge function had NO `verifySession`.** Any authed user with a copy of a QR token could mark tickets scanned. `scanned_by` was user-supplied and unvalidated. | `supabase/functions/ticket-scan/index.ts:57-100` | **FIXED** (`9d269cee`) |
| **V2-SEC-02** | **P0** | Security / Auth | **Scanner UI route had no host-only guard.** Any authed user could navigate to `/events/<id>/scanner` and access the camera + scan tickets. | `app/(protected)/events/[id]/scanner.tsx:233-260` | **FIXED** (`9d269cee`) |
| V2-BE-01 | P1 | Backend / Defensive | **12 Stripe-touching edge functions lacked the 503 STRIPE_SECRET_KEY guard.** Added uniform pattern + console.error startup warning. `stripe-webhook` intentionally excluded — webhooks must return 200 to prevent Stripe retry storms. Coverage now 19/20 Stripe functions. | `supabase/functions/{cart-line-refund,delete-account,host-disputes,host-payouts,organizer-connect,organizer-refund,payment-methods,payouts-release,promotion-checkout,purchases,reconcile-orders,ticket-refund}/index.ts` | **FIXED** |
| **V2-LINK-01** | **P1** | Universal Links | **AASA missing 4 path patterns** that map to registered routes. `/tickets/*` (success/cancel/guest), `/my-tickets`, `/organizer-setup`, `/sneaky/*` were not in `apple-app-site-association`, so legitimate share links opened in Safari instead of the app. Confirmed via Explore audit cross-referencing `lib/deep-linking/route-registry.ts`. | `public/.well-known/apple-app-site-association` | **FIXED** |
| V2-LINK-02 | P2 | Android App Links | **`assetlinks.json` still contains placeholder fingerprints** `<DEBUG_SHA256_FINGERPRINT>` / `<RELEASE_SHA256_FINGERPRINT>`. Until populated with real signing-key SHA256s, Android App Links won't validate and deep links fall back to browser. Requires the user's keystore fingerprints — held for explicit user input. | `public/.well-known/assetlinks.json` | **OPEN** (needs keystore fingerprints) |
| **V2-DB-01** | **P1** | Database / RLS | **3 public tables had RLS disabled** (advisor `rls_disabled_in_public`, ERROR level): `content_audit_log`, `sneaky_usage_tracking`, `liked_activity_history`. All three are server-only (trigger / edge-function writes). Enabled RLS + added explicit deny policies for anon/authenticated; service_role bypasses RLS so writes still work. | DB migration `v2_db_01_enable_rls_on_public_tables` | **FIXED** |
| V2-DB-02 | P3 | Database / Hygiene | **39 `function_search_path_mutable` lints** (advisor undercounted at 244; real count was 39 in `public`). Pinned `search_path = public, pg_temp` on all of them to prevent role-mutable search-path attacks. | DB migration `v2_db_02_set_function_search_paths` | **FIXED** |
| **V2-DB-03** | **P0** | Database / RPC | **34 SECURITY DEFINER functions exposed via PostgREST `/rest/v1/rpc/*` to the `anon` role.** Included `cart_apply_line_refund`, `increment_promo_uses`, `issue_rsvp_ticket`, `submit_verification_request`, `increment_event_attendees`, all `audit_*_delete` triggers, all `sync_*` and `reconcile_*` maintenance fns, all rate-limit fns, room-moderation helpers. Revoked EXECUTE from anon (and authenticated where appropriate). 7 intentional public-feed RPCs (`get_events_home`, `get_event_detail`, `get_events_for_you`, `get_promoted_event_ids`, `get_spotlight_feed`, `viewer_can_see_nsfw`) kept anon-callable. **Architectural follow-up**: `issue_rsvp_ticket` / `submit_verification_request` / `increment_event_attendees` accept `p_user_auth_id` as a parameter rather than deriving from session. A logged-in user could pass another user's auth_id. Should be routed through an edge function that validates the Better Auth token. | DB migration `v2_db_03_lock_down_security_definer_rpcs` | **FIXED** (with arch follow-up logged below) |
| V2-DB-04 | P2 | Auth / Settings | **`auth_leaked_password_protection` is OFF** — Supabase auth setting that checks new passwords against the HIBP breach database. Dashboard toggle, not fixable via SQL. Recommend enabling. | Supabase Dashboard → Authentication → Policies | **OPEN** (dashboard toggle) |
| V2-DB-05 | P3 | Architectural | **3 RPCs accept caller's `p_user_auth_id` as a parameter** — `issue_rsvp_ticket`, `submit_verification_request`, `increment_event_attendees`. With Better Auth (no Supabase JWT), the DB function cannot validate the caller from inside Postgres, so a logged-in user could spoof another user's id when calling these RPCs. Defense-in-depth fix: route through an edge function that calls `verifySession` and then invokes the RPC via service_role. | `lib/api/{tickets,users,events}.ts` | **OPEN** (architectural) |

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

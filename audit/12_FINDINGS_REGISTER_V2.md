# Findings Register v2 — Add-ons, Scanner, Share URLs

Wave-1 (Phase 1 inventory + targeted code audit) — 2026-05-18 session.
v1 findings tracked separately in `02_FINDINGS_REGISTER.md`.

## Verified findings

| ID | Severity | Category | Title | File | Status |
|----|----------|----------|-------|------|--------|
| **V2-SEC-01** | **P0** | Security / Auth | **`ticket-scan` edge function has NO `verifySession` — any authed user with a copy of a QR token can mark tickets scanned. `scanned_by` audit field is user-supplied and unvalidated.** Combined with V2-SEC-02 (no client-side host guard), gives full scanner abuse. | `supabase/functions/ticket-scan/index.ts:57-100` | OPEN |
| **V2-SEC-02** | **P0** | Security / Auth | **Scanner UI route `(protected)/events/[id]/scanner.tsx` has no host-only guard.** Any authed user can navigate to `/events/<id>/scanner` and access the live camera + scan tickets. Only `useAuthStore` is read; no `host_id === authUser.id` check. | `app/(protected)/events/[id]/scanner.tsx:233-260` | OPEN |
| V2-BE-01 | P1 | Backend / Defensive | **12 Stripe-touching edge functions lack the 503 STRIPE_SECRET_KEY guard** added to the 7 checkout functions earlier. If key rotates/expires, users hitting these surfaces see raw Stripe "did not provide API key" leakage. Affected: `cart-line-refund`, `delete-account`, `host-disputes`, `host-payouts`, `organizer-connect`, `organizer-refund`, `payment-methods`, `payouts-release`, `promotion-checkout`, `purchases`, `reconcile-orders`, `ticket-refund`, `stripe-webhook`. | `supabase/functions/*/index.ts` | OPEN |

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

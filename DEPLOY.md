# Deploy checklist — `claude/fix-crashes-improve-quality-aZkdM`

Everything in this branch ships without breaking users. Follow the
order below — a few steps have ordering constraints (the tickets RLS
lockdown is the most notable).

> **OTA channel is in quarantine** per the 2026-04-19 incident. All
> 28 client commits on this branch ride the next native EAS build.
> Do NOT publish an OTA update from this branch until the canary
> protocol in CLAUDE.md has re-established the OTA pipeline.

---

## 1. Migrations (apply in order)

All additive / idempotent. Safe to re-run.

```
supabase/migrations/20260422_event_waitlist.sql
supabase/migrations/20260423_guest_tickets.sql
supabase/migrations/20260424_ticket_types_capacity_alert.sql
supabase/migrations/20260426_event_spotlight_campaigns.sql
supabase/migrations/20260427_spotlight_expire_grant.sql
```

**Hold** `20260425_tickets_rls_lockdown.sql` until step 3 finishes.
Applying it before clients ship that know to use the new edge fns
will break ticket reads for users still on the old binary.

---

## 2. Edge functions (deploy in any order — all idempotent)

All use `--no-verify-jwt` per CLAUDE.md (Better Auth tokens, not
Supabase JWTs).

```
# New
npx supabase functions deploy get-my-tickets      --no-verify-jwt --project-ref npfjanxturvmjyevoyfo
npx supabase functions deploy get-event-tickets   --no-verify-jwt --project-ref npfjanxturvmjyevoyfo
npx supabase functions deploy event-analytics     --no-verify-jwt --project-ref npfjanxturvmjyevoyfo
npx supabase functions deploy event-waitlist      --no-verify-jwt --project-ref npfjanxturvmjyevoyfo
npx supabase functions deploy organizer-refund    --no-verify-jwt --project-ref npfjanxturvmjyevoyfo

# Updated
npx supabase functions deploy get-bookmarks       --no-verify-jwt --project-ref npfjanxturvmjyevoyfo
npx supabase functions deploy ticket-checkout     --no-verify-jwt --project-ref npfjanxturvmjyevoyfo
npx supabase functions deploy ticket-upgrade      --no-verify-jwt --project-ref npfjanxturvmjyevoyfo
npx supabase functions deploy stripe-webhook      --no-verify-jwt --project-ref npfjanxturvmjyevoyfo
```

**Required env on the functions:**
- `RESEND_API_KEY`, `RESEND_FROM_EMAIL` — guest ticket email, any
  future transactional email
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` — as before
- No new env variables introduced by this branch.

The three new `_shared/` helpers (`capacity-alerts.ts`,
`notify-waitlisters.ts`, `send-resend-email.ts`) are picked up
automatically by the functions that import them — no separate deploy.

---

## 3. Native app build (unblocks the RLS lockdown)

```
npx eas-cli build --platform ios --profile production --auto-submit --non-interactive
```

Wait for TestFlight rollout and a reasonable crash-free window before
step 4. At minimum confirm the app opens + fetches tickets on a
physical device running the new binary.

**Per CLAUDE.md:** always include `EAS_SKIP_AUTO_FINGERPRINT=1` on
updates, and do the staged OTA canary protocol before publishing any
OTA. This branch touches expo-updates static imports (fix:
84d1965), so users on the new binary are now protected from the
2026-04-19 class of OTA crash.

---

## 4. Tickets RLS lockdown (after step 3 is out)

```
supabase/migrations/20260425_tickets_rls_lockdown.sql
```

This drops permissive anon SELECT / INSERT / UPDATE on the `tickets`
table and revokes the corresponding grants. Safe to apply once users
are on the native build shipped in step 3 — the app no longer reads
`tickets` directly; it uses `get-my-tickets` / `get-event-tickets`
edge functions. Reverse order would break ticket screens for anyone
still on the previous binary.

---

## Smoke after deploy

Physical-device sanity, 5-10 min each:

- **Feed / home:** stories bar stays mounted across feed/grid toggle;
  spicy toggle doesn't rerender stories. GIF posts animate in grid
  and detail.
- **Events tab:** spotlight carousel appears (no-op if no active
  campaigns), `PROMOTED` ribbon on feed-placement cards. Join/leave
  waitlist on a sold-out tier works.
- **Event detail → Promote to Spotlight:** sheet opens → Stripe
  Checkout → on return, campaign appears in feed (once migrated DB
  + deployed fns in place).
- **Guest checkout:** open app in logged-out state → Events tab →
  tap an event → public event detail opens → pick a tier → guest
  sheet → email + name → Stripe → confirmation email arrives with
  QR + magic link.
- **Ticket detail:** upgrade flow (General → VIP) charges the
  difference + success state. Cancel a pending transfer works.
- **Analytics dashboard:** header Download icon exports CSV via
  system share sheet.
- **Organizer ticket list:** Refund ticket pill → Stripe refund +
  ticket flips to refunded within seconds.

---

## If something breaks

1. **Ticket reads fail after step 4:** users are still on the old
   binary. Roll back `20260425` immediately; redeploy `ticket-checkout`
   etc so the service role is still the only writer; complete step 3
   rollout; re-apply.
2. **Guest checkout 401s:** confirm `ticket-checkout` was redeployed
   with the guest-email branch. Test with
   `curl -X POST -d '{"event_id":..,"ticket_type_id":"..","quantity":1,"guest_email":"..."}'`.
3. **Spotlight shows no promoted events:** confirm `20260426` +
   `20260427` both applied; confirm `promotion-webhook` endpoint is
   configured in the Stripe dashboard with `STRIPE_PROMOTION_WEBHOOK_SECRET`.

---

## Summary by commit

28 commits. Full list: `git log 3d32d28..HEAD --oneline`.

# Deploy checklist — `claude/fix-crashes-improve-quality-aZkdM`

> ## 🚨 If users are currently crashing on launch — STOP and do this first
>
> This is the `ErrorRecovery.crash()` loop from the 2026-04-22 TestFlight
> 1.0.0.238 incident. Publishing anything new won't help — affected devices
> crash before they can fetch it.
>
> **Run this command once from a Mac with EAS CLI authenticated:**
>
> ```bash
> npx eas-cli update:roll-back-to-embedded \
>   --branch production --platform ios --runtime-version 1.0.0 \
>   --message "P0 ROLLBACK: ErrorRecovery loop 1.0.0.238"
> ```
>
> Affected devices recover in 2–3 app reopens. Reinstall is a last resort.
> Full recovery playbook at the bottom of this file.
>
> **Once users are unbrokened, come back to step 1 below.**

---

The rest of this file is the planned rollout for the 32 commits on this
branch. Every commit is reviewable in `git log 3d32d28..HEAD`.

> **OTA channel policy.** The OTA channel is in quarantine per the
> 2026-04-19 incident. All 32 client commits ride the next native EAS
> build (step 3). Do NOT publish an OTA from this branch until the
> canary protocol in CLAUDE.md has re-established the pipeline —
> the staged canary OTA step lives after step 5.

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

**Hold** `20260425_tickets_rls_lockdown.sql` until step 4. Applying it
before the native build is on user devices will break ticket reads for
anyone still on the old binary.

A helper script at `scripts/deploy-phase-1.sh` runs steps 1 + 2 in one
command. See the top of that file for prerequisites.

---

## 2. Edge functions (deploy in any order — all idempotent)

All use `--no-verify-jwt` per CLAUDE.md (Better Auth tokens, not
Supabase JWTs).

```
# New
npx supabase functions deploy get-my-tickets      --no-verify-jwt --project-ref npfjanxturvmjyevoyfo
npx supabase functions deploy get-event-tickets   --no-verify-jwt --project-ref npfjanxturvmjyevoyfo
npx supabase functions deploy get-guest-ticket    --no-verify-jwt --project-ref npfjanxturvmjyevoyfo
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

## 3. Native iOS build

```
npx eas-cli build --platform ios --profile production --auto-submit --non-interactive
```

This build contains two OTA-safety layers that make future incidents
less painful:

- **84d1965** — all static `expo-updates` imports converted to guarded
  `require()`-in-try-catch. Blocks the JS-side bundle-parse crash class.
- **60d20af** — `patches/expo-updates+55.0.20.patch` via patch-package.
  Adds an embedded-fallback step to `ErrorRecovery.crash()`: if the OTA
  recovery pipeline exhausts, wipes the OTA DB and `exit(0)` so the
  next launch boots from the embedded bundle instead of re-throwing the
  original JS load error. Breaks the cached-OTA crash loop class.

Wait for TestFlight rollout + 24h stability window before step 4.
Minimum sanity: confirm on a physical device that the app opens and
tickets load.

---

## 4. Tickets RLS lockdown (after step 3 is live)

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

## 5. Smoke after deploy

Physical-device sanity, 5–10 min each:

- **Feed / home (classic):** stories bar stays mounted across feed/grid
  toggle; spicy toggle doesn't rerender stories. Feed renders instantly
  after cold start (no stories-ready gate). GIF posts animate in both
  the grid and the detail view. No top divider above the first post.
- **Post actions:** delete a post → disappears from feed and profile
  grid immediately, stays gone (no ghost-reappear from replica lag).
  Tap a post from grid → detail opens with comments already rendered
  (no spinner).
- **Events tab:** spotlight carousel appears (no-op if no active
  campaigns), `PROMOTED` ribbon on feed-placement cards. Join/leave
  waitlist on a sold-out tier works.
- **Event detail → Promote to Spotlight:** sheet opens → Stripe
  Checkout → on return, campaign appears in feed.
- **Guest checkout:** open app in logged-out state → Events tab → tap
  an event → public event detail opens → pick a tier → guest sheet →
  email + name → Stripe → confirmation email with QR + magic link.
- **Guest magic link:** tap `dvnt://tickets/guest/<token>` from email
  → opens guest ticket view without requiring sign-in.
- **Ticket detail:** upgrade flow (General → VIP) charges the
  difference + success state. Cancel a pending transfer works.
- **Analytics dashboard:** header Download icon exports CSV via system
  share sheet.
- **Organizer ticket list:** Refund ticket pill → Stripe refund +
  ticket flips to refunded within seconds.

---

## 6. Resume OTA delivery — canary protocol

**Only after step 3 has been stable for 24h.**

Per CLAUDE.md §OTA RELEASE HARDENING, never publish a cold OTA. Always
stage:

```bash
# Canary — publish a trivial JS-only change (e.g. a 1-line comment)
EAS_SKIP_AUTO_FINGERPRINT=1 eas update --branch production \
  --message "canary: OTA pipeline check" \
  --platform ios --environment production
```

Verify on a physical device:
1. Settings → long-press "Version 1.0.0" for 1 second → OTA Diagnostics
2. Confirm `updateId` changed to the canary update ID
3. Confirm `isEmbeddedLaunch: false`
4. Confirm app opens cleanly after 3 relaunches

Only then ship a real OTA:

```bash
EAS_SKIP_AUTO_FINGERPRINT=1 eas update --branch production \
  --message "<description>" \
  --platform ios --environment production
```

---

## If something breaks

1. **Users crashing on launch (ErrorRecovery loop):** see the top of
   this file. Rollback directive first, then follow up.
2. **Ticket reads fail after step 4:** users are still on the old
   binary. Roll back `20260425`; redeploy `ticket-checkout` etc so the
   service role is still the only writer; complete step 3 rollout;
   re-apply.
3. **Guest checkout 401s:** confirm `ticket-checkout` was redeployed
   with the guest-email branch. Test with
   `curl -X POST -d '{"event_id":..,"ticket_type_id":"..","quantity":1,"guest_email":"..."}'`.
4. **Spotlight shows no promoted events:** confirm `20260426` +
   `20260427` both applied; confirm `promotion-webhook` endpoint is
   configured in the Stripe dashboard with
   `STRIPE_PROMOTION_WEBHOOK_SECRET`.

---

## Summary by commit

32 commits. Full list: `git log 3d32d28..HEAD --oneline`.

---

## P0 OTA Recovery — ErrorRecovery crash loop (reference)

**Symptom:** App crashes on launch with SIGABRT from
`ErrorRecovery.crash()`. No JS frames in crash report. Affects users
whose installed OTA bundle is incompatible with the native binary
(e.g. fingerprint mismatch, missing native module).

**Root cause:** `expo-updates@55.0.20` `ErrorRecovery` pipeline is
`[.waitForRemoteUpdate, .launchNew, .launchCached, .crash]`.
`.launchEmbedded` is not in the pipeline. Once a cached OTA exists,
recovery never falls back to the binary-shipped (embedded) bundle — it
re-throws the original JS load error.

### Immediate mitigation — rollback directive

Run from a Mac with EAS CLI authenticated:

```bash
npx eas-cli update:roll-back-to-embedded \
  --branch production \
  --platform ios \
  --runtime-version 1.0.0 \
  --message "P0 ROLLBACK: ErrorRecovery loop 1.0.0.238"
```

This publishes a **directive** (not a new JS bundle) telling
expo-updates to discard all cached OTAs and boot from the embedded
bundle. It does NOT require a new native build.

**Device recovery cadence:** Affected devices need 2–3 app reopens to
receive the rollback directive. expo-updates checks for updates on
each foreground, and the `ON_ERROR_RECOVERY` mechanism applies
directives on the next launch after download. Reinstalling from
TestFlight is a last resort — it is NOT required unless the device
remains stuck after 5+ reopens.

### Long-term fix — embedded fallback patch

`patches/expo-updates+55.0.20.patch` (in this repo) adds an
embedded-fallback step to `ErrorRecovery.crash()`: if the OTA database
exists, it is wiped and `exit(0)` is called so the next launch uses
the embedded bundle. If the DB is already absent (meaning embedded
itself crashed), the patch falls through to the original SIGABRT so
developers see a real crash report.

The patch is applied automatically via `patch-package` on every
`npm install` (the `postinstall` script runs `(patch-package || true)`
first). Ships with the build in step 3.

### If the rollback directive does not reach affected users

1. Ask testers to force-quit and reopen the app **3 times** (not just
   once).
2. Check EAS dashboard that the directive was published to
   `production` branch with `runtime-version 1.0.0`.
3. If still stuck after 5 reopens → uninstall + reinstall from
   TestFlight (this clears the corrupt OTA cache on-device).

### Republish a known-good update after recovery

Once the crash-loop population is cleared:

```bash
# Republish the last known-good update group (get the ID from EAS dashboard)
EAS_SKIP_AUTO_FINGERPRINT=1 npx eas-cli update:republish \
  --group <known-good-update-group-id> \
  --branch production \
  --message "RESTORE: republish known-good after rollback"
```

Always follow the staged canary OTA protocol (step 6) before
publishing any new update after a rollback event.

# DVNT Ticketing System — Test Plan & Anti-Regression Gate

## Pre-Deploy Checklist

- [ ] `npx tsc --noEmit` passes clean (exit 0)
- [ ] No new imports of `@gorhom/bottom-sheet` in events/tickets code
- [ ] No `FlatList` or `SectionList` in new code (LegendList only)
- [ ] No `KeyboardAvoidingView` in new code
- [ ] No `StyleSheet.create` in new components (NativeWind only)
- [ ] All edge functions have `--no-verify-jwt` flag on deploy
- [ ] New tables have `service_role` grants
- [ ] New tables have RLS enabled + deny-by-default policies
- [ ] `STRIPE_PUBLISHABLE_KEY` set in Supabase secrets
- [ ] `TICKET_HMAC_SECRET` set in Supabase secrets
- [ ] `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` set in `.env`

## Unit Tests

### 1. HMAC QR Payload
```
- createSignedQrPayload(ticketId, eventId) returns { qrToken, qrPayload }
- verifySignedQrPayload(validPayload) returns { valid: true, ticketId, eventId }
- verifySignedQrPayload(tamperedPayload) returns { valid: false }
- verifySignedQrPayload(garbageString) returns { valid: false, reason: "parse_error" }
- verifySignedQrPayload(wrongSecret) returns { valid: false, reason: "invalid_signature" }
```

### 2. Inventory Holds
```
- create-payment-intent reserves hold with 10min TTL
- Active holds reduce effective remaining count
- Expired holds don't reduce remaining count
- payment_intent.succeeded converts hold to "converted"
- payment_intent.payment_failed expires hold
- reconcile-orders expires stale holds
```

### 3. PaymentSheet Flow
```
- useTicketCheckout returns { free: true, tickets } for $0 tiers
- useTicketCheckout returns { success: true } after presentPaymentSheet succeeds
- useTicketCheckout returns { error: "Payment cancelled" } on user cancel
- useTicketCheckout returns { error } on network failure
```

## Integration Tests

### 4. End-to-End Ticket Purchase
```
1. User selects tier on event detail
2. create-payment-intent called → returns clientSecret + ephemeralKey
3. PaymentSheet presented → user pays
4. payment_intent.succeeded webhook fires
5. Tickets inserted with HMAC-signed qr_payload
6. ticket_hold converted
7. order updated to "paid"
8. order_timeline entries created
9. User polls → ticket appears in my-tickets
```

### 5. End-to-End QR Scan
```
1. Organizer opens scanner screen
2. Scans HMAC-signed QR payload
3. ticket-scan verifies HMAC signature (fast path)
4. Ticket status updated to "scanned"
5. Checkin recorded in checkins table
6. Scanner shows green overlay with attendee name
7. Re-scan same ticket → "already_scanned" result
8. Checkin for duplicate also recorded
```

### 6. Co-organizer Flow
```
1. Host adds co-organizer via addCoOrganizer(eventId, userId, "scanner")
2. Co-organizer sees invitation
3. Co-organizer accepts via acceptCoOrganizerInvite(eventId)
4. Co-organizer can access scanner screen
5. Host removes co-organizer → row deleted
```

### 7. Reconciliation
```
1. Create order in payment_pending for >2 hours
2. Run reconcile-orders
3. Order checked against Stripe PI status
4. If PI succeeded → order updated to "paid" + timeline entry
5. If PI canceled → order updated to "payment_failed"
6. Stale ticket_holds expired
```

## Anti-Regression Gate

### Must NOT break:
- [ ] Free ticket checkout (no Stripe involved)
- [ ] Legacy RSVP path (ticketing disabled)
- [ ] Existing Stripe Checkout Session flow (webhook handler still works)
- [ ] Offline check-in (MMKV store + local validation)
- [ ] Scanner screen camera lifecycle
- [ ] Receipt printing and PDF viewing
- [ ] Organizer Stripe Connect onboarding
- [ ] Settings screens navigation
- [ ] Event detail scroll performance

### Smoke Commands
```bash
# TS check
npx tsc --noEmit

# Verify no forbidden patterns
grep -r "FlatList\|SectionList" app/ src/ components/ --include="*.tsx" | grep -v node_modules | grep -v ".test."
grep -r "KeyboardAvoidingView" app/ src/ components/ --include="*.tsx" | grep -v node_modules
grep -r "StyleSheet.create" app/ src/ components/ --include="*.tsx" | grep -v node_modules | grep -v ".test."

# Verify StripeProvider is in root layout
grep -c "StripeProvider" app/_layout.tsx

# Verify edge functions have correct imports
grep -l "Deno.serve" supabase/functions/*/index.ts
```

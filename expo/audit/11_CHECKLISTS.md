# Audit Checklists

## Pre-Release Checklist

- [ ] `npx tsc --noEmit` — 0 errors
- [ ] No `EXPO_PUBLIC_BUNNY_STORAGE_API_KEY` in client code (SEC-01 fix verified)
- [ ] Global ErrorBoundary wraps `<Slot />` in `app/_layout.tsx`
- [ ] All edge functions deployed with `--no-verify-jwt`
- [ ] `curl https://npfjanxturvmjyevoyfo.supabase.co/functions/v1/auth/api/auth/ok` returns `{"ok":true}`
- [ ] Regression tests pass: `npx jest --passWithNoTests`
- [ ] OTA update pushed: `eas update --channel production --platform ios`

## Device Smoke Test Checklist

- [ ] App launches without crash
- [ ] Login flow completes
- [ ] Feed loads with posts
- [ ] Can create a post (upload + publish)
- [ ] Can like / unlike a post
- [ ] Can follow / unfollow a user
- [ ] Can open and send a message
- [ ] Can view a story
- [ ] Can view an event
- [ ] Push notifications received
- [ ] Deep link opens correct screen
- [ ] Settings screens load
- [ ] Sign out and sign back in

## Edge Function Deployment Checklist

```bash
# Deploy all functions with --no-verify-jwt
for fn in $(ls supabase/functions/ | grep -v _shared); do
  echo "Deploying $fn..."
  npx supabase functions deploy "$fn" --no-verify-jwt --project-ref npfjanxturvmjyevoyfo
done
```

## New Feature Checklist

- [ ] TypeScript compiles: `npx tsc --noEmit`
- [ ] No banned imports (FlatList, direct @legendapp/list)
- [ ] Uses Zustand store (not useState for app state)
- [ ] Uses LegendList (not FlatList)
- [ ] Uses sonner-native toast (not Alert)
- [ ] Uses TanStack Debouncer (not setTimeout for debounce)
- [ ] Error boundary coverage on new screens
- [ ] Entity avatar from entity data (not authUser)
- [ ] Cache keys scoped by userId
- [ ] Edge function uses verifySession
- [ ] Edge function deployed with `--no-verify-jwt`

## Security Review Checklist

- [ ] No `EXPO_PUBLIC_` env vars contain write-capable secrets
- [ ] No hardcoded API keys in source (grep for `sk_`, `key_`, `secret`)
- [ ] Edge function validates all user input
- [ ] Edge function uses service_role client with `{ auth: { persistSession: false } }`
- [ ] New tables have `GRANT ALL TO service_role`
- [ ] Rate limiting on new write endpoints

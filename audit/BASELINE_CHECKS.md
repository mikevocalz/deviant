# Baseline Health Checks

**Date**: 2026-02-23

## Environment

| Tool | Version |
|------|---------|
| Node.js | 25.2.1 |
| pnpm | 10.28.0 |
| Xcode | 26.0 (Build 17A324) |
| xcrun | 72 |
| adb | 36.0.0 |
| go-ios | 1.0.188 |

## TypeScript

```
$ npx tsc --noEmit 2>&1 | grep -c "error TS"
0
```

**Result**: ✅ **0 errors** — clean typecheck

## Install

- `node_modules/` present and populated
- `pnpm-lock.yaml` in sync with `package.json`
- `postinstall` script applies 10 patches via shell scripts

## Lint

- ESLint configured (`.eslintrc.js`)
- Run cancelled by user during audit session
- Recommendation: Run `npx eslint . --ext .ts,.tsx` to get baseline error count

## Tests

- Test files in `tests/`:
  - `feed-and-relationship-isolation.spec.ts`
  - `follow-system.spec.ts`
  - `identity-ownership.spec.ts`
  - `message-sender-isolation.spec.ts`
  - `story-thumbnail-regression.spec.ts`
  - `story-viewer-count-regression.spec.ts`
  - `smoke-tests.sh`
  - `ci-guardrails.sh`
- Run cancelled by user during audit session
- Recommendation: Run `npx jest --passWithNoTests` to verify regression tests pass

## Connected Devices

| Device | Platform | Status |
|--------|----------|--------|
| Mike V. iPhone (iOS 26.0.1) | iOS | ✅ Connected, UDID: 00008120-001C31990198201E |
| No Android device | Android | ❌ Not connected |

## Production Health

```bash
curl https://npfjanxturvmjyevoyfo.supabase.co/functions/v1/auth/api/auth/ok
# Expected: {"ok":true}
```

Not executed during this session — recommend running to verify.

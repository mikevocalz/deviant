---
description: Deploy to TestFlight / production — ensures OTA update is always pushed after build
---

# Deploy to Production (TestFlight)

This workflow ensures code changes are ALWAYS visible in TestFlight by pushing both a native build AND an OTA update.

## Steps

1. Verify TypeScript compiles with zero errors
// turbo
```bash
npx tsc --noEmit 2>&1 | grep -E "error TS" | grep -v "node_modules" | head -20
```

2. Commit all changes and push to origin/main
```bash
git add -A && git status
git commit -m "<message>"
git push origin main
```

3. Push OTA update to production channel (THIS IS THE CRITICAL STEP)
```bash
npx eas-cli update --branch production --message "<same message>" --platform ios
```

4. (Optional) If native dependencies changed, also trigger a native build
```bash
npx eas-cli build --platform ios --profile production --auto-submit --non-interactive
```

5. Verify OTA update was published
// turbo
```bash
npx eas-cli update:list --branch production --limit 1
```

6. Tell user to force-close and reopen the app twice to pick up the OTA update.

## IMPORTANT RULES

- **ALWAYS push OTA after commits** — native builds alone do NOT update the JS bundle in TestFlight
- **Use `--platform ios`** — web export fails due to `react-native-pager-view`
- **Force close + reopen twice** — first launch downloads, second launch applies
- **Never skip step 3** — this is the #1 cause of "I don't see my changes in prod"

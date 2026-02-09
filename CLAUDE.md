# DEVIANT - AI Assistant Instructions

> **⚠️ READ THIS FILE FIRST** - Before making ANY changes to this project, read this entire file.

---

## 🚨 PRODUCTION ONLY - ABSOLUTE RULES

**This is PRODUCTION code. Treat it as such AT ALL TIMES.**

### CRITICAL: ARCHITECTURE LOCK - SUPABASE + EDGE FUNCTIONS ONLY

**PERMANENT DECISION (2026-02-06):**

- ✅ Mobile App → Supabase (database, storage, realtime)
- ✅ Server logic → Supabase Edge Functions (Deno runtime)
- ✅ Auth → Better Auth (hosted in Supabase Edge Function at https://npfjanxturvmjyevoyfo.supabase.co/functions/v1/auth)
- ✅ Email → Resend (via Better Auth Edge Function + send-email Edge Function)
- ❌ Payload CMS — REMOVED, never reference
- ❌ Next.js — NOT USED, never reference
- ❌ Hono server — REMOVED permanently
- ❌ Expo Router API routes (app/api/) — FORBIDDEN for native app
- ❌ tRPC — REMOVED, never reference

**Required Environment Variables:**

```bash
# .env (REQUIRED for native app)
EXPO_PUBLIC_AUTH_URL=https://npfjanxturvmjyevoyfo.supabase.co/functions/v1/auth
EXPO_PUBLIC_SUPABASE_URL=https://npfjanxturvmjyevoyfo.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<supabase anon key>
DATABASE_URL=<supabase postgres connection string>
RESEND_API_KEY=<resend api key>
RESEND_FROM_EMAIL=DVNT <onboarding@resend.dev>
```

**Safety Checks:**

- ✅ Fails fast if localhost detected in production
- ✅ Fails fast if no auth/supabase URL set on native
- ✅ Fails fast if not HTTPS in production
- ✅ Fails fast if Expo dev server URL (port 8081)
- ✅ Fails fast if relative URL used (Expo Router routes)
- ✅ Logs resolved URL on boot

**Never do these:**

- ❌ `npx expo start --clear` - Can affect cached data
- ❌ `rm -rf node_modules` - Can break the build
- ❌ `npm cache clean` - Unnecessary and risky
- ❌ Any command with `--force`, `--hard`, `reset`, `clear`, `clean`, `purge`
- ❌ Suggesting "rebuild from scratch" or "fresh install"
- ❌ Any database DROP, TRUNCATE, or DELETE without WHERE clause
- ❌ Any command that could affect user data or authentication state

### ALWAYS DO THESE:

- ✅ Use `npx expo start` (no flags) for development
- ✅ Use `npm install` only when packages are missing (verify with `npm ls <package>`)
- ✅ Test fixes on specific files, not broad sweeping changes
- ✅ Verify TypeScript compiles: `npx tsc --noEmit`
- ✅ Check for errors BEFORE suggesting user action

### IF SOMETHING IS BROKEN:

1. Read the error message first
2. Check specific files for issues
3. Fix the code - don't wipe caches or reinstall
4. Only suggest safe, targeted fixes

### DEPLOYMENT - MANDATORY OTA UPDATE RULE:

**NEVER skip the OTA update step when deploying to TestFlight/production.**

The production TestFlight app uses **Expo Updates (OTA)** to get the latest JS bundle. A native build alone does NOT update the JS bundle — the OTA layer may serve an older version.

**After EVERY commit that should be visible in production:**

```bash
# 1. Push to git
git push origin main

# 2. ALWAYS push OTA update (CRITICAL - never skip this)
npx eas-cli update --branch production --message "<description>" --platform ios

# 3. Only if native deps changed, also do a native build
npx eas-cli build --platform ios --profile production --auto-submit --non-interactive
```

**Rules:**

- Use `--platform ios` (web export fails due to react-native-pager-view)
- User must force-close + reopen app twice (download then apply)
- Use `/deploy` workflow in Windsurf to automate this

### EDGE FUNCTION DEPLOYMENT - CRITICAL RULES:

**⚠️ All Edge Functions that use Better Auth tokens MUST be deployed with `--no-verify-jwt`.**

The Supabase API gateway validates the `Authorization` header as a Supabase JWT by default. Since we use Better Auth session tokens (NOT Supabase JWTs), the gateway rejects requests before the function code runs unless `--no-verify-jwt` is set.

```bash
# CORRECT — all edge functions must use this flag
npx supabase functions deploy <function-name> --no-verify-jwt --project-ref npfjanxturvmjyevoyfo

# WRONG — gateway will reject Better Auth tokens with "Invalid JWT"
npx supabase functions deploy <function-name> --project-ref npfjanxturvmjyevoyfo
```

**Video/Lynk Edge Functions (all 6 require `--no-verify-jwt`):**

- `video_create_room`, `video_join_room`, `video_refresh_token`
- `video_end_room`, `video_kick_user`, `video_ban_user`

**createClient in Edge Functions — MUST include auth options:**

```typescript
// CORRECT — service role key properly used, bypasses RLS
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { headers: { Authorization: `Bearer ${supabaseServiceKey}` } },
});

// WRONG — may inherit request's Authorization header, causing "permission denied"
const supabase = createClient(supabaseUrl, supabaseServiceKey);
```

**New tables MUST have `GRANT ALL TO service_role`:**

```sql
-- Without this, edge functions get "permission denied" even with service role key
GRANT ALL ON public.<table_name> TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;
```

### AFTER EVERY FIX - MANDATORY VERIFICATION:

**ALWAYS verify everything works after making changes. Never assume fixes work.**

1. **Run TypeScript check:**

   ```bash
   npx tsc --noEmit 2>&1 | grep "error TS" | grep -v "^server/" | head -30
   ```

2. **Check for critical errors (these WILL crash):**
   - TS2304: Cannot find name
   - TS2448: Variable used before declaration
   - TS17001: Duplicate attributes
   - TS2307: Cannot find module (in app code, not server/)

3. **Verify no regressions:**
   - Check that the original issue is fixed
   - Check related screens/components still work
   - Count errors before and after to ensure no increase

4. **Only declare "fixed" when:**
   - Zero critical errors in app code
   - TypeScript compiles without crash-causing errors
   - You've verified the specific fix works

---

## � UI INVARIANTS — NEVER REGRESS

### Stories — THUMBNAIL MUST BE MOST RECENT ITEM

**Story thumbnails in the stories bar MUST always show the MOST RECENT (last) story item's thumbnail/url.**

```
✅ CORRECT: story.items[story.items.length - 1].thumbnail || .url
❌ WRONG:   story.items[0].thumbnail || .url
❌ WRONG:   story.avatar (profile picture)
```

- **Other users' stories** (`stories-bar.tsx` → `instaData`): `user_image` = last item's thumbnail/url, fallback to avatar only if no items
- **Own story** (`stories-bar.tsx` → `StoryRing`): `storyThumbnail` = last item's thumbnail/url
- **Regression test**: `tests/story-thumbnail-regression.spec.ts`
- Avatar fallback is ONLY allowed when `items` array is empty

### Messages — SENDER ISOLATION

- `msg.sender` is `"user"` or `"other"` (string literals from `messages-impl.ts`)
- Check: `msg.sender === "user"` — NEVER compare against `user.id`
- Regression test: `tests/message-sender-isolation.spec.ts`

### Data Isolation — AVATAR OWNERSHIP

- Story/Post/Comment avatar → `entity.author.avatar` (NEVER authUser)
- Settings avatar → `authUser.avatar` (ONLY allowed place)
- Regression test: `tests/identity-ownership.spec.ts`

---

## �🔧 SEV-0 FIXES (2026-02-01)

**Critical production fixes applied for database connectivity and app stability.**

### Payload CMS Database Optimization

**Issue:** Serverless functions timing out when connecting to Supabase PostgreSQL.

**Root Cause:**

- Connection timeout too short (5s) for cold starts
- Using session pooler (port 5432) instead of transaction pooler
- Missing SSL configuration
- Pool size too large for serverless

**Fixes Applied:**

```typescript
// payload.config.ts
db: postgresAdapter({
  pool: {
    connectionString: process.env.DATABASE_URI,
    max: 2,                          // Reduced from 3
    idleTimeoutMillis: 30000,        // Increased from 10000
    connectionTimeoutMillis: 20000,  // Increased from 5000
    ssl: { rejectUnauthorized: false }, // Added SSL
  },
  push: false,
}),
```

**Database URI:**

```
postgresql://...@aws-1-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true
```

☝️ **Port 6543** = Supabase transaction pooler (better for serverless)

**Vercel Configuration:** (`vercel.json`)

```json
{
  "functions": {
    "app/api/**/*.ts": {
      "maxDuration": 30,
      "memory": 1024
    }
  }
}
```

### Mobile App: Messages API Fix

**Issue:** App crashing with "Failed to proxy request" error on boot.

**Root Cause:** `getPayloadUserId()` was querying `/api/users` without authentication.

**Fix:** Use current user's ID from auth session instead of API query:

```typescript
// lib/api/messages.ts
const currentUser = useAuthStore.getState().user;
if (currentUser && currentUser.username === username) {
  return currentUser.id; // Use session data
}
```

### Health Check Endpoints

**Payload CMS:** `/api/health`

- Lightweight DB ping (queries 1 user)
- 10s timeout
- Returns connection status + response time

**Test:**

```bash
curl https://npfjanxturvmjyevoyfo.supabase.co/functions/v1/auth/api/auth/ok
# {"ok":true}
```

### Performance Results

| Metric                | Before  | After |
| --------------------- | ------- | ----- |
| DB Connection Timeout | 5s      | 20s   |
| Health Check          | Timeout | 195ms |
| Posts API             | Timeout | <1s   |
| App Boot Errors       | Yes     | No ✅ |

**See:** `SEV0-RESOLUTION.md` for complete details.

---

## 📍 Backend Location

**All backend logic lives in Supabase Edge Functions:**

```
/Users/mikevocalz/deviant/supabase/functions/
```

- There is **no** Payload CMS, Vercel server, or Hono server. All removed.
- Edge Functions are deployed via: `supabase functions deploy <function-name>`
- Auth is handled by Better Auth in the `auth` Edge Function
- All writes go through privileged Edge Functions (service role key)

---

## 🔄 Database Schema Sync - CRITICAL

**⚠️ The Payload CMS collection definitions MUST stay in sync with the PostgreSQL database schema.**

### Why This Matters

If you add a new field to a collection (e.g., `isNSFW` to Posts), but the database table doesn't have that column, you'll get errors like:

```
column "is_nsfw" of relation "posts" does not exist
```

### How to Keep in Sync

1. **Adding new fields to collections:**
   - Add the field to the collection in `/Users/mikevocalz/Downloads/payload-cms-setup/collections/`
   - Payload CMS should auto-migrate on deploy, but if not:
     - Run `npx payload migrate:create` to generate a migration
     - Or manually add the column via Supabase SQL Editor

2. **Before deploying collection changes:**
   - Check if the field requires a DB migration
   - Test locally first if possible

3. **If you get "column does not exist" errors:**
   - The collection has a field the DB doesn't have
   - Either remove the field from the collection temporarily
   - Or add the column to the database manually

### Manual Column Addition (Supabase)

```sql
-- Example: Add isNSFW column to posts table
ALTER TABLE posts ADD COLUMN is_nsfw BOOLEAN DEFAULT false;
```

**Remember:** Collection schema changes = potential database migration needed!

---

## 🔗 API & Schema Synchronization - CRITICAL

**⚠️ ALL APIs MUST STAY IN SYNC WITH CMS COLLECTIONS AND DATABASE SCHEMA.**

### The Three-Way Sync Requirement

When making changes that affect data structure, you MUST update THREE places:

1. **CMS Collection Schema** (`/Users/mikevocalz/Downloads/payload-cms-setup/collections/`)
   - Add/remove fields in the collection definition
   - Commit and push to CMS repo
   - **⚠️ CRITICAL: Redeploy CMS for changes to take effect**
   - Deploy command: `cd /Users/mikevocalz/Downloads/payload-cms-setup && npx vercel --prod --yes`
   - CMS will auto-migrate database on deployment

2. **Database Schema** (PostgreSQL via Supabase)
   - Ensure database columns match collection fields
   - Run migrations or manually add columns
   - Field names convert: `likedPosts` → `liked_posts` (camelCase to snake_case)

3. **API Endpoints** (`/Users/mikevocalz/deviant/app/api/`)
   - Update API routes to use new fields
   - Ensure field names match CMS collection exactly
   - Handle both camelCase (API) and snake_case (DB) formats

### Example: Adding a New Field

**Step 1: Update CMS Collection**

```typescript
// /Users/mikevocalz/Downloads/payload-cms-setup/collections/Users.ts
{
  name: "likedPosts",
  type: "relationship",
  relationTo: "posts",
  hasMany: true,
}
```

**Step 2: Update Database** (if auto-migration doesn't work)

```sql
-- Supabase SQL Editor
ALTER TABLE users ADD COLUMN liked_posts JSONB DEFAULT '[]'::jsonb;
```

**Step 3: Update API Endpoints**

```typescript
// /Users/mikevocalz/deviant/app/api/posts/[id]/like+api.ts
const likedPosts = (currentUserData as any)?.likedPosts || [];
// Handle Payload array format (can be strings or objects)
```

### Sync Checklist

Before pushing any changes that affect data structure:

- ✅ CMS collection updated and pushed
- ✅ **CMS redeployed to production** (`cd /Users/mikevocalz/Downloads/payload-cms-setup && npx vercel --prod --yes`)
- ✅ Database schema matches (check Supabase - Payload auto-migrates on deploy)
- ✅ API endpoints updated to use new fields
- ✅ API handles both Payload format (objects) and DB format (IDs)
- ✅ Test locally if possible
- ✅ Commit and push CMS changes
- ✅ Commit and push API changes
- ✅ Publish EAS update to production

**⚠️ REMEMBER: CMS changes require redeployment!** Pushing to git is not enough - you must redeploy the CMS for schema changes to take effect.

### Common Sync Issues

**Problem:** API uses field that doesn't exist in CMS

- **Solution:** Add field to CMS collection first, then update API

**Problem:** API uses field that doesn't exist in database

- **Solution:** Add column to database, or ensure CMS migration runs

**Problem:** Field name mismatch (camelCase vs snake_case)

- **Solution:** Payload uses camelCase, DB uses snake_case - handle both in API

**Problem:** Field type mismatch (array vs relationship)

- **Solution:** Payload relationships can be arrays of IDs or objects - handle both formats

**Remember:** When in doubt, check all three places (CMS, DB, API) before deploying!

---

## 🚫 Protected Files - DO NOT EDIT

The following files should **NEVER** be modified unless explicitly requested by the user:

- `metro.config.js`
- `babel.config.js`

### Current babel.config.js

```js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      [
        "babel-preset-expo",
        { jsxImportSource: "nativewind", unstable_transformImportMeta: true },
      ],
    ],
    plugins: ["react-native-worklets/plugin"],
  };
};
```

### Current metro.config.js

```js
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const { withRorkMetro } = require("@rork-ai/toolkit-sdk/metro");

const config = getDefaultConfig(__dirname);

config.resolver.assetExts.push("riv");

module.exports = withRorkMetro(
  withNativeWind(config, { input: "./global.css" }),
);
```

## 🚫 Protected Dependencies - DO NOT REMOVE

The following dependencies must **NEVER** be removed from package.json:

- `nativewind`
- `@react-native-ml-kit/text-recognition` (used for ID OCR scanning)

---

## 📱 Project Context

This is a **React Native/Expo** project using:

- **NativeWind v4** for styling (Tailwind CSS)
- **Expo Router** for navigation
- **Rive** for animations (.riv files)
- **React Native Reanimated** for animations
- **Zustand** for state management (**DO NOT use useState hooks, use Zustand stores**)

---

## 💬 Messages — SENDER ISOLATION (SEV-0, Feb 2026)

**⚠️ NEVER change how message sender is determined. This caused a SEV-0 where ALL messages appeared as sent by the other person.**

### The Contract

```
messages-impl.ts getMessages() → returns sender: "user" | "other"  (string literals)
chat-store.ts    loadMessages() → checks:  msg.sender === "user"   (exact string match)
```

### Rules

1. **`messages-impl.ts` MUST return `sender: "user"` or `sender: "other"`** — string literals, NEVER an ID, object, or integer
2. **`chat-store.ts` MUST compare `msg.sender === "user"`** — NEVER compare against `user.id`, `user.authId`, or any other identifier
3. **The `sender` field is a pre-resolved label**, not a raw ID — the resolution happens in `messages-impl.ts` using `getCurrentUserIdInt()` vs `msg.sender_id`
4. **If `msg.sender` is anything other than `"user"` or `"other"`, default to `"them"`** — safe fallback prevents showing YOUR messages as theirs

### Forbidden Patterns

```typescript
// ❌ FORBIDDEN — caused SEV-0 regression
const isSender = (msg.sender?.id || msg.sender) === user?.id;
const isSender = msg.senderId === user.id;
const isSender = msg.sender === currentUser.authId;

// ✅ CORRECT — the ONLY allowed pattern
const isSender = msg.sender === "user";
```

### Key Files

| File                                     | Rule                                                       |
| ---------------------------------------- | ---------------------------------------------------------- |
| `lib/api/messages-impl.ts:154`           | Returns `"user"` or `"other"` — NEVER change this contract |
| `lib/stores/chat-store.ts:128`           | Compares `=== "user"` — NEVER compare against IDs          |
| `tests/message-sender-isolation.spec.ts` | Regression tests — NEVER delete                            |

---

## 🛡️ SEV-0 Regression Prevention - MANDATORY

**⚠️ READ `PREVENTION.md` before making changes to likes, follows, bookmarks, avatars, or query keys.**

### Key Files

| File                          | Purpose                           |
| ----------------------------- | --------------------------------- |
| `PREVENTION.md`               | Complete guardrail documentation  |
| `lib/contracts/dto.ts`        | Zod schemas for all API responses |
| `lib/contracts/query-keys.ts` | Canonical query key registry      |
| `lib/contracts/invariants.ts` | DEV-time fail-fast assertions     |

### Critical Rules

1. **Parse API responses through DTOs** before caching
2. **Use Query Key Registry** - no ad-hoc arrays
3. **Scoped keys only** - `['profile', userId]` not `['profile']`
4. **Entity avatar from entity** - never use authUser for other users' content
5. **Immutable cache updates** - always spread to new objects

### Banned Patterns

```typescript
// ❌ FORBIDDEN
const [isLiked, setIsLiked] = useState(post.hasLiked);
queryClient.setQueryData(["profile"], data);
<Avatar uri={authUser.avatar} /> // for other user's content

// ✅ REQUIRED
const { hasLiked, likesCount } = usePostLikeState(postId);
queryClient.setQueryData(profileKeys.byId(userId), data);
<Avatar uri={post.author.avatar} />
```

### Quick Verification

```bash
npx tsc --noEmit              # TypeScript check
./tests/smoke-tests.sh        # API smoke tests
```

---

## �🔧 Known Platform Fixes

### Android - react-native-vision-camera-text-recognition

Kotlin type mismatch error. Edit `VisionCameraTextRecognitionPlugin.kt` lines 54/58:

```kotlin
@Suppress("UNCHECKED_CAST")
return WritableNativeMap().toHashMap() as HashMap<String, Any>?

@Suppress("UNCHECKED_CAST")
return data.toHashMap() as HashMap<String, Any>?
```

### Android - Regula Face SDK

Add Maven repo to `android/build.gradle` in `allprojects.repositories`:

```gradle
maven { url 'https://maven.regulaforensics.com/RegulaDocumentReader' }
```

### iOS - GoogleMLKit Version Conflict

**Problem:** `@react-native-ml-kit/text-recognition` and `vision-camera-face-detection` require incompatible GoogleMLKit versions. The text-recognition package hardcodes specific GoogleMLKit versions in its podspec that conflict with face-detection.

**Solution:** Remove `@react-native-ml-kit/text-recognition` and `react-native-vision-camera-text-recognition` packages, keep only FaceDetection in Podfile:

```bash
# Remove conflicting packages
pnpm remove @react-native-ml-kit/text-recognition react-native-vision-camera-text-recognition
```

In `ios/Podfile`, use only FaceDetection:

```ruby
$GoogleMLKitVersion = '7.0.0'

target 'DVNT' do
  pod 'GoogleMLKit/FaceDetection', $GoogleMLKitVersion, :modular_headers => true
  # ... rest of target
end
```

Then run:

```bash
cd ios && pod install --repo-update
```

**Note:** If text recognition is needed later, find a version of `@react-native-ml-kit/text-recognition` compatible with GoogleMLKit 7.0.0, or use a different OCR solution.

### Android - TextRecognition Import Error

**Error:** `Unable to resolve "@react-native-ml-kit/text-recognition"` when building Android after removing the package.

**Cause:** The `IdScanTab.tsx` component imports TextRecognition which was removed due to GoogleMLKit conflicts.

**Fix:** The import in `components/verification/tabs/IdScanTab.tsx` has been commented out:

```tsx
// TextRecognition removed due to GoogleMLKit version conflict - see CLAUDE.md
// TODO: Re-add OCR when compatible version is available
```

**Prevention:** When removing any native package, ALWAYS search the codebase for imports:

```bash
grep -r "package-name" --include="*.tsx" --include="*.ts" .
```

### Android - Metro Bundler Cache Issues

**Error:** Changes not reflected after editing files, old errors persist.

**Fix:** Kill Metro and restart with clear cache:

```bash
lsof -ti:8081 | xargs kill -9
npx expo start --clear --android
```

### Native Rebuild Commands

After adding packages with native code:

```bash
# Android
npx expo run:android

# iOS (after fixing pod conflicts)
npx expo run:ios
```

### Android - Notification Icon Required

**Error:** `ENOENT: no such file or directory, open './assets/images/notification-icon.png'`

**Cause:** `expo-notifications` plugin requires a notification icon for Android.

**Fix:** Ensure `assets/images/notification-icon.png` exists. For Android, this should ideally be a white silhouette on transparent background (96x96px). As a quick fix, copy the app icon:

```bash
cp assets/images/icon.png assets/images/notification-icon.png
```

### ⚠️ Pre-Build Checklist

Before running native builds, verify:

1. **Check for removed package imports** - Search codebase for any imports of removed packages
2. **Read CLAUDE.md** - Always read this file for known fixes before building
3. **Clear Metro cache** - If builds fail unexpectedly, clear the cache
4. **Check Podfile/build.gradle** - Ensure native config matches package requirements
5. **Notification icon exists** - `assets/images/notification-icon.png` must exist for Android builds

---

## 🚫 Tab Bar Center Button - NEVER BELOW

**⚠️ The center button on the tab bar MUST ALWAYS be positioned ABOVE the tabbar, NEVER below it.**

**Location:** `components/center-button.tsx`

**Rules:**

- Use **positive** `bottom` values to push the button UP (above the tabbar)
- **NEVER** use negative `bottom` values that push the button down into or below the tabbar
- Current correct values: `bottom: 8` (Android), `bottom: 12` (iOS)

**Example of CORRECT positioning:**

```tsx
const containerStyle: ViewStyle = {
  position: "absolute",
  bottom: Platform.OS === "android" ? 8 : 12, // POSITIVE = above tabbar
  // ...
};
```

**Example of WRONG positioning (NEVER do this):**

```tsx
bottom: -34; // WRONG - pushes button below tabbar
bottom: -4; // WRONG - pushes button into tabbar
```

---

## 🏭 Production-First Development

**⚠️ ALWAYS write code for production, not just development.**

**CRITICAL RULES:**

1. **ALWAYS push code after making changes** - Never leave code uncommitted or unpushed. After completing any task:

   ```bash
   git add -A
   git commit -m "Descriptive commit message"
   git push origin main
   ```

2. **ALWAYS publish to production after pushing** - After pushing code, immediately publish an EAS update to production:

   ```bash
   eas update --channel production --message "Description of changes"
   ```

3. **Code for production from the start** - Write all code assuming it will run in production:
   - Use production API URLs (`EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_AUTH_URL`)
   - Include error handling for network failures
   - Add loading states and fallbacks
   - Never rely on dev server features

4. **API Routes don't work in production native apps** - Expo Router API routes (`+api.ts`) only work with the dev server. In production builds, use:
   - Direct API calls to deployed services (Payload CMS, Hono server)
   - Static content fallbacks where appropriate
   - The `EXPO_PUBLIC_API_URL` environment variable for API endpoints

5. **Static content fallbacks** - For legal pages, FAQs, etc., always include static fallback content that works without network requests

6. **Never rely on dev-only features** - Features that only work in `__DEV__` mode must have production equivalents

7. **Test with production builds** - Before pushing EAS updates, test with:

   ```bash
   npx expo start --no-dev --minify
   ```

8. **Environment-aware code:**

   ```tsx
   // Good - works in production
   const apiUrl = process.env.EXPO_PUBLIC_API_URL || "";

   // Better - explicit production handling
   if (__DEV__) {
     // Dev-only behavior
   } else {
     // Production behavior
   }
   ```

9. **Workflow checklist:**
   - ✅ Write code with production in mind
   - ✅ Test locally if possible
   - ✅ Commit changes with descriptive message
   - ✅ Push to `main` branch
   - ✅ Publish EAS update to production channel
   - ✅ Verify update appears in EAS dashboard

---

## 🚨 CRITICAL: Update Toast Functionality

**⚠️ NEVER REMOVE OR DISABLE THE UPDATE TOAST**

The update toast in `lib/hooks/use-updates.ts` is **CRITICAL** for OTA (Over-The-Air) updates. This toast **MUST ALWAYS** show when an update is available.

**Rules:**

1. **NEVER** remove the `showUpdateToast()` function
2. **NEVER** disable or skip the toast notification
3. **NEVER** remove the toast import or usage
4. **ALWAYS** ensure the toast shows with retry logic and Alert fallback
5. The toast **MUST** have `duration: Infinity` to never auto-dismiss
6. The toast **MUST** have TWO buttons:
   - **"Update Later"** (left/cancel button) - dismisses the toast
   - **"Restart App Now"** (right/action button) - restarts the app
7. If toast fails, **MUST** fall back to native Alert with same two buttons
8. **NEVER remove or disable this toast** - it is critical for OTA updates
9. The toast can be dismissed with "Update Later" but will show again if update is still pending

**Why this is critical:**

- Users need to know when updates are available
- Without the toast, users won't restart to get new features/fixes
- OTA updates are essential for the app's update mechanism
- The toast MUST always be visible when an update is available

**Location:** `lib/hooks/use-updates.ts` - `showUpdateToast()` function

**⚠️ CRITICAL: This toast must NEVER be removed, disabled, or modified to prevent showing. It is essential for the app's update mechanism.**

### EAS Updates – Getting the app to receive OTA updates

- **Runtime version:** The project uses a **fixed** `runtimeVersion: "1.0.0"` in `app.config.js`. Updates are published for `1.0.0`. **After changing `runtimeVersion`, you must create a new EAS build** (and submit it) for the change to apply. Existing store builds keep their old runtime until users install the new binary.
- **Publish updates:** `pnpm update:production` or `eas update --channel production`. Use `eas update --channel preview` (or `pnpm update:preview`) for preview builds.
- **Existing live builds (built before fixed runtime):** If the app was built with `policy: "appVersion"` + `autoIncrement`, its runtime is e.g. `1.0.1`, `1.0.2`. To push updates to **those** builds, run `eas update --channel production --runtime-version X.Y.Z` where `X.Y.Z` is the **live build's** runtime. Get it from [EAS → Builds](https://expo.dev) → select the production build that's in the store → Runtime version. After you ship a **new** build (with fixed `1.0.0`), use `eas update --channel production` only.
- **Receive updates:** Use a **production** or **preview** EAS build. OTA checks are **skipped in `__DEV__`** (e.g. `expo start --dev-client`). Production builds have `__DEV__ === false` and will check.
- **Test OTA in dev:** Set `EXPO_PUBLIC_FORCE_OTA_CHECK=true` so the hook runs checks even in `__DEV__`.
- **Channel / runtime:** Build and update must share the same **channel** and **runtime version**. Check [EAS Deployments](https://expo.dev) (channel, runtime version, branch) if updates are not received.
- **Logs:** The hook logs `[Updates]` messages (init, check, fetch, skip reasons). When no update is found, it also logs recent native `expo-updates` entries. Use device logs to debug.

---

## 📦 Dependencies - NEVER Missing

**⚠️ CRITICAL: Dependencies must NEVER be missing or out of sync.**

### Rules

1. **ALWAYS verify `node_modules` exists** before making changes:

   ```bash
   ls node_modules/ | head -5
   ```

2. **If `node_modules` is empty or missing, run `npm install` FIRST** - before doing anything else

3. **After cloning or switching branches**, always run:

   ```bash
   npm install
   ```

4. **After adding new packages**, verify they installed:

   ```bash
   npm ls <package-name>
   ```

5. **Never assume packages are installed** - if the app crashes on multiple screens, check dependencies first

### Common Symptoms of Missing Dependencies

- App crashes on multiple screens
- "Unable to resolve module" errors
- Native module errors on startup
- Metro bundler can't find packages

### Quick Fix

```bash
# If app is crashing everywhere, run this first:
npm install

# If still having issues, clean and reinstall:
rm -rf node_modules
npm install

# For iOS, also reinstall pods:
cd ios && pod install && cd ..
```

**⚠️ Missing dependencies = broken app. Always verify before debugging other issues.**

---

## 🔍 Code Quality - ALWAYS Check Before Finishing

**⚠️ CRITICAL: Run TypeScript check after making changes to catch crashes before they happen.**

### Required Check

After making code changes, ALWAYS run:

```bash
npx tsc --noEmit 2>&1 | grep -E "error TS" | head -20
```

### Common Crash-Causing Bugs to Avoid

1. **Variables used before declaration**

   ```tsx
   // WRONG - callHandleNext used before defined
   useEffect(() => {
     callHandleNext()  // ERROR: used before declaration
   }, [callHandleNext])

   const callHandleNext = useCallback(() => { ... }, [])

   // CORRECT - define before using
   const callHandleNext = useCallback(() => { ... }, [])

   useEffect(() => {
     callHandleNext()  // OK
   }, [callHandleNext])
   ```

2. **Calling booleans as functions**

   ```tsx
   // WRONG - isBookmarked is a boolean, not a function
   const isBookmarked =
     bookmarkStore.isBookmarked(id) || apiBookmarks.includes(id);
   const isSaved = isBookmarked(id); // CRASH: boolean is not a function

   // CORRECT
   const isBookmarked =
     bookmarkStore.isBookmarked(id) || apiBookmarks.includes(id);
   const isSaved = isBookmarked; // OK: use the boolean directly
   ```

3. **Missing function definitions**

   ```tsx
   // WRONG - showToast not defined
   showToast("success", "Done", "Saved!"); // CRASH: showToast is not defined

   // CORRECT - import from store first
   const showToast = useUIStore((s) => s.showToast);
   showToast("success", "Done", "Saved!"); // OK
   ```

4. **Duplicate JSX attributes**

   ```tsx
   // WRONG - duplicate attribute causes error
   <ScrollView
     keyboardShouldPersistTaps="handled"
     keyboardShouldPersistTaps="handled"  // ERROR: duplicate
   />

   // CORRECT
   <ScrollView
     keyboardShouldPersistTaps="handled"
   />
   ```

5. **Wrong import syntax**

   ```tsx
   // WRONG - named import when should be default
   import { StarRating } from "react-native-star-rating-widget"; // ERROR

   // CORRECT - use default import
   import StarRating from "react-native-star-rating-widget"; // OK
   ```

### TypeScript Errors That Cause Crashes

- `TS2304: Cannot find name` - Variable/function not defined
- `TS2448: Block-scoped variable used before declaration` - Used before defined
- `TS2454: Variable is used before being assigned` - Used before assigned
- `TS17001: JSX elements cannot have multiple attributes with same name` - Duplicate props

**⚠️ If you see these errors, FIX THEM before finishing. They WILL crash the app.**

---

## 📝 Code Style

- Use **TypeScript**
- Follow existing code patterns
- Do not add or remove comments unless asked
- Preserve existing formatting
- Use Zustand stores instead of useState hooks
- **ALWAYS use sonner-native toasts instead of Alert** - Use `useUIStore.showToast()` for all user feedback:

  ```tsx
  import { useUIStore } from "@/lib/stores/ui-store";

  const showToast = useUIStore((s) => s.showToast);

  // Instead of: Alert.alert("Error", "Something went wrong")
  showToast("error", "Error", "Something went wrong");

  // Types: "success" | "error" | "warning" | "info"
  showToast("success", "Done", "Post created successfully");
  ```

---

## 📂 Key Directories

- `app/` - Expo Router screens and layouts
- `components/` - Reusable UI components
- `lib/` - Utilities, hooks, stores, and services
- `backend/` - Backend/API related code
- `assets/` - Static assets (images, fonts, etc.)
- `theme/` - Theme configuration

---

## 🎬 Screen Transitions & Animations

- Use **@legendapp/motion** (`Motion.View`) for animations instead of `react-native-reanimated` `Animated.View`
- For smooth modal transitions, use Expo Router's modal presentation:

  ```tsx
  // In _layout.tsx
  <Stack screenOptions={{ presentation: "modal" }} />
  ```

- Enable shared element transitions for seamless navigation between screens
- Use spring animations with `type: "spring", damping: 20, stiffness: 300` for natural motion
- Avoid `LayoutAnimation` as it's deprecated in the New Architecture

---

## � Lists Policy — LegendList ONLY (MANDATORY)

**⚠️ LegendList (`@legendapp/list`) is the ONLY allowed list component in this project.**

### Banned Components (CI will block)

- ❌ `FlatList` from `react-native`
- ❌ `SectionList` from `react-native`
- ❌ `VirtualizedList` from `react-native`
- ❌ `FlashList` from `@shopify/flash-list` (package REMOVED)

### Single Blessed Import Path

```tsx
// ✅ CORRECT — always import from the blessed path
import { LegendList } from "@/components/list";
import type { LegendListRef, LegendListProps } from "@/components/list";

// ❌ WRONG — direct import from @legendapp/list
import { LegendList } from "@legendapp/list";

// ❌ WRONG — FlatList/FlashList
import { FlatList } from "react-native";
import { FlashList } from "@shopify/flash-list";
```

### Required Props

- **`recycleItems`** — Enable recycling for performance
- **`estimatedItemSize`** — Provide a pixel estimate for item height
- **`keyExtractor`** — Stable unique key per item

### Enforcement

- **ESLint** `no-restricted-imports` blocks FlatList/FlashList/direct @legendapp/list imports
- **DEV runtime guard** throws if `@shopify/flash-list` is detected at boot
- **No exceptions** — not for "small lists", not for conditional fallbacks

---

## �📍 Location Autocomplete & Maps

### Google Places Autocomplete

Use the `LocationAutocomplete` component for location search inputs:

```tsx
import {
  LocationAutocomplete,
  type LocationData,
} from "@/components/ui/location-autocomplete";

// In your component
<LocationAutocomplete
  value={location}
  placeholder="Search location..."
  onLocationSelect={(data: LocationData) => {
    // data contains: name, latitude, longitude, placeId
    setLocationData(data);
  }}
  onClear={() => setLocationData(null)}
/>;
```

**Requirements:**

- Set `EXPO_PUBLIC_GOOGLE_PLACES_API_KEY` environment variable
- Package: `react-native-google-places-autocomplete` (already installed)

### Expo Maps (Event Location Preview)

For displaying maps with location markers (events screen):

```tsx
import { AppleMaps, GoogleMaps } from "expo-maps";
import { Platform } from "react-native";

// Render platform-specific map
{
  Platform.OS === "ios" ? (
    <AppleMaps.View
      style={{ flex: 1 }}
      cameraPosition={{
        coordinates: { latitude, longitude },
        zoom: 15,
      }}
      markers={[
        {
          id: "location",
          coordinates: { latitude, longitude },
        },
      ]}
    />
  ) : (
    <GoogleMaps.View
      style={{ flex: 1 }}
      cameraPosition={{
        coordinates: { latitude, longitude },
        zoom: 15,
      }}
      markers={[
        {
          id: "location",
          coordinates: { latitude, longitude },
        },
      ]}
    />
  );
}
```

**Requirements:**

- Package: `expo-maps` (already installed)
- Google Maps API key configured via environment variable

### Secure API Key Configuration

API keys are securely configured in `app.config.js` using environment variables:

```bash
# Copy .env.example to .env and set your keys
cp .env.example .env

# Required environment variables:
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your_key_here
EXPO_PUBLIC_GOOGLE_PLACES_API_KEY=your_key_here
```

Get API keys from [Google Cloud Console](https://console.cloud.google.com/apis/credentials). Enable:

- Maps SDK for Android
- Maps SDK for iOS
- Places API

**Important:** After changing environment variables, run `npx expo prebuild --clean` to regenerate native code with new keys.

---

## 🔌 Payload CMS Integration

### Architecture

```
Expo Client (iOS/Android/Web)
         ↓
Expo Router API Route (+api.ts)
         ↓
Payload REST Client (lib/payload.server.ts)
         ↓
Payload CMS
```

**Security:** Payload API keys are NEVER exposed to the client. All CMS access goes through server-side API routes.

### Server-only Payload Client

`lib/payload.server.ts` - Import ONLY in `+api.ts` files:

```typescript
import {
  payloadClient,
  getCookiesFromRequest,
  createErrorResponse,
} from "@/lib/payload.server";

export async function GET(request: Request) {
  const cookies = getCookiesFromRequest(request);
  const result = await payloadClient.find(
    {
      collection: "posts",
      limit: 10,
      page: 1,
      depth: 2,
      sort: "-createdAt",
      where: { status: { equals: "published" } },
    },
    cookies,
  );
  return Response.json(result);
}
```

### Client-side API Usage

`lib/api-client.ts` - Use in React components:

```typescript
import { posts, users, createCollectionAPI } from "@/lib/api-client";

// Fetch posts
const { docs, totalPages } = await posts.find({ limit: 10, page: 1 });

// Get single post
const post = await posts.findByID("abc123");

// Create post
const newPost = await posts.create({ title: "Hello", content: "..." });

// Get current user
const { user } = await users.me();

// Generic collection
const events = createCollectionAPI("events");
const { docs } = await events.find({ limit: 5 });
```

### API Routes Structure

```
app/
  api/
    posts+api.ts          # GET (list), POST (create)
    posts/[id]+api.ts     # GET, PATCH, DELETE by ID
    users+api.ts          # GET (list), POST (register)
    users/me+api.ts       # GET current user
```

### Environment Variables

```bash
# Server-only (NEVER prefix with EXPO_PUBLIC_)
PAYLOAD_URL=http://localhost:3000
PAYLOAD_API_KEY=your_api_key_here
```

### Auth Forwarding

Cookies are automatically forwarded from client requests to Payload for user authentication:

```typescript
const cookies = getCookiesFromRequest(request);
await payloadClient.find({ collection: "posts" }, cookies);
```

---

## 🔐 Better Auth Integration

### Architecture

```
Expo Client (iOS/Android/Web)
         ↓
Better Auth Client (lib/auth-client.ts)
         ↓
Expo Router API Route (app/api/auth/[...all]+api.ts)
         ↓
Better Auth Server (lib/auth.ts)
         ↓
PostgreSQL Database
```

### Server Configuration

`lib/auth.ts` - Import ONLY in `+api.ts` files:

```typescript
import { betterAuth } from "better-auth";
import { expo } from "@better-auth/expo";

export const auth = betterAuth({
  database: { provider: "pg", url: DATABASE_URI },
  plugins: [expo()],
  emailAndPassword: { enabled: true },
  trustedOrigins: ["dvnt://", "dvnt://*"],
});
```

### Client Usage

`lib/auth-client.ts` - Use in React components:

```typescript
import {
  authClient,
  useSession,
  signIn,
  signUp,
  signOut,
} from "@/lib/auth-client";

// Sign up
await signUp.email({
  email: "user@example.com",
  password: "password123",
  name: "User Name",
});

// Sign in
await signIn.email({
  email: "user@example.com",
  password: "password123",
});

// Sign out
await signOut();

// Get session (hook)
const { data: session } = useSession();

// Social sign in
await signIn.social({
  provider: "google",
  callbackURL: "/dashboard", // converts to dvnt://dashboard
});
```

### Making Authenticated Requests

```typescript
import { authenticatedFetch, getAuthCookies } from "@/lib/auth-client";

// Option 1: Use helper
const response = await authenticatedFetch("/api/posts");

// Option 2: Manual cookies
const cookies = getAuthCookies();
const response = await fetch("/api/posts", {
  headers: { Cookie: cookies || "" },
  credentials: "omit",
});
```

### 🚨 CRITICAL: User Data Isolation

**⚠️ When users log in/out, ALL user-specific data MUST be cleared to prevent data leakage.**

The `clearAllCachedData()` function in `lib/auth-client.ts` handles this and is called automatically during `signIn` and `signUp`. It clears:

1. **React Query Cache** - All cached API responses
2. **MMKV Storage** - Persisted stores (`post-storage`, `bookmark-storage`)
3. **Zustand Stores** - All user-specific state:
   - `useProfileStore` - following, followers, edit state
   - `useFeedPostUIStore` - video states, pressed posts
   - `useFeedSlideStore` - carousel positions
   - `usePostStore` - liked posts, like counts, comment counts
   - `useBookmarkStore` - bookmarked posts

**Storage keys cleared on user switch:**

```typescript
const USER_DATA_STORAGE_KEYS = [
  "post-storage", // liked posts, like counts
  "bookmark-storage", // bookmarked posts
  "chat-storage", // chat data
];
```

**If users report seeing another user's data:**

1. Check that `clearAllCachedData()` is being called in `signIn.email` and `signUp.email`
2. Verify MMKV storage is being cleared via `clearUserDataFromStorage()`
3. Ensure Zustand stores are reset synchronously (not async)
4. Check if any new persisted stores need to be added to the clear list
5. Verify the profile page has the user switch detection (`prevUserIdRef`) that forces refetch

### React Query Cache Clearing (CRITICAL)

**⚠️ `queryClient.clear()` alone is NOT enough!** Use ALL of these methods:

```typescript
globalQueryClient.cancelQueries(); // Cancel active queries
globalQueryClient.removeQueries(); // Remove all queries from cache
globalQueryClient.clear(); // Clear the cache
globalQueryClient.resetQueries(); // Reset query state
```

### Profile Page User Switch Detection (CRITICAL)

The profile page MUST detect user switches and force refetch:

```typescript
// In profile.tsx
const prevUserIdRef = useRef<string | null>(null);

useEffect(() => {
  const currentUserId = user?.id || null;
  if (
    prevUserIdRef.current !== null &&
    prevUserIdRef.current !== currentUserId
  ) {
    console.log("[Profile] User switched, refetching...");
    refetch();
  }
  prevUserIdRef.current = currentUserId;
}, [user?.id, refetch]);
```

This is needed because:

1. React Query's `clear()` doesn't force active queries to re-render
2. Mounted components may still hold stale data
3. The ref-based detection catches when user ID changes and forces refetch

### Environment Variables

```bash
# Server-only
BETTER_AUTH_SECRET=your_secret_here
DATABASE_URI=postgresql://...

# Client-accessible
EXPO_PUBLIC_AUTH_URL=http://localhost:8081
```

### API Routes Structure

```
app/
  api/
    auth/[...all]+api.ts  # All auth endpoints (sign in, sign up, etc.)
```

---

## 📤 Post/Upload Progress Pattern

When creating content (posts, events, etc.), use the `Progress` component with an overlay:

```tsx
import { Progress } from "@/components/ui/progress";

// State
const [isSubmitting, setIsSubmitting] = useState(false);
const [uploadProgress, setUploadProgress] = useState(0);

// Simulate progress during upload
const progressInterval = setInterval(() => {
  setUploadProgress((prev) => (prev >= 90 ? prev : prev + 10));
}, 200);

// On complete
setUploadProgress(100);

// Progress Overlay JSX
{
  isSubmitting && (
    <View className="absolute inset-0 bg-black/80 items-center justify-center z-50">
      <Motion.View
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", damping: 20, stiffness: 300 }}
        className="bg-card rounded-3xl p-8 items-center gap-4"
      >
        <View className="w-48 mb-2">
          <Progress value={uploadProgress} />
        </View>
        <Text className="text-lg font-semibold text-foreground">
          Creating...
        </Text>
      </Motion.View>
    </View>
  );
}
```

---

## 🚀 Production Deployment (API Routes)

### Live Deployments

| Service                | URL                                                          |
| ---------------------- | ------------------------------------------------------------ |
| **Auth (Better Auth)** | `https://npfjanxturvmjyevoyfo.supabase.co/functions/v1/auth` |
| **Edge Functions**     | `https://npfjanxturvmjyevoyfo.supabase.co/functions/v1/*`    |
| **Bunny CDN**          | `https://dvnt.b-cdn.net`                                     |

### EAS Environment Variables

These are configured in EAS project settings and referenced in `eas.json`:

| Variable                   | EAS Secret Name | Value                                                        |
| -------------------------- | --------------- | ------------------------------------------------------------ |
| `EXPO_PUBLIC_AUTH_URL`     | -               | `https://npfjanxturvmjyevoyfo.supabase.co/functions/v1/auth` |
| `EXPO_PUBLIC_SUPABASE_URL` | -               | `https://npfjanxturvmjyevoyfo.supabase.co`                   |
| `EXPO_PUBLIC_BUNNY_*`      | `BUNNY_*`       | See EAS secrets                                              |

### Architecture Overview

**LOCKED (2026-02-06): SUPABASE + EDGE FUNCTIONS ONLY**

```
Native App (iOS/Android)
         ↓
Better Auth (Supabase Edge Function) ← Authentication
Supabase Client (direct) ← Reads
Edge Functions (privileged) ← Writes (posts, stories, events, messages)
         ↓
Supabase PostgreSQL
```

**CRITICAL:**

- ✅ Auth via Better Auth in Supabase Edge Function
- ✅ Reads via Supabase client (anon key)
- ✅ Writes via privileged Edge Functions (service role)
- ❌ No Vercel, no Payload CMS, no Hono, no Expo API routes

### Production Health Checks

```bash
# Better Auth
curl https://npfjanxturvmjyevoyfo.supabase.co/functions/v1/auth/api/auth/ok
# Expected: {"ok":true}
```

### Deployment

All backend logic is deployed as Supabase Edge Functions:

```bash
# Deploy a single Edge Function
supabase functions deploy <function-name>

# Deploy all Edge Functions
supabase functions deploy

# Set secrets
supabase secrets set KEY=value
```

### Local Development

```bash
# Start Expo dev server
npx expo start --tunnel --clear
```

### Why Not Expo Web Export?

The app uses native modules that cannot run in Node.js SSR:

- `expo-secure-store`
- `expo-notifications`
- `react-native-vision-camera`
- `@regulaforensics/react-native-face-api`

These cause `__fbBatchedBridgeConfig is not set` errors during web export.

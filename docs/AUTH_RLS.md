# Authentication & Row Level Security (RLS) Architecture

## Overview

This project uses **Better Auth** for authentication and **Supabase** for the database. This creates a unique challenge because Supabase's Row Level Security (RLS) relies on `auth.uid()`, which only works with Supabase Auth.

Since we use Better Auth, `auth.uid()` returns `null` in RLS policies, causing "permission denied" errors for direct database writes.

## The Problem

```sql
-- This RLS policy DOES NOT WORK with Better Auth
CREATE POLICY "Users can update own profile" ON users
FOR UPDATE USING (auth_id = auth.uid());
-- auth.uid() is NULL because we don't use Supabase Auth!
```

## The Solution: Edge Functions

For any database operation that requires elevated privileges (writes to protected tables), we use **Supabase Edge Functions**:

1. Client sends request with Better Auth token
2. Edge Function verifies token with Better Auth server
3. Edge Function uses service role key to bypass RLS
4. Edge Function performs the database operation

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Client    │────▶│  Edge Function   │────▶│    Supabase     │
│  (Expo RN)  │     │  (Deno Runtime)  │     │   (Postgres)    │
└─────────────┘     └──────────────────┘     └─────────────────┘
      │                     │                        │
      │ Bearer Token        │ Verify with            │ Service Role
      │ (Better Auth)       │ Better Auth            │ (bypasses RLS)
      ▼                     ▼                        ▼
```

## Security Rules

### NEVER Do This

```typescript
// ❌ NEVER expose service role key in client
const supabaseServiceKey = process.env.EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;

// ❌ NEVER create admin client in React Native
export const supabaseAdmin = createClient(url, serviceRoleKey);

// ❌ NEVER disable RLS as a "fix"
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
```

### ALWAYS Do This

```typescript
// ✅ Use Edge Function for privileged writes
import { updateProfilePrivileged } from "@/lib/supabase/privileged";

await updateProfilePrivileged({ name: "New Name", bio: "New bio" });

// ✅ Service role key only in Edge Functions (Deno.env)
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
```

## Operations That Require Edge Functions

| Operation | Edge Function | Status |
|-----------|---------------|--------|
| Update user profile | `update-profile` | ✅ Implemented |
| Delete user account | `delete-account` | 🔜 Planned |
| Update avatar | `update-avatar` | 🔜 Planned |
| Admin actions | Various | 🔜 As needed |

## Operations That Work With Anon Key

These operations work with the regular Supabase client because:
- They are read-only (SELECT)
- They have permissive RLS policies
- They don't require user identity

| Operation | Notes |
|-----------|-------|
| Fetch posts | Public read |
| Fetch user profiles | Public read |
| Fetch stories | Public read |
| Fetch events | Public read |

## Adding a New Privileged Operation

1. **Create Edge Function** in `supabase/functions/<name>/index.ts`
   - Verify Better Auth token
   - Use service role for database access
   - Return structured response

2. **Add wrapper** in `lib/supabase/privileged.ts`
   - Call Edge Function with `supabase.functions.invoke()`
   - Include Authorization header with Better Auth token
   - Handle errors appropriately

3. **Update this document** with the new operation

4. **Test thoroughly**
   - Verify 401 when token missing/invalid
   - Verify correct row is updated
   - Verify RLS is not bypassed incorrectly

## Environment Variables

### Client (.env)
```bash
EXPO_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
EXPO_PUBLIC_AUTH_URL=https://server-zeta-lovat.vercel.app
# ⚠️ NO SERVICE ROLE KEY HERE
```

### Edge Functions (Supabase Secrets)
```bash
supabase secrets set SUPABASE_URL=https://xxx.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=eyJ...
supabase secrets set BETTER_AUTH_BASE_URL=https://server-zeta-lovat.vercel.app
```

## Verification Checklist

Before deploying, verify:

- [ ] `npm run check:secrets` passes (no service role in client)
- [ ] Edge Function returns 401 when token missing
- [ ] Edge Function returns 401 when token invalid
- [ ] Edge Function updates correct row by `auth_id`
- [ ] Client receives updated data after successful operation
- [ ] No "permission denied" errors in production

## Troubleshooting

### "permission denied for table users"
- You're trying to write directly from the client
- Use the appropriate Edge Function wrapper from `lib/supabase/privileged.ts`

### "Invalid or expired session" from Edge Function
- Better Auth token is expired
- Call `authClient.getSession()` to refresh before retrying

### "User not found" from Edge Function
- The `auth_id` in the users table doesn't match the Better Auth user ID
- Check that user was properly synced during registration

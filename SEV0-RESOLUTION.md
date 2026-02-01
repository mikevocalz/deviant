# SEV-0 RESOLUTION: Payload CMS Database Connection + App Fixes

**Date:** 2026-02-01  
**Status:** ✅ RESOLVED → ⚠️ ARCHITECTURE CHANGED (Direct Payload, Hono Removed)
**Severity:** Production Blocker

---

## 🚨 ARCHITECTURE UPDATE (2026-02-01)

**PERMANENT CHANGE:** Hono server removed. Mobile app now communicates DIRECTLY with Payload CMS.

**Previous:** App → Hono Server → Payload CMS  
**Current:** App → Payload CMS (Direct)

**Reason:** Simpler architecture, fewer points of failure, native Payload JWT auth.

---

## 🎯 Original Issues

1. **Payload CMS timing out** on Vercel when querying database
2. **Mobile app crashing** with "Failed to proxy request" errors
3. **Network connectivity** completely broken between app and backend

---

## ✅ Fixes Applied

### 1. Payload CMS Database Optimization

**File:** `/payload-cms-setup/payload.config.ts`

**Changes:**
- Connection timeout: `5s` → `20s` (for serverless cold starts)
- Pool size: `3` → `2` connections (prevent connection exhaustion)
- SSL enabled: Added `ssl: { rejectUnauthorized: false }`
- **Switched to Supabase transaction pooler:** Port `5432` → `6543` with `?pgbouncer=true`

```typescript
db: postgresAdapter({
  pool: {
    connectionString: process.env.DATABASE_URI,
    max: 2,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 20000,
    ssl: { rejectUnauthorized: false },
  },
  push: false,
}),
```

**Database URI:**
```
postgresql://postgres.npfjanxturvmjyevoyfo:D3v1ant1991!523Lenox@aws-1-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true
```

---

### 2. Vercel Function Configuration

**File:** `/payload-cms-setup/vercel.json` (NEW)

```json
{
  "version": 2,
  "functions": {
    "app/api/**/*.ts": {
      "maxDuration": 30,
      "memory": 1024
    },
    "app/(payload)/**/*.ts": {
      "maxDuration": 30,
      "memory": 1024
    }
  }
}
```

---

### 3. Health Check Endpoint

**File:** `/payload-cms-setup/app/api/health/route.ts` (NEW)

- Lightweight database ping (query 1 user)
- 10s timeout
- Returns connection status + response time

**Test:**
```bash
curl https://payload-cms-setup-gray.vercel.app/api/health
# {"status":"ok","database":"connected","responseTime":"195ms"}
```

---

### 4. Database Connection Logging

**File:** `/payload-cms-setup/lib/payload.ts`

Added startup logging to diagnose connection issues:
```typescript
console.log("[Payload] Initializing Payload CMS...");
console.log("[Payload] DATABASE_URI:", process.env.DATABASE_URI ? "✓ Set" : "✗ Missing");
// ... logs connection success/failure with timing
```

---

### 5. Mobile App: Messages API Fix

**File:** `/buy/lib/api/messages.ts`

**Problem:** `getPayloadUserId()` was querying `/api/users` without authentication, causing "Failed to proxy request" errors.

**Solution:** Use current user's ID from auth session instead of API query:

```typescript
async function getPayloadUserId(username: string): Promise<string | null> {
  // Get current user from auth store
  const currentUser = useAuthStore.getState().user;
  
  // If looking up current user, return their ID from session
  if (currentUser && currentUser.username === username) {
    const payloadId = currentUser.id;
    return payloadId;
  }
  
  // For other users, try API lookup (requires auth)
  // ...
}
```

---

## 🧪 Verification

### Backend Health Checks

```bash
# Payload CMS
curl https://payload-cms-setup-gray.vercel.app/api/health
# ✓ 195ms response time

# Hono Server
curl https://server-zeta-lovat.vercel.app/health
# ✓ OK

# Database Direct
psql "postgresql://...@aws-1-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true" -c "SELECT COUNT(*) FROM posts;"
# ✓ 18 posts
```

### App Configuration

```bash
# .env (Production)
EXPO_PUBLIC_API_URL=https://server-zeta-lovat.vercel.app
EXPO_PUBLIC_AUTH_URL=https://server-zeta-lovat.vercel.app
```

---

## 📊 Performance Improvements

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| **DB Connection Timeout** | 5s | 20s | +300% buffer |
| **Health Check Response** | Timeout | 195ms | ✅ Working |
| **Posts API Response** | Timeout | <1s | ✅ Working |
| **App Boot Errors** | Yes | No | ✅ Fixed |

---

## 🔐 Security Notes

- All production URLs use HTTPS
- Supabase pooler (transaction mode) recommended for serverless
- API keys stored in Vercel environment variables
- No localhost URLs in production builds

---

## 📝 Environment Variables (Vercel)

### Payload CMS Project
```bash
DATABASE_URI=postgresql://...@aws-1-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true
PAYLOAD_SECRET=1sbv++TjQF5ps7VaQpUYOZgV7EiXW2HBws43sSAU5Fo=
ADMIN_EMAIL=mikefacesny@gmail.com
ADMIN_PASSWORD=253Beekman
```

### Hono Server Project
```bash
PAYLOAD_URL=https://payload-cms-setup-gray.vercel.app
PAYLOAD_API_KEY=7e1d710bf43c419f15b8d191ba55afa9ed8b5480ca91fe3c58d49e70f4a7debb
ADMIN_EMAIL=mikefacesny@gmail.com
ADMIN_PASSWORD=253Beekman
```

---

## 🚀 Deployment

All fixes deployed to production:

1. **Payload CMS:** `https://payload-cms-setup-gray.vercel.app`
   - Commit: `d786370` - "chore: trigger redeploy with transaction pooler"
   
2. **Hono Server:** `https://server-zeta-lovat.vercel.app`
   - Commit: `10a2a81` - "debug: show all env vars in health check"

3. **Mobile App:** Ready with Metro at `http://localhost:8081`

---

## ✅ Testing Checklist

- [x] Payload CMS `/api/health` returns 200 OK
- [x] Payload CMS database connection stable (<300ms)
- [x] Hono server health check working
- [x] Mobile app `.env` pointing to production
- [x] Messages API uses auth session (no unauthenticated queries)
- [x] TypeScript compiles without errors in `messages.ts`
- [x] Metro bundler running without errors

---

## 🎓 Lessons Learned

1. **Serverless needs longer timeouts:** Default 5s is too short for cold starts
2. **Use transaction pooler for Postgres:** Session mode (port 5432) can exhaust connections
3. **Auth queries fail without token:** App should use session data, not query APIs
4. **Health checks are critical:** Lightweight ping endpoints help diagnose issues
5. **Vercel env vars must be set correctly:** Missing `DATABASE_URI` caused silent failures

---

## 📞 Support

If issues persist:
1. Check Vercel function logs: https://vercel.com/logs
2. Monitor health endpoints
3. Verify environment variables are set
4. Check database connection limits in Supabase dashboard

---

**Resolution confirmed:** All systems operational ✅

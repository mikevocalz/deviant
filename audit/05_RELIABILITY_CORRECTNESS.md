# Reliability & Correctness Audit

## REL-01: MEDIUM — Error Boundaries Cover Only 3 of 96 Screens

**Evidence**:

```bash
grep -rn "ErrorBoundary" app/ components/ lib/ --include="*.tsx" --include="*.ts" | grep -v node_modules
```

Only 3 screens wrap content in error boundaries:

- `app/(protected)/(tabs)/index.tsx` — feed screen (inline class-based boundary)
- `app/(protected)/post/[id].tsx` — post detail (imported from `@/components/error-boundary`)
- `app/(protected)/(tabs)/profile.tsx` — profile screen

**Impact**: Any unhandled JS error on the remaining 93 screens crashes the entire app. Given the use of native modules (Skia, Vision Camera, WebRTC), unhandled errors in rendering are likely.

**Fix**: Add a global `ErrorBoundary` in `app/_layout.tsx` wrapping the `<Slot />`. This catches crashes on any screen without needing per-screen changes.

---

## REL-02: LOW — 18 Skipped Migrations

**Evidence**:

```bash
find supabase/migrations -name "*.sql.skip" | wc -l
# Result: 18
```

Skipped migrations suggest schema evolution attempts that were abandoned or deferred. No cleanup plan or documentation explains which are safe to delete vs. which represent planned work.

**Fix**: Document each `.sql.skip` file with a one-line comment at the top explaining its status: "superseded by X", "deferred to v2", or "delete after Y date".

---

## REL-03: LOW — users.id Has No Auto-Increment Sequence

**Known issue** (from memory): The `users` table's `id` column (integer PK) has no sequence. INSERTs that omit `id` fail. Edge functions work around this by querying `max(id) + 1`.

**Impact**: Race condition — two concurrent edge functions could both get `max(id) = 50` and both try to insert `id = 51`. The second would fail.

**Fix**: Add a proper SERIAL or IDENTITY sequence:

```sql
CREATE SEQUENCE IF NOT EXISTS users_id_seq OWNED BY users.id;
SELECT setval('users_id_seq', (SELECT COALESCE(MAX(id), 0) FROM users));
ALTER TABLE users ALTER COLUMN id SET DEFAULT nextval('users_id_seq');
```

---

## Positive Findings

- ✅ Boot guard mechanism (`lib/boot-guard.ts`) tracks consecutive failed boots
- ✅ Auth rehydration race condition fixed (loadAuthState awaits MMKV hydration)
- ✅ Optimistic UI updates with proper rollback on failure (TanStack Query mutations)
- ✅ Chat message key mismatch fixed (activeConvId tracks resolved numeric ID)
- ✅ Password reset URL fixed (fixEmailUrl rewrites path + appends apikey)
- ✅ COUNT(*)-based triggers replace racy RPC increment/decrement for all counters
- ✅ Safe native module wrappers prevent OTA crashes from missing native modules
- ✅ Regression tests exist for critical invariants (message sender, story thumbnails, identity ownership)

# Migration Safety Protocol Enforcement

## Current State

- **58 active migrations** (`.sql` files)
- **18 skipped migrations** (`.sql.skip` files)
- **3 migration packages** with rollback/verification subdirectories:
  - `backend_health_package/`
  - `comment_likes_package/`
  - `event_editing_promotion/`
- **2 additional subdirectories**: `follow_system_fix/`, `rollback/`, `verification/`

## Protocol: Plan → Prove → Apply → Verify → Rollback

### Plan

- ✅ Migration packages exist with structured directories
- ⚠️ No standard template for new migration packages
- ⚠️ 18 `.sql.skip` files have no documentation on why they're skipped

### Prove

- ✅ `scripts/verify-backend-health.sql` exists for post-migration health checks
- ✅ `scripts/db-contract-tests.sql` provides 12 DB invariant checks
- ⚠️ No CI step runs these checks automatically

### Apply

- ✅ Migrations are numbered with timestamps
- ⚠️ No `supabase db push` or `supabase migration up` in CI
- ⚠️ Migrations appear to be applied manually via SQL Editor

### Verify

- ✅ `scripts/verify-backend-health.sql` checks all counts = 0
- ✅ `scripts/ci-guardrails.ts` provides client-side checks
- ⚠️ No automated post-apply verification step

### Rollback

- ✅ `supabase/migrations/rollback/` directory exists
- ⚠️ Only some migrations have corresponding rollback scripts
- ⚠️ No documented rollback procedure

## Recommendations

1. **Create a migration template**: `scripts/new-migration.sh` that scaffolds `plan.md`, `apply.sql`, `verify.sql`, `rollback.sql`
2. **Document .sql.skip files**: Add a header comment to each explaining status
3. **Add CI check**: Run `verify-backend-health.sql` and `db-contract-tests.sql` on every PR that touches `supabase/`
4. **Add users.id sequence**: Known issue — `users.id` lacks auto-increment. Migration file was created but never pushed due to conflicts.

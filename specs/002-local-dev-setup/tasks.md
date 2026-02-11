# Tasks: Local Development Setup

**Feature Branch**: `002-local-dev-setup` | **Generated**: 2026-02-10

## Task Breakdown

### T1: Fix PostgreSQL Migration Idempotency
**Status**: Pending | **Priority**: P1 | **File**: `backend/migrations/001_initial.up.sql`

Add `IF NOT EXISTS` clauses to all DDL statements to make migrations idempotent.

**Changes**:
- Add `IF NOT EXISTS` to `CREATE TABLE`
- Add `IF NOT EXISTS` to `CREATE INDEX`
- Add `IF NOT EXISTS` to `CREATE EXTENSION`
- Wrap `CREATE POLICY` statements in PL/pgSQL blocks with existence checks

---

### T2: Update ClickHouse Port Configuration
**Status**: Pending | **Priority**: P1 | **File**: `docker-compose.yml`

Remap ClickHouse native port from 9000 to 9004 to avoid macOS AirPlay conflict.

**Changes**:
- Change `"9000:9000"` to `"9004:9000"` in ClickHouse ports mapping

---

### T3: Update Environment Configuration
**Status**: Pending | **Priority**: P1 | **File**: `.env.example`

Update ClickHouse port reference to 9004.

**Changes**:
- Change `CLICKHOUSE_NATIVE_PORT=9000` to `CLICKHOUSE_NATIVE_PORT=9004`

---

### T4: Update Backend Config Defaults
**Status**: Pending | **Priority**: P1 | **File**: `backend/internal/config/config.go`

Update default ClickHouse port in configuration loading.

**Changes**:
- Update default port from 9000 to 9004 for ClickHouse native protocol

---

### T5: Update Makefile for Docker Exec Migrations
**Status**: Pending | **Priority**: P1 | **File**: `Makefile`

Change migration targets to use `docker compose exec` instead of local CLI tools.

**Changes**:
- Update `migrate-up` target to use `docker compose exec -T postgres psql`
- Update `ch-init` target to use `docker compose exec -T clickhouse clickhouse-client`

---

### T6: Create Frontend Environment Template
**Status**: Pending | **Priority**: P2 | **File**: `frontend/.env.local.example`

Create environment template for frontend with development defaults.

**Changes**:
- Create new file with `NEXT_PUBLIC_API_URL=http://localhost:8080`
- Include empty `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` with comments

---

### T7: Add Conditional ClerkProvider Wrapper
**Status**: Pending | **Priority**: P2 | **File**: `frontend/src/app/layout.tsx`

Add conditional rendering for ClerkProvider based on presence of publishable key.

**Changes**:
- Check for `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` at runtime
- Wrap app in ClerkProvider only when key is present
- Add dev-mode banner when Clerk is not configured

---

### T8: Add Dev-Mode User Button Placeholder
**Status**: Pending | **Priority**: P2 | **File**: `frontend/src/app/(dashboard)/layout.tsx`

Replace UserButton with dev-mode placeholder when Clerk is not configured.

**Changes**:
- Check for Clerk configuration
- Show placeholder avatar/text when Clerk is disabled
- Keep UserButton for production mode

---

### T9: Create Setup Script
**Status**: Pending | **Priority**: P1 | **File**: `scripts/setup.sh`

Create comprehensive setup script with prerequisite checks, config generation, and service orchestration.

**Changes**:
- Check prerequisites (Docker, Go, Node.js, npm, make)
- Detect port conflicts
- Generate `.env` from `.env.example`
- Generate `frontend/.env.local` from template
- Start Docker services
- Wait for health checks
- Run migrations
- Install dependencies
- Print status summary

---

### T10: Update Makefile Setup Target
**Status**: Pending | **Priority**: P1 | **File**: `Makefile`

Update `make setup` to invoke the new setup script.

**Changes**:
- Modify `setup` target to run `bash scripts/setup.sh`

---

### T11: Update Quickstart Documentation
**Status**: Pending | **Priority**: P3 | **File**: `specs/002-local-dev-setup/quickstart.md`

Update quickstart guide with new workflow and commands.

**Changes**:
- Reference the new setup script
- Document dev-mode authentication bypass
- Update port references (9004 for ClickHouse native)
- Add troubleshooting section

---

## Task Dependencies

```
T1 → T5 → T9 → T10
T2 → T3 → T4
T6 → T7 → T8
T9 → T11
```

## Completion Criteria

- [ ] All migrations are idempotent
- [ ] All 5 Docker services start without port conflicts
- [ ] `bash scripts/setup.sh` completes successfully
- [ ] Backend starts in dev mode without Clerk/AI keys
- [ ] Frontend renders without Clerk keys
- [ ] Health check endpoint returns success
- [ ] Documentation is updated

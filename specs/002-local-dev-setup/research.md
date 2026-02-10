# Research: Local Development Setup

**Feature**: 002-local-dev-setup
**Date**: 2026-02-10

## R1: Frontend Clerk Dev Bypass Strategy

**Decision**: Conditional ClerkProvider wrapper based on environment variable presence

**Rationale**: The `@clerk/nextjs` `ClerkProvider` component throws a runtime error when `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` is not set. Since local development should not require a Clerk account, the root layout must conditionally render ClerkProvider only when the key is present. Next.js exposes `NEXT_PUBLIC_*` env vars at build time, so a simple runtime check (`process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`) determines the mode.

**Alternatives considered**:
- **Mock Clerk provider**: Create a stub ClerkProvider that returns mock user data. Rejected — adds complexity and maintenance burden as Clerk API changes.
- **Clerk dev instance**: Require developers to create a free Clerk dev project. Rejected — violates the "no mandatory third-party accounts" requirement.
- **Remove Clerk entirely for dev**: Use a build-time flag to swap auth providers. Rejected — too invasive; conditional rendering is simpler.

**Implementation detail**: Create a `DevModeProvider` wrapper component that renders children without ClerkProvider. Add a visible banner ("DEV MODE — Auth Disabled") so developers know they're in bypass mode. Replace `<UserButton />` with a static avatar in dev mode.

## R2: PostgreSQL Migration Idempotency

**Decision**: Add `IF NOT EXISTS` to all DDL statements; wrap policy creation in PL/pgSQL blocks

**Rationale**: PostgreSQL supports `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, and `CREATE EXTENSION IF NOT EXISTS`. However, `CREATE POLICY` does not have an `IF NOT EXISTS` clause in PostgreSQL 16. The solution is to wrap policy creation in `DO $$ ... END $$` blocks that check `pg_policies` before creating.

**Alternatives considered**:
- **Use a migration framework (golang-migrate)**: Proper solution for production, but adds a dependency and changes the migration workflow. Better for a future feature.
- **Drop and recreate on every run**: Destructive — would lose data between sessions.
- **Check migration state in setup script**: Fragile — would need to parse psql output.

**Implementation detail**: For each `CREATE POLICY` statement, wrap in:
```sql
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tenant_isolation' AND tablename = 'table_name') THEN
    CREATE POLICY tenant_isolation ON table_name ...;
  END IF;
END $$;
```

For `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`, this is already idempotent (enabling twice is safe).

## R3: Docker Exec for Migrations

**Decision**: Use `docker compose exec` instead of local CLI tools for running migrations

**Rationale**: The `psql` CLI and `clickhouse-client` are not installed by default on macOS. Rather than requiring developers to install these tools (via Homebrew or otherwise), we can execute migrations inside the already-running Docker containers which have these tools available.

**Alternatives considered**:
- **Require local installation**: Document `brew install postgresql clickhouse` as a prerequisite. Rejected — adds friction and version mismatch risk.
- **Embed migrations in Go code**: Use `pgx` to run SQL files at startup. Good long-term solution but larger change. Better for a future feature.
- **Docker run (one-shot containers)**: Similar to exec but creates/destroys containers. Exec is simpler since containers are already running.

**Implementation detail**:
```makefile
migrate-up:
	docker compose exec -T postgres psql -U remedyiq -d remedyiq -f /dev/stdin < backend/migrations/001_initial.up.sql

ch-init:
	docker compose exec -T clickhouse clickhouse-client --queries-file /dev/stdin < backend/migrations/clickhouse/001_init.sql
```

## R4: macOS Port 9000 Conflict

**Decision**: Remap ClickHouse native port from 9000 to 9004

**Rationale**: macOS Monterey (12.0+) introduced AirPlay Receiver which listens on port 5000 and 7000, and in some configurations port 9000. ControlCenter on macOS also uses port 9000 in certain setups. The MinIO API was already remapped to 9002 to avoid this conflict. ClickHouse native protocol should also be remapped.

**Alternatives considered**:
- **Disable AirPlay Receiver**: Requires manual system settings change. Rejected — poor developer experience.
- **Use port 9009**: ClickHouse uses 9009 for inter-server replication. Rejected — potential confusion.
- **Use only HTTP interface (8123)**: The Go `clickhouse-go` driver supports both native and HTTP protocols. However, native protocol is significantly faster for bulk inserts. Remapping is simpler than changing protocol.

**Implementation detail**: Change `docker-compose.yml` port mapping from `"9000:9000"` to `"9004:9000"` (host 9004 maps to container's native 9000). Update `.env.example` ClickHouse native port to 9004. Update `config.go` default for `CLICKHOUSE_URL` to use port 9004.

## R5: Frontend API URL Configuration

**Decision**: Add `NEXT_PUBLIC_API_URL` environment variable with `http://localhost:8080` default

**Rationale**: The frontend needs to know where the backend API is running. Currently, API calls in the frontend either use relative paths or hardcoded URLs. A `NEXT_PUBLIC_API_URL` env var provides a clean configuration point.

**Alternatives considered**:
- **Next.js rewrites/proxy**: Configure `next.config.ts` to proxy `/api/*` to the backend. Good approach but changes the URL structure and adds Next.js as a middleman.
- **Hardcode localhost:8080**: Works for local dev but breaks in other environments.

**Implementation detail**: Create `frontend/.env.local.example` with:
```
NEXT_PUBLIC_API_URL=http://localhost:8080
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
```

## R6: Setup Script Architecture

**Decision**: Single bash script (`scripts/setup.sh`) with clear phases and colored output

**Rationale**: A comprehensive setup script provides the best developer experience. It handles prerequisite checking, configuration generation, service startup, health verification, and migration execution in a single invocation. Using bash (not Make) for the top-level orchestration allows for proper error handling, colored output, and user-friendly messages.

**Alternatives considered**:
- **Keep Makefile-only approach**: Make is good for individual targets but poor for sequential workflows with error handling and user feedback.
- **Use Docker Compose profiles**: Docker Compose can orchestrate services but can't check prerequisites or run migrations.
- **Use a Go CLI tool**: Over-engineered for a setup script. Better suited for production tooling.

**Implementation detail**: The script follows these phases:
1. Check prerequisites (docker, go, node, npm, make)
2. Check for port conflicts
3. Generate `.env` from `.env.example` if not present
4. Generate `frontend/.env.local` from template if not present
5. Start Docker services and wait for health checks
6. Run database migrations via docker exec
7. Install Go dependencies
8. Install frontend dependencies
9. Print status summary with next steps

## R7: Worker Limitation Documentation

**Decision**: Document the Worker job processing limitation; do not implement job processing in this feature

**Rationale**: The Worker currently connects to all infrastructure services but does not subscribe to NATS or process jobs. Implementing the full job processing pipeline is a significant effort that belongs to a separate feature. For local dev setup, the goal is ensuring the Worker starts successfully and all connections are healthy.

**Alternatives considered**:
- **Implement basic job processing**: Would make the end-to-end pipeline work but is out of scope for a "setup" feature. Estimated effort: 3-5 days.
- **Add a mock processor**: Returns fake results. Rejected — misleading and creates technical debt.

**Impact on spec**: US4 (End-to-End Log Analysis Pipeline) will be partially fulfilled. File upload and job creation will work, but the Worker won't process jobs. This is documented as a known limitation.

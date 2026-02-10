# Implementation Plan: Local Development Setup

**Branch**: `002-local-dev-setup` | **Date**: 2026-02-10 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-local-dev-setup/spec.md`

## Summary

Make the existing RemedyIQ MVP run end-to-end on a local macOS (Apple Silicon) machine. The codebase has all 88 MVP tasks implemented, but several issues prevent it from actually running: non-idempotent PostgreSQL migrations, hard dependency on `psql`/`clickhouse-client` CLI tools for migrations, frontend crashes without Clerk keys, no dev-mode auth bypass on the frontend, port 9000 conflict with macOS AirPlay, and a stubbed-out Worker job processor. This plan addresses each blocker with minimal, targeted changes.

## Technical Context

**Language/Version**: Go 1.24.1 (backend), TypeScript 5 / Next.js 16.1.6 (frontend)
**Primary Dependencies**: gorilla/mux, clickhouse-go/v2, pgx/v5, nats.go, bleve/v2, @clerk/nextjs, shadcn/ui, Recharts
**Storage**: PostgreSQL 16 (metadata + RLS), ClickHouse 24 (log entries), Redis 7 (cache), MinIO (S3-compatible files)
**Testing**: `go test` with race detector, sample log files in `backend/testdata/`
**Target Platform**: macOS ARM64 (Apple Silicon) with Docker Desktop
**Project Type**: Web application (Go backend + Next.js frontend)
**Performance Goals**: Setup completes in under 10 minutes; idle stack uses <4 GB RAM
**Constraints**: No mandatory third-party accounts (Clerk, Anthropic) for local dev
**Scale/Scope**: Single developer workstation, 5 Docker services + 2 Go processes + 1 Node.js dev server

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Wrapper-First Architecture | PASS | JAR remains primary parser; native Go is fallback when Java unavailable |
| II. API-First Design | PASS | No new APIs added; existing OpenAPI contracts unchanged |
| III. Test-First Development | PASS | Setup script changes testable via dry-run; migration idempotency verifiable |
| IV. AI as a Skill | PASS | AI features degrade gracefully when ANTHROPIC_API_KEY absent (existing behavior) |
| V. Multi-Tenant by Default | PASS | Dev bypass headers inject tenant context; no change to isolation model |
| VI. Simplicity Gate | PASS | No new services added; changes limited to scripts, configs, and conditional rendering |
| VII. Log Format Fidelity | N/A | No parser changes |
| VIII. Streaming-Ready | N/A | No changes to streaming architecture |
| IX. Incremental Delivery | PASS | This feature makes existing Phase 1 deliverable actually runnable |

All gates pass. No violations to justify.

## Identified Blockers

### B1: Frontend Crashes Without Clerk Keys

**Problem**: `frontend/src/app/layout.tsx` wraps the entire app in `<ClerkProvider>` which requires `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` to be set. Without it, the frontend throws a runtime error and won't render.

**Solution**: Add a conditional dev-mode wrapper that detects when Clerk keys are absent and renders children directly without ClerkProvider. Show a dev-mode banner. Replace `<UserButton />` with a dev placeholder when Clerk is not configured.

### B2: PostgreSQL Migrations Not Idempotent

**Problem**: `backend/migrations/001_initial.up.sql` uses `CREATE TABLE` and `CREATE EXTENSION` without `IF NOT EXISTS`. Running `make migrate-up` twice fails with "relation already exists" errors.

**Solution**: Add `IF NOT EXISTS` to all `CREATE TABLE`, `CREATE INDEX`, and `CREATE EXTENSION` statements. Add `CREATE POLICY ... IF NOT EXISTS` or use `DO $$ ... END $$` blocks for policies. ClickHouse migrations already use `IF NOT EXISTS` — no changes needed there.

### B3: Migration CLI Tools Not Available

**Problem**: `Makefile` targets `migrate-up` and `ch-init` require `psql` and `clickhouse-client` to be installed locally. These are not standard on macOS.

**Solution**: Change Makefile targets to use `docker compose exec` to run migrations inside the running containers. This eliminates the need for local CLI tool installation.

### B4: macOS Port 9000 Conflict

**Problem**: ClickHouse native protocol uses port 9000, which conflicts with macOS AirPlay Receiver (Monterey+). This causes `docker compose up` to fail or ClickHouse to be unreachable.

**Solution**: Remap ClickHouse native port to 9004 in `docker-compose.yml`. Update `.env.example` and config defaults to use port 9004. The HTTP interface (8123) is unaffected.

### B5: Worker Job Processing Stubbed Out

**Problem**: The Worker (`backend/cmd/worker/main.go`) initializes all connections but then just waits for a shutdown signal. It logs "job processing will be enabled in Phase 3" — it never subscribes to NATS or processes jobs.

**Solution**: This is a known incomplete feature from the MVP. For local dev setup, the Worker should at minimum subscribe to the NATS job queue and attempt to process incoming jobs. However, this is a larger change that belongs to a separate feature. For now, document this limitation clearly and ensure the Worker starts without errors.

### B6: No Frontend .env Configuration

**Problem**: The frontend has no `.env.local` file or template. It needs `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `NEXT_PUBLIC_API_URL` to function.

**Solution**: Create `frontend/.env.local.example` with development defaults. The setup script copies it to `frontend/.env.local` if not present. Include `NEXT_PUBLIC_API_URL=http://localhost:8080` and empty Clerk keys with comments.

### B7: Setup Script Missing

**Problem**: While `make setup` exists, it chains `deps`, `docker-up`, and `db-setup` but lacks prerequisite checking, port conflict detection, .env generation, and clear error reporting.

**Solution**: Create `scripts/setup.sh` as a comprehensive bootstrap script that: checks prerequisites, detects port conflicts, generates `.env` files, starts Docker, waits for health checks, runs migrations, and reports status. Update `make setup` to invoke this script.

## Project Structure

### Documentation (this feature)

```text
specs/002-local-dev-setup/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output (N/A — no new data models)
├── quickstart.md        # Phase 1 output (updated local dev guide)
├── contracts/           # Phase 1 output (N/A — no new APIs)
└── tasks.md             # Phase 2 output (via /speckit.tasks)
```

### Source Code (repository root)

```text
backend/
├── cmd/
│   ├── api/main.go              # No changes needed
│   └── worker/main.go           # No changes needed (document limitation)
├── internal/
│   └── config/config.go         # Update ClickHouse default port 9000→9004
├── migrations/
│   ├── 001_initial.up.sql       # Add IF NOT EXISTS for idempotency
│   └── clickhouse/001_init.sql  # Already idempotent — no changes
└── testdata/                    # Existing sample logs — no changes

frontend/
├── src/app/
│   ├── layout.tsx               # Conditional ClerkProvider wrapper
│   └── (dashboard)/layout.tsx   # Conditional UserButton
├── .env.local.example           # NEW: dev defaults template
└── package.json                 # No changes needed

scripts/
└── setup.sh                     # NEW: comprehensive bootstrap script

docker-compose.yml               # Remap ClickHouse native port 9000→9004
.env.example                     # Update ClickHouse port reference
Makefile                         # Use docker exec for migrations; invoke setup.sh
```

**Structure Decision**: Web application (existing layout preserved). Changes are surgical — 4 existing files modified, 2 new files created, no new services.

## Complexity Tracking

No constitution violations. All changes fit within the existing 3-service architecture.

# Implementation Plan: Comprehensive Test Coverage

**Branch**: `005-test-coverage` | **Date**: 2026-02-12 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/005-test-coverage/spec.md`

## Summary

Rewrite all 35 existing backend test files and create new tests for uncovered code, plus build the entire frontend test suite from scratch, targeting tiered coverage thresholds (90% critical packages, 80% others, 85% aggregate). The approach involves: (1) extracting interfaces from concrete storage/infrastructure types to enable mocking, (2) creating a shared test utilities package with mock implementations and fixture loaders, (3) rewriting all backend tests with unified patterns, (4) setting up Vitest for the frontend and writing component/hook/utility tests, and (5) adding Docker-based integration tests for all external services.

## Technical Context

**Language/Version**: Go 1.24.1 (backend), TypeScript 5.x / Next.js 16.1.6 (frontend)
**Primary Dependencies**: testify v1.11.1 (Go assertions/mocks), Vitest 3.x + React Testing Library 16.x (frontend), gorilla/mux, pgx v5, clickhouse-go v2, redis v9, nats.go, anthropic-sdk-go, bleve v2
**Storage**: PostgreSQL 16 (RLS), ClickHouse 24 (analytics), Redis 7 (cache), MinIO (S3-compatible)
**Testing**: `go test` with `-race -cover` (backend unit), `go test -tags=integration` (backend integration), `vitest` (frontend)
**Target Platform**: Linux server (backend), Browser (frontend)
**Project Type**: Web application (Go API + Next.js frontend)
**Performance Goals**: Unit test suite completes in under 60 seconds; integration suite under 5 minutes
**Constraints**: Unit tests must run without Docker/external services; integration tests require `docker-compose up`
**Scale/Scope**: ~86 Go source files, ~43 TypeScript/React files; ~60 test files to write/rewrite; targeting 85%+ aggregate coverage

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Wrapper-First Architecture | PASS | Tests validate JAR wrapper behavior using real log fixtures |
| II. API-First Design | PASS | Handler tests validate all API endpoints against expected contracts |
| III. Test-First Development | PASS | This feature directly implements the test-first mandate; uses real AR log samples from testdata/ |
| IV. AI as a Skill | PASS | AI skill tests validate typed request/response contracts with mocked client |
| V. Multi-Tenant by Default | PASS | Storage tests validate tenant isolation; middleware tests validate tenant context |
| VI. Simplicity Gate | PASS | No new services added; test utilities are internal packages, not external dependencies |
| VII. Log Format Fidelity | PASS | Parser tests with real log fixtures validate fidelity; fidelity_test.go is rewritten |
| VIII. Streaming-Ready | PASS | NATS and WebSocket tests validate streaming infrastructure |
| IX. Incremental Delivery | PASS | Tests are organized by priority (P1-P6) allowing incremental implementation |

**Post-Phase 1 Re-check**: All gates remain PASS. Interface extraction does not add services or complexity — it makes existing concrete types testable.

## Project Structure

### Documentation (this feature)

```text
specs/005-test-coverage/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0: technology decisions and rationale
├── data-model.md        # Phase 1: interface definitions and mock entities
├── quickstart.md        # Phase 1: how to run tests
├── contracts/           # Phase 1: interface contracts and config specs
│   ├── test-interfaces.go    # Go interface definitions
│   ├── makefile-targets.md   # Makefile test target contracts
│   └── vitest-config.md      # Frontend test configuration
├── checklists/
│   └── requirements.md       # Spec quality checklist
└── tasks.md             # Phase 2 output (created by /speckit.tasks)
```

### Source Code (repository root)

```text
backend/
├── internal/
│   ├── testutil/                    # NEW: Shared test infrastructure
│   │   ├── mocks.go                # Mock implementations for all interfaces
│   │   ├── fixtures.go             # Test data loading helpers
│   │   └── helpers.go              # HTTP test helpers, context builders
│   ├── storage/
│   │   ├── interfaces.go           # NEW: Extracted storage interfaces
│   │   ├── postgres_unit_test.go   # Rewritten unit tests
│   │   ├── postgres_test.go        # Rewritten integration tests
│   │   ├── clickhouse_unit_test.go # New unit tests
│   │   ├── clickhouse_test.go      # Rewritten integration tests
│   │   ├── redis_unit_test.go      # New unit tests
│   │   ├── redis_test.go           # New integration tests
│   │   ├── s3_unit_test.go         # New unit tests
│   │   └── s3_test.go              # Rewritten integration tests
│   ├── api/
│   │   ├── handlers/               # 14 handler test files (rewritten + new)
│   │   ├── middleware/             # 7 middleware test files (rewritten + new)
│   │   ├── response_test.go       # New
│   │   └── router_test.go         # New
│   ├── ai/
│   │   ├── interfaces.go          # NEW: AI client interface
│   │   ├── client_test.go         # Rewritten
│   │   ├── registry_test.go       # Rewritten
│   │   └── skills/                # 7 skill test files (rewritten + new)
│   ├── jar/                       # 4 test files (rewritten + new)
│   ├── search/                    # 2 test files (rewritten)
│   ├── streaming/
│   │   ├── interfaces.go          # NEW: NATS interface
│   │   ├── nats_unit_test.go      # New unit tests
│   │   ├── nats_test.go           # Rewritten integration tests
│   │   └── websocket_test.go      # New
│   ├── worker/                    # 4 test files (rewritten + new)
│   └── config/
│       └── config_test.go         # New

frontend/
├── vitest.config.ts               # NEW: Vitest configuration
├── src/
│   ├── test-setup.ts              # NEW: Global test setup
│   ├── __mocks__/                 # NEW: Global mocks
│   │   ├── recharts.tsx
│   │   └── react-window.tsx
│   ├── lib/                       # 3 test files (new)
│   ├── hooks/                     # 4 test files (new)
│   ├── components/
│   │   ├── dashboard/             # 12 test files (new)
│   │   ├── explorer/              # 4 test files (new)
│   │   ├── trace/                 # 1 test file (new)
│   │   ├── ai/                    # 2 test files (new)
│   │   └── upload/                # 2 test files (new)
│   └── app/                       # 7 page test files (new)
```

**Structure Decision**: Web application structure (backend + frontend). Tests are colocated with source following Go and React conventions. A new `backend/internal/testutil/` package provides shared test infrastructure. Interface files are added to `storage/`, `ai/`, and `streaming/` packages. Frontend test config added at `frontend/vitest.config.ts`.

## Implementation Phases

### Phase 0: Test Infrastructure Foundation

**Goal**: Set up shared test utilities, interfaces, and configuration that all subsequent test phases depend on.

**Deliverables**:
1. `backend/internal/storage/interfaces.go` — Extract interfaces from concrete types
2. `backend/internal/ai/interfaces.go` — AI client interface
3. `backend/internal/streaming/interfaces.go` — NATS streamer interface
4. `backend/internal/testutil/mocks.go` — Mock implementations for all interfaces
5. `backend/internal/testutil/fixtures.go` — Test fixture loader (error_logs/, testdata/)
6. `backend/internal/testutil/helpers.go` — HTTP test helpers, context builders, assertion helpers
7. `frontend/vitest.config.ts` — Vitest configuration with coverage thresholds
8. `frontend/src/test-setup.ts` — Global test setup (browser API mocks)
9. `frontend/src/__mocks__/recharts.tsx` — Recharts component mocks
10. `frontend/src/__mocks__/react-window.tsx` — react-window mocks
11. Updated `Makefile` — New test targets (test-integration, test-all, test-frontend, test-full)
12. Frontend dev dependencies installed (vitest, @testing-library/react, etc.)

**Refactoring required**: Handler constructors must accept interfaces instead of concrete types. This is a targeted change — update function signatures, not behavior.

### Phase 1: Backend Core Tests (P1 — Handlers, Storage, Parser)

**Goal**: Rewrite all handler and storage unit tests, add missing tests, achieve 90%+ on critical packages.

**Deliverables**:
1. **Handler tests** (14 files rewritten/new): health, dashboard, stream, analysis, upload, ai, aggregates, exceptions, filters, gaps, threads, search, trace, report
2. **Storage unit tests** (4 files rewritten/new): postgres_unit_test.go, clickhouse_unit_test.go, redis_unit_test.go, s3_unit_test.go
3. **JAR parser tests** (4 files rewritten/new): parser_test.go, runner_test.go, fidelity_test.go, config_test.go
4. **API utility tests** (2 files new): response_test.go, router_test.go

**Test patterns**:
- Table-driven tests with `t.Run()` subtests
- `require` for setup assertions, `assert` for test assertions
- Real log fixtures from `error_logs/` for parser tests (minimum 10 test cases using real data)
- Mocked storage interfaces for handler tests
- Both success and error paths for every endpoint

### Phase 2: Backend Middleware & Infrastructure Tests (P2)

**Goal**: Complete middleware coverage and infrastructure client unit tests, achieve 90%+ on middleware.

**Deliverables**:
1. **Middleware tests** (7 files rewritten/new): auth_test.go, tenant_test.go, cors_test.go, logging_test.go, recovery_test.go, bodylimit_test.go, errors_test.go
2. **Search tests** (2 files rewritten): bleve_test.go, kql_test.go
3. **Streaming unit tests** (2 files new): nats_unit_test.go, websocket_test.go
4. **Config test** (1 file new): config_test.go

### Phase 3: Backend AI & Worker Tests (P3)

**Goal**: Test all AI skills and worker pipeline, achieve 80%+ on ai and worker packages.

**Deliverables**:
1. **AI client test** (1 file rewritten): client_test.go
2. **AI registry test** (1 file rewritten): registry_test.go
3. **AI skill tests** (7 files rewritten/new): summarizer_test.go, error_explainer_test.go, anomaly_test.go, performance_test.go, nl_query_test.go, root_cause_test.go, helpers_test.go
4. **Worker tests** (4 files rewritten/new): processor_test.go, ingestion_test.go, indexer_test.go, anomaly_test.go

### Phase 4: Frontend Tests (P4 + P5)

**Goal**: Build complete frontend test suite from scratch, achieve tiered thresholds.

**Deliverables**:
1. **Lib/utility tests** (3 files new): api.test.ts, utils.test.ts, websocket.test.ts
2. **Hook tests** (4 files new): use-ai.test.ts, use-analysis.test.ts, use-search.test.ts, use-lazy-section.test.ts
3. **Dashboard component tests** (12 files new): stats-cards, time-series-chart, distribution-chart, aggregates-section, anomaly-alerts, exceptions-section, filters-section, gaps-section, health-score-card, threads-section, top-n-table, report-button
4. **Explorer component tests** (4 files new): log-table, search-bar, filter-panel, detail-panel
5. **Trace component tests** (1 file new): timeline
6. **AI component tests** (2 files new): chat-panel, skill-selector
7. **Upload component tests** (2 files new): dropzone, progress-tracker
8. **Page tests** (7 files new): landing, dashboard, upload, explorer, trace, analysis, ai

### Phase 5: Integration Tests (P6)

**Goal**: Docker-based integration tests for all external services, tagged with `//go:build integration`.

**Deliverables**:
1. **PostgreSQL integration tests**: CRUD operations, RLS enforcement, tenant isolation, migration verification
2. **ClickHouse integration tests**: Batch insert, aggregation queries, search, materialized view validation
3. **Redis integration tests**: Get/set/delete, TTL enforcement, rate limiting, tenant key scoping
4. **S3/MinIO integration tests**: Upload/download, bucket operations, large file handling
5. **NATS integration tests**: Stream creation, publish/subscribe, job queue lifecycle, backpressure
6. Updated Makefile targets for integration test execution

### Phase 6: Coverage Verification & Cleanup

**Goal**: Verify all coverage thresholds are met, fix any gaps, ensure determinism.

**Deliverables**:
1. Run full test suite 3 consecutive times to verify zero flaky failures
2. Generate per-package coverage report and verify tiered thresholds
3. Generate frontend per-directory coverage report and verify tiered thresholds
4. Fix any packages below threshold
5. Clean up any unused test helpers or dead mock code

## Dependency Graph

```
Phase 0 (Infrastructure)
    ├── Phase 1 (Handlers/Storage/Parser) ─── depends on Phase 0
    ├── Phase 2 (Middleware/Search/Streaming) ─── depends on Phase 0
    ├── Phase 3 (AI/Worker) ─── depends on Phase 0
    ├── Phase 4 (Frontend) ─── depends on Phase 0 (vitest config only)
    └── Phase 5 (Integration) ─── depends on Phase 0 (interfaces)
Phase 6 (Verification) ─── depends on ALL previous phases
```

Phases 1-5 can be executed in parallel after Phase 0 completes. Phase 6 is the final gate.

## Complexity Tracking

No constitution violations. No complexity justifications needed.

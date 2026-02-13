# Quickstart: Comprehensive Test Coverage

**Branch**: `005-test-coverage` | **Date**: 2026-02-12

## Prerequisites

- Go 1.24.1+
- Node.js 20+
- Docker & Docker Compose (for integration tests)

## Running Unit Tests

### Backend (Go)

```bash
# Run all unit tests with coverage
make test

# Run with HTML coverage report
make test-coverage

# Run a specific package
go test -v -race -cover ./backend/internal/api/handlers/...

# Run with per-package coverage breakdown
go test -v -race -coverprofile=coverage.out ./backend/...
go tool cover -func=coverage.out
```

### Frontend (TypeScript/React)

```bash
# Run all frontend tests
cd frontend && npx vitest run --coverage

# Run in watch mode
cd frontend && npx vitest

# Run a specific test file
cd frontend && npx vitest run src/components/dashboard/stats-cards.test.tsx
```

## Running Integration Tests

```bash
# Start Docker services
make docker-up

# Wait for services to be healthy
make check-services

# Run integration tests
make test-integration

# Stop services when done
make docker-down
```

## Running All Tests

```bash
# Unit + integration (requires Docker services)
make test-all
```

## Coverage Thresholds

| Category | Threshold | Packages/Directories |
|----------|-----------|---------------------|
| Backend Critical | 90% | handlers, storage, middleware |
| Backend Other | 80% | ai, worker, search, jar, config, streaming |
| Frontend Critical | 90% | components, hooks, lib |
| Frontend Other | 80% | app (pages) |
| Aggregate | 85% | All source files combined |

## Project Test Structure

### Backend

```
backend/
├── internal/
│   ├── testutil/              # NEW: Shared test infrastructure
│   │   ├── mocks.go           # Mock implementations for all interfaces
│   │   ├── fixtures.go        # Test data loading helpers
│   │   └── helpers.go         # HTTP test helpers, context builders
│   ├── api/
│   │   ├── handlers/
│   │   │   ├── health_test.go       # Rewritten
│   │   │   ├── dashboard_test.go    # New
│   │   │   ├── stream_test.go       # New
│   │   │   ├── analysis_test.go     # Rewritten
│   │   │   ├── upload_test.go       # Rewritten
│   │   │   ├── ai_test.go           # Rewritten
│   │   │   ├── aggregates_test.go   # Rewritten
│   │   │   ├── exceptions_test.go   # Rewritten
│   │   │   ├── filters_test.go      # Rewritten
│   │   │   ├── gaps_test.go         # Rewritten
│   │   │   ├── threads_test.go      # Rewritten
│   │   │   ├── search_test.go       # Rewritten
│   │   │   ├── trace_test.go        # Rewritten
│   │   │   └── report_test.go       # Rewritten
│   │   ├── middleware/
│   │   │   ├── auth_test.go         # Rewritten
│   │   │   ├── tenant_test.go       # Rewritten
│   │   │   ├── cors_test.go         # New
│   │   │   ├── logging_test.go      # New
│   │   │   ├── recovery_test.go     # New
│   │   │   ├── bodylimit_test.go    # New
│   │   │   └── errors_test.go       # New
│   │   ├── response_test.go         # New
│   │   └── router_test.go           # New
│   ├── storage/
│   │   ├── postgres_unit_test.go    # Rewritten (unit, no build tag)
│   │   ├── postgres_test.go         # Rewritten (integration, build tag)
│   │   ├── clickhouse_unit_test.go  # New (unit)
│   │   ├── clickhouse_test.go       # Rewritten (integration)
│   │   ├── redis_unit_test.go       # New (unit)
│   │   ├── redis_test.go            # New (integration)
│   │   ├── s3_unit_test.go          # New (unit)
│   │   └── s3_test.go               # Rewritten (integration)
│   ├── ai/
│   │   ├── client_test.go           # Rewritten
│   │   ├── registry_test.go         # Rewritten
│   │   └── skills/
│   │       ├── summarizer_test.go   # Rewritten
│   │       ├── error_explainer_test.go  # New
│   │       ├── anomaly_test.go      # New
│   │       ├── performance_test.go  # New
│   │       ├── nl_query_test.go     # New
│   │       ├── root_cause_test.go   # New
│   │       └── helpers_test.go      # New
│   ├── jar/
│   │   ├── parser_test.go          # Rewritten
│   │   ├── runner_test.go          # Rewritten
│   │   ├── fidelity_test.go        # Rewritten
│   │   └── config_test.go          # New
│   ├── search/
│   │   ├── bleve_test.go           # Rewritten
│   │   └── kql_test.go             # Rewritten
│   ├── streaming/
│   │   ├── nats_unit_test.go       # New (unit)
│   │   ├── nats_test.go            # Rewritten (integration)
│   │   └── websocket_test.go       # New
│   ├── worker/
│   │   ├── processor_test.go       # New
│   │   ├── ingestion_test.go       # Rewritten
│   │   ├── indexer_test.go         # New
│   │   └── anomaly_test.go         # Rewritten
│   └── config/
│       └── config_test.go          # New
```

### Frontend

```
frontend/
├── vitest.config.ts               # New: Vitest configuration
├── src/
│   ├── __mocks__/                 # New: Global mocks
│   │   ├── recharts.tsx           # Chart component mocks
│   │   └── react-window.tsx       # Virtualization mocks
│   ├── lib/
│   │   ├── api.test.ts            # New
│   │   ├── utils.test.ts          # New
│   │   └── websocket.test.ts      # New
│   ├── hooks/
│   │   ├── use-ai.test.ts         # New
│   │   ├── use-analysis.test.ts   # New
│   │   ├── use-search.test.ts     # New
│   │   └── use-lazy-section.test.ts # New
│   ├── components/
│   │   ├── dashboard/
│   │   │   ├── stats-cards.test.tsx         # New
│   │   │   ├── time-series-chart.test.tsx   # New
│   │   │   ├── distribution-chart.test.tsx  # New
│   │   │   ├── aggregates-section.test.tsx  # New
│   │   │   ├── anomaly-alerts.test.tsx      # New
│   │   │   ├── exceptions-section.test.tsx  # New
│   │   │   ├── filters-section.test.tsx     # New
│   │   │   ├── gaps-section.test.tsx        # New
│   │   │   ├── health-score-card.test.tsx   # New
│   │   │   ├── threads-section.test.tsx     # New
│   │   │   ├── top-n-table.test.tsx         # New
│   │   │   └── report-button.test.tsx       # New
│   │   ├── explorer/
│   │   │   ├── log-table.test.tsx           # New
│   │   │   ├── search-bar.test.tsx          # New
│   │   │   ├── filter-panel.test.tsx        # New
│   │   │   └── detail-panel.test.tsx        # New
│   │   ├── trace/
│   │   │   └── timeline.test.tsx            # New
│   │   ├── ai/
│   │   │   ├── chat-panel.test.tsx          # New
│   │   │   └── skill-selector.test.tsx      # New
│   │   └── upload/
│   │       ├── dropzone.test.tsx            # New
│   │       └── progress-tracker.test.tsx    # New
│   └── app/
│       ├── page.test.tsx                    # New (landing)
│       └── (dashboard)/
│           ├── page.test.tsx                # New
│           ├── upload/page.test.tsx          # New
│           ├── explorer/page.test.tsx        # New
│           ├── trace/page.test.tsx           # New
│           ├── analysis/page.test.tsx        # New
│           └── ai/page.test.tsx              # New
```

## Key Conventions

1. **Backend unit tests**: No build tag, use mocks from `testutil/`
2. **Backend integration tests**: `//go:build integration` tag, use real services
3. **Table-driven tests**: All test functions use `[]struct` pattern with `t.Run()`
4. **Assertions**: `require` for fatal checks, `assert` for non-fatal
5. **Frontend tests**: Colocated with source (`*.test.tsx` next to `*.tsx`)
6. **Frontend mocks**: Global mocks in `__mocks__/`, per-test mocks via `vi.mock()`

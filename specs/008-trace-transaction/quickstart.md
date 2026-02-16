# Quickstart: Enhanced Trace Transaction Page

**Feature**: 008-trace-transaction
**Date**: 2026-02-15

## Prerequisites

- Local dev environment running (`docker compose up` — PostgreSQL, ClickHouse, NATS, Redis, MinIO)
- Go 1.24.1+ installed
- Node.js 18+ and npm installed
- At least one analysis job completed with logs containing trace IDs

## New Frontend Dependencies

```bash
cd frontend
npm install prism-react-renderer d3-scale d3-array
npm install -D @types/d3-scale @types/d3-array
```

No new backend Go dependencies required (all existing: gorilla/mux, clickhouse-go, redis, etc.)

## No Database Migrations

This feature uses the existing `log_entries` ClickHouse schema with no changes. The `trace_id`, `rpc_id`, `thread_id`, `filter_level`, and all other fields are already present.

## New Backend Package

A new `internal/trace/` package is created for hierarchy inference:

```text
backend/internal/trace/
├── hierarchy.go           # Temporal+Thread containment algorithm
├── hierarchy_test.go      # Tests with sample trace data
├── critical_path.go       # Longest-path critical path computation
└── critical_path_test.go  # Critical path tests
```

## Running the Feature

### Backend

```bash
cd backend
go run ./cmd/api
```

The API server starts on `:8080` with the following new routes:
- `GET /api/v1/analysis/{job_id}/trace/{trace_id}/waterfall` — Hierarchical waterfall data
- `GET /api/v1/analysis/{job_id}/transactions` — Transaction search
- `GET /api/v1/analysis/{job_id}/trace/{trace_id}/export` — Trace export (JSON/CSV)
- `POST /api/v1/analysis/{job_id}/trace/ai-analyze` — AI trace analysis
- `GET /api/v1/trace/recent` — Recent traces

### Frontend

```bash
cd frontend
npm run dev
```

Navigate to `http://localhost:3000/trace` to access the enhanced trace page.

## Testing

### Backend Tests

```bash
cd backend
go test ./internal/trace/... -v          # Hierarchy + critical path tests
go test ./internal/api/handlers/ -run TestTrace -v  # Trace handler tests
```

### Frontend Tests

```bash
cd frontend
npm test -- --filter trace               # All trace component tests
```

## Testing with Sample Data

1. Upload AR Server logs via the existing upload flow
2. Wait for analysis job to complete
3. Navigate to the Dashboard > click any Trace ID in a Top-N table
4. Or go to `/trace` and search by Trace ID, User, or Thread ID

### Finding Trace IDs

If you need sample trace IDs from existing test data:

```bash
# Query ClickHouse for traces in your job
docker exec -it remedyiq-clickhouse clickhouse-client \
  --query "SELECT trace_id, count() as spans FROM log_entries WHERE trace_id != '' GROUP BY trace_id ORDER BY spans DESC LIMIT 10"
```

## Key Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| Redis trace cache TTL | 5 min | How long computed hierarchy is cached |
| Recent traces limit | 20 | Max recent traces per user |
| Transaction search limit | 50 | Default page size for transaction search |
| Max spans rendered | 5000 | Virtualization kicks in at 200+ |

# Quickstart: Complete Log Explorer

**Feature**: 007-complete-log-explorer
**Prerequisites**: Local dev environment running (docker compose up)

## Development Setup

### 1. Start Infrastructure

```bash
cd /Users/omar/Developer/ARLogAnalyzer-25
docker compose up -d
```

Verify all services are healthy:
- PostgreSQL: `localhost:5432`
- ClickHouse: `localhost:8123` (HTTP) / `localhost:9004` (native)
- Redis: `localhost:6379`
- NATS: `localhost:4222` / `localhost:8222` (monitoring)
- MinIO: `localhost:9001` (console) / `localhost:9002` (API)

### 2. Apply Database Migrations

```bash
# Add time_range column to saved_searches
psql -h localhost -U remedyiq -d remedyiq -c "
ALTER TABLE saved_searches ADD COLUMN IF NOT EXISTS time_range JSONB DEFAULT NULL;
"

# Create search_history table
psql -h localhost -U remedyiq -d remedyiq -c "
CREATE TABLE IF NOT EXISTS search_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    user_id TEXT NOT NULL,
    job_id UUID REFERENCES analysis_jobs(id),
    kql_query TEXT NOT NULL,
    result_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_search_history_user ON search_history(tenant_id, user_id, created_at DESC);
ALTER TABLE search_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS tenant_isolation ON search_history USING (tenant_id::TEXT = current_setting('app.tenant_id', true));
"
```

### 3. Backend Development

```bash
cd backend

# Run tests
go test ./...

# Run API server
go run ./cmd/api

# Run worker (for ingestion)
go run ./cmd/worker
```

### 4. Frontend Development

```bash
cd frontend

# Install dependencies
npm install

# Run dev server
npm run dev
```

Frontend will be available at `http://localhost:3000`.

### 5. Key Files to Modify

**Backend (Go)**:
- `backend/internal/api/handlers/search.go` — Refactor for job-scoped search, add time range, histogram
- `backend/internal/api/handlers/autocomplete.go` — New handler for autocomplete
- `backend/internal/api/handlers/entry.go` — New handler for single entry fetch + context
- `backend/internal/api/handlers/export.go` — New handler for CSV/JSON export
- `backend/internal/api/handlers/saved_search.go` — New handler for saved searches CRUD
- `backend/internal/api/handlers/search_history.go` — New handler for query history
- `backend/internal/api/router.go` — Register new handlers in RouterConfig
- `backend/internal/storage/clickhouse.go` — Add histogram query, context query, autocomplete query
- `backend/internal/storage/interfaces.go` — Extend ClickHouseStore interface
- `backend/internal/storage/postgres.go` — Add saved search + history CRUD methods

**Frontend (TypeScript/React)**:
- `frontend/src/hooks/use-search.ts` — Add job_id scoping, time range params, histogram data
- `frontend/src/components/explorer/search-bar.tsx` — Add autocomplete dropdown, syntax highlighting
- `frontend/src/components/explorer/log-table.tsx` — Add column sorting
- `frontend/src/components/explorer/detail-panel.tsx` — Add related entries links, context view button
- `frontend/src/components/explorer/time-range-picker.tsx` — New component
- `frontend/src/components/explorer/timeline-histogram.tsx` — New component
- `frontend/src/components/explorer/context-view.tsx` — New component
- `frontend/src/components/explorer/saved-searches.tsx` — New component
- `frontend/src/components/explorer/export-button.tsx` — New component
- `frontend/src/app/(dashboard)/explorer/page.tsx` — Integrate all new components
- `frontend/src/lib/kql-tokenizer.ts` — New TypeScript KQL tokenizer for syntax highlighting

### 6. Testing

```bash
# Backend tests
cd backend && go test ./... -v

# Frontend tests
cd frontend && npm test

# Specific test files
cd backend && go test ./internal/api/handlers/ -run TestSearch -v
cd frontend && npx vitest run src/components/explorer/
```

### 7. Verification Checklist

- [ ] Explorer opens scoped to a job (URL contains job_id)
- [ ] Time range picker appears and filters results
- [ ] Timeline histogram renders with color-coded bars
- [ ] Autocomplete suggests field names and values
- [ ] Detail panel fetches full entry data
- [ ] Trace ID / RPC ID links filter related entries
- [ ] Context view shows surrounding entries
- [ ] Column sorting works (click headers)
- [ ] Syntax highlighting colors KQL tokens
- [ ] Saved searches persist and restore
- [ ] Query history shows recent searches
- [ ] Export downloads CSV/JSON
- [ ] Keyboard shortcuts work (/, arrows, Enter, Escape)
- [ ] Dashboard "View in Explorer" links navigate correctly

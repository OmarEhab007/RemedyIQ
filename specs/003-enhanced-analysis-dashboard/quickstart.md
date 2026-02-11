# Quickstart: Enhanced Analysis Dashboard

**Feature**: 003-enhanced-analysis-dashboard | **Date**: 2026-02-10

## Prerequisites

- Local dev environment running (from 002-local-dev-setup)
- Docker Compose services healthy: PostgreSQL, ClickHouse, NATS, Redis, MinIO
- Go 1.24+ installed
- Node.js 20+ installed
- Sample AR Server log file for testing

## Development Setup

### 1. Start Infrastructure

```bash
cd /Users/omar/Developer/ARLogAnalyzer-25-local-dev
docker compose up -d
```

Verify all services healthy:
```bash
docker compose ps
```

### 2. Backend Development

```bash
cd backend

# Run tests (including new parser tests)
go test ./internal/jar/... -v -run TestParse

# Run full test suite
go test ./...

# Start API server (with hot reload via air if installed)
go run ./cmd/api

# Start worker
go run ./cmd/worker
```

### 3. Frontend Development

```bash
cd frontend

# Install dependencies
npm install

# Start dev server
npm run dev
```

Frontend available at: http://localhost:3000

### 4. Testing the Enhanced Dashboard

1. Upload a sample AR Server log file via the UI or API:
   ```bash
   curl -X POST http://localhost:8080/api/v1/files/upload \
     -H "X-Dev-User-ID: dev-user" \
     -H "X-Dev-Tenant-ID: dev-tenant" \
     -F "file=@sample.log"
   ```

2. Create an analysis job:
   ```bash
   curl -X POST http://localhost:8080/api/v1/analysis \
     -H "Content-Type: application/json" \
     -H "X-Dev-User-ID: dev-user" \
     -H "X-Dev-Tenant-ID: dev-tenant" \
     -d '{"file_id": "<file_id>"}'
   ```

3. Wait for job completion, then test new endpoints:
   ```bash
   # Summary with health score
   curl http://localhost:8080/api/v1/analysis/<job_id>/dashboard \
     -H "X-Dev-User-ID: dev-user" -H "X-Dev-Tenant-ID: dev-tenant"

   # Lazy-loaded sections
   curl http://localhost:8080/api/v1/analysis/<job_id>/dashboard/aggregates \
     -H "X-Dev-User-ID: dev-user" -H "X-Dev-Tenant-ID: dev-tenant"

   curl http://localhost:8080/api/v1/analysis/<job_id>/dashboard/exceptions \
     -H "X-Dev-User-ID: dev-user" -H "X-Dev-Tenant-ID: dev-tenant"

   curl http://localhost:8080/api/v1/analysis/<job_id>/dashboard/gaps \
     -H "X-Dev-User-ID: dev-user" -H "X-Dev-Tenant-ID: dev-tenant"

   curl http://localhost:8080/api/v1/analysis/<job_id>/dashboard/threads \
     -H "X-Dev-User-ID: dev-user" -H "X-Dev-Tenant-ID: dev-tenant"

   curl http://localhost:8080/api/v1/analysis/<job_id>/dashboard/filters \
     -H "X-Dev-User-ID: dev-user" -H "X-Dev-Tenant-ID: dev-tenant"
   ```

4. Visit http://localhost:3000/analysis/<job_id> to see the enhanced dashboard.

## Key Files to Work On

### Backend (in priority order)

1. `backend/internal/domain/models.go` — Add new domain types
2. `backend/internal/jar/parser.go` — Extend parser for new sections
3. `backend/internal/jar/parser_test.go` — Tests for parser extensions
4. `backend/internal/worker/ingestion.go` — Store extended data + health score
5. `backend/internal/api/router.go` — Register new routes
6. `backend/internal/api/handlers/` — New handler files for lazy endpoints

### Frontend (in priority order)

1. `frontend/src/lib/api.ts` — Add types + fetch functions
2. `frontend/src/hooks/use-lazy-section.ts` — Intersection Observer hook
3. `frontend/src/components/dashboard/health-score.tsx` — Health score component
4. `frontend/src/components/dashboard/aggregate-table.tsx` — Aggregate tables
5. `frontend/src/components/dashboard/exception-panel.tsx` — Error reports
6. `frontend/src/components/dashboard/gap-analysis.tsx` — Gap analysis
7. `frontend/src/components/dashboard/thread-stats.tsx` — Thread statistics
8. `frontend/src/components/dashboard/filter-complexity.tsx` — Filter insights
9. `frontend/src/app/(dashboard)/analysis/[id]/page.tsx` — Wire up new sections

## Validation Checklist

- [ ] Health score appears at top of dashboard
- [ ] Stats cards display correctly (existing behavior preserved)
- [ ] Time-series chart shows duration/error toggles
- [ ] Aggregate tables load when scrolled into view
- [ ] Aggregate tables sort by any column (default: SUM Time desc)
- [ ] Exception/error panels display with error rates
- [ ] Gap analysis shows line gaps and thread gaps
- [ ] Thread statistics show per-queue health indicators
- [ ] Filter complexity shows most executed and per-transaction data
- [ ] All numerical values match JAR plain-text output
- [ ] Tables with 500+ rows scroll smoothly (react-window)
- [ ] Mobile viewport (375px) is usable

# Quickstart: ARLogAnalyzer Insights Enhancement

**Branch**: `012-analyzer-insights`

## Prerequisites

- Docker Compose running (all 5 services: PostgreSQL, ClickHouse, NATS, Redis, MinIO)
- Go 1.24.1+ installed
- Node.js 20+ with npm

## Local Development Setup

```bash
# Start infrastructure
docker compose up -d

# Backend
cd backend
go test ./...           # Verify existing tests pass
go run ./cmd/api        # Start API server (port 8080)

# Frontend (separate terminal)
cd frontend
npm install
npm test                # Verify existing tests pass (1077 tests)
npm run dev             # Start dev server (port 3000)
```

## Implementation Order

Follow priority order for incremental delivery:

### P1: API Legend + Thread Busy % (frontend-only)
1. Create `ApiCodeBadge` shared component
2. Integrate tooltips in Top-N table, log-table, waterfall-row
3. Add `busy_pct` to frontend types + progress bar in ThreadsSection
4. Run `npm test` — all tests pass

### P2: FPS + Queued Calls + Filter Levels
5. Add `filters_per_sec` to frontend types + column in FiltersSection
6. Backend: new `queued_calls.go` handler + endpoint
7. Frontend: add "Queued" tab to dashboard page
8. Frontend: add filter levels sub-table to FiltersSection
9. Run `npm test && go test ./...` — all tests pass

### P3: Logging Activity + Source Files + Delayed Escalations
10. Backend: parse "LOGGING ACTIVITY" JAR section
11. Frontend: new `LoggingActivitySection` component
12. Backend: parse "FILE INFORMATION" JAR section
13. Frontend: new `SourceFilesSection` component
14. Backend: ClickHouse query + handler for delayed escalations
15. Frontend: new `DelayedEscalationsSection` component
16. Run `npm test && go test ./...` — all tests pass

## Testing

```bash
# Frontend tests
cd frontend && npm test

# Backend tests
cd backend && go test ./...

# Specific component tests
cd frontend && npx vitest run src/components/shared/api-code-badge.test.tsx
cd frontend && npx vitest run src/components/dashboard/threads-section.test.tsx
```

## Verification

After implementation, verify with sample AR Server logs:
1. Upload log files with all 4 types (API, SQL, Filter, Escalation)
2. Wait for analysis to complete
3. Open the analysis dashboard
4. Verify: API code tooltips appear on hover in Top-N table
5. Expand Thread Statistics — verify busy% progress bars
6. Expand Filter Complexity — verify FPS column and Filter Levels table
7. Click "Queued" tab in Top-N — verify queued calls appear
8. Verify Logging Activity section shows per-type durations
9. Verify Source Files section shows per-file metadata
10. Verify Delayed Escalations section shows entries (if escalation delays exist)

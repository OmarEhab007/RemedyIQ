# Quickstart: Complete Dashboard Features

**Feature**: 004-complete-dashboard-features
**Date**: 2026-02-11

## Prerequisites

- Go 1.24.1+
- Node.js 20+
- Docker & Docker Compose (for infrastructure services)

## Setup

```bash
# Start infrastructure services
make docker-up

# Run database migrations
make db-setup

# Start backend API + Worker
make dev

# In another terminal, start frontend
make frontend
```

## Development Order

### Phase 1: Backend ClickHouse Queries (no frontend changes)

1. Add 6 new query functions to `backend/internal/storage/clickhouse.go`:
   - `GetAggregates(ctx, tenantID, jobID, aggregateType)` → `*domain.AggregatesResponse`
   - `GetExceptions(ctx, tenantID, jobID)` → `*domain.ExceptionsResponse`
   - `GetGaps(ctx, tenantID, jobID)` → `*domain.GapsResponse`
   - `GetThreadStats(ctx, tenantID, jobID)` → `*domain.ThreadStatsResponse`
   - `GetFilterComplexity(ctx, tenantID, jobID)` → `*domain.FilterComplexityResponse`
   - `ComputeHealthScore(ctx, tenantID, jobID)` → `*domain.HealthScore`

2. Test each query function against a real ClickHouse instance with test data.

### Phase 2: Backend Handlers

3. Replace the 5 stub handlers with full implementations following the `DashboardHandler` pattern:
   - Parse tenant ID, job ID from request
   - Verify job exists and is complete
   - Check Redis cache → return if hit
   - Call ClickHouse query function
   - Cache result (5-min TTL)
   - Return JSON response

4. Update `DashboardHandler` to compute and include health score.

5. Update `TopNEntry` query to include type-specific details.

### Phase 3: Frontend Dashboard Sections

6. Create 5 new React components:
   - `aggregates-section.tsx`
   - `exceptions-section.tsx`
   - `gaps-section.tsx`
   - `threads-section.tsx`
   - `filters-section.tsx`

7. Create `health-score-card.tsx` component.

8. Integrate all new sections into `analysis/[id]/page.tsx` with lazy loading.

### Phase 4: Frontend Chart Enhancements

9. Enhance `time-series-chart.tsx` with duration/error toggles and zoom.

10. Enhance `distribution-chart.tsx` with dimension selector and top-N config.

11. Enhance `top-n-table.tsx` with type-specific columns, expand rows, and explorer links.

### Phase 5: AI Skills & Testing

12. Review and fix all AI skills for production readiness.

13. Write backend unit tests for all new handlers.

14. Write frontend component tests.

## Verification

```bash
# Run backend tests
make test

# Run frontend lint + type check
cd frontend && npm run lint && npx tsc --noEmit

# Manual verification
# 1. Upload a sample log file
# 2. Wait for analysis to complete
# 3. Open the dashboard
# 4. Verify health score appears at top
# 5. Scroll to each new section and verify data loads
# 6. Toggle chart overlays
# 7. Expand top-N entries
# 8. Test AI chat skills
```

## Key Files

| Purpose | Backend | Frontend |
| ------- | ------- | -------- |
| Domain models | `internal/domain/models.go` | `src/lib/api.ts` |
| ClickHouse queries | `internal/storage/clickhouse.go` | - |
| Redis cache | `internal/storage/redis.go` | - |
| Handlers | `internal/api/handlers/*.go` | - |
| Router | `internal/api/router.go` | - |
| Dashboard page | - | `src/app/(dashboard)/analysis/[id]/page.tsx` |
| Dashboard components | - | `src/components/dashboard/*.tsx` |
| Lazy loading hook | - | `src/hooks/use-lazy-section.ts` |
| API client | - | `src/lib/api.ts` |

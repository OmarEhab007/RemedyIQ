# Implementation Plan: Complete Dashboard Features

**Branch**: `004-complete-dashboard-features` | **Date**: 2026-02-11 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/004-complete-dashboard-features/spec.md`

## Summary

Implement all remaining dashboard features for RemedyIQ: 5 new backend API endpoints (aggregates, exceptions, gaps, threads, filters) with ClickHouse queries and Redis caching, corresponding frontend dashboard sections with lazy loading, enhanced top-N tables with type-specific columns and expandable rows, enhanced time-series/distribution charts with toggles and dimension switching, a composite health score computed in the existing dashboard endpoint, AI skills hardening, and comprehensive tests.

## Technical Context

**Language/Version**: Go 1.24.1 (backend), TypeScript 5.x / Next.js 16.1.6 (frontend)
**Primary Dependencies**: gorilla/mux, clickhouse-go v2, pgx v5 (backend); React 19, shadcn/ui, Recharts, react-window (frontend)
**Storage**: ClickHouse (log_entries table, log_entries_aggregates materialized view), PostgreSQL (jobs/tenants with RLS), Redis (caching)
**Testing**: Go test (backend), ESLint + TypeScript (frontend)
**Target Platform**: Docker-based web application (Linux server)
**Project Type**: Web application (Go backend + Next.js frontend)
**Performance Goals**: Each lazy-loaded section renders within 2 seconds for up to 1M log entries; dashboard initial load unaffected by new sections
**Constraints**: Tenant isolation enforced on all endpoints; 5-minute Redis cache TTL; all data from existing ClickHouse log_entries table (no schema changes)
**Scale/Scope**: Up to 1M log entries per analysis, 500+ aggregate rows, 50 threads, 50 gaps

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
| --------- | ------ | ----- |
| I. Wrapper-First | PASS | No parsing changes; all data comes from existing log_entries populated by JAR subprocess |
| II. API-First | PASS | OpenAPI contract defined in contracts/openapi-enhanced-dashboard.yaml before implementation |
| III. Test-First | PASS | Unit tests planned for all 5 handlers; integration tests for ClickHouse queries |
| IV. AI as a Skill | PASS | AI skills remain independent with typed I/O; hardening adds error handling, not structural changes |
| V. Multi-Tenant | PASS | All new endpoints enforce tenant_id scoping via middleware + ClickHouse WHERE clauses |
| VI. Simplicity Gate | PASS | No new services; changes to existing API Server and Frontend only. No new dependencies. |
| VII. Log Format Fidelity | PASS | All data derived from existing ClickHouse data (already validated against JAR output) |
| VIII. Streaming-Ready | PASS | No changes to streaming infrastructure; new endpoints are REST-only (appropriate for historical analysis) |
| IX. Incremental Delivery | PASS | Each endpoint + frontend section is independently deployable and testable |

**Post-Phase 1 Re-check**: All gates remain PASS. No new services, dependencies, or architectural patterns introduced.

## Project Structure

### Documentation (this feature)

```text
specs/004-complete-dashboard-features/
├── plan.md                              # This file
├── spec.md                              # Feature specification
├── research.md                          # Phase 0 research output
├── data-model.md                        # Phase 1 data model documentation
├── quickstart.md                        # Phase 1 quickstart guide
├── contracts/
│   └── openapi-enhanced-dashboard.yaml  # Phase 1 OpenAPI contract
├── checklists/
│   └── requirements.md                  # Spec quality checklist
└── tasks.md                             # Phase 2 output (via /speckit.tasks)
```

### Source Code (repository root)

```text
backend/
├── internal/
│   ├── api/
│   │   └── handlers/
│   │       ├── aggregates.go      # MODIFY: Replace stub with full handler
│   │       ├── exceptions.go      # MODIFY: Replace stub with full handler
│   │       ├── gaps.go            # MODIFY: Replace stub with full handler
│   │       ├── threads.go         # MODIFY: Replace stub with full handler
│   │       ├── filters.go         # MODIFY: Replace stub with full handler
│   │       └── dashboard.go       # MODIFY: Add health score computation
│   ├── storage/
│   │   └── clickhouse.go          # MODIFY: Add 6 new query functions
│   └── domain/
│       └── models.go              # NO CHANGE: All models already defined
└── tests/
    ├── handlers/
    │   ├── aggregates_test.go     # NEW: Unit tests
    │   ├── exceptions_test.go     # NEW: Unit tests
    │   ├── gaps_test.go           # NEW: Unit tests
    │   ├── threads_test.go        # NEW: Unit tests
    │   └── filters_test.go        # NEW: Unit tests
    └── storage/
        └── clickhouse_test.go     # MODIFY: Add integration tests

frontend/
├── src/
│   ├── app/
│   │   └── (dashboard)/
│   │       └── analysis/
│   │           └── [id]/
│   │               └── page.tsx   # MODIFY: Add new sections with lazy loading
│   ├── components/
│   │   └── dashboard/
│   │       ├── aggregates-section.tsx     # NEW: Aggregates tabbed tables
│   │       ├── exceptions-section.tsx     # NEW: Exception reports
│   │       ├── gaps-section.tsx           # NEW: Gap analysis with tabs
│   │       ├── threads-section.tsx        # NEW: Thread statistics table
│   │       ├── filters-section.tsx        # NEW: Filter complexity tables
│   │       ├── health-score-card.tsx      # NEW: Health score display
│   │       ├── time-series-chart.tsx      # MODIFY: Add duration/error toggles, zoom
│   │       ├── distribution-chart.tsx     # MODIFY: Add dimension selector, top-N config
│   │       └── top-n-table.tsx            # MODIFY: Type-specific columns, expand, explorer link
│   ├── hooks/
│   │   └── use-lazy-section.ts    # NO CHANGE: Already suitable
│   └── lib/
│       └── api.ts                 # NO CHANGE: All API functions already defined
```

**Structure Decision**: Web application structure. All changes are modifications to existing backend handlers + storage layer and new/modified frontend components. No new services, directories, or architectural layers.

## Implementation Phases

### Phase 1: Backend ClickHouse Query Functions

Add 6 new query methods to `ClickHouseClient` in `backend/internal/storage/clickhouse.go`:

1. **`GetAggregates`** — GROUP BY form (API), user (API), sql_table (SQL) with count, sum, avg, min, max duration, error metrics. Returns `*domain.AggregatesResponse`.
2. **`GetExceptions`** — GROUP BY error pattern with count, first/last seen, sample context. Also computes per-log-type error rates. Returns `*domain.ExceptionsResponse`.
3. **`GetGaps`** — Uses `neighbor()` window function to detect time gaps between consecutive entries. Separate queries for line gaps (all entries) and thread gaps (partitioned by thread_id). Returns `*domain.GapsResponse`.
4. **`GetThreadStats`** — GROUP BY thread_id with call count, duration stats, busy_pct calculation. Returns `*domain.ThreadStatsResponse`.
5. **`GetFilterComplexity`** — GROUP BY filter_name for most executed; GROUP BY trace_id, filter_name for per-transaction. Returns `*domain.FilterComplexityResponse`.
6. **`ComputeHealthScore`** — Calculates 4 weighted factors (error rate, avg response time, thread saturation, gap frequency) and produces composite 0-100 score. Returns `*domain.HealthScore`.

### Phase 2: Backend Handler Implementation

Replace the 5 stub handlers following the existing `DashboardHandler` pattern:

Each handler:
- Extracts tenant_id from middleware context
- Parses job_id from URL path
- Validates job exists, belongs to tenant, and is complete
- Checks Redis cache (key: `remedyiq:{tenantID}:{section}:{jobID}`)
- Calls the corresponding ClickHouse query function
- Caches the result with 5-minute TTL
- Returns JSON response

Additionally:
- Update `DashboardHandler.ServeHTTP` to call `ComputeHealthScore` and include it in the response
- Update `queryTopN` to include type-specific fields (sql_statement, filter_name, filter_level, esc_name, esc_pool, delay_ms) in the `Details` JSON field

### Phase 3: Frontend New Dashboard Sections

Create 5 new React components + health score card:

1. **`health-score-card.tsx`** — Circular score indicator with color coding, factor breakdown cards
2. **`aggregates-section.tsx`** — Tabbed interface (API by Form / API by User / SQL by Table), sortable table with shadcn/ui Table, grand total row
3. **`exceptions-section.tsx`** — Error rate badges, expandable exception list, log-type filtering
4. **`gaps-section.tsx`** — Tabbed (Line Gaps / Thread Gaps), ranked table with critical gap highlighting (>60s)
5. **`threads-section.tsx`** — Thread table with busy% color bars, 90% warning indicator, total thread count badge
6. **`filters-section.tsx`** — Two sub-views (Most Executed / Per Transaction), sortable tables

Integrate into `analysis/[id]/page.tsx`:
- Add `useLazySection` hook for each new section
- Health score renders immediately (part of dashboard data)
- Other 5 sections lazy-load on scroll
- Each section has independent loading/error/empty states

### Phase 4: Frontend Chart & Table Enhancements

1. **`time-series-chart.tsx`** enhancements:
   - "Show Duration" toggle → secondary YAxis with avg_duration_ms Line
   - "Show Errors" toggle → error_count Area with shaded fill
   - Brush component for click-and-drag zoom
   - All controls use shadcn/ui Button and Switch

2. **`distribution-chart.tsx`** enhancements:
   - Dimension selector dropdown (by type, queue, form, user, table)
   - "Show top N" selector (5, 10, 15, 25, 50)
   - Backend already returns by_type and by_queue; for form/user/table, compute from aggregates data client-side

3. **`top-n-table.tsx`** enhancements:
   - Type-specific columns per tab (SQL: table, statement preview; Filter: name, level; Escalation: pool, delay)
   - Queue wait time column for all tabs
   - Expandable detail rows (click to show full context)
   - "View in Explorer" link per row → navigates to `/explorer?line={lineNumber}&trace={traceId}`

### Phase 5: AI Skills Hardening & Testing

1. Review each AI skill implementation (nl_query, summarizer, anomaly, error_explainer, root_cause, performance)
2. Add proper error handling: catch AI service errors, return user-friendly messages
3. Ensure each skill queries ClickHouse correctly for the target job's data
4. Add fallback responses when AI service is unavailable

### Phase 6: Backend Unit Tests

Write tests for all 5 new handlers:
- Success path: valid tenant, completed job, data returned
- Cache hit path: verify cached response returned without ClickHouse query
- Missing job: 404 response
- Incomplete job: 409 response
- Invalid tenant: 401 response
- Invalid job_id format: 400 response

Write integration tests for ClickHouse query functions using test data.

## Complexity Tracking

No constitution violations. No complexity tracking needed.

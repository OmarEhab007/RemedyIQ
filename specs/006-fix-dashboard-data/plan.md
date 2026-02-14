# Implementation Plan: Fix Dashboard Data Pipeline

**Branch**: `006-fix-dashboard-data` | **Date**: 2026-02-13 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/006-fix-dashboard-data/spec.md`

## Summary

The ARLogAnalyzer JAR v3.2.2 produces ~23 data sections but the Go parser only extracts 5 (General Statistics + 4 TopN tables). This causes 7 of 10 dashboard sections to display "No data available." The fix requires:

1. **Extend the parser** (`parser.go`) to extract all 18 missing JAR output sections into their native structure
2. **Add JAR-native domain types** that match the actual JAR output format (grouped aggregates, gap entries, thread stats, errors, exceptions, filter sub-sections)
3. **Cache parsed sections in Redis** alongside existing dashboard data (no ClickHouse changes)
4. **Update API handlers** to serve JAR-parsed data directly instead of computing approximations from TopN entries
5. **Generate time series and distributions** from the newly parsed aggregate/TopN data
6. **Update frontend components** to render the richer data structures from JAR output

## Technical Context

**Language/Version**: Go 1.24.1 (backend), TypeScript 5.x / Next.js 16.1.6 (frontend)
**Primary Dependencies**: gorilla/mux, pgx v5, redis v9, nats.go (backend); React 19, shadcn/ui, Recharts (frontend)
**Storage**: Redis 7 (cache - sole storage for this feature), PostgreSQL 16 (job metadata), ClickHouse (unchanged)
**Testing**: testify v1.11.1 (Go), Vitest 3.x + React Testing Library 16.x (frontend)
**Target Platform**: Linux server (production), macOS aarch64 (development)
**Project Type**: Web application (Go backend + Next.js frontend)
**Performance Goals**: Dashboard API response <500ms for all sections, parser handles 1000+ line JAR output in <100ms
**Constraints**: Redis-only storage for parsed data (no ClickHouse writes), backward-compatible with existing cache format
**Scale/Scope**: 23 JAR sections to parse, 6 API endpoints to update, 5 frontend components to enhance, ~15 new domain types

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|---|---|---|
| I. Wrapper-First Architecture | PASS | Enhancing JAR output parsing — JAR remains the canonical parser |
| II. API-First Design | PASS | Existing API endpoints reused; response shapes extended but backward-compatible |
| III. Test-First Development | PASS | New parser sections require tests with real JAR output samples from error_logs/ |
| IV. AI as a Skill | N/A | No AI features in this change |
| V. Multi-Tenant by Default | PASS | All Redis keys already tenant-scoped (`remedyiq:{tenantID}:...`) |
| VI. Simplicity Gate | PASS | No new services; extends existing parser + handlers within 3-service architecture |
| VII. Log Format Fidelity | PASS | Parser extracts JAR output verbatim — no re-interpretation of raw data |
| VIII. Streaming-Ready | N/A | Batch analysis path only; no streaming changes |
| IX. Incremental Delivery | PASS | Each parser section is independently testable and deployable |

No constitution violations. All gates pass.

## Project Structure

### Documentation (this feature)

```text
specs/006-fix-dashboard-data/
├── plan.md              # This file
├── research.md          # Phase 0: JAR format research & tech decisions
├── data-model.md        # Phase 1: New domain types for JAR sections
├── quickstart.md        # Phase 1: Dev setup for testing this feature
├── contracts/
│   └── openapi.yaml     # Phase 1: Updated API response schemas
├── checklists/
│   └── requirements.md  # Spec quality checklist
└── tasks.md             # Phase 2: Implementation tasks
```

### Source Code (repository root)

```text
backend/
├── internal/
│   ├── domain/
│   │   └── models.go              # MODIFY: Add ~15 JAR-native types
│   ├── jar/
│   │   ├── parser.go              # MODIFY: Add parsers for 18 missing sections
│   │   ├── parser_test.go         # MODIFY: Add tests for all new parsers
│   │   ├── fidelity_test.go       # MODIFY: Add fidelity tests with real JAR output
│   │   └── integration_test.go    # MODIFY: Validate full pipeline with real JAR
│   ├── worker/
│   │   ├── ingestion.go           # MODIFY: Cache all ParseResult sections in Redis
│   │   ├── enhanced.go            # MODIFY: Prefer JAR-parsed data over computed
│   │   └── enhanced_test.go       # MODIFY: Test with JAR-parsed data
│   └── api/handlers/
│       ├── dashboard.go           # MODIFY: Include TimeSeries + Distribution from parsed data
│       ├── aggregates.go          # MODIFY: Serve JAR-parsed aggregates
│       ├── exceptions.go          # MODIFY: Serve JAR-parsed errors/exceptions
│       ├── gaps.go                # MODIFY: Serve JAR-parsed gap data
│       ├── threads.go             # MODIFY: Serve JAR-parsed thread stats
│       ├── filters.go             # MODIFY: Serve JAR-parsed filter data
│       └── enhanced_helpers.go    # MODIFY: Update cache-aside logic
└── testdata/
    └── jar_output_log1.txt        # NEW: Real JAR output sample for tests

frontend/
├── src/
│   ├── lib/
│   │   └── api.ts                 # MODIFY: Update TypeScript interfaces
│   ├── components/dashboard/
│   │   ├── aggregates-section.tsx  # MODIFY: Add tabs for Form/Client/Table/Pool
│   │   ├── exceptions-section.tsx  # MODIFY: Add API Errors + Exception Reports
│   │   ├── gaps-section.tsx        # MODIFY: Render actual gap entries from JAR
│   │   ├── threads-section.tsx     # MODIFY: Render queue-grouped thread stats
│   │   ├── filters-section.tsx     # MODIFY: Add 5 sub-tabs matching JAR output
│   │   ├── time-series-chart.tsx   # MODIFY: Handle TopN-bucketed data
│   │   └── distribution-chart.tsx  # MODIFY: Handle aggregate-derived breakdowns
│   └── app/(dashboard)/analysis/[id]/
│       └── page.tsx                # MODIFY: Pass new data structures to components
```

**Structure Decision**: Existing web application structure (backend/ + frontend/) is preserved. All changes are modifications to existing files plus one new testdata file. No new services, packages, or architectural layers.

## Architecture: Data Flow Change

### Current Flow (broken for 7/10 sections)

```
JAR stdout → parser.go (5 sections only) → DashboardData → Redis
                                                              ↓
Handler → Redis cache → DashboardData (sparse) → enhanced.go computes approximations from TopN
                                                                  ↓
                                                    AggregatesResponse (approximate, from 50 entries)
                                                    ExceptionsResponse (from Distribution["errors"] only)
                                                    GapsResponse (no actual gaps, just queue health)
                                                    ThreadStatsResponse (no busy%, from Distribution["threads"])
                                                    FilterComplexityResponse (from TopN only, limited)
```

### New Flow (all 10 sections populated)

```
JAR stdout → parser.go (ALL 23 sections) → DashboardData + ParseResult → Redis
                                                                           ↓
Handler → Redis cache → ParseResult sections (rich, JAR-native data)
                          ↓
                          AggregatesResponse (exact: grouped by Form/Client/Table/Pool with OK/Fail/MIN/MAX/AVG/SUM)
                          ExceptionsResponse (exact: API errors + API exceptions + SQL exceptions)
                          GapsResponse (exact: 50 line gaps + 50 thread gaps with durations/timestamps)
                          ThreadStatsResponse (exact: per-queue, per-thread with busy%)
                          FilterComplexityResponse (exact: 5 sub-sections from JAR)
                          TimeSeries (derived: TopN timestamps bucketed by interval)
                          Distribution (derived: from aggregate totals per form/table/queue)
```

### Key Design Decision: Parse-First, Not Compute-First

The current `enhanced.go` computes section data from TopN entries (50 items per type). This produces *approximations* at best and empty data at worst. The fix parses the JAR's own aggregated sections (which contain ALL operations, not just top 50) and serves them directly. The `enhanced.go` compute functions become the fallback for old cached analyses that don't have parsed sections.

## Implementation Phases

### Phase 1: Backend Parser Enhancement (P1 — Blocking)

**Goal**: Parse all 18 missing JAR v3.2.2 output sections into structured Go types.

**Files**: `domain/models.go`, `jar/parser.go`, `jar/parser_test.go`, `jar/fidelity_test.go`

**Approach**:
1. Add ~15 new Go types to `domain/models.go` matching JAR's native output format
2. Extend `splitSections()` to recognize `###` subsection headers within major sections
3. Add per-section parse functions: `parseGaps()`, `parseAggregateTable()`, `parseThreadStats()`, `parseAPIErrors()`, `parseExceptionReport()`, `parseFilterMostExecuted()`, `parseFilterPerTransaction()`, `parseFilterLevels()`, `parseQueuedAPICalls()`
4. Reuse existing `extractColumnBoundaries()` / `extractColumnValues()` for fixed-width tables
5. Handle grouped aggregate tables (entity > operation > subtotal > grand total pattern)
6. Write test for each parser function using real JAR output snippets from `/tmp/jar_output_log1.txt`

**Risk**: Aggregate tables have a grouped/nested structure (form → API types → subtotal) that differs from flat TopN tables. Requires a multi-pass parser.

### Phase 2: Worker & Cache Integration (P1 — Blocking)

**Goal**: Store all parsed sections in Redis and update the ingestion pipeline.

**Files**: `worker/ingestion.go`, `worker/enhanced.go`, `worker/enhanced_test.go`

**Approach**:
1. After `jar.ParseOutput()`, cache each ParseResult section in its own Redis key
2. Update Redis key pattern: use existing `{jobID}:agg`, `{jobID}:exc`, etc.
3. Modify `ComputeEnhancedSections()` to use JAR-parsed data when available, fall back to TopN computation for old analyses
4. Generate TimeSeries by bucketing TopN entry timestamps into minute/second intervals
5. Generate Distribution from aggregate totals (by form, table, queue, type)

### Phase 3: API Handler Updates (P1 — Blocking)

**Goal**: Serve JAR-parsed sections from Redis through existing API endpoints.

**Files**: `handlers/aggregates.go`, `handlers/exceptions.go`, `handlers/gaps.go`, `handlers/threads.go`, `handlers/filters.go`, `handlers/dashboard.go`, `handlers/enhanced_helpers.go`

**Approach**:
1. Update `getOrCompute*()` helpers to check for JAR-parsed data in Redis first
2. If JAR-parsed data exists, return it directly (no computation needed)
3. If not (old analysis), fall back to existing `ComputeEnhancedSections()` logic
4. Update dashboard handler to include TimeSeries and Distribution from parsed data
5. Handle the "Re-analyze for full data" prompt for stale analyses

### Phase 4: Frontend Component Updates (P2 — Non-blocking)

**Goal**: Update dashboard components to render the richer JAR-native data structures.

**Files**: All 7 dashboard section components + `api.ts` + page.tsx

**Approach**:
1. Update TypeScript interfaces in `api.ts` to match new response shapes
2. Update AggregatesSection: add Form/Client/Table/Pool tabs with OK/Fail/MIN/MAX/AVG/SUM columns
3. Update ExceptionsSection: add API Errors tab, API Exceptions tab, SQL Exceptions tab
4. Update GapsSection: render actual line gap and thread gap entries with durations
5. Update ThreadsSection: group by queue, show per-thread busy%, first/last timestamps
6. Update FiltersSection: add 5 sub-tabs (Longest, Most Executed, Per Transaction, Executed Per Txn, Levels)
7. Update TimeSeriesChart: handle sparse TopN-bucketed data gracefully
8. Update DistributionChart: use aggregate-derived breakdowns by form/table/queue

### Phase 5: Testing & Validation (P1 — Blocking)

**Goal**: Comprehensive test coverage ensuring parser fidelity and backward compatibility.

**Approach**:
1. Copy real JAR output to `backend/testdata/jar_output_log1.txt` for deterministic tests
2. Unit tests for each new parse function with real output snippets
3. Integration test: run full JAR → parse → cache → API → response cycle
4. Fidelity tests: compare parsed aggregates against JAR output values exactly
5. Backward compatibility: verify old cache format still works (graceful degradation)
6. Frontend tests: verify components render with new data structures

## Complexity Tracking

No constitution violations requiring justification. All changes stay within the existing 3-service architecture.

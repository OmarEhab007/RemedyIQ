# Research: Enhanced Analysis Dashboard

**Feature**: 003-enhanced-analysis-dashboard | **Date**: 2026-02-10

## Summary

This document resolves all technical unknowns for extending the analysis dashboard. Research covered: (1) JAR parser extension strategy, (2) new API endpoint design, (3) health score algorithm, (4) frontend rendering strategy for large datasets, and (5) caching strategy for lazy-loaded sections.

## Technical Unknowns Resolved

### TU-1: Parser Extension Strategy

**Question**: How to extend `parser.go` to extract aggregates, gaps, thread stats, exceptions, and filter complexity from JAR output?

**Finding**: The parser (1137 lines) already has infrastructure for this. Key discoveries:

1. **Aggregates already partially parsed**: `parseAggregateByPrimaryKey()` extracts grouped tables with subtotals into `Distribution["forms"]`, `Distribution["users"]`, `Distribution["tables"]`. However, the current output only captures counts into `map[string]int`, losing the MIN/MAX/AVG/SUM timing breakdown. Need to change the return type to `[]AggregateGroup` structs.

2. **Thread stats already partially parsed**: `parseThreadStats()` exists but only captures queue/thread/count. Need to extend to capture first_seen, last_seen, queue_time, total_time, busy_pct.

3. **Exception reports already partially parsed**: `parseExceptionReport()` collects error messages but discards line numbers, trace IDs, and structured fields. Need to extend to return `[]ExceptionEntry`.

4. **Gap analysis NOT parsed**: The parser currently skips the GAP section (has a `case "GAP"` in the section router but does nothing). The JAR produces two subsections: "Top 50 Longest Line Gaps" and "Top 50 Longest Thread Gaps" in standard table format. Parser already has `extractDataRows()` which can parse these tables.

5. **Filter complexity NOT parsed**: The parser skips "Most Executed Filters", "Filters per Transaction", and nesting depth subsections. These use the same tabular format as top-N entries.

**Decision**: Extend the existing parser methods. No architectural changes needed. The parser's `extractDataRows()` + `parseColumnBoundaries()` pipeline handles all JAR table formats.

**Approach**:
- Modify `parseAggregateByPrimaryKey()` → return `[]AggregateGroup` with full timing breakdown
- Modify `parseThreadStats()` → return `[]ThreadStatsEntry` with full utilization data
- Modify `parseExceptionReport()` → return `[]ExceptionEntry` with structured fields
- Add `parseGapAnalysis()` → new method for gap tables → `[]GapEntry`
- Add `parseFilterComplexity()` → new method for filter subsections → `FilterComplexityData`
- Store all new data on `DashboardData` struct (new fields, not replacing existing)

### TU-2: Lazy-Load API Design

**Question**: How to design endpoints for the two-tier loading strategy?

**Finding**: Current architecture has a single `GET /analysis/{job_id}/dashboard` endpoint returning all data. The handler checks Redis cache (5-min TTL), then queries ClickHouse.

**Decision**: Add 6 section-specific endpoints that follow the same pattern (cache check → query → cache store):

| Endpoint | Section | Cache TTL |
|----------|---------|-----------|
| `GET /analysis/{job_id}/dashboard` | Summary (enhanced with health score) | 5 min |
| `GET /analysis/{job_id}/dashboard/aggregates` | Aggregate tables | 5 min |
| `GET /analysis/{job_id}/dashboard/exceptions` | Exception/error reports | 5 min |
| `GET /analysis/{job_id}/dashboard/gaps` | Gap analysis | 5 min |
| `GET /analysis/{job_id}/dashboard/threads` | Thread statistics | 5 min |
| `GET /analysis/{job_id}/dashboard/filters` | Filter complexity | 5 min |

**Rationale**: Using sub-paths of `/dashboard` keeps the resource hierarchy clean. All endpoints share the same auth, tenant isolation, and cache patterns. Query params:
- `aggregates`: `?type=api_by_form|api_by_user|sql_by_table` (optional, returns all if omitted)
- `exceptions`: `?type=api|sql|escalation` (optional, returns all if omitted)
- `gaps`: `?type=line|thread` (optional, returns all if omitted)
- `threads`: no params needed
- `filters`: no params needed

### TU-3: Health Score Algorithm

**Question**: How to compute a composite health score (0-100) from analysis data?

**Finding**: The score needs to be deterministic, reproducible, and explainable. Reviewed common APM scoring approaches.

**Decision**: Weighted factor model with 4 factors, 25 points each:

```
Health Score = Error Factor + Response Time Factor + Thread Factor + Gap Factor
```

**Error Factor (0-25 points)**:
- Error rate = (total errors / total operations) * 100
- <1% → 25 pts | 1-2% → 20 pts | 2-5% → 15 pts | 5-10% → 10 pts | >10% → 0 pts
- Special case: 0 operations → 25 pts (no errors possible)

**Response Time Factor (0-25 points)**:
- Based on median API call duration from top-N entries
- <100ms → 25 pts | 100-500ms → 20 pts | 500ms-1s → 15 pts | 1-5s → 10 pts | >5s → 0 pts
- Special case: no API calls → 25 pts

**Thread Saturation Factor (0-25 points)**:
- Based on maximum thread busy percentage across all queues
- <50% → 25 pts | 50-70% → 20 pts | 70-85% → 15 pts | 85-95% → 10 pts | >95% → 0 pts
- Special case: no thread data → 25 pts

**Gap Frequency Factor (0-25 points)**:
- Based on count of gaps >10 seconds in top-50 line gaps
- 0 gaps → 25 pts | 1-2 → 20 pts | 3-5 → 15 pts | 6-10 → 10 pts | >10 → 0 pts
- Special case: no gap data → 25 pts

**Color mapping**: >80 green | 50-80 yellow | <50 red
**Satisfies SC-007**: >10% error rate → Error Factor = 0 → max score 75 → below 80 (yellow at best). <1% errors + no thread saturation → Error Factor 25 + Thread Factor 25 → 50+ guaranteed, typically 80+.

### TU-4: Frontend Virtual Scrolling for Large Tables

**Question**: How to render aggregate tables with 500+ rows at 60fps?

**Finding**: `react-window` is already a project dependency. Current `top-n-table.tsx` does not use virtual scrolling (max 50 rows).

**Decision**: Use `react-window` `FixedSizeList` for aggregate tables that may exceed 100 rows. Wrap in a container with a fixed height (400px). Tables with fewer than 100 rows render normally without virtualization.

**Implementation**: Create `aggregate-table.tsx` component that:
1. Renders with shadcn/ui `Table` for <100 rows (consistent styling)
2. Switches to `react-window` `FixedSizeList` for 100+ rows
3. Maintains column sorting via state (client-side sort on cached data)
4. Subtotal and grand total rows pinned outside the virtual list

### TU-5: Cache Strategy for Lazy Sections

**Question**: Should lazy-loaded sections be cached separately or as part of the full dashboard?

**Finding**: Current caching uses a single Redis key `cache:{tenant_id}:dashboard:{job_id}` for the entire dashboard. The worker also pre-caches the dashboard with 24h TTL after job completion.

**Decision**: Store extended data (aggregates, exceptions, gaps, threads, filter complexity) as separate Redis hash fields under the same key:

```
cache:{tenant_id}:dashboard:{job_id}          → summary JSON (existing)
cache:{tenant_id}:dashboard:{job_id}:agg      → aggregates JSON
cache:{tenant_id}:dashboard:{job_id}:exc      → exceptions JSON
cache:{tenant_id}:dashboard:{job_id}:gaps     → gaps JSON
cache:{tenant_id}:dashboard:{job_id}:threads  → threads JSON
cache:{tenant_id}:dashboard:{job_id}:filters  → filters JSON
```

**Rationale**: Separate keys allow lazy sections to be cached independently. The worker pre-populates all keys after job completion (24h TTL). API handlers check per-section keys (5-min TTL for on-demand queries).

### TU-6: Data Flow — Where Extended Data Lives

**Question**: Should extended data (aggregates, exceptions, gaps, etc.) be stored in ClickHouse, Redis only, or derived on-the-fly?

**Finding**: The current flow is: JAR output → parser → DashboardData → Redis cache. ClickHouse stores individual log entries, and the dashboard handler queries ClickHouse for time-series/distribution/top-N when the cache misses.

**Decision**: Hybrid approach:
1. **Parser produces full `ExtendedDashboardData`** including all new sections
2. **Worker stores extended data in Redis** (24h TTL) — aggregates, exceptions, gaps, threads, filter complexity all come from JAR output, not ClickHouse queries
3. **Lazy-load handlers read from Redis first**, fall back to re-parsing JAR output (expensive, rare)
4. **No new ClickHouse tables/views needed** — all new data originates from JAR plain-text output, not from querying individual log entries

**Rationale**: Aggregates from JAR output include timing breakdowns (MIN/MAX/AVG/SUM) that are expensive to recompute from individual ClickHouse entries. The JAR already computes these perfectly. Storing parsed sections in Redis is simpler and faster than duplicating the computation.

## Technology Decisions

| Decision | Choice | Alternatives Rejected |
|----------|--------|----------------------|
| Parser extension | Modify existing parser methods | New parser file — unnecessary, methods already exist |
| Lazy-load pattern | Sub-path endpoints under /dashboard | Query params on existing endpoint — harder to cache, less RESTful |
| Health score location | Server-side computation in worker | Client-side — inconsistent across sessions; AI skill — overkill for deterministic calc |
| Virtual scrolling | react-window (FixedSizeList) | @tanstack/virtual — already have react-window as dep; infinite scroll — poor for aggregate tables |
| Extended data storage | Redis (from JAR parser) | ClickHouse (recompute from entries) — expensive, loses JAR timing precision |
| Gap timeline visualization | Recharts ScatterChart | D3.js — inconsistent with existing chart library; canvas — overkill |

## Key Risks

| Risk | Mitigation |
|------|-----------|
| Parser extension breaks existing parsing | Test-first: capture current parser output for sample files, ensure no regression |
| Large Redis values for big analyses | JSON compression (gzip); TTL ensures cleanup; monitor key sizes |
| Health score thresholds produce unintuitive scores | Configurable thresholds; validate against 10+ real log files before shipping |
| Frontend bundle size increase with 6 new components | All new components are lazy-loaded (dynamic import); only loaded when scrolled into view |

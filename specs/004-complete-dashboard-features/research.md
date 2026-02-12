# Research: Complete Dashboard Features

**Feature**: 004-complete-dashboard-features
**Date**: 2026-02-11

## R1: ClickHouse Aggregation Queries for Dashboard Endpoints

**Decision**: Use direct ClickHouse SQL queries with GROUP BY, window functions (`neighbor()`), and conditional aggregation against the `log_entries` table. Do not rely on the `log_entries_aggregates` materialized view for the new endpoints — it pre-aggregates by time bucket and log_type, which doesn't match the grouping dimensions needed (by form, by user, by table).

**Rationale**: The `log_entries` table already has all required columns (form, user, sql_table, thread_id, filter_name, success, error_message, duration_ms). ClickHouse is optimized for analytical GROUP BY queries on columnar data, and the table is partitioned by `(tenant_id, toYYYYMM(timestamp))`, so tenant+job scoped queries are efficient. The materialized view only stores per-minute, per-log-type aggregates — it lacks the granularity for form/user/table groupings.

**Alternatives considered**:
- Using the `log_entries_aggregates` materialized view: Rejected because it only groups by (tenant_id, job_id, log_type, period_start), not by form/user/table.
- Pre-computing aggregates during the worker job: Rejected per simplicity gate — ClickHouse can compute these at query time for 1M entries well under 2 seconds.

## R2: Gap Detection Algorithm in ClickHouse

**Decision**: Use ClickHouse's `neighbor()` function to compute time gaps between consecutive log entries ordered by timestamp. For line gaps: order all entries by timestamp and compute the difference with the next entry. For thread gaps: partition by thread_id and compute the same.

**Rationale**: `neighbor(timestamp, 1)` returns the next row's timestamp within the current sort order. `dateDiff('millisecond', timestamp, neighbor(timestamp, 1))` gives the gap duration. This is a single-pass query that ClickHouse executes efficiently. The top 50 gaps can be extracted with `ORDER BY gap_ms DESC LIMIT 50`.

**Query pattern for line gaps**:
```sql
SELECT
    timestamp AS start_time,
    neighbor(timestamp, 1) AS end_time,
    dateDiff('millisecond', timestamp, neighbor(timestamp, 1)) AS gap_ms,
    line_number AS before_line,
    neighbor(line_number, 1) AS after_line,
    log_type
FROM log_entries
WHERE tenant_id = @tenantID AND job_id = @jobID
ORDER BY timestamp ASC
LIMIT 50 BY 1  -- Not needed; we'll use a subquery with ORDER BY gap_ms DESC LIMIT 50
```

**Actual approach**: Wrap in a subquery, filter out the last row (where neighbor returns 0), and ORDER BY gap_ms DESC LIMIT 50.

**Alternatives considered**:
- Using LAG/LEAD window functions: ClickHouse supports `neighbor()` which is the idiomatic equivalent and more performant for this use case.
- Computing gaps in Go code: Rejected — would require fetching all entries sorted by timestamp, which defeats the purpose of ClickHouse.

## R3: Thread Busy Percentage Calculation

**Decision**: Calculate busy_pct as `(SUM(duration_ms) / dateDiff('millisecond', MIN(timestamp), MAX(timestamp))) * 100` per thread_id. This gives the ratio of active processing time to wall-clock time for each thread.

**Rationale**: A thread's "busy" time is the sum of all operation durations it executed. The wall-clock time is the span from its first to last observed entry. If a thread processed 45 seconds of operations over a 60-second span, it was 75% busy. Threads with 100% of a single entry or zero span get capped at 100%.

**Alternatives considered**:
- Using queue_time_ms instead of duration_ms: Rejected — queue_time_ms measures waiting, not processing. Busy percentage should reflect active processing.
- Including idle time as a separate metric: Deferred — the spec doesn't require it, and it's derivable from (100% - busy_pct).

## R4: Health Score Computation Algorithm

**Decision**: Compute a weighted health score from 4 factors:
1. **Error Rate** (weight: 0.30) — Score: 100 if <1%, 80 if <2%, 50 if <5%, 25 if <10%, 0 if >=10%
2. **Average Response Time** (weight: 0.25) — Score: 100 if <500ms, 80 if <1000ms, 50 if <2000ms, 25 if <5000ms, 0 if >=5000ms
3. **Thread Saturation** (weight: 0.25) — Score: 100 if max_busy <50%, 80 if <70%, 50 if <85%, 25 if <95%, 0 if >=95%
4. **Gap Frequency** (weight: 0.20) — Score: 100 if max_gap <5s, 80 if <15s, 50 if <30s, 25 if <60s, 0 if >=60s

Final score = weighted sum, rounded to nearest integer. Thresholds: green >80, yellow 50-80, red <50.

**Rationale**: These thresholds align with AR Server operational best practices. The weights prioritize error rate (most visible to end users) and balance response time and thread saturation equally (both indicate capacity issues). Gap frequency has the lowest weight because gaps can be benign (scheduled maintenance, log rotation).

**Alternatives considered**:
- Equal weights: Rejected — error rate is more impactful than gap frequency.
- Including filter complexity as a factor: Rejected — filter complexity is an optimization opportunity, not a health indicator.

## R5: Enhanced Top-N Tables — Data Already Available

**Decision**: The existing `log_entries` table already stores all type-specific fields needed for enhanced top-N display (sql_statement, filter_name, filter_level, esc_name, esc_pool, delay_ms, queue_time_ms). The existing `queryTopN()` function in clickhouse.go already queries by log type. The enhancement is frontend-only: expand the TopNEntry interface with additional fields and update the top-n-table component to display type-specific columns.

**Rationale**: The backend `queryTopN()` function selects only `identifier` via a type-specific expression, but the underlying table has all fields. We need to expand the SELECT to include type-specific fields and return them in the response. The TopNEntry domain model already has a `Details` field (string) that can carry serialized extra data, but a cleaner approach is to add the missing fields to TopNEntry directly.

**Alternatives considered**:
- Adding separate endpoints per log type: Rejected per simplicity gate — the existing top-N query structure handles this with a type parameter.
- Using the Details field for JSON-encoded extras: Rejected — first-class fields are more type-safe and frontend-friendly.

## R6: Enhanced Charts — Frontend-Only Changes

**Decision**: The time-series data already includes `avg_duration_ms` and `error_count` per time bucket (see `queryTimeSeries()` in clickhouse.go). The distribution data already supports `by_type` and `by_queue` groupings. Enhancements are frontend-only: add toggle buttons for duration/error overlays on the time-series chart, add a secondary Y-axis using Recharts' `YAxis` with `yAxisId`, and add a dimension selector dropdown for the distribution chart.

**Rationale**: No new backend endpoints or queries needed. The data is already returned by the existing dashboard endpoint. This is purely a UI enhancement.

**Alternatives considered**:
- Adding backend-computed chart configurations: Rejected — chart configuration is a presentation concern, not a data concern.

## R7: Lazy Loading Pattern for New Sections

**Decision**: Use the existing `useLazySection` hook for all 5 new dashboard sections. Each section gets a `<div ref={ref}>` wrapper. The hook's IntersectionObserver triggers the fetch when the section scrolls into view (100px root margin). Each section independently manages its loading, error, and empty states.

**Rationale**: The hook already implements the exact pattern needed: observe visibility → fetch data → manage state → support refetch. No modifications to the hook are needed.

**Alternatives considered**:
- Manual scroll event listeners: Rejected — IntersectionObserver is more efficient and the hook already wraps it.
- Fetching all sections on initial load: Rejected — spec explicitly requires lazy loading per FR-009.

## R8: Caching Strategy for New Endpoints

**Decision**: Follow the exact same pattern as `DashboardHandler`: use `redis.TenantKey(tenantID, section, jobID)` for the cache key, 5-minute TTL, check cache before ClickHouse query, cache the JSON response after successful query.

**Rationale**: Analysis jobs are immutable after completion. The 5-minute TTL exists only to handle the edge case of data correction, not because data changes. Consistency with the existing pattern reduces cognitive load.

**Alternatives considered**:
- Longer TTL (1 hour): Rejected — maintaining consistency with existing dashboard cache behavior per FR-006.
- No caching: Rejected — ClickHouse queries for 1M entries can take 100-500ms; caching eliminates repeated load.

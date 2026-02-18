# Research: ARLogAnalyzer Insights Enhancement

**Date**: 2026-02-18 | **Branch**: `012-analyzer-insights`

## Data Availability Analysis

### Decision: Most features require frontend-only work
**Rationale**: 6 of 8 features have data already parsed by the JAR parser and stored in Redis. Only Features 7 (File Metadata) and 8 (Logging Activity) require new backend parser sections. Feature 2 (Delayed Escalations) requires a new ClickHouse query.
**Alternatives considered**: Building native Go parsers for missing data — rejected per Constitution Article I (Wrapper-First).

---

## Feature-by-Feature Research

### Feature 1: Queue Wait Time (Queued API Calls Tab)

**Backend data**: `ParseResult.QueuedAPICalls []TopNEntry` exists at `models.go:615`. Populated by JAR parser section "QUEUED API CALLS" (`parser.go:102-105`). Uses standard `TopNEntry` which has `QueueTimeMS` field (`models.go:258`).

**Gap**: Data is in `ParseResult` (cached in Redis as full JSON) but not exposed via a dedicated API endpoint. The main dashboard endpoint returns `DashboardData` which doesn't include `QueuedAPICalls`.

**Decision**: Add a new `getOrComputeQueuedCalls` helper in `enhanced_helpers.go` that reads the full `ParseResult` from Redis and extracts the `QueuedAPICalls` field. New endpoint `GET /api/v1/analysis/{job_id}/dashboard/queued-calls`.
**Rationale**: Follows the exact same pattern as `getOrComputeThreads`, `getOrComputeFilters`, etc. Keeps the main dashboard response lean.
**Alternatives considered**: Embedding in main dashboard response — rejected because it would change the existing contract.

### Feature 2: Delayed Escalations

**Backend data**: `LogEntry` has `ScheduledTime *time.Time`, `DelayMS uint32`, `EscPool string` at `models.go:143-145`. These are stored in ClickHouse `log_entries` table.

**Gap**: No aggregation query exists to find delayed escalations. No API endpoint. No frontend component.

**Decision**: New ClickHouse query filtering `log_type = 'ESCL' AND delay_ms > 0` with ordering by delay_ms DESC. New `DelayedEscalationEntry` struct. New handler + endpoint.
**Rationale**: ClickHouse is the appropriate store for this aggregation since the data lives in `log_entries`, not in the JAR ParseResult cache.
**Alternatives considered**: Parsing from JAR output — the JAR doesn't produce a dedicated "delayed escalations" section, so ClickHouse query is the right approach.

### Feature 3: API Abbreviation Legend

**Backend data**: `ParseResult.APIAbbreviations []JARAPIAbbreviation` at `models.go:614`. `JARAPIAbbreviation` has `Abbreviation string` and `FullName string` (`models.go:590-594`). Parsed from JAR "ABBREVIATION LEGEND" section (`parser.go:91-93, 1886-1908`).

**Frontend data**: `AR_API_CODES` in `constants.ts:226` already has 50+ entries with `name` and `description` fields.

**Gap**: Frontend has static data but doesn't use it for tooltips. Backend has dynamic data but doesn't expose it.

**Decision**: Create a shared `ApiCodeBadge` component that uses the static `AR_API_CODES` map as baseline. Optionally fetch JAR abbreviations per-job and merge (backend takes precedence). Component used in Top-N table, log explorer, and trace waterfall.
**Rationale**: Static map provides instant tooltips without API calls. JAR data supplements with any codes not in the static map.
**Alternatives considered**: Only using JAR data — rejected because it requires an API call and wouldn't work for pages without a specific job context.

### Feature 4: Thread Busy %

**Backend data**: `JARThreadStat.BusyPct float64` at `models.go:504`. `ThreadStatsEntry.BusyPct float64` at `models.go:327`. Both types are populated and cached in Redis.

**Frontend gap**: `ThreadStatsEntry` interface in `api-types.ts:344-355` is missing `busy_pct` field. `ThreadsSection` component doesn't display it.

**Decision**: Add `busy_pct` to the frontend `ThreadStatsEntry` interface. Add a progress bar column to `ThreadsSection` with color thresholds (<50% green, 50-80% amber, >80% red). Update the `normalizeThreads` function in the dashboard page to map `busy_pct`.
**Rationale**: Minimal change — just adding a field and column to existing components.

### Feature 5: Filter Nesting Depth (Filter Levels)

**Backend data**: `JARFilterLevel` struct at `models.go:570-578` with `LineNumber`, `TraceID`, `FilterLevel`, `Operation`, `Form`, `RequestID`. Part of `JARFilterComplexityResponse.FilterLevels` at `models.go:586`. Already used in HTML report generation (`report_html.go:1008-1020`).

**Frontend data**: `JARFilterLevel` interface exists in `api-types.ts:411-415` but is not rendered anywhere.

**Gap**: The filters endpoint returns `JARFilterComplexityResponse` when JAR data is cached, which includes `filter_levels`. Frontend's `FiltersSection` and normalization don't handle this field.

**Decision**: Add a "Filter Levels" sub-table to `FiltersSection` that renders when JAR filter data includes `filter_levels`. Show nesting level with color coding (>5 levels = warning).
**Rationale**: Data already flows through the existing filters endpoint. Just needs frontend rendering.

### Feature 6: Filters Per Second

**Backend data**: `JARFilterPerTransaction.FiltersPerSec float64` at `models.go:558`. Parsed from JAR "MOST FILTERS PER TRANSACTION" section (`parser.go:1732-1735`).

**Frontend gap**: `FilterPerTransaction` interface in `api-types.ts:392-400` is missing `filters_per_sec`. The `normalizeFilters` function in the dashboard page maps per-transaction data but drops `filters_per_sec`.

**Decision**: Add `filters_per_sec` to the frontend `FilterPerTransaction` interface. Add a "Filters/sec" column to the per-transaction table in `FiltersSection`. Highlight values >100 as warnings.
**Rationale**: Trivial change — one field, one column.

### Feature 7: Per-File Metadata

**Backend data**: `LogFile` struct at `models.go:42-54` has basic file metadata (filename, size, S3 path). But it does NOT have per-file time ranges parsed from JAR output.

**JAR output**: The JAR produces a "FILE INFORMATION" or similar section showing per-file start/end times. This is NOT currently parsed in `parser.go`.

**Decision**: Add `FileMetadata` struct to `models.go` with `FileNumber int`, `FileName string`, `StartTime time.Time`, `EndTime time.Time`, `Duration time.Duration`. Add parser function in `parser.go`. Store in ParseResult. New frontend `SourceFilesSection` component.
**Rationale**: Requires new backend parsing but follows established JAR section parsing pattern.
**Alternatives considered**: Deriving from ClickHouse min/max timestamps per file — rejected because JAR output is authoritative.

### Feature 8: Logging Activity by Type

**Backend data**: Not currently parsed. JAR output has a "LOGGING ACTIVITY" section showing first/last timestamps and duration per log type.

**Decision**: Add `LoggingActivity` struct to `models.go` with `LogType string`, `FirstTimestamp time.Time`, `LastTimestamp time.Time`, `Duration time.Duration`, `EntryCount int`. Add parser function. Store in ParseResult. New frontend `LoggingActivitySection` component.
**Rationale**: Same pattern as Feature 7 — new JAR section parser + frontend component.

---

## Data Flow Architecture

All 8 features follow the same established pattern:

```
JAR Parser → ParseResult → Redis Cache → API Handler → Frontend Component
```

- **Features 1, 3-6**: Data already in Redis. Frontend changes only (+ 1 new endpoint for queued calls).
- **Features 7-8**: New JAR parser sections → stored in ParseResult → cached in Redis → new frontend sections.
- **Feature 2**: ClickHouse query → new endpoint → new frontend section (different data flow since delayed escalations are computed from raw log entries, not JAR aggregate output).

## Frontend Component Pattern

All new dashboard sections follow the existing `CollapsibleSection` pattern:

```tsx
<CollapsibleSection title="..." description="..." onExpand={handler} isLoading={loading}>
  <NewSection data={data} />
</CollapsibleSection>
```

New sections are lazy-loaded (data fetched only when expanded) using the same `useState` + conditional query pattern from the dashboard page.

## API Abbreviation Tooltip Pattern

The `ApiCodeBadge` component wraps API code text with a tooltip:

```tsx
<ApiCodeBadge code="RE" />
// Renders: RE with tooltip "Retrieve Entry - Retrieves an existing record"
```

Uses the existing shadcn/ui `Tooltip` component already in the project. Falls back to raw code display when the code is not recognized.

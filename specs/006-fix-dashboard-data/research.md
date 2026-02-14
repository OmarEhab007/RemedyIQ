# Research: Fix Dashboard Data Pipeline

**Feature**: 006-fix-dashboard-data
**Date**: 2026-02-13
**Status**: Complete

## Research Topics

### R1: JAR v3.2.2 Output Format

**Decision**: Parse all sections using fixed-width column extraction with dash-separator boundary detection.

**Rationale**: The JAR v3.2.2 uses `###` section/subsection headers (not `===` as the v3 parser code assumed) and fixed-width tables with dash separator lines that define column boundaries. The existing `extractColumnBoundaries()` and `extractColumnValues()` functions already handle this format for TopN tables and can be reused for all section types.

**Key Findings**:
- Major section headers: `###  SECTION: NAME  ######...` (~80 char padded)
- Subsection headers: `### SUBSECTION TITLE`
- Column separators: Dash lines matching column widths (e.g., `------------ -------- -----`)
- Grouped aggregates use a multi-row pattern: entity → operation rows → subtotal (dashes) → total row
- Grand totals indicated by `======` separator lines
- Empty sections indicated by text like "No Queued API's"
- Timestamp format: `DDD MMM DD YYYY HH:MM:SS.fff` (e.g., "Mon Nov 24 2025 14:47:07.436")
- Decimal times: 3 decimal places (seconds, e.g., "0.122")
- Percentages: 2 decimal places (e.g., "0.33%")

**Alternatives Considered**:
- Regex-based parsing: Rejected — fixed-width is more reliable for aligned columns
- HTML report parsing: Rejected — text output is simpler and already captured by runner
- Custom format per section: Rejected — all sections share the same fixed-width pattern

### R2: Domain Type Mapping (JAR → Go)

**Decision**: Add JAR-native types to `domain/models.go` that mirror the actual JAR output structure. Existing computed types remain for backward compatibility.

**Rationale**: The current domain types (`AggregateGroup`, `ExceptionEntry`, `GapEntry`, `ThreadStatsEntry`) were designed for ClickHouse query results, not JAR output. The JAR produces a different structure — for example, aggregates are grouped by entity with per-operation-type sub-rows including OK/Fail/Total counts and MIN/MAX/AVG/SUM timing. Creating JAR-native types ensures exact fidelity; the existing types serve as the compute fallback.

**New Types Required**:

| Go Type | JAR Section | Key Fields |
|---|---|---|
| `JARGapEntry` | Line/Thread Gaps | GapDuration, LineNumber, TraceID, Timestamp, Details |
| `JARAggregateRow` | All Aggregate Tables | EntityName, OperationType, OK, Fail, Total, MinTime, MinLine, MaxTime, MaxLine, AvgTime, SumTime |
| `JARAggregateGroup` | Grouped Aggregates | EntityName, Rows []JARAggregateRow, Subtotal *JARAggregateRow |
| `JARAggregateTable` | Full Aggregate Section | Groups []JARAggregateGroup, GrandTotal *JARAggregateRow, GroupedBy string |
| `JARThreadStat` | Thread Stats by Queue | Queue, ThreadID, FirstTime, LastTime, Count, QCount, QTime, TotalTime, BusyPct |
| `JARAPIError` | API Errors | EndLine, TraceID, Queue, API, Form, User, StartTime, ErrorMessage |
| `JARExceptionEntry` | Exception Reports | LineNumber, TraceID, Type, Message (API); LineNumber, TraceID, Message, SQLStatement (SQL) |
| `JARFilterMostExecuted` | Most Executed Filters | FilterName, PassCount, FailCount |
| `JARFilterPerTransaction` | Filters Per Transaction | LineNumber, TraceID, FilterCount, Operation, Form, RequestID, FiltersPerSec |
| `JARFilterExecutedPerTxn` | Most Executed Per Txn | LineNumber, TraceID, FilterName, PassCount, FailCount |
| `JARFilterLevel` | Filter Levels | LineNumber, TraceID, FilterLevel, Operation, Form, RequestID |
| `JARQueuedAPICall` | Queued API Calls | Same as TopN API but sorted by queue time |

**Alternatives Considered**:
- Reuse existing `AggregateGroup` type: Rejected — fields don't match (no OK/Fail/MIN/MAX columns, no sub-grouping)
- Generic map[string]interface{}: Rejected — loses type safety and JSON serialization control
- Separate package for JAR types: Rejected — simplicity gate; all domain types in one place

### R3: Aggregate Table Parsing Strategy

**Decision**: Two-pass parser for grouped aggregate tables.

**Rationale**: JAR aggregate tables have a hierarchical structure:
```
Form1                  API_TYPE_1    OK  Fail  Total  MIN  ...  SUM
                       API_TYPE_2    OK  Fail  Total  MIN  ...  SUM
                                    --- ---  ---                 ---
                                     N1       N1                 SUM1
Form2                  API_TYPE_1    ...
```

This requires tracking the "current group entity" across rows, detecting subtotal separators, and accumulating operation-type sub-rows.

**Algorithm**:
1. **Pass 1**: Detect column boundaries from dash separator line
2. **Pass 2**: Iterate data rows:
   - If first column non-empty → start new group (entity name)
   - If first column empty + data in other columns → operation sub-row for current group
   - If dash separator → next row is subtotal
   - If equals separator → next row is grand total
   - Empty/whitespace rows → skip

**Alternatives Considered**:
- Single-pass with lookahead: Possible but more complex error handling
- Per-row regex extraction: Fragile with varying column widths
- Split on entity boundaries first, then parse: Extra memory allocation for large tables

### R4: Cache Strategy for Parsed Sections

**Decision**: Store JAR-parsed sections in the same Redis keys used by enhanced_helpers, overwriting computed approximations.

**Rationale**: The existing cache key pattern (`remedyiq:{tid}:dashboard:{jid}:agg`, `:exc`, `:gaps`, `:threads`, `:filters`) is already correct. By populating these keys at ingestion time with JAR-parsed data, the handler `getOrCompute*()` functions will find cached data on the first request and return it directly. No handler code changes needed for the basic flow — only the fallback logic needs awareness of which data format is cached.

**Cache Keys (unchanged)**:
| Key Suffix | Content (New) | Content (Old/Fallback) |
|---|---|---|
| `:agg` | `JARAggregatesResponse` with full aggregate tables | `AggregatesResponse` computed from TopN |
| `:exc` | `JARExceptionsResponse` with errors + exceptions | `ExceptionsResponse` from Distribution["errors"] |
| `:gaps` | `JARGapsResponse` with line + thread gaps | `GapsResponse` with queue health only |
| `:threads` | `JARThreadStatsResponse` grouped by queue | `ThreadStatsResponse` from Distribution["threads"] |
| `:filters` | `JARFilterComplexityResponse` with 5 sub-sections | `FilterComplexityResponse` from TopN filters |

**TTL**: 24 hours (unchanged)

**Alternatives Considered**:
- New Redis keys (e.g., `:jar_agg`): Rejected — doubles cache footprint, requires handler changes
- ClickHouse storage: Rejected per clarification (Redis-only for this feature)
- No caching (compute on demand): Rejected — parser output is deterministic, cache avoids re-parsing

### R5: Time Series Generation Strategy

**Decision**: Bucket TopN entry timestamps into minute or second intervals, producing sparse time-series data.

**Rationale**: Per spec clarification, time series is derived from TopN entries (up to 200 across 4 types). This is sparse but honest — it shows the heaviest operations distributed over time. The algorithm:
1. Collect all TopN entries with valid timestamps
2. Determine log duration from GeneralStats
3. If duration > 1 minute: bucket by minute
4. If duration <= 1 minute: bucket by second
5. Count operations per type per bucket
6. Return TimeSeriesPoint array

**Alternatives Considered**:
- Derive from gap analysis timestamps: Only shows gaps, not activity volume
- Use aggregate totals distributed evenly: Misleading — masks actual spike patterns
- No time series (leave empty): Rejected — spec requires SC-007

### R6: Distribution Generation Strategy

**Decision**: Derive distributions from aggregate table totals.

**Rationale**: The JAR's aggregate tables already contain totals per form, table, client, and operation type. Distributions can be computed by summing the `Total` column per entity:
- **By Type**: Sum API/SQL/Filter/Escalation from GeneralStats
- **By Queue**: Extract queue names from ThreadStats, sum counts per queue
- **By Form**: Sum `Total` per form from API aggregate table
- **By Table**: Sum `Total` per table from SQL aggregate table
- **By User**: From existing Distribution["users"] in DashboardData

**Alternatives Considered**:
- Keep existing Distribution map approach: Still used as fallback
- Generate from TopN entries only: Limited to 50 entries per type, misses most data

### R7: Backward Compatibility for Old Analyses

**Decision**: Graceful degradation — detect old cache format, serve what's available, prompt for re-analysis.

**Rationale**: Per spec clarification, old analyses cached before the parser enhancement should show existing data in already-working sections and display "Re-analyze for full data" in new sections. Detection strategy: check if the Redis value for a section key contains JAR-native fields (e.g., `aggregate_tables` for aggregates). If not, fall back to computed data.

**Implementation**:
1. Handler attempts to unmarshal cached JSON into new type
2. If new fields present → serve JAR-parsed data
3. If not → fall back to `ComputeEnhancedSections()` (existing behavior)
4. Frontend checks for a `source` field: `"jar_parsed"` vs `"computed"`
5. If computed + section was previously empty → show "Re-analyze for full data" banner

**Alternatives Considered**:
- Auto-invalidate old caches: Rejected per clarification (no auto-invalidation)
- Version stamp on cache: Over-engineering for a transitional state
- Different endpoints for old vs new: Breaks frontend simplicity

### R8: Frontend Component Enhancement Strategy

**Decision**: Extend existing components with new tabs/columns rather than replacing them.

**Rationale**: Each dashboard component already handles loading, error, and empty states. The enhancement adds:
- **AggregatesSection**: New tab per grouping dimension (Form, Client, Table, Pool) + new columns (OK, Fail, MIN, MAX, AVG, SUM)
- **ExceptionsSection**: New tabs for API Errors, API Exceptions, SQL Exceptions (each with their own column set)
- **GapsSection**: Replace empty state with actual gap table data (duration, line#, traceID, timestamp, details)
- **ThreadsSection**: Group by queue, add First/Last time, Q Count, Q Time, Busy% columns
- **FiltersSection**: Add 3 new sub-tabs (Most Executed, Executed Per Txn, Filter Levels)

**Alternatives Considered**:
- New page for detailed data: Rejected — users expect data on the existing analysis dashboard
- Modal/drawer for section details: Adds navigation complexity, spec requires inline display
- Replace components entirely: Loses existing styling, accessibility, and lazy-loading logic

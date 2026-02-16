# Data Model: Enhanced Trace Transaction Page

**Date**: 2026-02-15
**Feature**: 008-trace-transaction

## Overview

This feature requires **no ClickHouse or PostgreSQL schema changes**. All necessary fields (trace_id, rpc_id, thread_id, filter_level, timestamp, duration_ms, etc.) already exist in the `log_entries` table. The data model additions are:

1. **New Go types** for waterfall hierarchy and transaction search responses
2. **Redis cache keys** for computed hierarchy and recent traces
3. **Client-side TypeScript types** for trace visualization state

## Existing Schema (No Changes)

### ClickHouse: log_entries (unchanged)

Key fields used for trace transaction:

| Field | Type | Usage in Trace |
|-------|------|----------------|
| trace_id | String | Primary correlation (AR 19.x+) |
| rpc_id | String | Fallback correlation (pre-19.x) |
| thread_id | String | Thread-level grouping for hierarchy |
| timestamp | DateTime64(3) | Temporal ordering, containment |
| duration_ms | UInt32 | Span duration, bar width |
| queue_time_ms | UInt32 | Queue wait (shown in detail) |
| log_type | Enum8 | Color coding (API/SQL/FLTR/ESCL) |
| filter_level | UInt8 | Filter nesting depth (1/2/3) |
| line_number | UInt32 | Ordering tiebreaker, log link |
| file_number | UInt16 | Multi-file support |
| success | Bool | Error highlighting |
| user | String | Search-by-user, display |
| queue | String | Summary header |
| form | String | API/filter context |
| operation | String | Operation type |
| api_code | String | API span identifier |
| filter_name | String | Filter span identifier |
| sql_statement | String | SQL query text (detail sidebar) |
| sql_table | String | SQL table name |
| esc_name | String | Escalation name |
| esc_pool | String | Escalation pool |
| scheduled_time | DateTime64(3) | Escalation timing |
| delay_ms | UInt32 | Escalation delay |
| error_encountered | Bool | Escalation errors |
| error_message | String | Error details |
| raw_text | String | Full raw log line |
| request_id | String | Request correlation |
| entry_id | String | Unique entry ID |

## New Go Types

### SpanNode (Hierarchy Node)

```go
// SpanNode represents a single span in the trace hierarchy tree.
type SpanNode struct {
    ID            string                 `json:"id"`
    ParentID      string                 `json:"parent_id,omitempty"`
    Depth         int                    `json:"depth"`
    LogType       string                 `json:"log_type"`
    StartOffsetMS int64                  `json:"start_offset_ms"` // Relative to trace start
    DurationMS    int                    `json:"duration_ms"`
    Fields        map[string]interface{} `json:"fields"`
    Children      []SpanNode             `json:"children"`
    OnCriticalPath bool                  `json:"on_critical_path"`
}
```

### WaterfallResponse

```go
// WaterfallResponse is the enhanced trace endpoint response.
type WaterfallResponse struct {
    TraceID        string     `json:"trace_id"`
    CorrelationType string   `json:"correlation_type"` // "trace_id" or "rpc_id"
    TotalDurationMS int64    `json:"total_duration_ms"`
    SpanCount      int        `json:"span_count"`
    ErrorCount     int        `json:"error_count"`
    PrimaryUser    string     `json:"primary_user"`
    PrimaryQueue   string     `json:"primary_queue"`
    TypeBreakdown  map[string]int `json:"type_breakdown"` // e.g. {"API":5,"SQL":20,"FLTR":15,"ESCL":1}
    TraceStart     string     `json:"trace_start"`     // ISO 8601
    TraceEnd       string     `json:"trace_end"`       // ISO 8601
    Spans          []SpanNode `json:"spans"`            // Hierarchical tree (roots only)
    FlatSpans      []SpanNode `json:"flat_spans"`       // Flat ordered list for span list view
    CriticalPath   []string   `json:"critical_path"`    // Ordered list of span IDs
    TookMS         int        `json:"took_ms"`
}
```

### TransactionSummary (Search Result)

```go
// TransactionSummary is a single transaction in search results.
type TransactionSummary struct {
    TraceID        string `json:"trace_id"`
    CorrelationType string `json:"correlation_type"`
    PrimaryUser    string `json:"primary_user"`
    PrimaryForm    string `json:"primary_form"`
    PrimaryOperation string `json:"primary_operation"`
    TotalDurationMS int64 `json:"total_duration_ms"`
    SpanCount      int    `json:"span_count"`
    ErrorCount     int    `json:"error_count"`
    FirstTimestamp string `json:"first_timestamp"` // ISO 8601
    LastTimestamp  string `json:"last_timestamp"`  // ISO 8601
}
```

### TransactionSearchResponse

```go
// TransactionSearchResponse is the response for transaction discovery.
type TransactionSearchResponse struct {
    Transactions []TransactionSummary `json:"transactions"`
    Total        int                  `json:"total"`
    TookMS       int                  `json:"took_ms"`
}
```

## Redis Cache Keys

| Key Pattern | Value | TTL | Purpose |
|-------------|-------|-----|---------|
| `{tenant_id}:trace:waterfall:{job_id}:{trace_id}` | JSON WaterfallResponse | 5 min | Cached hierarchy computation |
| `{tenant_id}:trace:recent:{user_id}` | JSON array of last 20 trace summaries | 1 hour | Recent traces dropdown |

## TypeScript Types (Frontend)

### SpanNode

```typescript
interface SpanNode {
  id: string;
  parent_id?: string;
  depth: number;
  log_type: "API" | "SQL" | "FLTR" | "ESCL";
  start_offset_ms: number;
  duration_ms: number;
  fields: Record<string, unknown>;
  children: SpanNode[];
  on_critical_path: boolean;
}
```

### TraceState (Hook State)

```typescript
interface TraceState {
  traceId: string;
  waterfall: WaterfallResponse | null;
  selectedSpanId: string | null;
  activeView: "waterfall" | "flamegraph" | "spanlist";
  filters: TraceFilters;
  comparisonTrace: WaterfallResponse | null;
  aiInsights: string | null;
  loading: boolean;
  error: string | null;
}

interface TraceFilters {
  logTypes: Set<string>;   // Active log type filters
  errorsOnly: boolean;
  minDurationMs: number | null;
  searchText: string;
}
```

## ClickHouse Queries (New)

### Transaction Search by User

```sql
SELECT
    trace_id,
    any(user) AS primary_user,
    any(form) AS primary_form,
    any(operation) AS primary_operation,
    max(timestamp) - min(timestamp) AS total_duration_ms,
    count() AS span_count,
    countIf(success = false) AS error_count,
    min(timestamp) AS first_timestamp,
    max(timestamp) AS last_timestamp
FROM log_entries
WHERE tenant_id = {tenantID:String}
  AND job_id = {jobID:String}
  AND user = {user:String}
  AND trace_id != ''
GROUP BY trace_id
ORDER BY first_timestamp DESC
LIMIT 50
```

### Transaction Search by Thread

```sql
SELECT
    trace_id,
    any(user) AS primary_user,
    any(form) AS primary_form,
    any(operation) AS primary_operation,
    max(timestamp) - min(timestamp) AS total_duration_ms,
    count() AS span_count,
    countIf(success = false) AS error_count,
    min(timestamp) AS first_timestamp,
    max(timestamp) AS last_timestamp
FROM log_entries
WHERE tenant_id = {tenantID:String}
  AND job_id = {jobID:String}
  AND thread_id = {threadID:String}
  AND trace_id != ''
GROUP BY trace_id
ORDER BY first_timestamp DESC
LIMIT 50
```

## Entity Relationships

```
Trace (1) ──contains──> (*) SpanNode (hierarchical tree)
  │
  ├── SpanNode [API] (root)
  │     ├── SpanNode [FLTR] (filter_level=1)
  │     │     ├── SpanNode [SQL] (child of filter)
  │     │     └── SpanNode [FLTR] (filter_level=2)
  │     │           └── SpanNode [SQL]
  │     └── SpanNode [FLTR] (filter_level=1)
  │           └── SpanNode [SQL]
  └── SpanNode [ESCL] (separate root if escalation-triggered)
```

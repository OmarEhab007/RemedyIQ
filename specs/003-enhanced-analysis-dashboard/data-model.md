# Data Model: Enhanced Analysis Dashboard

**Feature**: 003-enhanced-analysis-dashboard | **Date**: 2026-02-10

## New Go Domain Types

All types added to `backend/internal/domain/models.go`.

### AggregateGroup

Represents a performance summary for a specific dimension value (form, user, or table).

```go
type AggregateGroup struct {
    PrimaryKey  string  // Form name, user name, or table name
    SecondaryKey string // API code, SQL operation type, or empty
    OKCount     int64
    FailCount   int64
    TotalCount  int64
    MinTimeMS   float64
    MaxTimeMS   float64
    AvgTimeMS   float64
    SumTimeMS   float64
}

type AggregateSection struct {
    Groups     []AggregateGroup
    GrandTotal *AggregateGroup // Grand total row (PrimaryKey = "TOTAL")
}
```

### GapEntry

Represents a detected period of silence in the log.

```go
type GapEntry struct {
    Rank       int
    DurationMS int64   // Gap duration in milliseconds
    LineNumber int
    FileNumber int
    Timestamp  time.Time
    TraceID    string
    ThreadID   string  // Only for thread gaps
    Details    string  // Context from surrounding log lines
}
```

### ThreadStatsEntry

Represents utilization metrics for a single thread within a queue.

```go
type ThreadStatsEntry struct {
    Queue        string
    ThreadID     string
    FirstSeen    time.Time
    LastSeen     time.Time
    OperationCount int64
    QueueCount   int64
    QueueTimeMS  float64
    TotalTimeMS  float64
    BusyPct      float64  // 0.0 - 100.0
}
```

### ExceptionEntry

Represents an error or exception from the analysis.

```go
type ExceptionEntry struct {
    LineNumber  int
    FileNumber  int
    Timestamp   time.Time
    TraceID     string
    RPCID       string
    LogType     LogType  // API, SQL, or ESCL
    Identifier  string   // API code, SQL table, or escalation name
    User        string
    ErrorType   string   // Exception class or error category
    ErrorMessage string  // Full error text
    Details     string   // Stack trace or SQL statement
}
```

### FilterComplexityData

Represents filter execution complexity metrics.

```go
type MostExecutedFilter struct {
    Rank           int
    FilterName     string
    ExecutionCount int64
}

type FilterPerTransaction struct {
    Rank         int
    LineNumber   int
    TraceID      string
    FilterCount  int
    Operation    string
    Form         string
    RequestID    string
    FiltersPerSec float64
}

type FilterComplexityData struct {
    MostExecuted    []MostExecutedFilter
    PerTransaction  []FilterPerTransaction
    MaxNestingDepth int
}
```

### HealthScore

Composite health metric with factor breakdown.

```go
type HealthScoreFactor struct {
    Name        string  // "error_rate", "response_time", "thread_saturation", "gap_frequency"
    Score       int     // 0-25
    MaxScore    int     // 25
    Value       string  // Human-readable value, e.g., "2.3%", "450ms", "87%", "3 gaps"
    Status      string  // "green", "yellow", "red"
    Description string  // Brief explanation when not green
}

type HealthScore struct {
    Score   int                // 0-100
    Status  string             // "green" (>80), "yellow" (50-80), "red" (<50)
    Factors []HealthScoreFactor // Always 4 factors
}
```

### Extended DashboardData

Existing `DashboardData` struct enhanced with new fields:

```go
type DashboardData struct {
    // Existing fields (unchanged)
    GeneralStats   GeneralStatistics
    TopAPICalls    []TopNEntry
    TopSQL         []TopNEntry
    TopFilters     []TopNEntry
    TopEscalations []TopNEntry
    TimeSeries     []TimeSeriesPoint
    Distribution   map[string]map[string]int

    // New fields (added for enhanced dashboard)
    HealthScore    *HealthScore          // Computed from analysis data
}
```

### New Section Response Types

Separate types for lazy-loaded endpoint responses:

```go
type AggregatesResponse struct {
    APIByForm  *AggregateSection `json:"api_by_form,omitempty"`
    APIByUser  *AggregateSection `json:"api_by_user,omitempty"`
    SQLByTable *AggregateSection `json:"sql_by_table,omitempty"`
}

type ExceptionsResponse struct {
    APIExceptions []ExceptionEntry `json:"api_exceptions"`
    SQLErrors     []ExceptionEntry `json:"sql_errors"`
    EscErrors     []ExceptionEntry `json:"esc_errors"`
    ErrorRates    map[string]float64 `json:"error_rates"` // log_type → percentage
}

type GapsResponse struct {
    LineGaps   []GapEntry `json:"line_gaps"`
    ThreadGaps []GapEntry `json:"thread_gaps"`
}

type ThreadStatsResponse struct {
    Entries []ThreadStatsEntry `json:"entries"`
    QueueSummary []QueueHealthSummary `json:"queue_summary"`
}

type QueueHealthSummary struct {
    Queue       string  `json:"queue"`
    ThreadCount int     `json:"thread_count"`
    AvgBusyPct  float64 `json:"avg_busy_pct"`
    MaxBusyPct  float64 `json:"max_busy_pct"`
    Status      string  `json:"status"` // "normal", "warning", "critical"
}

type FilterComplexityResponse struct {
    MostExecuted    []MostExecutedFilter    `json:"most_executed"`
    PerTransaction  []FilterPerTransaction  `json:"per_transaction"`
    MaxNestingDepth int                     `json:"max_nesting_depth"`
}
```

## Storage Schema Changes

### Redis Keys (Extended)

No ClickHouse schema changes needed. All new data is derived from JAR parser output and cached in Redis.

```
# Existing key (enhanced to include health score)
cache:{tenant_id}:dashboard:{job_id}            → DashboardData JSON (with HealthScore)

# New section keys (populated by worker after job completion)
cache:{tenant_id}:dashboard:{job_id}:agg        → AggregatesResponse JSON
cache:{tenant_id}:dashboard:{job_id}:exc        → ExceptionsResponse JSON
cache:{tenant_id}:dashboard:{job_id}:gaps       → GapsResponse JSON
cache:{tenant_id}:dashboard:{job_id}:threads    → ThreadStatsResponse JSON
cache:{tenant_id}:dashboard:{job_id}:filters    → FilterComplexityResponse JSON

# TTL: 24h (set by worker after job completion)
# API handler re-caches with 5-min TTL on cache miss
```

### No ClickHouse Changes

All new data sections (aggregates, exceptions, gaps, thread stats, filter complexity) are extracted from the JAR plain-text output by the parser. They are NOT derived from querying individual log entries in ClickHouse. This preserves:
- **JAR computation fidelity**: The JAR computes timing breakdowns (MIN/MAX/AVG/SUM) with its own precision rules
- **Performance**: No expensive ClickHouse aggregation queries for 1M+ entry jobs
- **Simplicity**: No new materialized views or table schemas

### No PostgreSQL Changes

No new metadata tables needed. The existing `analysis_jobs` table already stores all job metadata. Section data lives in Redis, not PostgreSQL.

## Parser Output Mapping

### JAR Section → Parser Method → Domain Type → Redis Key

| JAR Section | Parser Method | Domain Type | Redis Suffix |
|-------------|--------------|-------------|--------------|
| API Aggregates by Form | `parseAggregateByPrimaryKey()` (modified) | `AggregateSection` | `:agg` |
| API Aggregates by Client | `parseAggregateByPrimaryKey()` (modified) | `AggregateSection` | `:agg` |
| SQL Aggregates by Table | `parseAggregateByPrimaryKey()` (modified) | `AggregateSection` | `:agg` |
| API Exception Report | `parseExceptionReport()` (modified) | `[]ExceptionEntry` | `:exc` |
| SQL Error Report | `parseExceptionReport()` (modified) | `[]ExceptionEntry` | `:exc` |
| API Thread Statistics | `parseThreadStats()` (modified) | `[]ThreadStatsEntry` | `:threads` |
| SQL Thread Statistics | `parseThreadStats()` (modified) | `[]ThreadStatsEntry` | `:threads` |
| Top 50 Line Gaps | `parseGapAnalysis()` (new) | `[]GapEntry` | `:gaps` |
| Top 50 Thread Gaps | `parseGapAnalysis()` (new) | `[]GapEntry` | `:gaps` |
| Most Executed Filters | `parseFilterComplexity()` (new) | `[]MostExecutedFilter` | `:filters` |
| Filters per Transaction | `parseFilterComplexity()` (new) | `[]FilterPerTransaction` | `:filters` |

### Extended ParseOutput Return

Currently `ParseOutput()` returns `*DashboardData`. After extension:

```go
type ParseResult struct {
    Dashboard   *DashboardData
    Aggregates  *AggregatesResponse
    Exceptions  *ExceptionsResponse
    Gaps        *GapsResponse
    ThreadStats *ThreadStatsResponse
    Filters     *FilterComplexityResponse
}
```

The worker pipeline stores each section in its respective Redis key after parsing.

## TypeScript Type Additions

Added to `frontend/src/lib/api.ts`:

```typescript
// Aggregate types
interface AggregateGroup {
  primary_key: string;
  secondary_key: string;
  ok_count: number;
  fail_count: number;
  total_count: number;
  min_time_ms: number;
  max_time_ms: number;
  avg_time_ms: number;
  sum_time_ms: number;
}

interface AggregateSection {
  groups: AggregateGroup[];
  grand_total: AggregateGroup | null;
}

interface AggregatesResponse {
  api_by_form?: AggregateSection;
  api_by_user?: AggregateSection;
  sql_by_table?: AggregateSection;
}

// Gap types
interface GapEntry {
  rank: number;
  duration_ms: number;
  line_number: number;
  file_number: number;
  timestamp: string;
  trace_id: string;
  thread_id: string;
  details: string;
}

interface GapsResponse {
  line_gaps: GapEntry[];
  thread_gaps: GapEntry[];
}

// Thread stats types
interface ThreadStatsEntry {
  queue: string;
  thread_id: string;
  first_seen: string;
  last_seen: string;
  operation_count: number;
  queue_count: number;
  queue_time_ms: number;
  total_time_ms: number;
  busy_pct: number;
}

interface QueueHealthSummary {
  queue: string;
  thread_count: number;
  avg_busy_pct: number;
  max_busy_pct: number;
  status: "normal" | "warning" | "critical";
}

interface ThreadStatsResponse {
  entries: ThreadStatsEntry[];
  queue_summary: QueueHealthSummary[];
}

// Exception types
interface ExceptionEntry {
  line_number: number;
  file_number: number;
  timestamp: string;
  trace_id: string;
  rpc_id: string;
  log_type: "API" | "SQL" | "ESCL";
  identifier: string;
  user: string;
  error_type: string;
  error_message: string;
  details: string;
}

interface ExceptionsResponse {
  api_exceptions: ExceptionEntry[];
  sql_errors: ExceptionEntry[];
  esc_errors: ExceptionEntry[];
  error_rates: Record<string, number>;
}

// Filter complexity types
interface MostExecutedFilter {
  rank: number;
  filter_name: string;
  execution_count: number;
}

interface FilterPerTransaction {
  rank: number;
  line_number: number;
  trace_id: string;
  filter_count: number;
  operation: string;
  form: string;
  request_id: string;
  filters_per_sec: number;
}

interface FilterComplexityResponse {
  most_executed: MostExecutedFilter[];
  per_transaction: FilterPerTransaction[];
  max_nesting_depth: number;
}

// Health score types
interface HealthScoreFactor {
  name: string;
  score: number;
  max_score: number;
  value: string;
  status: "green" | "yellow" | "red";
  description: string;
}

interface HealthScore {
  score: number;
  status: "green" | "yellow" | "red";
  factors: HealthScoreFactor[];
}

// Extended DashboardData (summary endpoint)
interface DashboardData {
  general_stats: GeneralStats;
  top_api_calls: TopNEntry[];
  top_sql_statements: TopNEntry[];
  top_filters: TopNEntry[];
  top_escalations: TopNEntry[];
  time_series: TimeSeriesPoint[];
  distribution: Record<string, Record<string, number>>;
  health_score: HealthScore | null;
}
```

## API Fetch Functions

```typescript
// New lazy-load fetch functions
async function getDashboardAggregates(jobId: string, type?: string): Promise<AggregatesResponse>;
async function getDashboardExceptions(jobId: string, type?: string): Promise<ExceptionsResponse>;
async function getDashboardGaps(jobId: string, type?: string): Promise<GapsResponse>;
async function getDashboardThreads(jobId: string): Promise<ThreadStatsResponse>;
async function getDashboardFilters(jobId: string): Promise<FilterComplexityResponse>;
```

# Data Model: Complete Dashboard Features

**Feature**: 004-complete-dashboard-features
**Date**: 2026-02-11

## Source Table (Existing — No Changes)

### log_entries (ClickHouse)

All new endpoints query this existing table. No schema changes required.

| Column | Type | Purpose |
| ------ | ---- | ------- |
| tenant_id | String | Tenant isolation |
| job_id | String | Analysis job scope |
| entry_id | String | Unique entry identifier |
| line_number | UInt32 | Position in log file |
| file_number | UInt16 | Source file index |
| timestamp | DateTime64(3) | Log entry timestamp |
| log_type | LowCardinality(String) | API, SQL, FLTR, ESCL |
| trace_id | String | Transaction correlation |
| rpc_id | String | RPC correlation |
| thread_id | String | Server thread ID |
| queue | String | AR Server queue name |
| user | String | Client user/login |
| duration_ms | UInt32 | Operation duration |
| queue_time_ms | UInt32 | Queue wait time |
| success | Bool | Operation outcome |
| api_code | String | API operation code |
| form | String | AR form name |
| sql_table | String | Database table |
| sql_statement | String | SQL text |
| filter_name | String | Filter/workflow name |
| filter_level | UInt8 | Nesting depth |
| operation | String | Operation type |
| request_id | String | Request correlation |
| esc_name | String | Escalation name |
| esc_pool | String | Escalation pool |
| delay_ms | UInt32 | Escalation delay |
| error_encountered | Bool | Error flag |
| error_message | String | Error text |
| raw_text | String | Full log line |

## Response Models (Existing — No Changes)

All response models are already defined in `backend/internal/domain/models.go` and `frontend/src/lib/api.ts`.

### AggregatesResponse

```
AggregatesResponse
├── api: AggregateSection?
│   ├── groups: AggregateGroup[]  (grouped by form)
│   │   ├── name: string          (form name)
│   │   ├── count: int64          (total operations)
│   │   ├── total_ms: int64       (SUM duration)
│   │   ├── avg_ms: float64       (AVG duration)
│   │   ├── min_ms: int64         (MIN duration)
│   │   ├── max_ms: int64         (MAX duration)
│   │   ├── error_count: int64    (failed operations)
│   │   ├── error_rate: float64   (error_count / count)
│   │   └── unique_traces: int    (distinct trace_ids)
│   └── grand_total: AggregateGroup?
├── sql: AggregateSection?        (grouped by sql_table)
└── filter: AggregateSection?     (grouped by filter_name)
```

### ExceptionsResponse

```
ExceptionsResponse
├── exceptions: ExceptionEntry[]
│   ├── error_code: string        (error type/code)
│   ├── message: string           (representative error message)
│   ├── count: int64              (occurrence count)
│   ├── first_seen: DateTime      (earliest occurrence)
│   ├── last_seen: DateTime       (latest occurrence)
│   ├── log_type: LogType         (API/SQL/FLTR/ESCL)
│   ├── queue: string?            (sample queue)
│   ├── form: string?             (sample form)
│   ├── user: string?             (sample user)
│   ├── sample_line: int          (representative line number)
│   └── sample_trace: string?     (representative trace_id)
├── total_count: int64            (total error entries)
├── error_rates: map[string]float64  (per log_type error rate)
└── top_codes: string[]           (most frequent error codes)
```

### GapsResponse

```
GapsResponse
├── gaps: GapEntry[]
│   ├── start_time: DateTime      (gap start timestamp)
│   ├── end_time: DateTime        (gap end timestamp)
│   ├── duration_ms: int64        (gap duration)
│   ├── before_line: int          (line before gap)
│   ├── after_line: int           (line after gap)
│   ├── log_type: LogType         (entry type at gap boundary)
│   ├── queue: string?            (context queue)
│   └── thread_id: string?        (for thread gaps only)
└── queue_health: QueueHealthSummary[]
    ├── queue: string
    ├── total_calls: int64
    ├── avg_ms: float64
    ├── error_rate: float64
    └── p95_ms: int64
```

### ThreadStatsResponse

```
ThreadStatsResponse
├── threads: ThreadStatsEntry[]
│   ├── thread_id: string
│   ├── total_calls: int64
│   ├── total_ms: int64
│   ├── avg_ms: float64
│   ├── max_ms: int64
│   ├── error_count: int64
│   ├── busy_pct: float64         (total_ms / wall_clock_ms * 100)
│   ├── active_start: string?     (first observed timestamp)
│   └── active_end: string?       (last observed timestamp)
└── total_threads: int
```

### FilterComplexityResponse

```
FilterComplexityResponse
├── most_executed: MostExecutedFilter[]
│   ├── name: string              (filter name)
│   ├── count: int64              (execution count)
│   └── total_ms: int64           (total processing time)
├── per_transaction: FilterPerTransaction[]
│   ├── transaction_id: string    (trace_id)
│   ├── filter_name: string
│   ├── execution_count: int
│   ├── total_ms: int64
│   ├── avg_ms: float64
│   ├── max_ms: int64
│   ├── queue: string?
│   └── form: string?
└── total_filter_time_ms: int64
```

### HealthScore (added to existing DashboardData response)

```
HealthScore
├── score: int                    (0-100 composite)
├── status: string                (green/yellow/red)
└── factors: HealthScoreFactor[]
    ├── name: string              (Error Rate, Avg Response Time, etc.)
    ├── score: int                (individual factor score)
    ├── max_score: int            (maximum possible)
    ├── weight: float64           (contribution weight)
    ├── description: string       (human-readable explanation)
    └── severity: string          (green/yellow/red)
```

## ClickHouse Query Patterns

### Aggregates Query (by form example)

```sql
SELECT
    form AS name,
    count() AS count,
    toInt64(sum(duration_ms)) AS total_ms,
    avg(duration_ms) AS avg_ms,
    toInt64(min(duration_ms)) AS min_ms,
    toInt64(max(duration_ms)) AS max_ms,
    countIf(success = false) AS error_count,
    if(count() > 0, countIf(success = false) / count(), 0) AS error_rate,
    uniqExact(trace_id) AS unique_traces
FROM log_entries
WHERE tenant_id = @tenantID AND job_id = @jobID AND log_type = 'API' AND form != ''
GROUP BY form
ORDER BY total_ms DESC
```

### Exceptions Query

```sql
SELECT
    if(error_message != '', substring(error_message, 1, 100), 'Unknown Error') AS error_code,
    any(error_message) AS message,
    count() AS cnt,
    min(timestamp) AS first_seen,
    max(timestamp) AS last_seen,
    any(log_type) AS log_type,
    any(queue) AS queue,
    any(form) AS form,
    any(user) AS user,
    any(line_number) AS sample_line,
    any(trace_id) AS sample_trace
FROM log_entries
WHERE tenant_id = @tenantID AND job_id = @jobID AND success = false
GROUP BY error_code
ORDER BY cnt DESC
```

### Line Gaps Query

```sql
SELECT
    timestamp AS start_time,
    next_ts AS end_time,
    gap_ms,
    line_number AS before_line,
    next_line AS after_line,
    log_type
FROM (
    SELECT
        timestamp,
        line_number,
        log_type,
        neighbor(timestamp, 1) AS next_ts,
        neighbor(line_number, 1) AS next_line,
        dateDiff('millisecond', timestamp, neighbor(timestamp, 1)) AS gap_ms
    FROM log_entries
    WHERE tenant_id = @tenantID AND job_id = @jobID
    ORDER BY timestamp ASC
)
WHERE gap_ms > 0 AND next_ts != toDateTime64(0, 3)
ORDER BY gap_ms DESC
LIMIT 50
```

### Thread Stats Query

```sql
SELECT
    thread_id,
    count() AS total_calls,
    toInt64(sum(duration_ms)) AS total_ms,
    avg(duration_ms) AS avg_ms,
    toInt64(max(duration_ms)) AS max_ms,
    countIf(success = false) AS error_count,
    if(
        dateDiff('millisecond', min(timestamp), max(timestamp)) > 0,
        (sum(duration_ms) / dateDiff('millisecond', min(timestamp), max(timestamp))) * 100,
        0
    ) AS busy_pct,
    formatDateTime(min(timestamp), '%Y-%m-%d %H:%M:%S') AS active_start,
    formatDateTime(max(timestamp), '%Y-%m-%d %H:%M:%S') AS active_end
FROM log_entries
WHERE tenant_id = @tenantID AND job_id = @jobID AND thread_id != ''
GROUP BY thread_id
ORDER BY busy_pct DESC
```

### Filter Complexity — Most Executed

```sql
SELECT
    filter_name AS name,
    count() AS cnt,
    toInt64(sum(duration_ms)) AS total_ms
FROM log_entries
WHERE tenant_id = @tenantID AND job_id = @jobID AND log_type = 'FLTR' AND filter_name != ''
GROUP BY filter_name
ORDER BY cnt DESC
LIMIT 50
```

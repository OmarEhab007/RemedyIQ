# Data Model: Fix Dashboard Data Pipeline

**Feature**: 006-fix-dashboard-data
**Date**: 2026-02-13

## Overview

This document defines the new domain types added to `backend/internal/domain/models.go` to represent JAR v3.2.2 output sections. These types mirror the actual JAR output structure for exact fidelity.

## New Types

### Gap Analysis Types

```go
// JARGapEntry represents a single line gap or thread gap from the JAR output.
// Used in both "50 LONGEST LINE GAPS" and "50 LONGEST THREAD GAPS" sections.
type JARGapEntry struct {
    GapDuration float64   `json:"gap_duration"`   // Gap in seconds (e.g., 0.265)
    LineNumber  int       `json:"line_number"`     // Log line number
    TraceID     string    `json:"trace_id"`        // Transaction ID (e.g., "oKNmA5MvSwOxCzBulz9-zQ:0003436")
    Timestamp   time.Time `json:"timestamp"`       // When the gap occurred
    Details     string    `json:"details"`         // Description text (can be long SQL)
}

// JARGapsResponse contains both line gaps and thread gaps from the GAP ANALYSIS section.
type JARGapsResponse struct {
    LineGaps     []JARGapEntry       `json:"line_gaps"`
    ThreadGaps   []JARGapEntry       `json:"thread_gaps"`
    QueueHealth  []QueueHealthSummary `json:"queue_health"`  // Reuse existing type
    Source       string              `json:"source"`         // "jar_parsed" or "computed"
}
```

### Aggregate Types

```go
// JARAggregateRow represents one row in a JAR aggregate table.
// Each row is an operation type within a grouped entity (form, client, table, pool).
type JARAggregateRow struct {
    OperationType string  `json:"operation_type"` // API type (SE, GE, GLE) or SQL type (SELECT, INSERT) or escalation name
    OK            int     `json:"ok"`             // Successful operations
    Fail          int     `json:"fail"`           // Failed operations
    Total         int     `json:"total"`          // OK + Fail
    MinTime       float64 `json:"min_time"`       // Minimum execution time (seconds)
    MinLine       int     `json:"min_line"`       // Line number of MIN
    MaxTime       float64 `json:"max_time"`       // Maximum execution time (seconds)
    MaxLine       int     `json:"max_line"`       // Line number of MAX
    AvgTime       float64 `json:"avg_time"`       // Average execution time (seconds)
    SumTime       float64 `json:"sum_time"`       // Total execution time (seconds)
}

// JARAggregateGroup represents one entity (form, client, table, pool) with its operation breakdowns.
type JARAggregateGroup struct {
    EntityName string            `json:"entity_name"` // Form name, client name, table name, or pool number
    Rows       []JARAggregateRow `json:"rows"`        // Per-operation-type breakdowns
    Subtotal   *JARAggregateRow  `json:"subtotal"`    // Aggregated subtotal for this entity
}

// JARAggregateTable represents a complete aggregate section (e.g., "API CALL AGGREGATES grouped by Form").
type JARAggregateTable struct {
    GroupedBy  string              `json:"grouped_by"`  // "Form", "Client", "Client IP", "Table", "Pool"
    SortedBy   string              `json:"sorted_by"`   // "descending AVG execution time"
    Groups     []JARAggregateGroup `json:"groups"`      // All entity groups
    GrandTotal *JARAggregateRow    `json:"grand_total"` // Grand total row (after ====== separator)
}

// JARAggregatesResponse contains all aggregate tables parsed from JAR output.
type JARAggregatesResponse struct {
    APIByForm      *JARAggregateTable `json:"api_by_form"`
    APIByClient    *JARAggregateTable `json:"api_by_client"`
    APIByClientIP  *JARAggregateTable `json:"api_by_client_ip"`
    SQLByTable     *JARAggregateTable `json:"sql_by_table"`
    EscByForm      *JARAggregateTable `json:"esc_by_form"`
    EscByPool      *JARAggregateTable `json:"esc_by_pool"`
    Source         string             `json:"source"` // "jar_parsed" or "computed"
}
```

### Thread Statistics Types

```go
// JARThreadStat represents one thread's statistics within a queue.
type JARThreadStat struct {
    Queue     string    `json:"queue"`       // Queue name (AssignEng, Fast, List, Prv:NNNNN, Escalation)
    ThreadID  string    `json:"thread_id"`   // 10-digit thread identifier
    FirstTime time.Time `json:"first_time"`  // First thread activity timestamp
    LastTime  time.Time `json:"last_time"`   // Last thread activity timestamp
    Count     int       `json:"count"`       // Total call count
    QCount    int       `json:"q_count"`     // Queued call count (API only, 0 for SQL)
    QTime     float64   `json:"q_time"`      // Total queue wait time in seconds (API only)
    TotalTime float64   `json:"total_time"`  // Total execution time in seconds
    BusyPct   float64   `json:"busy_pct"`    // Busy percentage (0-100)
}

// JARThreadStatsResponse contains thread statistics for both API and SQL sections.
type JARThreadStatsResponse struct {
    APIThreads  []JARThreadStat `json:"api_threads"`  // API thread stats grouped by queue
    SQLThreads  []JARThreadStat `json:"sql_threads"`  // SQL thread stats grouped by queue
    Source      string          `json:"source"`        // "jar_parsed" or "computed"
}
```

### Error and Exception Types

```go
// JARAPIError represents one API call that errored out.
type JARAPIError struct {
    EndLine      int       `json:"end_line"`      // End line number in log
    TraceID      string    `json:"trace_id"`      // Transaction ID
    Queue        string    `json:"queue"`         // Queue name
    API          string    `json:"api"`           // API abbreviation (SE, GE, etc.)
    Form         string    `json:"form"`          // Form name
    User         string    `json:"user"`          // User name
    StartTime    time.Time `json:"start_time"`    // API call start timestamp
    ErrorMessage string    `json:"error_message"` // Full error text (e.g., "-SE FAIL -- AR Error(45386) ...")
}

// JARExceptionEntry represents one entry from an API or SQL exception report.
type JARExceptionEntry struct {
    LineNumber   int    `json:"line_number"`   // Log line number
    TraceID      string `json:"trace_id"`      // Transaction ID
    Type         string `json:"type"`          // API abbreviation (API exceptions only)
    Message      string `json:"message"`       // Warning/error message
    SQLStatement string `json:"sql_statement"` // SQL text (SQL exceptions only)
}

// JARExceptionsResponse contains all error and exception data from JAR output.
type JARExceptionsResponse struct {
    APIErrors      []JARAPIError      `json:"api_errors"`      // API calls that errored out
    APIExceptions  []JARExceptionEntry `json:"api_exceptions"`  // API exception report
    SQLExceptions  []JARExceptionEntry `json:"sql_exceptions"`  // SQL exception report
    Source         string             `json:"source"`          // "jar_parsed" or "computed"
}
```

### Filter Types

```go
// JARFilterMostExecuted represents one filter in the "50 MOST EXECUTED FLTR" section.
type JARFilterMostExecuted struct {
    FilterName string `json:"filter_name"` // Full filter name
    PassCount  int    `json:"pass_count"`  // Number of times filter passed
    FailCount  int    `json:"fail_count"`  // Number of times filter failed
}

// JARFilterPerTransaction represents one entry in "50 MOST FILTERS PER TRANSACTION".
type JARFilterPerTransaction struct {
    LineNumber   int     `json:"line_number"`    // Log line number
    TraceID      string  `json:"trace_id"`       // Transaction ID
    FilterCount  int     `json:"filter_count"`   // Total filters in this transaction
    Operation    string  `json:"operation"`       // SET, CREATE, DELETE
    Form         string  `json:"form"`           // Form name
    RequestID    string  `json:"request_id"`     // Request ID (can be "<NULL" or pipe-separated)
    FiltersPerSec float64 `json:"filters_per_sec"` // Filters/second (can be NaN → 0)
}

// JARFilterExecutedPerTxn represents one entry in "50 MOST EXECUTED FLTR PER TRANSACTION".
type JARFilterExecutedPerTxn struct {
    LineNumber int    `json:"line_number"` // Log line number
    TraceID    string `json:"trace_id"`    // Transaction ID
    FilterName string `json:"filter_name"` // Filter name
    PassCount  int    `json:"pass_count"`  // Pass count
    FailCount  int    `json:"fail_count"`  // Fail count
}

// JARFilterLevel represents one entry in "50 MOST FILTER LEVELS IN TRANSACTIONS".
type JARFilterLevel struct {
    LineNumber  int    `json:"line_number"`  // Log line number
    TraceID     string `json:"trace_id"`     // Transaction ID
    FilterLevel int    `json:"filter_level"` // Nesting depth (0, 1, 2, ...)
    Operation   string `json:"operation"`    // SET, CREATE, DELETE
    Form        string `json:"form"`         // Form name
    RequestID   string `json:"request_id"`   // Request ID
}

// JARFilterComplexityResponse contains all 5 filter sub-sections from JAR output.
type JARFilterComplexityResponse struct {
    LongestRunning     []TopNEntry              `json:"longest_running"`      // Reuse existing TopN (already parsed)
    MostExecuted       []JARFilterMostExecuted   `json:"most_executed"`       // 50 Most Executed
    PerTransaction     []JARFilterPerTransaction `json:"per_transaction"`     // 50 Most Filters Per Transaction
    ExecutedPerTxn     []JARFilterExecutedPerTxn `json:"executed_per_txn"`    // 50 Most Executed Per Transaction
    FilterLevels       []JARFilterLevel          `json:"filter_levels"`       // 50 Most Filter Levels
    Source             string                    `json:"source"`              // "jar_parsed" or "computed"
}
```

### Queued API Calls

```go
// JARQueuedAPICall represents one entry from "50 LONGEST QUEUED INDIVIDUAL API CALLS".
// Uses same format as TopN API calls but sorted by queue time.
// Reuses TopNEntry type — no new type needed.
```

### API Abbreviation Legend

```go
// JARAPIAbbreviation maps an API abbreviation to its full name.
type JARAPIAbbreviation struct {
    Abbreviation string `json:"abbreviation"` // e.g., "SE"
    FullName     string `json:"full_name"`    // e.g., "ARSetEntry"
}
```

## Modified Types

### ParseResult (extended)

```go
// ParseResult holds all parsed data from JAR output.
// Existing fields are preserved; new JAR-native fields are added.
type ParseResult struct {
    Dashboard   *DashboardData            // Existing: stats + TopN + distribution

    // Existing computed types (kept for backward compatibility)
    Aggregates  *AggregatesResponse
    Exceptions  *ExceptionsResponse
    Gaps        *GapsResponse
    ThreadStats *ThreadStatsResponse
    Filters     *FilterComplexityResponse

    // New JAR-native types (parsed directly from JAR output)
    JARGaps         *JARGapsResponse
    JARAggregates   *JARAggregatesResponse
    JARExceptions   *JARExceptionsResponse
    JARThreadStats  *JARThreadStatsResponse
    JARFilters      *JARFilterComplexityResponse

    // Supplementary data
    APIAbbreviations []JARAPIAbbreviation
    QueuedAPICalls   []TopNEntry
}
```

## Redis Cache Schema

| Redis Key | Go Type | TTL | Populated By |
|---|---|---|---|
| `remedyiq:{tid}:dashboard:{jid}` | `DashboardData` | 24h | `ingestion.go` |
| `remedyiq:{tid}:dashboard:{jid}:agg` | `JARAggregatesResponse` | 24h | `ingestion.go` |
| `remedyiq:{tid}:dashboard:{jid}:exc` | `JARExceptionsResponse` | 24h | `ingestion.go` |
| `remedyiq:{tid}:dashboard:{jid}:gaps` | `JARGapsResponse` | 24h | `ingestion.go` |
| `remedyiq:{tid}:dashboard:{jid}:threads` | `JARThreadStatsResponse` | 24h | `ingestion.go` |
| `remedyiq:{tid}:dashboard:{jid}:filters` | `JARFilterComplexityResponse` | 24h | `ingestion.go` |

## Entity Relationships

```
ParseResult
├── Dashboard (DashboardData)
│   ├── GeneralStats
│   ├── TopAPICalls []TopNEntry
│   ├── TopSQL []TopNEntry
│   ├── TopFilters []TopNEntry
│   ├── TopEscalations []TopNEntry
│   ├── TimeSeries []TimeSeriesPoint     ← Generated from TopN timestamps
│   └── Distribution map[string]map[string]int  ← Generated from aggregates
│
├── JARGaps (JARGapsResponse)
│   ├── LineGaps []JARGapEntry          ← Parsed from "50 LONGEST LINE GAPS"
│   └── ThreadGaps []JARGapEntry        ← Parsed from "50 LONGEST THREAD GAPS"
│
├── JARAggregates (JARAggregatesResponse)
│   ├── APIByForm *JARAggregateTable    ← Parsed from "API CALL AGGREGATES grouped by Form"
│   ├── APIByClient *JARAggregateTable  ← Parsed from "API CALL AGGREGATES grouped by Client"
│   ├── APIByClientIP *JARAggregateTable ← Parsed from "API CALL AGGREGATES grouped by Client IP"
│   ├── SQLByTable *JARAggregateTable   ← Parsed from "SQL CALL AGGREGATES grouped by Table"
│   ├── EscByForm *JARAggregateTable    ← Parsed from "Escalation CALL AGGREGATES grouped by Form"
│   └── EscByPool *JARAggregateTable    ← Parsed from "Escalation CALL AGGREGATES grouped by Pool"
│
├── JARExceptions (JARExceptionsResponse)
│   ├── APIErrors []JARAPIError         ← Parsed from "API CALLS THAT ERRORED OUT"
│   ├── APIExceptions []JARExceptionEntry ← Parsed from "API EXCEPTION REPORT"
│   └── SQLExceptions []JARExceptionEntry ← Parsed from "SQL EXCEPTION REPORT"
│
├── JARThreadStats (JARThreadStatsResponse)
│   ├── APIThreads []JARThreadStat      ← Parsed from "API THREAD STATISTICS BY QUEUE"
│   └── SQLThreads []JARThreadStat      ← Parsed from "SQL THREAD STATISTICS BY QUEUE"
│
└── JARFilters (JARFilterComplexityResponse)
    ├── LongestRunning []TopNEntry       ← Already parsed (existing TopN)
    ├── MostExecuted []JARFilterMostExecuted ← Parsed from "50 MOST EXECUTED FLTR"
    ├── PerTransaction []JARFilterPerTransaction ← Parsed from "50 MOST FILTERS PER TRANSACTION"
    ├── ExecutedPerTxn []JARFilterExecutedPerTxn ← Parsed from "50 MOST EXECUTED FLTR PER TRANSACTION"
    └── FilterLevels []JARFilterLevel    ← Parsed from "50 MOST FILTER LEVELS IN TRANSACTIONS"
```

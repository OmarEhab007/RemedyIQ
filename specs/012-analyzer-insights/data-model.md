# Data Model: ARLogAnalyzer Insights Enhancement

**Date**: 2026-02-18 | **Branch**: `012-analyzer-insights`

## Existing Entities (no changes needed)

### TopNEntry (backend: models.go:247-262)
Used by Feature 1 (Queued API Calls). Already has `QueueTimeMS` field.

```
TopNEntry
├── Name: string          # API/SQL/Filter/Escalation name
├── Count: int            # Execution count
├── TotalMS: int64        # Total execution time
├── AvgMS: float64        # Average execution time
├── MaxMS: int64          # Maximum execution time
├── MinMS: int64          # Minimum execution time
├── QueueTimeMS: int64    # Queue wait time (Feature 1)
├── Form: string          # Associated form
├── LogType: string       # API/SQL/FLTR/ESCL
└── Source: string        # "jar_parsed" or "computed"
```

### JARAPIAbbreviation (backend: models.go:590-594)
Used by Feature 3 (API Legend). Already parsed.

```
JARAPIAbbreviation
├── Abbreviation: string  # 2-3 letter code (e.g., "RE")
└── FullName: string      # Full API name (e.g., "Retrieve Entry")
```

### JARThreadStat (backend: models.go:494-505)
Used by Feature 4 (Thread Busy %). Already has BusyPct.

```
JARThreadStat
├── ThreadID: string
├── RequestCount: int
├── TotalTime: float64
├── QTime: float64
├── TotalTime: float64
└── BusyPct: float64     # 0-100 percentage (Feature 4)
```

### ThreadStatsEntry (backend: models.go:318-330)
Computed thread stats. Already has BusyPct.

```
ThreadStatsEntry
├── ThreadID: string
├── Queue: string
├── TotalRequests: int64
├── ErrorCount: int64
├── AvgMS: float64
├── MaxMS: int64
├── MinMS: int64
├── TotalMS: int64
├── UniqueUsers: int
├── UniqueForms: int
├── BusyPct: float64     # 0-100 percentage (Feature 4)
├── ActiveStart: string
└── ActiveEnd: string
```

### JARFilterLevel (backend: models.go:570-578)
Used by Feature 5 (Filter Nesting Depth). Already parsed.

```
JARFilterLevel
├── LineNumber: int
├── TraceID: string
├── FilterLevel: int      # Nesting depth (Feature 5)
├── Operation: string
├── Form: string
└── RequestID: string
```

### JARFilterPerTransaction (backend: models.go:549-559)
Used by Feature 6 (FPS). Already parsed.

```
JARFilterPerTransaction
├── LineNumber: int
├── TraceID: string
├── FilterCount: int
├── Operation: string
├── Form: string
├── RequestID: string
└── FiltersPerSec: float64  # Execution rate (Feature 6)
```

## New Entities

### DelayedEscalationEntry (Feature 2)
Aggregated from ClickHouse `log_entries` where `log_type = 'ESCL' AND delay_ms > 0`.

```
DelayedEscalationEntry
├── EscName: string           # Escalation name
├── EscPool: string           # Escalation pool assignment
├── ScheduledTime: timestamp  # When it was supposed to run
├── ActualTime: timestamp     # When it actually ran
├── DelayMS: uint32           # Delay in milliseconds
├── ThreadID: string          # Thread that executed it
├── TraceID: string           # Associated trace/transaction
└── LineNumber: int64         # Line in source log file
```

**Relationships**: Belongs to an AnalysisJob (via job_id). References log_entries in ClickHouse.

### FileMetadata (Feature 7)
Parsed from JAR "FILE INFORMATION" output section.

```
FileMetadata
├── FileNumber: int           # Ordinal position (1, 2, 3...)
├── FileName: string          # Original filename
├── StartTime: timestamp      # First log entry timestamp
├── EndTime: timestamp        # Last log entry timestamp
├── DurationMS: int64         # EndTime - StartTime in ms
└── EntryCount: int           # Number of log entries in file
```

**Relationships**: Part of ParseResult (stored in Redis as part of the cached analysis).

### LoggingActivity (Feature 8)
Parsed from JAR "LOGGING ACTIVITY" output section.

```
LoggingActivity
├── LogType: string           # API, SQL, FLTR, ESCL
├── FirstTimestamp: timestamp  # Earliest entry of this type
├── LastTimestamp: timestamp   # Latest entry of this type
├── DurationMS: int64         # LastTimestamp - FirstTimestamp in ms
└── EntryCount: int           # Total entries of this type
```

**Relationships**: Part of ParseResult (stored in Redis as part of the cached analysis).

## Frontend Type Changes

### ThreadStatsEntry (api-types.ts) — Add field
```
+ busy_pct: number          # 0-100 percentage
```

### FilterPerTransaction (api-types.ts) — Add field
```
+ filters_per_sec: number   # Execution rate per second
```

### New Interfaces (api-types.ts)

```typescript
DelayedEscalationEntry {
  esc_name: string
  esc_pool: string
  scheduled_time: string
  actual_time: string
  delay_ms: number
  thread_id: string
  trace_id: string
  line_number: number
}

FileMetadataEntry {
  file_number: number
  file_name: string
  start_time: string
  end_time: string
  duration_ms: number
  entry_count: number
}

LoggingActivityEntry {
  log_type: string
  first_timestamp: string
  last_timestamp: string
  duration_ms: number
  entry_count: number
}
```

## State Transitions

No state machines in this feature. All data is read-only from the analysis results.

## Validation Rules

- `BusyPct` must be clamped to 0-100 range for display
- `FiltersPerSec` of NaN from JAR is converted to 0 (already handled in parser)
- `DelayMS` of 0 means no delay (filter out from delayed escalations view)
- Timestamps must be parseable; entries with invalid timestamps are skipped

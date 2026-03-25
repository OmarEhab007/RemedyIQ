# Worker Pipeline

This document describes the job processing pipeline in the Worker service.

## Pipeline Overview

```mermaid
flowchart TB
    subgraph "Job Submission"
        UPLOAD[File Upload]
        CREATE[Create Job Record]
        PUBLISH[Publish to NATS]
    end
    
    subgraph "Worker Processing"
        SUB[Subscribe to NATS]
        DOWNLOAD[Download from S3]
        JAR[Execute ARLogAnalyzer.jar]
        PARSE[Parse JAR Output]
        ENHANCE[Enhance Results]
        ANOMALY[Detect Anomalies]
        CACHE[Cache to Redis]
        STORE[Store to ClickHouse]
        INDEX[Index to Bleve]
        COMPLETE[Mark Complete]
    end
    
    subgraph "Output"
        DASHBOARD[Dashboard Data]
        ENTRIES[Log Entries]
        SEARCH[Search Index]
    end
    
    UPLOAD --> CREATE
    CREATE --> PUBLISH
    PUBLISH --> SUB
    SUB --> DOWNLOAD
    DOWNLOAD --> JAR
    JAR --> PARSE
    PARSE --> ENHANCE
    ENHANCE --> ANOMALY
    ANOMALY --> CACHE
    CACHE --> STORE
    STORE --> INDEX
    INDEX --> COMPLETE
    
    COMPLETE --> DASHBOARD
    COMPLETE --> ENTRIES
    COMPLETE --> SEARCH
    
    style JAR fill:#ff9800
    style STORE fill:#4caf50
    style ANOMALY fill:#e91e63
```

## Job Status Lifecycle

```mermaid
stateDiagram-v2
    [*] --> queued: Job Created
    queued --> parsing: Worker Picks Up
    parsing --> analyzing: JAR Complete
    analyzing --> storing: Parse Complete
    storing --> complete: ClickHouse Insert
    parsing --> failed: JAR Error
    analyzing --> failed: Parse Error
    storing --> failed: Storage Error
    failed --> [*]
    complete --> [*]
```

## Pipeline Stages

### Stage 1: Job Pickup

```mermaid
sequenceDiagram
    participant NATS
    participant Worker
    participant PG
    
    NATS->>Worker: job.created event
    Worker->>PG: UPDATE status = 'parsing'
    Worker->>PG: GET file metadata
    Note over Worker: Create job context with timeout
```

**Key Actions:**
1. Subscribe to `jobs.{tenant_id}.*` subjects
2. Update job status to `parsing`
3. Fetch file metadata from PostgreSQL
4. Create per-job context with 30-minute timeout

### Stage 2: File Download

```mermaid
sequenceDiagram
    participant Worker
    participant S3 as MinIO/S3
    participant FS as Temp File
    
    Worker->>S3: Download(file.s3_key)
    S3-->>Worker: io.Reader
    Worker->>FS: CreateTemp()
    Worker->>FS: Write file content
    Worker->>NATS: Progress 15%
```

**Key Actions:**
1. Stream download from S3
2. Write to temp file (auto-cleanup on exit)
3. Publish progress update

### Stage 3: JAR Execution

```mermaid
sequenceDiagram
    participant Worker
    participant JAR as ARLogAnalyzer.jar
    participant NATS
    
    Worker->>JAR: java -jar ARLogAnalyzer.jar [flags]
    loop Every 1000 lines
        JAR-->>Worker: Line callback
        Worker->>NATS: Progress update (15-70%)
    end
    JAR-->>Worker: JSON output + stderr
    Worker->>NATS: Progress 75%
```

**Key Actions:**
1. Execute JAR with configured flags and heap size
2. Stream stdout to parser
3. Capture stderr for error reporting
4. Report progress based on lines processed

**JAR Flags:**
- `--top-n`: Number of top entries to include
- `--group-by`: Aggregation dimensions
- `--skip-api`, `--skip-sql`, `--skip-fltr`, `--skip-esc`: Skip log types
- `--begin-time`, `--end-time`: Time range filter
- `--user-filter`: Filter by user

### Stage 4: Parse & Enhance

```mermaid
sequenceDiagram
    participant Worker
    participant Parser
    participant Enhancer
    participant Anomaly
    
    Worker->>Parser: ParseOutput(stdout)
    Parser-->>Worker: ParseResult
    Worker->>Enhancer: EnhanceParseResult()
    Enhancer-->>Worker: Computed sections
    Worker->>Anomaly: Detect(dashboard data)
    Anomaly-->>Worker: Anomaly list
```

**Key Actions:**
1. Parse JAR JSON output into structured data
2. Compute derived sections (time series, distribution)
3. Run anomaly detection on top-N data
4. Generate health score

### Stage 5: Cache Results

```mermaid
sequenceDiagram
    participant Worker
    participant Redis
    
    Worker->>Redis: SET dashboard:{job_id}
    Worker->>Redis: SET dashboard:{job_id}:agg
    Worker->>Redis: SET dashboard:{job_id}:exc
    Worker->>Redis: SET dashboard:{job_id}:gaps
    Worker->>Redis: SET dashboard:{job_id}:threads
    Worker->>Redis: SET dashboard:{job_id}:filters
    Note over Redis: TTL: 24 hours
```

**Cached Sections:**
- `dashboard:{job_id}` - Full dashboard data
- `dashboard:{job_id}:agg` - Aggregates (by form, client, table)
- `dashboard:{job_id}:exc` - Exceptions and errors
- `dashboard:{job_id}:gaps` - Idle periods and queue health
- `dashboard:{job_id}:threads` - Thread statistics
- `dashboard:{job_id}:filters` - Filter complexity data
- `dashboard:{job_id}:queued` - Queued API calls
- `dashboard:{job_id}:logging-activity` - Logging duration per type
- `dashboard:{job_id}:file-metadata` - Per-file metadata

### Stage 6: Store to ClickHouse

```mermaid
sequenceDiagram
    participant Worker
    participant Parser as Log Parser
    participant CH as ClickHouse
    
    Worker->>Parser: ParseFile(log file)
    loop Every 5000 entries
        Parser-->>Worker: Batch of LogEntry
        Worker->>CH: BatchInsertEntries()
    end
    Worker->>NATS: Progress 95%
```

**Key Actions:**
1. Parse raw log file into LogEntry structs
2. Batch insert into ClickHouse (5000 entries per batch)
3. ClickHouse automatically updates materialized views

### Stage 7: Build Search Index

```mermaid
sequenceDiagram
    participant Worker
    participant Bleve
    
    Worker->>Bleve: Open index (job_id)
    loop For each log entry
        Worker->>Bleve: Index(entry)
    end
    Worker->>Bleve: Close index
```

**Indexed Fields:**
- `trace_id` - Exact match
- `user` - Exact match
- `form` - Exact match
- `operation` - Exact match
- `raw_text` - Full-text search
- `timestamp` - Range queries

### Stage 8: Complete Job

```mermaid
sequenceDiagram
    participant Worker
    participant PG
    participant NATS
    
    Worker->>PG: UPDATE status = 'complete'
    Worker->>PG: UPDATE progress = 100
    Worker->>PG: SET completed_at = now()
    Worker->>NATS: Publish job.completed
    Worker->>NATS: Progress 100%
```

## Error Handling

```mermaid
flowchart TB
    ERROR[Error Occurred]
    
    ERROR -->|JAR Failure| JAR_ERR[JAR stderr captured]
    ERROR -->|Parse Failure| PARSE_ERR[Parse error logged]
    ERROR -->|Storage Failure| STORE_ERR[Non-fatal, job continues]
    
    JAR_ERR --> FAIL[Mark Job Failed]
    PARSE_ERR --> FAIL
    STORE_ERR --> LOG_ERR[Log Warning]
    
    FAIL --> UPDATE_PG[UPDATE status = 'failed']
    UPDATE_PG --> NATS_FAIL[Publish job.failed]
    NATS_FAIL --> CLEANUP[Cleanup temp files]
```

## Progress Reporting

| Stage | Progress Range | Description |
|-------|---------------|-------------|
| Download | 0-15% | File download from S3 |
| JAR Execution | 15-70% | Based on lines processed |
| Parse | 70-75% | Parse JAR output |
| Cache | 75-85% | Store to Redis |
| ClickHouse | 85-95% | Batch insert entries |
| Index | 95-99% | Build Bleve index |
| Complete | 100% | Job finished |

## Anomaly Detection

The pipeline runs anomaly detection on:
- **Slow API calls**: Z-score outlier detection on duration
- **Slow SQL statements**: Z-score outlier detection on duration
- **High filter execution**: Statistical deviation from mean

Detected anomalies are logged and can trigger alerts.

## Scaling Considerations

### Current Constraint

The worker is intentionally deployed as a **single replica**:
- Bleve index requires single-writer access
- PVC uses `ReadWriteOnce` access mode
- Multiple workers would cause index corruption

### Future Scaling Path

To enable horizontal scaling:
1. Replace Bleve with distributed search (Elasticsearch, Meilisearch)
2. Use shared storage with proper locking
3. Implement index sharding with coordinator

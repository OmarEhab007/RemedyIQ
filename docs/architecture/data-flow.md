# Data Flow

This document explains the data flows between components with sequence diagrams.

## Table of Contents

1. [Log Upload & Analysis](#1-log-upload--analysis)
2. [Dashboard Loading](#2-dashboard-loading)
3. [KQL Search](#3-kql-search)
4. [Transaction Tracing](#4-transaction-tracing)
5. [AI Query Streaming](#5-ai-query-streaming)
6. [Real-time Progress Updates](#6-real-time-progress-updates)

---

## 1. Log Upload & Analysis

The complete flow from file upload to analysis completion.

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant API as API Server
    participant S3 as MinIO/S3
    participant PG as PostgreSQL
    participant NATS
    participant Worker
    participant JAR as ARLogAnalyzer.jar
    participant CH as ClickHouse
    participant Redis
    participant Bleve
    
    User->>Frontend: Select log file
    Frontend->>API: POST /api/v1/files/upload (multipart)
    API->>API: Validate file (size, type)
    API->>S3: Upload to s3://{bucket}/{tenant_id}/{uuid}.log
    S3-->>API: Upload confirmed
    API->>PG: INSERT INTO log_files (...)
    API->>PG: INSERT INTO analysis_jobs (status='queued')
    API->>NATS: Publish jobs.{tenant_id}.created
    API-->>Frontend: {job_id, status: 'queued'}
    Frontend-->>User: Show progress UI
    
    NATS->>Worker: job.created event
    Worker->>PG: UPDATE status='parsing'
    Worker->>NATS: Progress 5%
    
    Worker->>S3: Download file
    S3-->>Worker: File stream
    Worker->>Worker: Write to temp file
    Worker->>NATS: Progress 15%
    
    Worker->>JAR: Execute java -jar ARLogAnalyzer.jar
    loop Process lines
        JAR-->>Worker: Output lines
        Worker->>NATS: Progress 15-70%
    end
    JAR-->>Worker: JSON output
    Worker->>NATS: Progress 75%
    
    Worker->>Worker: Parse JAR output
    Worker->>Worker: Enhance results
    Worker->>Worker: Detect anomalies
    Worker->>Redis: Cache dashboard sections
    Worker->>NATS: Progress 85%
    
    Worker->>PG: UPDATE status='storing'
    Worker->>Worker: Parse raw log entries
    loop Batch insert
        Worker->>CH: INSERT 5000 entries
    end
    Worker->>Bleve: Build search index
    Worker->>NATS: Progress 95%
    
    Worker->>PG: UPDATE status='complete', progress=100
    Worker->>NATS: Publish jobs.{tenant_id}.completed
    NATS->>API: Job complete event
    API->>Frontend: WebSocket: job_complete
    Frontend-->>User: Redirect to dashboard
```

---

## 2. Dashboard Loading

How dashboard data is fetched and cached.

```mermaid
sequenceDiagram
    participant Frontend
    participant API
    participant Redis
    participant CH as ClickHouse
    participant PG as PostgreSQL
    
    Frontend->>API: GET /api/v1/analysis/{job_id}/dashboard
    API->>PG: Validate job ownership
    PG-->>API: Job exists for tenant
    
    API->>Redis: GET dashboard:{tenant}:{job_id}
    
    alt Cache hit
        Redis-->>API: Dashboard data
        API-->>Frontend: JSON response
    else Cache miss
        Redis-->>API: nil
        
        API->>CH: SELECT aggregates, top_n, time_series
        CH-->>API: Dashboard data
        
        API->>Redis: SET dashboard:{...} (TTL 24h)
        API-->>Frontend: JSON response
    end
```

### Lazy-Loaded Sections

Individual dashboard sections can be loaded independently:

```mermaid
sequenceDiagram
    participant Frontend
    participant API
    participant Redis
    participant CH as ClickHouse
    
    Frontend->>API: GET /api/v1/analysis/{job_id}/dashboard/aggregates
    API->>Redis: GET dashboard:{tenant}:{job_id}:agg
    
    alt Cache hit
        Redis-->>API: Aggregates data
    else Cache miss
        API->>CH: SELECT ... GROUP BY ...
        CH-->>API: Aggregates
        API->>Redis: SET dashboard:{...}:agg
    end
    
    API-->>Frontend: Aggregates JSON
```

---

## 3. KQL Search

Full-text and structured search flow.

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant API
    participant KQL as KQL Parser
    participant Bleve
    participant CH as ClickHouse
    
    User->>Frontend: Enter KQL query
    Note over User,Frontend: "user:admin AND duration_ms > 1000"
    
    Frontend->>API: GET /api/v1/analysis/{job_id}/search?q=...
    API->>KQL: Parse(query)
    KQL-->>API: Parsed query tree
    
    API->>Bleve: Search(parsedQuery)
    Bleve-->>API: Matching entry IDs
    
    alt Entry IDs found
        API->>CH: SELECT * FROM log_entries WHERE entry_id IN (...)
        CH-->>API: Full log entries
    else No results
        API-->>API: Empty result set
    end
    
    API-->>Frontend: {entries: [...], total: N}
    Frontend-->>User: Display results table
    
    User->>Frontend: Click entry row
    Frontend->>API: GET /api/v1/analysis/{job_id}/entries/{entry_id}/context
    API->>CH: SELECT entries before/after
    CH-->>API: Context entries
    API-->>Frontend: Context data
    Frontend-->>User: Show entry in context
```

### KQL Query Examples

| Query | Meaning |
|-------|---------|
| `user:admin` | Entries where user = 'admin' |
| `form:*Help*` | Forms containing 'Help' |
| `duration_ms > 5000` | Duration greater than 5 seconds |
| `type:API AND success:false` | Failed API calls |
| `error_message:*timeout*` | Timeout errors |

---

## 4. Transaction Tracing

Trace reconstruction and waterfall visualization.

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant API
    participant CH as ClickHouse
    participant TB as Trace Builder
    
    User->>Frontend: Click trace_id in search results
    Frontend->>API: GET /api/v1/analysis/{job_id}/trace/{trace_id}
    
    API->>CH: SELECT * FROM log_entries WHERE trace_id = ? ORDER BY timestamp
    CH-->>API: All entries with trace_id
    
    API->>TB: BuildTrace(entries)
    TB->>TB: Group by rpc_id hierarchy
    TB->>TB: Calculate start offsets
    TB->>TB: Identify critical path
    TB-->>API: WaterfallResponse{spans, critical_path}
    
    API-->>Frontend: Trace data
    Frontend-->>User: Render waterfall chart
    
    User->>Frontend: Click span
    Frontend->>User: Show span details
    Frontend->>API: GET /trace/{trace_id}/waterfall
    API-->>Frontend: Enhanced waterfall data
```

### Trace Data Structure

```mermaid
graph TB
    subgraph "Transaction Trace"
        SPAN1[Span: API Entry<br/>duration: 1500ms]
        SPAN2[Span: SQL Query<br/>duration: 800ms]
        SPAN3[Span: Filter Execution<br/>duration: 200ms]
        SPAN4[Span: SQL Query<br/>duration: 400ms]
    end
    
    SPAN1 --> SPAN2
    SPAN1 --> SPAN3
    SPAN2 --> SPAN4
    
    SPAN2 -.->|Critical Path| SPAN4
```

---

## 5. AI Query Streaming

SSE-based streaming AI responses.

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant API
    participant Router as AI Router
    participant Skill as AI Skill
    participant CH as ClickHouse
    participant Gemini as Google Gemini
    participant PG as PostgreSQL
    
    User->>Frontend: Ask question
    Note over User,Frontend: "Why are API calls slow?"
    
    Frontend->>API: POST /api/v1/ai/stream
    Note over Frontend,API: Accept: text/event-stream
    Note over Frontend,API: Body: {query, job_id, conversation_id}
    
    API->>PG: Get/Create conversation
    PG-->>API: conversation_id
    
    API->>Router: Route(query)
    Note over Router: Keywords: 'slow' → 'performance'
    Router-->>API: skill = 'performance'
    
    API->>Skill: Execute(ctx, input)
    
    Skill->>CH: Fetch context (slow API calls)
    CH-->>Skill: Top 20 slow entries
    
    Skill->>Skill: Build system prompt
    Note over Skill: Context + Instructions + User Query
    
    Skill->>Gemini: StreamGenerateContent
    
    loop Stream chunks
        Gemini-->>Skill: Chunk delta
        Skill-->>API: SSE event
        API-->>Frontend: data: {"delta": "..."}
        Frontend->>User: Render markdown
    end
    
    Gemini-->>Skill: Stream complete
    Skill-->>API: Full response
    
    API->>PG: INSERT message (role=assistant)
    API-->>Frontend: data: [DONE]
    
    Frontend->>User: Complete response
```

### SSE Event Format

```
data: {"delta": "Based on the log analysis, "}

data: {"delta": "the slowest API calls are related to "}

data: {"delta": "form submissions with an average "}

data: {"delta": "duration of 2.5 seconds."}

data: [DONE]
```

---

## 6. Real-time Progress Updates

WebSocket-based job progress updates.

```mermaid
sequenceDiagram
    participant Frontend
    participant WS as WebSocket Client
    participant API
    participant Hub as WS Hub
    participant NATS
    participant Worker
    
    Frontend->>WS: Connect to /api/v1/ws
    WS->>API: WebSocket handshake
    API->>Hub: Register connection
    
    Frontend->>API: POST /api/v1/analysis (create job)
    API-->>Frontend: {job_id}
    
    Frontend->>WS: Send: {"subscribe": "job:{job_id}"}
    WS->>Hub: Subscribe to job topic
    
    loop Job processing
        Worker->>NATS: Publish progress
        NATS->>API: Progress event
        API->>Hub: Broadcast to subscribers
        Hub->>WS: {"type": "progress", "pct": 45, "message": "..."}
        WS->>Frontend: Progress update
        Frontend->>User: Update progress bar
    end
    
    Worker->>NATS: Publish complete
    NATS->>API: Complete event
    API->>Hub: Broadcast completion
    Hub->>WS: {"type": "complete", "job_id": "..."}
    WS->>Frontend: Job complete
    Frontend->>User: Navigate to dashboard
```

### WebSocket Message Types

| Type | Direction | Purpose |
|------|-----------|---------|
| `subscribe` | Client → Server | Subscribe to job updates |
| `unsubscribe` | Client → Server | Unsubscribe from updates |
| `progress` | Server → Client | Job progress update |
| `complete` | Server → Client | Job completed |
| `error` | Server → Client | Job failed |

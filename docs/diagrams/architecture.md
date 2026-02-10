# RemedyIQ Architecture Diagrams

This directory contains architecture diagrams for the RemedyIQ platform.

## High-Level Architecture

```mermaid
graph TB
    subgraph "Client Layer"
        WEB[Web UI<br/>Next.js + React]
        CLI[CLI Tool<br/>Optional]
    end
    
    subgraph "API Gateway"
        API[REST API<br/>Go + Gorilla Mux]
        WS[WebSocket<br/>Real-time Updates]
    end
    
    subgraph "Application Layer"
        API_SERVER[API Server<br/>cmd/api]
        WORKER[Worker Service<br/>cmd/worker]
        AUTH[Authentication<br/>Clerk]
    end
    
    subgraph "Message Queue"
        NATS[NATS JetStream<br/>Job Queue]
    end
    
    subgraph "AI & Analysis"
        JAR[ARLogAnalyzer.jar<br/>Log Parser]
        AI[Claude API<br/>AI Analysis]
        BLEVE[Bleve<br/>Full-text Search]
    end
    
    subgraph "Storage Layer"
        PG[(PostgreSQL<br/>Metadata & Tenant)]
        CH[(ClickHouse<br/>Log Entries)]
        REDIS[(Redis<br/>Cache)]
        S3[(MinIO/S3<br/>Log Files)]
    end
    
    WEB -->|HTTP/HTTPS| API
    WEB -->|WebSocket| WS
    CLI -->|HTTP| API
    
    API --> API_SERVER
    WS --> API_SERVER
    
    API_SERVER -->|SQL| PG
    API_SERVER -->|CHQL| CH
    API_SERVER -->|Get/Set| REDIS
    API_SERVER -->|Upload/Download| S3
    API_SERVER --> NATS
    API_SERVER --> AUTH
    
    WORKER --> NATS
    WORKER -->|Execute| JAR
    WORKER -->|Query| AI
    WORKER -->|Search| BLEVE
    WORKER -->|SQL| PG
    WORKER -->|CHQL| CH
    WORKER -->|Store| S3
    
    NATS --> WORKER
    
    style WEB fill:#e1f5ff
    style API fill:#fff4e1
    style API_SERVER fill:#e8f5e9
    style WORKER fill:#e8f5e9
    style PG fill:#fce4ec
    style CH fill:#f3e5f5
    style REDIS fill:#fff3e0
    style S3 fill:#e0f2f1
    style NATS fill:#f1f8e9
    style AI fill:#ede7f6
```

## Data Flow - Log Upload & Analysis

```mermaid
sequenceDiagram
    participant User
    participant WebUI
    participant API as API Server
    participant NATS
    participant Worker
    participant JAR as ARLogAnalyzer.jar
    participant CH as ClickHouse
    participant PG as PostgreSQL
    participant S3 as MinIO/S3
    
    User->>WebUI: Upload .log file (drag & drop)
    WebUI->>API: POST /api/v1/logs/upload (multipart)
    API->>S3: Store raw log file
    API->>PG: Create LogFile record
    API->>PG: Create AnalysisJob (status: queued)
    API->>NATS: Publish job.created event
    API-->>WebUI: Return job_id with progress URL
    
    Worker->>NATS: Subscribe to job.* subjects
    NATS->>Worker: job.created message
    
    Worker->>PG: Update job status (parsing)
    Worker->>JAR: Execute with log file path
    JAR-->>Worker: Parsed JSON output
    
    Worker->>PG: Update job status (analyzing)
    Worker->>CH: Batch insert log entries
    Worker->>BLEVE: Build search index
    Worker->>AI: Optional AI analysis
    
    Worker->>PG: Update job status (storing)
    Worker->>PG: Store analysis results
    
    Worker->>PG: Update job status (complete)
    Worker->>NATS: Publish job.completed event
    API->>WebUI: WebSocket push (100% progress)
    
    WebUI->>API: GET /api/v1/jobs/:job_id
    API-->>WebUI: Job status + stats
    WebUI->>User: Show dashboard with results
```

## Multi-Tenant Architecture

```mermaid
graph LR
    subgraph "Tenant A (Organization 1)"
        WEB_A[Web UI]
        API_A[API Requests]
        NATS_A[jobs.tenant-a.*]
        PG_A[PostgreSQL<br/>tenant_id = 'a']
        CH_A[ClickHouse<br/>PARTITION tenant_a]
        REDIS_A[Redis<br/>prefix:tenant-a: ]
        S3_A[S3<br/>s3://tenant-a/]
    end
    
    subgraph "Tenant B (Organization 2)"
        WEB_B[Web UI]
        API_B[API Requests]
        NATS_B[jobs.tenant-b.*]
        PG_B[PostgreSQL<br/>tenant_id = 'b']
        CH_B[ClickHouse<br/>PARTITION tenant_b]
        REDIS_B[Redis<br/>prefix:tenant-b: ]
        S3_B[S3<br/>s3://tenant-b/]
    end
    
    subgraph "Shared Services"
        AUTH[Clerk Auth<br/>Multi-tenant]
        AI[Claude API<br/>Rate-limited]
        WORKER[Worker Pool]
    end
    
    WEB_A --> API_A
    WEB_B --> API_B
    
    API_A --> AUTH
    API_B --> AUTH
    
    API_A --> NATS_A
    API_B --> NATS_B
    
    WORKER --> NATS_A
    WORKER --> NATS_B
    
    WORKER --> PG_A
    WORKER --> PG_B
    
    WORKER --> CH_A
    WORKER --> CH_B
    
    WORKER --> REDIS_A
    WORKER --> REDIS_B
    
    WORKER --> S3_A
    WORKER --> S3_B
    
    WORKER --> AI
    
    style PG_A fill:#fce4ec
    style PG_B fill:#e3f2fd
    style CH_A fill:#fce4ec
    style CH_B fill:#e3f2fd
    style REDIS_A fill:#fce4ec
    style REDIS_B fill:#e3f2fd
    style S3_A fill:#fce4ec
    style S3_B fill:#e3f2fd
```

## AI-Powered Query Flow

```mermaid
sequenceDiagram
    participant User
    participant WebUI
    participant API
    participant AI as Claude API
    participant CH as ClickHouse
    participant BLEVE as Bleve Search
    
    User->>WebUI: Ask: "Show me slow API calls yesterday"
    WebUI->>API: POST /api/v1/ai/query
    
    API->>AI: Send query + context
    AI-->>API: Return SQL query + reasoning
    
    API->>CH: Execute: SELECT * FROM log_entries<br/>WHERE type='API' AND duration_ms > 1000<br/>AND timestamp >= yesterday
    
    CH-->>API: Return matching log entries
    
    API->>BLEVE: Search for related patterns
    BLEVE-->>API: Additional context
    
    API->>AI: Ask for explanation with evidence
    AI-->>API: Natural language answer<br/>with log line references
    
    API-->>WebUI: JSON: { answer, evidence, confidence, suggested_questions }
    WebUI-->>User: Display answer with clickable log lines
```

## Component Interaction - Real-time Dashboard

```mermaid
graph TB
    subgraph "Browser"
        REACT[React App]
        REDUX[State Management]
        CHART[Recharts<br/>Visualization]
        WEBSOCK[WebSocket Client]
    end
    
    subgraph "API Server"
        WS_SERVER[WebSocket Handler]
        REST[REST API]
        AUTHZ[Auth Middleware]
    end
    
    subgraph "Worker"
        ANALYZER[Log Analyzer]
        AGGREGATOR[Metrics Aggregator]
    end
    
    subgraph "Storage"
        CH[(ClickHouse)]
        REDIS[(Redis<br/>Real-time Stats)]
    end
    
    REACT --> REDUX
    REDUX --> CHART
    REDUX --> REST
    REACT --> WEBSOCK
    
    WEBSOCK --> WS_SERVER
    REST --> WS_SERVER
    REST --> AUTHZ
    
    WS_SERVER --> REDIS
    
    ANALYZER --> CH
    AGGREGATOR --> REDIS
    
    REST --> CH
    
    style REACT fill:#61dafb
    style CHART fill:#4caf50
    style WS_SERVER fill:#ff9800
    style ANALYZER fill:#9c27b0
```

## Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | Next.js 15, React 19, TypeScript | Web UI framework |
| **UI Components** | shadcn/ui, Radix UI, Tailwind CSS | Component library |
| **Charts** | Recharts | Data visualization |
| **API** | Go 1.24, Gorilla Mux | REST API server |
| **Real-time** | WebSocket, NATS JetStream | Live updates, job queue |
| **Database** | PostgreSQL + pgx/v5 | Metadata, tenant data |
| **Analytics** | ClickHouse | Time-series log data |
| **Cache** | Redis | Session, rate limiting, real-time stats |
| **Storage** | MinIO / S3 | Log file storage |
| **Search** | Bleve | Full-text search index |
| **AI** | Claude API (Anthropic) | Natural language query |
| **Auth** | Clerk | Multi-tenant authentication |
| **Infrastructure** | Docker, Docker Compose | Containerization |

## Deployment Architecture

```mermaid
graph TB
    subgraph "Production Environment"
        LB[Load Balancer<br/>Nginx/Caddy]
        
        subgraph "Frontend Cluster"
            FE1[Frontend Pod 1]
            FE2[Frontend Pod 2]
            FEN[Frontend Pod N]
        end
        
        subgraph "API Cluster"
            API1[API Pod 1]
            API2[API Pod 2]
            APIN[API Pod N]
        end
        
        subgraph "Worker Cluster"
            WKR1[Worker Pod 1]
            WKR2[Worker Pod 2]
            WKRN[Worker Pod N]
        end
        
        LB --> FE1
        LB --> FE2
        LB --> FEN
        
        FE1 --> API1
        FE2 --> API2
        FEN --> APIN
        
        API1 --> WKR1
        API2 --> WKR2
        APIN --> WKRN
    end
    
    subgraph "Data Layer"
        PG_HA[(PostgreSQL<br/>Primary + Replicas)]
        CH_CLUSTER[(ClickHouse<br/>Cluster)]
        REDIS_HA[(Redis<br/>Sentinel)]
        S3_CLUSTER[(MinIO/S3<br/>Distributed)]
    end
    
    API1 --> PG_HA
    API2 --> PG_HA
    APIN --> PG_HA
    
    API1 --> CH_CLUSTER
    API2 --> CH_CLUSTER
    APIN --> CH_CLUSTER
    
    API1 --> REDIS_HA
    API2 --> REDIS_HA
    APIN --> REDIS_HA
    
    WKR1 --> S3_CLUSTER
    WKR2 --> S3_CLUSTER
    WKRN --> S3_CLUSTER
    
    WKR1 --> CH_CLUSTER
    WKR2 --> CH_CLUSTER
    WKRN --> CH_CLUSTER
    
    subgraph "External Services"
        CLERK[Clerk Auth]
        CLAUDE[Claude API]
    end
    
    API1 --> CLERK
    API2 --> CLERK
    APIN --> CLERK
    
    WKR1 --> CLAUDE
    WKR2 --> CLAUDE
    WKRN --> CLAUDE
```

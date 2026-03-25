# System Overview

RemedyIQ is an **Enterprise Log Intelligence Platform** designed for analyzing BMC Remedy AR Server logs. It provides structured ingestion, real-time dashboards, KQL-based exploration, transaction tracing, and AI-assisted analysis.

## Purpose

BMC Remedy AR Server generates complex, multi-format log files that are difficult to analyze manually. RemedyIQ solves this by:

1. **Parsing** - Structured extraction from raw log files
2. **Analysis** - Statistical analysis with anomaly detection
3. **Visualization** - Interactive dashboards with drill-down capabilities
4. **Search** - Full-text and structured KQL queries
5. **Tracing** - Transaction waterfall visualization
6. **AI Insights** - Natural language queries with streaming responses

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              CLIENT LAYER                                │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                     Next.js 16 + React 19                        │    │
│  │  Dashboard │ Explorer │ Trace View │ AI Assistant │ Upload      │    │
│  └─────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                          HTTP/SSE/WebSocket
                                    │
┌─────────────────────────────────────────────────────────────────────────┐
│                              API LAYER                                   │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                     Go API Server                                │    │
│  │  REST API │ SSE Streaming │ WebSocket Hub │ Auth Middleware     │    │
│  └─────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
          ┌─────────────────────────┼─────────────────────────┐
          │                         │                         │
          ▼                         ▼                         ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   PostgreSQL    │    │   ClickHouse    │    │     Redis       │
│   (Metadata)    │    │  (Log Entries)  │    │    (Cache)      │
│   Multi-tenant  │    │   Time-series   │    │   Dashboard     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Core Components

### Frontend (Next.js)

| Component | Technology | Purpose |
|-----------|------------|---------|
| Dashboard | React + Recharts | Visualize analysis results |
| Explorer | React + TanStack Query | KQL search with filters |
| Trace View | React + Custom | Waterfall transaction visualization |
| AI Assistant | React + streamdown | Streaming markdown AI responses |
| Upload | React + Dropzone | Drag-and-drop file upload |

### Backend (Go)

| Service | Entry Point | Purpose |
|---------|-------------|---------|
| API Server | `cmd/api/main.go` | REST API, SSE, WebSocket |
| Worker | `cmd/worker/main.go` | Background job processing |

### Storage

| Database | Purpose | Data Type |
|----------|---------|-----------|
| PostgreSQL | Metadata, tenants, jobs | Relational |
| ClickHouse | Log entries, analytics | Time-series |
| Redis | Dashboard cache, sessions | Key-value |
| MinIO | Uploaded log files | Object storage |

### Infrastructure

| Component | Purpose |
|-----------|---------|
| NATS JetStream | Job queue, event streaming |
| Clerk | Multi-tenant authentication |
| Google Gemini | AI analysis (streaming) |

## Key Features

### 1. Log Analysis Pipeline

```
Upload → Store (S3) → Queue (NATS) → Parse (JAR) → Store (ClickHouse) → Index (Bleve)
```

The worker executes ARLogAnalyzer.jar to parse BMC Remedy logs into structured data.

### 2. Real-time Dashboards

- **General Statistics**: Line counts, unique users, duration
- **Aggregates**: By form, client, table, pool
- **Exceptions**: Errors, API failures, SQL exceptions
- **Gaps**: Idle periods, queue health
- **Thread Stats**: Per-thread utilization
- **Filter Complexity**: Most executed, per-transaction

### 3. KQL Search

Full-text search with Bleve supports:
- Field queries: `user:admin`, `form:"Help Desk"`
- Range queries: `duration_ms > 1000`
- Boolean operators: `AND`, `OR`, `NOT`
- Wildcards: `form:*Request*`

### 4. Transaction Tracing

Trace correlation via `trace_id` and `rpc_id`:
- Hierarchical span tree
- Critical path analysis
- Waterfall visualization
- Error highlighting

### 5. AI Assistant

Six specialized skills with keyword routing:
- **performance**: Latency and slow operations
- **root_cause**: Correlations and cascading failures
- **error_explainer**: Error code explanations
- **anomaly_narrator**: Unusual pattern detection
- **summarizer**: Executive summaries
- **nl_query**: General queries (fallback)

## Multi-Tenancy

RemedyIQ supports multi-tenant isolation:

1. **Authentication**: Clerk validates JWT tokens
2. **Tenant Extraction**: Middleware extracts `org_id` from JWT
3. **Session Variable**: PostgreSQL `app.tenant_id` set per request
4. **Row-Level Security**: PostgreSQL policies filter by tenant
5. **S3 Prefix**: Files stored under `tenant_id/` prefix
6. **NATS Subjects**: Jobs published to `jobs.{tenant_id}.*`

## Performance Characteristics

| Metric | Value |
|--------|-------|
| Log parsing | ~50,000 lines/second |
| ClickHouse insert | ~100,000 entries/second |
| Dashboard load | <100ms (cached) |
| Search query | <50ms (Bleve) |
| AI response | Streaming (first token <1s) |

## Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend | Next.js | 16.x |
| UI | React | 19.x |
| Language (FE) | TypeScript | 5.x |
| Styling | Tailwind CSS | 4.x |
| Backend | Go | 1.24 |
| Router | Gorilla Mux | 1.8 |
| Database | PostgreSQL | 16 |
| Analytics | ClickHouse | 24 |
| Cache | Redis | 7 |
| Queue | NATS JetStream | 2.x |
| Storage | MinIO | Latest |
| AI | Google Gemini | gemini-2.5-flash |
| Auth | Clerk | 6.x |
| Search | Bleve | 2.5 |

## Getting Started

See the main [README](../../README.md) for setup instructions.

### Quick Start

```bash
# Start infrastructure
make docker-up

# Run migrations
make db-setup

# Start backend
make dev

# Start frontend
cd frontend && npm run dev
```

## Documentation Index

- [Components](./components.md) - Detailed component breakdown
- [Data Flow](./data-flow.md) - Sequence diagrams
- [Multi-Tenancy](./multi-tenancy.md) - Tenant isolation
- [Deployment](./deployment.md) - Kubernetes deployment

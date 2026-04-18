# RemedyIQ

Enterprise log intelligence for BMC Remedy AR Server.

RemedyIQ transforms raw AR log files — API, SQL, Filter, and Escalation — into structured, queryable, AI-augmented intelligence. It wraps the battle-tested ARLogAnalyzer engine with a modern SaaS platform: multi-tenant job orchestration, real-time analytics dashboards, full-text log search, transaction tracing, and a context-aware AI assistant. Built for operations teams that need answers in minutes, not hours.

---

## Why RemedyIQ?

BMC Remedy AR Server generates high-volume, multi-type log files that are difficult to analyze manually. A single log file from a busy production environment can run into gigabytes, spanning thousands of API calls, SQL queries, filter executions, and escalation events — all interleaved with microsecond timestamps.

The standard workflow is: download the file, run the ARLogAnalyzer JAR locally, open an HTML report, and manually correlate findings across log types. This works for one-off investigations but breaks down under operational pressure:

- **No persistent storage** — every analysis starts from scratch
- **No search** — findings are locked in a static HTML report
- **No correlation** — API calls, SQL queries, and filters are siloed
- **No collaboration** — analysis is per-person, per-machine
- **No AI** — pattern recognition and root-cause inference are manual

RemedyIQ solves this by turning the JAR into a backend service, storing every parsed event in ClickHouse, and layering structured search, trace correlation, and AI-assisted analysis on top. The result is a platform where a team can upload a log file, have it automatically analyzed, and immediately start querying, tracing, and conversing with an AI that has full context of the parsed events.

---

## Features

### Log Ingestion & Job Pipeline
- Upload AR log files via the web UI or API
- Asynchronous job queue (NATS JetStream) with real-time status updates over WebSocket
- ARLogAnalyzer JAR executed as a managed subprocess with configurable heap and timeout
- Parsed events stored in ClickHouse; job metadata in PostgreSQL; files in S3-compatible object storage

### Analytics Dashboard
Seven analysis sections surfaced per job:

| Section | What it shows |
|---|---|
| **Health Score** | Composite health indicator for the analyzed period |
| **Aggregates** | Operation counts, error rates, and throughput over time |
| **Exceptions** | Top exceptions by frequency, with representative log entries |
| **Gap Analysis** | Periods of inactivity or processing delay |
| **Thread Utilization** | Thread pool saturation and queue depth over time |
| **Filter Complexity** | Filter execution counts and performance breakdown |
| **Insights** | AI-generated summary of the most significant findings |

### Log Explorer
- KQL-based full-text search across all parsed log entries
- Field-level filtering by log type, severity, component, and time range
- Autocomplete for field names and known values
- Saved searches and per-user query history
- Entry context retrieval: surrounding log lines for any matched entry
- Export results to CSV or JSON

### Transaction Tracing
- Search across all transactions in a job
- Waterfall visualization showing operation sequence and durations
- Correlated view across API, SQL, and Filter events within a single transaction
- Trace export for offline analysis
- AI trace analysis: summarize bottlenecks and anomalies in a single request

### AI Assistant
Six specialized skill modes routed by intent:

| Skill | Purpose |
|---|---|
| `performance` | Identify slow operations and throughput bottlenecks |
| `root_cause` | Hypothesize root causes for observed errors or degradation |
| `error_explainer` | Explain specific error messages in plain language |
| `anomaly_narrator` | Describe unusual patterns in the log timeline |
| `summarizer` | Generate an executive summary of the analysis |
| `nl_query` | Translate natural language questions into log search queries |

Conversations are persistent, multi-turn, and scoped to a specific analysis job. AI responses stream via Server-Sent Events.

### Multi-Tenancy
- Organisation-based isolation via Clerk
- PostgreSQL Row-Level Security on all tenant data
- ClickHouse partitioned by tenant ID
- NATS subjects and Redis keys namespaced per tenant

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                        Browser                          │
│              Next.js 16 + React 19 + TypeScript         │
└───────────────────────┬─────────────────────────────────┘
                        │  REST / SSE / WebSocket
┌───────────────────────▼─────────────────────────────────┐
│                      API Server (Go)                    │
│   gorilla/mux · pgx · clickhouse-go · redis · bleve     │
│   Clerk JWT auth · dev bypass headers (local)           │
└──────────┬───────────────────────────┬──────────────────┘
           │ NATS JetStream            │ direct reads
┌──────────▼──────────┐   ┌───────────▼──────────────────┐
│    Worker (Go)      │   │        Storage Layer          │
│  Job orchestration  │   │                               │
│  JAR subprocess     │   │  PostgreSQL 16  — metadata    │
│  Event ingestion    │   │  ClickHouse 24  — log events  │
│  Bleve indexing     │   │  Redis 7        — cache       │
│  AI skill dispatch  │   │  MinIO (S3)     — files       │
└─────────────────────┘   └───────────────────────────────┘
```

**Service responsibilities:**

- **API Server** — handles all client-facing requests: file uploads, job status, dashboard queries, log search, trace retrieval, AI streaming, and WebSocket push
- **Worker** — consumes jobs from NATS, executes the ARLogAnalyzer JAR, ingests parsed events into ClickHouse, builds the Bleve full-text index, and dispatches AI skill requests
- **ARLogAnalyzer JAR** — BMC's battle-tested parsing engine; invoked as a managed subprocess with controlled heap allocation (default 4 GB) and analysis timeout

**Data responsibilities:**

| Store | Holds |
|---|---|
| PostgreSQL | Files, jobs, tenants, conversations, saved searches, search history |
| ClickHouse | All parsed log events and materialized aggregates |
| Redis | Parsed results cache, autocomplete cache, session state |
| MinIO | Uploaded log files, generated HTML reports, trace exports |

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Backend** | Go 1.24, gorilla/mux, pgx/v5, clickhouse-go/v2, go-redis/v9, nats.go, bleve/v2 |
| **Frontend** | Next.js 16, React 19, TypeScript 5, Tailwind CSS, shadcn/ui, Recharts, Zustand |
| **AI** | Google Gemini (`google.golang.org/genai`) for streaming · Anthropic Claude SDK for non-stream paths |
| **Infrastructure** | PostgreSQL 16, ClickHouse 24, NATS JetStream, Redis 7, MinIO |
| **Deployment** | Docker Compose (local) · Helm + EKS (production) |

---

## Getting Started

### Prerequisites

- Go `>= 1.24`
- Node.js `>= 20`
- Docker + Docker Compose
- Java (required for ARLogAnalyzer JAR execution)

### Quick Start

```bash
git clone https://github.com/OmarEhab007/RemedyIQ.git
cd RemedyIQ

# One-time setup: checks tools, starts infrastructure, installs dependencies
make setup

# Start API + Worker (requires infrastructure running)
make dev

# In a separate terminal: start the frontend
make frontend
```

Copy `frontend/.env.local.example` to `frontend/.env.local` if you use `npm run dev` (API URL must include `/api/v1`). `make setup` creates a sensible default when the example file is present.

Open:
- **Frontend**: `http://localhost:3000`
- **API health**: `http://localhost:8080/api/v1/health`

### Start Full Stack in One Command

```bash
make run
```

This starts infrastructure, API, Worker, and Frontend together.

### Full Stack in Docker (API + Worker + Frontend + data services)

From the repository root, create a root **`.env`** once (`cp .env.example .env`) so Compose can load secrets for the API and worker. Then:

```bash
docker compose up -d --build
```

- **Frontend**: http://localhost:3000 (built with local dev headers; no Clerk key required)
- **API**: http://localhost:8080/api/v1/health
- **MinIO console**: http://localhost:9001 (default `minioadmin` / `minioadmin`)

Stop containers (keeps volumes): `docker compose down`.

---

## Useful Commands

```bash
# Infrastructure
make docker-up           # Start Postgres, ClickHouse, NATS, Redis, MinIO
make docker-down         # Stop all Docker services
make check-services      # Verify all services are healthy

# Database
make db-setup            # Full database initialisation (docker-up + migrate + ch-init + dev tenant seed)
make seed-dev-tenant     # Idempotent dev tenant row (for older Postgres volumes)

# Tests
make test                # Backend unit + integration tests (with race detector)
make test-integration    # Integration tests only
make test-frontend       # Frontend Vitest suite
make test-all            # Everything
make test-coverage       # Generate HTML coverage report (backend/coverage.html)

# Quality
make lint                # go vet + go fmt (backend) + ESLint (frontend)

# Build
make build               # Compile API and Worker binaries
```

---

## Configuration

The backend loads from environment variables (`.env` if present) with sensible local defaults.

### Backend

| Variable | Description | Default |
|---|---|---|
| `API_PORT` | API listen port | `8080` |
| `ENVIRONMENT` | Runtime environment | `development` |
| `LOG_LEVEL` | Log level (`debug`, `info`, `warn`, `error`) | `info` |
| `POSTGRES_URL` | PostgreSQL DSN | `postgres://remedyiq:remedyiq@localhost:5432/remedyiq?sslmode=disable` |
| `CLICKHOUSE_URL` | ClickHouse connection URL | `clickhouse://localhost:9004/remedyiq` |
| `NATS_URL` | NATS URL | `nats://localhost:4222` |
| `REDIS_URL` | Redis URL | `redis://localhost:6379` |
| `S3_ENDPOINT` | MinIO / S3 endpoint | `http://localhost:9002` |
| `S3_ACCESS_KEY` | S3 access key | `minioadmin` |
| `S3_SECRET_KEY` | S3 secret key | `minioadmin` |
| `S3_BUCKET` | Bucket for log files and artifacts | `remedyiq-logs` |
| `JAR_PATH` | Path to ARLogAnalyzer.jar | `../ARLogAnalyzer/ARLogAnalyzer-3/ARLogAnalyzer.jar` |
| `JAR_DEFAULT_HEAP_MB` | JVM heap allocation for JAR (MB) | `4096` |
| `JAR_TIMEOUT_SEC` | JAR analysis timeout (seconds) | `1800` |
| `BLEVE_PATH` | Bleve index storage directory | `./data/bleve` |
| `CLERK_SECRET_KEY` | Clerk JWT signing secret (required when `ENVIRONMENT` is not `development`) | — |
| `CORS_ORIGINS` | Comma-separated browser origins (no `*` outside `development`) | `*` in dev if unset |
| `GOOGLE_API_KEY` | Gemini API key (streaming AI) | — |
| `GOOGLE_MODEL` | Gemini model override | `gemini-2.5-flash` |
| `ANTHROPIC_API_KEY` | Anthropic API key (non-streaming paths) | — |

### Frontend

See `frontend/.env.local.example`. Typical local file:

```bash
NEXT_PUBLIC_API_URL=http://localhost:8080/api/v1
NEXT_PUBLIC_DEV_MODE=true
NEXT_PUBLIC_DEV_USER_ID=00000000-0000-0000-0000-000000000001
NEXT_PUBLIC_DEV_TENANT_ID=00000000-0000-0000-0000-000000000001
# NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...   # omit or set for Clerk sign-in
```

### Authentication

**Production / staging** — Use [Clerk](https://clerk.com). Configure a session token template with claim **`internal_tenant_id`** (UUID equal to `tenants.id` in Postgres). Set `CLERK_SECRET_KEY` (API) and `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (frontend). Outside `development`, the API requires `CORS_ORIGINS` and a non-wildcard allow list.

**Local header-auth** — When `ENVIRONMENT=development`, the API accepts dev headers (tenant UUID must exist in Postgres; migrations seed a dev tenant). The UI treats **header-auth mode** as `NEXT_PUBLIC_DEV_MODE=true` **or** an unset `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`: it skips Clerk, injects `X-Dev-User-ID` / `X-Dev-Tenant-Id` on API calls, and shows a **“Local development”** panel in the sidebar instead of Sign in.

WebSocket dev bypass: append `?token=dev` when not using Clerk (see `AGENTS.md`).

### CI and Deployment Workflows

GitHub Actions CI runs automatically for pull requests and stays local-development friendly. The AWS-backed `Deploy` workflow is manual-only via `workflow_dispatch` and should be triggered only in repositories or environments that have the required AWS credentials and repository variables configured.

---

## API Reference

All routes are prefixed `/api/v1`.

### Health
```
GET  /api/v1/health
HEAD /api/v1/health
```

### Files
```
POST /files/upload
GET  /files
```

### Analysis Jobs
```
POST /analysis
GET  /analysis
GET  /analysis/{job_id}
GET  /analysis/{job_id}/dashboard
GET  /analysis/{job_id}/dashboard/aggregates
GET  /analysis/{job_id}/dashboard/exceptions
GET  /analysis/{job_id}/dashboard/gaps
GET  /analysis/{job_id}/dashboard/threads
GET  /analysis/{job_id}/dashboard/filters
GET  /analysis/{job_id}/search
GET  /analysis/{job_id}/search/export
GET  /analysis/{job_id}/entries/{entry_id}
GET  /analysis/{job_id}/entries/{entry_id}/context
POST /analysis/{job_id}/report
```

### Traces
```
GET  /analysis/{job_id}/transactions
GET  /analysis/{job_id}/trace/{trace_id}
GET  /analysis/{job_id}/trace/{trace_id}/waterfall
GET  /analysis/{job_id}/trace/{trace_id}/export
POST /analysis/{job_id}/trace/ai-analyze
GET  /trace/recent
```

### AI & Conversations
```
POST /ai/stream                    (SSE)
GET  /ai/skills
GET  /ai/conversations
POST /ai/conversations
GET  /ai/conversations/{id}
DELETE /ai/conversations/{id}
POST /analysis/{job_id}/ai
```

### Search Utilities
```
GET  /search/autocomplete
GET  /search/saved
POST /search/saved
DELETE /search/saved/{search_id}
GET  /search/history
```

### Streaming
```
GET  /ws                           (WebSocket — job status events)
```

---

## Repository Layout

```
.
├── backend/
│   ├── cmd/              # API and Worker entrypoints
│   ├── internal/         # Domain, handlers, storage, worker pipeline, AI skills
│   ├── migrations/       # PostgreSQL and ClickHouse schema files
│   └── testdata/         # Log fixtures for integration tests
├── frontend/
│   └── src/              # Next.js app, components, hooks, API client
├── helm/                 # Helm charts for EKS deployment
├── docs/                 # Architecture docs, design plans, screenshots
├── scripts/              # Local setup utilities (`setup.sh`, `seed_dev_tenant.sql`)
├── docker-compose.yml    # Local stack: data services + API + worker + frontend
└── Makefile              # Primary developer workflow commands
```

---

## Contributing

1. Branch from `main`.
2. Implement your change with tests (`make test`).
3. Run `make lint` before opening a PR.
4. Open a pull request with a concise description and validation notes.

For code style, naming conventions, and agent development standards, see [`AGENTS.md`](./AGENTS.md).

---

## License

MIT. See [`LICENSE`](./LICENSE).

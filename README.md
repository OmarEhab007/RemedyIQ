# RemedyIQ

Enterprise log intelligence platform for BMC Remedy AR Server.

RemedyIQ ingests AR logs, parses and indexes entries, and provides dashboards, search, tracing, and AI-assisted analysis for faster troubleshooting and root-cause investigation.

## Overview

RemedyIQ is designed for high-volume AR environments where raw log files are difficult to analyze quickly. The platform provides:

- Structured ingestion and analysis of AR log files
- Operational dashboard with health, exceptions, gaps, threads, and filter metrics
- KQL-based log exploration with export support
- Transaction tracing and waterfall visualization
- AI assistant with skill-based routing and streaming responses (SSE)

## Architecture

### Services

- **Frontend**: Next.js 16 + React 19 application
- **API**: Go service exposing REST + SSE + WebSocket endpoints
- **Worker**: Go service that processes queued analysis jobs
- **Infrastructure**: PostgreSQL, ClickHouse, NATS JetStream, Redis, MinIO

### Data Responsibilities

- **PostgreSQL**: metadata (files, jobs, conversations, saved searches)
- **ClickHouse**: parsed log events and analytics queries
- **NATS JetStream**: job queue and async processing coordination
- **Redis**: caching and transient query/report state
- **MinIO (S3-compatible)**: uploaded files and generated artifacts

## Key Features

- File upload and analysis job orchestration
- Multi-section analysis dashboard:
  - health scoring
  - aggregates
  - exception insights
  - gap analysis
  - thread utilization
  - filter complexity
- KQL search with autocomplete, saved searches, and history
- Entry context retrieval and export (CSV/JSON)
- Trace search, waterfall, and trace export
- AI analysis modes:
  - `performance`
  - `root_cause`
  - `error_explainer`
  - `anomaly_narrator`
  - `summarizer`
  - `nl_query`
- AI conversation management and SSE streaming

## Tech Stack

- **Backend**: Go 1.24, `gorilla/mux`, `pgx/v5`, `clickhouse-go/v2`, `go-redis/v9`, `nats.go`, `bleve/v2`
- **AI**:
  - Streaming: Google Gemini (`google.golang.org/genai`)
  - Legacy/non-stream paths: Anthropic SDK (`anthropic-sdk-go`)
- **Frontend**: Next.js 16, React 19, TypeScript, Tailwind, Recharts, streamdown

## Getting Started

### Prerequisites

- Go `>= 1.24`
- Node.js `>= 20`
- Docker + Docker Compose
- Java (optional but recommended for ARLogAnalyzer JAR path)

### Quick Start

```bash
git clone https://github.com/OmarEhab007/RemedyIQ.git
cd RemedyIQ

# One-time setup (checks tools, starts infra, installs deps)
make setup

# Start API + Worker (requires infrastructure up)
make dev

# Start frontend in another terminal
make frontend
```

Open:

- Frontend: `http://localhost:3000`
- API Health: `http://localhost:8080/api/v1/health`

### Alternative: Start Full Stack

```bash
make run
```

This starts infrastructure plus API, Worker, and Frontend together.

## Useful Commands

```bash
# Infrastructure
make docker-up
make docker-down
make check-services

# Database init
make db-setup

# Tests
make test
make test-integration
make test-frontend
make test-all

# Coverage
make test-coverage

# Quality
make lint

# Build
make build
```

## Configuration

The backend loads environment variables from `.env` (if present) and has sensible local defaults.

### Core Backend Variables

| Variable | Description | Default |
|---|---|---|
| `API_PORT` | API listen port | `8080` |
| `ENVIRONMENT` | Runtime environment | `development` |
| `LOG_LEVEL` | Logger level (`debug`,`info`,`warn`,`error`) | `info` |
| `POSTGRES_URL` | PostgreSQL DSN | `postgres://remedyiq:remedyiq@localhost:5432/remedyiq?sslmode=disable` |
| `CLICKHOUSE_URL` | ClickHouse connection URL | `clickhouse://localhost:9004/remedyiq` |
| `NATS_URL` | NATS URL | `nats://localhost:4222` |
| `REDIS_URL` | Redis URL | `redis://localhost:6379` |
| `S3_ENDPOINT` | MinIO/S3 endpoint | `http://localhost:9002` |
| `S3_ACCESS_KEY` | S3 access key | `minioadmin` |
| `S3_SECRET_KEY` | S3 secret key | `minioadmin` |
| `S3_BUCKET` | Bucket for log objects | `remedyiq-logs` |
| `S3_USE_SSL` | Enable TLS for S3 endpoint | `false` |
| `S3_SKIP_BUCKET_VERIFICATION` | Skip bucket existence check | `true` |
| `JAR_PATH` | ARLogAnalyzer JAR path | `../ARLogAnalyzer/ARLogAnalyzer-3/ARLogAnalyzer.jar` |
| `JAR_DEFAULT_HEAP_MB` | JAR JVM heap size (MB) | `4096` |
| `JAR_TIMEOUT_SEC` | JAR analysis timeout (sec) | `1800` |
| `BLEVE_PATH` | Bleve index storage path | `./data/bleve` |
| `CLERK_SECRET_KEY` | Clerk JWT signing secret | empty |
| `ANTHROPIC_API_KEY` | Anthropic API key (legacy/non-stream) | empty |
| `GOOGLE_API_KEY` | Gemini API key (SSE streaming) | empty |
| `GOOGLE_MODEL` | Gemini model override | `gemini-2.5-flash` |

### Frontend Variables

Create `frontend/.env.local` and set:

```bash
NEXT_PUBLIC_API_URL=http://localhost:8080/api/v1
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
```

## Development Authentication Mode

In local development (`ENVIRONMENT=development`), the API accepts dev bypass headers:

- `X-Dev-User-ID`
- `X-Dev-Tenant-ID`

The frontend sends these automatically when no auth token is provided (unless `NEXT_PUBLIC_DEV_MODE=false`).

## API Reference (Core Routes)

All routes are under `/api/v1`.

### Health

- `GET /health`

### Files

- `POST /files/upload`
- `GET /files`

### Analysis

- `POST /analysis`
- `GET /analysis`
- `GET /analysis/{job_id}`
- `GET /analysis/{job_id}/dashboard`
- `GET /analysis/{job_id}/dashboard/aggregates`
- `GET /analysis/{job_id}/dashboard/exceptions`
- `GET /analysis/{job_id}/dashboard/gaps`
- `GET /analysis/{job_id}/dashboard/threads`
- `GET /analysis/{job_id}/dashboard/filters`
- `GET /analysis/{job_id}/search`
- `GET /analysis/{job_id}/search/export`
- `GET /analysis/{job_id}/entries/{entry_id}`
- `GET /analysis/{job_id}/entries/{entry_id}/context`
- `POST /analysis/{job_id}/report`

### Trace

- `GET /analysis/{job_id}/trace/{trace_id}`
- `GET /analysis/{job_id}/trace/{trace_id}/waterfall`
- `GET /analysis/{job_id}/trace/{trace_id}/export`
- `POST /analysis/{job_id}/trace/ai-analyze`
- `GET /analysis/{job_id}/transactions`
- `GET /trace/recent`

### AI

- `POST /analysis/{job_id}/ai`
- `POST /ai/stream` (SSE)
- `GET /ai/skills`
- `GET /ai/conversations`
- `POST /ai/conversations`
- `GET /ai/conversations/{id}`
- `DELETE /ai/conversations/{id}`

### Search Utilities

- `GET /search/autocomplete`
- `GET /search/saved`
- `POST /search/saved`
- `DELETE /search/saved/{search_id}`
- `GET /search/history`

### Streaming

- `GET /ws` (WebSocket)

## Repository Layout

```text
.
├── backend/
│   ├── cmd/                 # API and Worker entrypoints
│   ├── internal/            # Domain, handlers, storage, worker pipeline, AI
│   ├── migrations/          # PostgreSQL + ClickHouse schema setup
│   └── testdata/            # Log fixtures
├── frontend/
│   └── src/                 # Next.js app, components, hooks, client libs
├── docs/                    # Screenshots and architecture/design docs
├── scripts/                 # Local setup utilities
├── docker-compose.yml       # Local infrastructure services
└── Makefile                 # Primary developer workflow commands
```

## Screenshots

- Dashboard: `docs/screenshots/dashboard.png`
- Log Explorer: `docs/screenshots/explorer.png`
- Analysis Detail: `docs/screenshots/analysis-detail.png`
- AI Insights: `docs/screenshots/ai-insights.png`

## Contributing

1. Create a branch from `main`.
2. Implement your change with tests.
3. Run `make test` (and relevant frontend tests).
4. Open a pull request with a concise description and validation notes.

For development standards and conventions, see `AGENTS.md`.

## License

MIT. See `LICENSE`.

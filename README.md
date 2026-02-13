# RemedyIQ

> AI-Powered BMC Remedy AR Server Log Analysis Platform

[![Go Version](https://img.shields.io/badge/Go-1.24+-00ADD8?style=flat&logo=go)](https://golang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-16.1-black?style=flat&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5+-3178C6?style=flat&logo=typescript)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

---

## Overview

RemedyIQ is a modern, cloud-native platform for analyzing BMC Remedy AR Server logs. It transforms raw log files into actionable insights through:

- **AI-Powered Analysis**: Ask natural language questions about your logs and get instant answers
- **Comprehensive Dashboard**: 10 analysis sections with real-time visualizations of API, SQL, Filter, and Escalation performance
- **Performance Aggregates**: Grouped statistics by form, user, table with sortable columns and grand totals
- **Exception Tracking**: Complete error analysis with per-log-type error rates, grouped by error code with sample context
- **Gap Analysis**: Detect log silence periods, thread gaps, and system hangs with critical gap highlighting
- **Thread Statistics**: Per-thread utilization metrics with busy percentage calculations and warning indicators
- **Filter Complexity**: Most-executed filters ranked by count and per-transaction filter metrics
- **Health Scoring**: Composite 0-100 health score with factor breakdown (Error Rate, Response Time, Saturation, Gaps)
- **Enhanced Visualizations**: Time-series charts with duration/error overlays, distribution charts with dimension switching
- **Multi-Tenant SaaS**: Built for organizations with secure data isolation via PostgreSQL RLS
- **Lightning-Fast Search**: KQL-style search across millions of log entries in seconds

Designed as a modern replacement for the legacy ARLogAnalyzer CLI tool, RemedyIQ provides a web-based interface with significantly enhanced capabilities.

---

## What's New (Latest Release)

The latest release delivers a complete dashboard experience with **5 new backend endpoints** and **6 new frontend sections**, plus enhanced visualizations and AI skills hardening:

### New Backend Endpoints
- **`/api/v1/analysis/:id/aggregates`** - Performance aggregates grouped by form, user, and table
- **`/api/v1/analysis/:id/exceptions`** - Exception reports grouped by error code with per-log-type error rates
- **`/api/v1/analysis/:id/gaps`** - Line gaps and thread gaps analysis with queue health
- **`/api/v1/analysis/:id/threads`** - Per-thread statistics with busy percentage calculations
- **`/api/v1/analysis/:id/filters`** - Filter complexity metrics (most-executed, per-transaction)

### New Frontend Sections
- **Health Score Card** - 0-100 composite score with color-coded status and factor breakdown
- **Aggregates Section** - Tabbed interface (API by Form, API by User, SQL by Table) with sortable columns
- **Exceptions Section** - Error rate badges, expandable exception list, log-type filtering
- **Gaps Section** - Line gaps and thread gaps with critical gap highlighting (>60s)
- **Threads Section** - Thread table with busy% color bars and 90% warning indicators
- **Filters Section** - Most-executed filters and per-transaction metrics with sortable tables

### Enhanced Features
- **Top-N Tables** - Type-specific columns, expandable detail rows, "View in Explorer" links
- **Time-Series Charts** - Toggleable duration overlay, error count overlay, click-and-drag zoom
- **Distribution Charts** - Switchable grouping dimensions (type, queue, form, user, table)
- **AI Skills** - Hardened implementations with proper error handling and fallbacks
- **Performance** - Lazy-loaded dashboard sections with 5-minute Redis cache TTL

---

## Table of Contents

- [Overview](#overview)
- [What's New (Latest Release)](#whats-new-latest-release)
- [Architecture](#architecture)
- [Technology Stack](#technology-stack)
- [Features](#features)
- [Quick Start](#quick-start)
- [Development Guide](#development-guide)
- [API Documentation](#api-documentation)
- [Deployment](#deployment)
- [Performance Benchmarks](#performance-benchmarks)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)
- [Acknowledgments](#acknowledgments)
- [Support](#support)

---

## Architecture

RemedyIQ follows a clean, microservices-inspired architecture with clear separation of concerns:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Frontend (Next.js)                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────────┐   │
│  │  Auth    │  │ Dashboard│  │  Search  │  │    AI Chat Panel     │   │
│  │ (Clerk)  │  │  (10 sections)│   │ (Bleve) │  │   (Claude API)       │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────────────┘   │
│  Health Score • Aggregates • Exceptions • Gaps • Threads • Filters      │
└─────────────────────────────────────────────────────────────────────────┘
                                   ▲
                                   │ HTTP/HTTPS + WebSocket
                                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           API Layer (Go)                                 │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │              Gorilla Mux Router + Auth Middleware               │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                │                                        │
│  ┌─────────────────────────────┼─────────────────────────────────────┐ │
│  │                             │                                     │ │
│  ▼                             ▼                                     ▼ │
│ ┌──────────┐              ┌──────────┐                        ┌──────────┐│
│ │ Handlers│              │Streaming │                        │  Queue   ││
│ │  (10+)   │              │(WebSocket)│                        │  (NATS)  ││
│ └──────────┘              └──────────┘                        └──────────┘│
└─────────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        Business Logic Layer                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────────┐   │
│  │ Tenant   │  │   Job    │  │   AI     │  │   Search Engine      │   │
│  │ Isolation│  │Orchestrator│  │  Skills  │  │      (Bleve)         │   │
│  │   (RLS)  │  │           │  │   (6+)    │  │                      │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          Storage Layer                                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌───────────────┐  │
│  │ PostgreSQL  │  │ ClickHouse  │  │   Redis     │  │  MinIO / S3   │  │
│  │ (Metadata)  │  │ (Log Data   │  │   (Cache)   │  │  (Raw Files)  │  │
│  │ + RLS       │  │ + MVs)      │  │   (5min)    │  │               │  │
│  └─────────────┘  └─────────────┘  └─────────────┘  └───────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

### Key Design Principles

- **Tenant Isolation**: All data is scoped by tenant at every layer (PostgreSQL RLS, ClickHouse partitions, Redis prefixes, S3 paths)
- **Event-Driven**: NATS JetStream for async job processing with guaranteed delivery
- **Scalable Storage**: ClickHouse for time-series analytics, PostgreSQL for relational data
- **Graceful Degradation**: AI features fail silently to keyword search when API is unavailable

For detailed architecture diagrams, see [docs/diagrams/architecture.md](docs/diagrams/architecture.md).

---

## Technology Stack

### Backend

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Language | Go 1.24+ | High-performance, concurrent processing |
| Framework | Gorilla Mux | HTTP routing and middleware |
| Database | PostgreSQL + pgx/v5 | Metadata, tenant management, RLS |
| Analytics DB | ClickHouse + go-clickhouse/v2 | Time-series log storage with materialized views |
| Cache | Redis + go-redis/v9 | Response caching, rate limiting |
| Message Queue | NATS + nats.go | Job queue, pub/sub with JetStream |
| Object Storage | MinIO / AWS S3 v2 | Raw log file storage |
| Full-text Search | Bleve | Semantic log search and indexing |
| AI/LLM | Anthropic Claude API | Natural language queries, summarization |
| Log Parser | ARLogAnalyzer.jar (subprocess) | BMC Remedy log parsing |

### Frontend

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Framework | Next.js 16.1 + React 19 | SSR, API routes, routing |
| Language | TypeScript 5+ | Type safety |
| UI Library | shadcn/ui + Radix UI | Accessible components |
| Styling | Tailwind CSS 4 | Utility-first CSS |
| Charts | Recharts + D3.js | Data visualization |
| Virtualization | react-window | Large dataset rendering |
| Auth | Clerk Next.js SDK | Multi-tenant authentication |
| State | React Context + Hooks | Local state management |

### Infrastructure

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Containerization | Docker + Docker Compose | Local development |
| Build Tool | GNU Make | Build automation |
| Testing | Go test + ESLint + TypeScript | Test coverage and linting |
| CI/CD | GitHub Actions (planned) | Continuous integration |

### Frontend

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Framework | Next.js 15 + React 19 | SSR, API routes, routing |
| Language | TypeScript 5+ | Type safety |
| UI Library | shadcn/ui + Radix UI | Accessible components |
| Styling | Tailwind CSS 4 | Utility-first CSS |
| Charts | Recharts + D3.js | Data visualization |
| Auth | Clerk Next.js SDK | Multi-tenant authentication |
| State | React Context + Hooks | Local state management |

### Infrastructure

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Containerization | Docker + Docker Compose | Local development |
| Build Tool | GNU Make | Build automation |

---

## Features

### 1. Log Upload & Parsing

- Drag-and-drop file upload supporting up to 2GB log files
- Multi-part upload with resumable support for large files
- Automatic log type detection (API, SQL, Filter, Escalation)
- Legacy JAR-based parsing with configurable JVM settings
- Progress tracking via WebSocket (queued → parsing → analyzing → storing → complete)

### 2. Comprehensive Analysis Dashboard

**Health Score (0-100)**
- Composite health assessment with color-coded status (green >80, yellow 50-80, red <50)
- Factor breakdown: Error Rate, Average Response Time, Thread Saturation, Gap Frequency
- Severity indicators with explanatory descriptions

**General Statistics**
- Real-time statistics cards (total entries, API/SQL/Filter/Escalation counts, duration)
- Unique counts for users, forms, tables, and queues
- Log duration with start/end timestamps

**Performance Aggregates**
- Tabbed interface: API by Form, API by User, SQL by Table
- Sortable columns (count, MIN/MAX/AVG/SUM duration, error rate, unique traces)
- Grand total rows with aggregate statistics

**Exception & Error Reports**
- Grouped by error code with occurrence count and first/last seen timestamps
- Per-log-type error rates (API, SQL, Filter, Escalation)
- Sample context including line number, trace ID, queue, form, and user
- Top error codes summary bar

**Gap Analysis**
- Line gaps and thread gaps with top 50 longest periods
- Gap duration with appropriate units (ms, seconds, minutes)
- Critical gap highlighting (>60 seconds marked as severe)
- Timeline overlay for visual gap detection

**Thread Statistics**
- Per-thread utilization metrics (total calls, duration stats, error count, busy percentage)
- Active time range per thread
- Visual warning indicators for threads exceeding 90% busy

**Filter Complexity**
- Most-executed filters ranked by count with total execution time
- Per-transaction filter metrics (execution count, total/avg/max time)
- Total filter processing time summary

**Top-N Slowest Operations**
- Type-specific columns: SQL statement preview, filter name/level, escalation pool/delay
- Queue wait time for all operation types
- Expandable detail rows with full context (trace ID, RPC ID, all fields)
- "View in Explorer" links for direct log navigation

**Enhanced Time-Series Charts**
- Operation volume over time with toggleable overlays
- Average duration line on secondary Y-axis
- Error count shaded overlay
- Click-and-drag zoom functionality

**Enhanced Distribution Charts**
- Switchable grouping dimensions: by type, queue, form, user, table
- Configurable top-N categories (5, 10, 15, 25, 50)

### 3. Advanced Search

- KQL-style query syntax with field autocomplete
- Boolean operators: `AND`, `OR`, `NOT`
- Range queries: `duration:>1000`, `timestamp:>2024-01-01`
- Wildcard matching: `form:HPD:*`, `queue:admin*`
- Sub-2 second response times for millions of entries

### 4. AI-Powered Insights

- Natural language queries: "Show me slow API calls yesterday"
- Explain errors and anomalies with context
- Root cause analysis suggestions
- Log line references as clickable evidence
- Confidence scores and suggested follow-up questions
- Executive summaries for completed analyses

### 5. Transaction Tracing

- Visual timeline of complete request flows
- Cross-log correlation (API → Filter → SQL → Escalation)
- Trace ID support for AR 19.x+
- RPC ID fallback for earlier versions

### 6. Multi-Tenant SaaS

- Organization-level data isolation
- Quota management per tenant
- Role-based access control via Clerk
- Dedicated storage prefixes
- Redis caching with 5-minute TTL for performance

---

## Quick Start

### Prerequisites

- Go 1.24 or higher
- Node.js 20 or higher
- Docker and Docker Compose

### 5-Minute Setup

```bash
# 1. Clone the repository
git clone https://github.com/OmarEhab007/RemedyIQ.git
cd RemedyIQ

# 2. Start infrastructure services (Postgres, ClickHouse, NATS, Redis, MinIO)
make docker-up

# 3. Set up databases (run migrations + initialize ClickHouse)
make db-setup

# 4. Install dependencies
make deps

# 5. Start the API and Worker (in one terminal)
make dev

# 6. In another terminal, start the frontend
cd frontend && npm install && npm run dev
```

### Access Points

| Service | URL | Credentials |
|---------|-----|-------------|
| Frontend | http://localhost:3000 | Clerk Auth |
| API | http://localhost:8080 | - |
| API Docs (OpenAPI) | http://localhost:8080/api/v1/docs | - |
| NATS Monitor | http://localhost:8222 | - |
| MinIO Console | http://localhost:9001 | admin/password |
| PostgreSQL | localhost:5432 | remedyiq/remedyiq |
| ClickHouse HTTP | http://localhost:8123 | - |

### Testing

```bash
# Run all tests with race detection and coverage
make test

# Generate HTML coverage report
make test-coverage
# View at backend/coverage.html

# Run linter
make lint
```

---

## Development Guide

### Project Structure

```
RemedyIQ/
├── backend/                 # Go backend services
│   ├── cmd/
│   │   ├── api/            # API server entry point
│   │   └── worker/         # Background worker entry point
│   ├── internal/
│   │   ├── ai/             # AI skill orchestration
│   │   ├── api/            # HTTP handlers and middleware
│   │   ├── config/         # Configuration loading
│   │   ├── domain/         # Domain models and interfaces
│   │   ├── jar/            # ARLogAnalyzer.jar wrapper
│   │   ├── search/         # Bleve search engine
│   │   ├── storage/        # Database repositories (Postgres, ClickHouse)
│   │   ├── streaming/      # WebSocket handlers
│   │   └── worker/         # Job processing logic
│   ├── migrations/         # SQL and ClickHouse migrations
│   └── testdata/           # Test fixtures
├── frontend/                # Next.js frontend
│   ├── src/
│   │   ├── app/            # Next.js App Router pages
│   │   ├── components/     # React components
│   │   ├── hooks/          # Custom React hooks
│   │   └── lib/            # API clients and utilities
│   └── public/             # Static assets
├── docs/                   # Documentation
│   └── diagrams/           # Architecture diagrams
├── legacy/                 # Legacy tools (archived)
│   └── webTemplates/       # Original ARLogAnalyzer HTML templates
├── specs/                  # Feature specifications
│   ├── 001-remedyiq-mvp/   # MVP feature specs
│   └── 002-local-dev-setup/# Local development setup
├── AGENTS.md               # AI agent development guide
├── Makefile                # Build automation
└── README.md               # This file
```

### Backend Development

```bash
# Run API server with live reload
cd backend && go run ./cmd/api/...

# Run worker with live reload
cd backend && go run ./cmd/worker/...

# Run a specific test
cd backend && go test -v -run TestPostgres_Ping ./internal/storage/

# Run tests for a package
cd backend && go test -v ./internal/storage/

# Run tests with coverage
cd backend && go test -race -coverprofile=coverage.out ./...
go tool cover -html=coverage.out

# Format and vet
cd backend && go fmt ./... && go vet ./...
```

### Frontend Development

```bash
cd frontend

# Start dev server
npm run dev

# Production build
npm run build

# Start production server
npm start

# Lint code
npm run lint
```

### Code Style

**Go:**
- Standard library imports first, then external, then internal (alphabetical)
- Exported types/functions: PascalCase
- Unexported: camelCase
- Error wrapping: `fmt.Errorf("prefix: %w", err)`
- Logging: `log/slog` with structured fields
- Testing: `require` for critical assertions, `assert` for checks

**TypeScript:**
- Strict mode enabled
- Components use `"use client"` directive
- Imports: `@/` alias for internal modules
- Styling: Tailwind CSS utility classes with semantic color tokens

See [AGENTS.md](AGENTS.md) for detailed coding standards.

---

## API Documentation

### REST API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/logs/upload` | Upload log file |
| `GET` | `/api/v1/jobs/:id` | Get job status |
| `GET` | `/api/v1/jobs` | List all jobs |
| `GET` | `/api/v1/search` | Search log entries |
| `POST` | `/api/v1/ai/query` | AI-powered query |
| `GET` | `/api/v1/analysis/:id/dashboard` | Dashboard statistics (includes health score) |
| `GET` | `/api/v1/analysis/:id/aggregates` | Performance aggregates (by form, user, table) |
| `GET` | `/api/v1/analysis/:id/exceptions` | Exception and error reports |
| `GET` | `/api/v1/analysis/:id/gaps` | Gap analysis (line gaps, thread gaps) |
| `GET` | `/api/v1/analysis/:id/threads` | Thread statistics and utilization |
| `GET` | `/api/v1/analysis/:id/filters` | Filter complexity metrics |
| `GET` | `/api/v1/trace/:id` | Get transaction trace |
| `GET` | `/api/v1/stream` | WebSocket connection for real-time updates |
| `GET` | `/api/v1/report/:id` | Generate analysis report |
| `GET` | `/api/v1/health` | Health check endpoint |

### WebSocket Events

**Server → Client:**
- `job.progress`: Update job progress percentage
- `job.completed`: Notify job completion
- `log.tail`: Real-time log entry (during parsing)

**Client → Server:**
- `job.subscribe`: Subscribe to job updates
- `job.unsubscribe`: Unsubscribe from updates

### API Examples

#### Upload a Log File

```bash
curl -X POST http://localhost:8080/api/v1/logs/upload \
  -H "Authorization: Bearer <token>" \
  -F "file=@arapi.log" \
  -F "log_type=api"
```

#### Search Log Entries

```bash
curl -X GET "http://localhost:8080/api/v1/search?q=type:API%20AND%20duration:>1000&limit=100" \
  -H "Authorization: Bearer <token>"
```

#### AI Query

```bash
curl -X POST http://localhost:8080/api/v1/ai/query \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"query": "Show me the slowest API calls and what caused them"}'
```

---

## Deployment

### Docker Compose (Production-ready)

```bash
# Build Docker images
make docker-build

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `POSTGRES_HOST` | PostgreSQL host | localhost |
| `POSTGRES_PORT` | PostgreSQL port | 5432 |
| `POSTGRES_USER` | PostgreSQL user | remedyiq |
| `POSTGRES_PASSWORD` | PostgreSQL password | remedyiq |
| `POSTGRES_DB` | PostgreSQL database | remedyiq |
| `CLICKHOUSE_HOST` | ClickHouse host | localhost |
| `CLICKHOUSE_PORT` | ClickHouse port | 9000 |
| `REDIS_HOST` | Redis host | localhost |
| `REDIS_PORT` | Redis port | 6379 |
| `NATS_URL` | NATS connection URL | nats://localhost:4222 |
| `S3_ENDPOINT` | S3/MinIO endpoint | http://localhost:9002 |
| `S3_ACCESS_KEY` | S3 access key | minioadmin |
| `S3_SECRET_KEY` | S3 secret key | minioadmin |
| `S3_BUCKET` | S3 bucket name | remedyiq-logs |
| `CLAUDE_API_KEY` | Anthropic API key | - |
| `CLERK_SECRET_KEY` | Clerk secret key | - |
| `CLERK_PUBLISHABLE_KEY` | Clerk publishable key | - |

---

## Performance Benchmarks

| Metric | Target | Achieved |
|--------|--------|----------|
| Upload 500MB file | < 5 min | ✓ |
| Parse 10M log entries | < 2 min | ✓ |
| Search 10M entries | < 2 sec | ✓ |
| AI query response | < 10 sec | ✓ |
| WebSocket latency | < 500 ms | ✓ |
| Dashboard initial load | < 3 sec | ✓ |
| Lazy section render | < 2 sec | ✓ |
| Aggregates query (1M entries) | < 2 sec | ✓ |
| Exceptions query (1M entries) | < 2 sec | ✓ |
| Gaps analysis (1M entries) | < 2 sec | ✓ |
| Thread stats query (1M entries) | < 2 sec | ✓ |
| Filter complexity query | < 2 sec | ✓ |

---

## Roadmap

### Phase 1: Foundation ✅
- [x] Log parsing and ingestion
- [x] ClickHouse storage with materialized views
- [x] PostgreSQL with RLS for multi-tenant isolation
- [x] NATS JetStream for job queuing
- [x] Redis caching layer
- [x] MinIO/S3 object storage
- [x] Basic dashboard with stats cards
- [x] KQL search with Bleve
- [x] Multi-tenant auth with Clerk
- [x] WebSocket real-time updates

### Phase 2: Complete Dashboard Features ✅
- [x] Performance aggregates (by form, user, table)
- [x] Exception and error reports with error rates
- [x] Gap analysis (line gaps, thread gaps)
- [x] Thread statistics and utilization
- [x] Filter complexity metrics
- [x] Health score computation (0-100 with factor breakdown)
- [x] Enhanced top-N tables with type-specific columns
- [x] Enhanced time-series charts with duration/error overlays and zoom
- [x] Enhanced distribution charts with dimension switching
- [x] AI skills hardening (nl_query, summarizer, anomaly, error_explainer, root_cause, performance)
- [x] Lazy-loaded dashboard sections for performance
- [x] Comprehensive unit and integration tests

### Phase 3: AI & Analysis 🚧
- [ ] AI-powered executive summaries
- [ ] Anomaly detection baselines and alerts
- [ ] Root cause analysis automation
- [ ] Performance trend analysis over time
- [ ] Predictive capacity planning

### Phase 4: Advanced Features 📋
- [ ] Scheduled reports (daily, weekly, monthly)
- [ ] Custom alert rules and notifications
- [ ] ITSM integrations (ServiceNow, Jira, PagerDuty)
- [ ] SLA monitoring and reporting
- [ ] Comparative analysis across time periods

### Phase 5: Scale & Polish 🔮
- [ ] Kubernetes deployment with Helm charts
- [ ] ClickHouse clustering for scalability
- [ ] Advanced caching strategies
- [ ] Performance optimizations (query indexing, partitioning)
- [ ] Internationalization (i18n)
- [ ] Dark mode support
- [ ] Mobile app (React Native)

---

## Contributing

We welcome contributions! Please see [AGENTS.md](AGENTS.md) for detailed coding standards and development guidelines.

### Getting Started with Development

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes following the code style in [AGENTS.md](AGENTS.md)
4. Run tests: `make test`
5. Run linter: `make lint`
6. Commit your changes: `git commit -m "Add feature"`
7. Push to branch: `git push origin feature/my-feature`
8. Open a Pull Request

### Areas for Contribution

- **Frontend**: Enhance dashboard visualizations, add new chart types, improve mobile responsiveness
- **Backend**: Add new analysis endpoints, optimize ClickHouse queries, implement additional AI skills
- **Documentation**: Improve API documentation, write tutorials, add examples
- **Testing**: Increase test coverage, add integration tests, improve test fixtures
- **Performance**: Optimize query performance, improve caching strategies, reduce latency

---

## License

MIT License - see [LICENSE](LICENSE) for details.

---

## Acknowledgments

- **BMC Remedy** - The AR Server platform that generates the logs we analyze
- **ARLogAnalyzer** - The original CLI tool that inspired this project
- **Anthropic** - Claude API for AI-powered analysis
- **Clerk** - Authentication and multi-tenant management

---

## Support

- **Documentation**: [docs/](docs/)
- **Issues**: [GitHub Issues](https://github.com/OmarEhab007/RemedyIQ/issues)
- **Discussions**: [GitHub Discussions](https://github.com/OmarEhab007/RemedyIQ/discussions)

---

Built with ❤️ for BMC Remedy Administrators

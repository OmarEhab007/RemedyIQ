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
- **Real-Time Dashboard**: Interactive visualizations of API, SQL, Filter, and Escalation performance
- **Anomaly Detection**: Automatically identify performance degradation and unusual patterns
- **Multi-Tenant SaaS**: Built for organizations with secure data isolation
- **Lightning-Fast Search**: KQL-style search across millions of log entries in seconds

Designed as a modern replacement for the legacy ARLogAnalyzer CLI tool, RemedyIQ provides a web-based interface with significantly enhanced capabilities.

---

## Table of Contents

- [Architecture](#architecture)
- [Technology Stack](#technology-stack)
- [Features](#features)
- [Quick Start](#quick-start)
- [Development Guide](#development-guide)
- [API Documentation](#api-documentation)
- [Deployment](#deployment)
- [Contributing](#contributing)

---

## Architecture

RemedyIQ follows a clean, microservices-inspired architecture with clear separation of concerns:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Frontend (Next.js)                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────────┐   │
│  │  Auth    │  │ Dashboard│  │  Search  │  │    AI Chat Panel     │   │
│  │ (Clerk)  │  │  (Recharts) │   │ (Bleve) │  │   (Claude API)       │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────────────┘   │
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
│ │  (REST) │              │(WebSocket)│                        │  (NATS)  ││
│ └──────────┘              └──────────┘                        └──────────┘│
└─────────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        Business Logic Layer                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────────┐   │
│  │ Tenant   │  │   Job    │  │   AI     │  │   Search Engine      │   │
│  │ Isolation│  │Orchestrator│  │  Skills  │  │      (Bleve)         │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          Storage Layer                                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌───────────────┐  │
│  │ PostgreSQL  │  │ ClickHouse  │  │   Redis     │  │  MinIO / S3   │  │
│  │ (Metadata)  │  │ (Log Data)  │  │   (Cache)   │  │  (Raw Files)  │  │
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
| Analytics DB | ClickHouse + go-clickhouse/v2 | Time-series log storage |
| Cache | Redis + go-redis/v9 | Session cache, rate limiting |
| Message Queue | NATS + nats.go | Job queue, pub/sub |
| Object Storage | MinIO / AWS S3 v2 | Raw log file storage |
| Full-text Search | Bleve | Semantic log search |
| AI/LLM | Anthropic Claude API | Natural language queries |
| Log Parser | ARLogAnalyzer.jar (subprocess) | BMC Remedy log parsing |

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

### 2. Interactive Dashboard

- Real-time statistics cards (total entries, API/SQL/Filter counts, duration)
- Top-N slowest operations tables
- Time-series charts showing operation volume over time
- Performance metrics by form, table, user, and queue

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

### 5. Transaction Tracing

- Visual timeline of complete request flows
- Cross-log correlation (API → Filter → SQL → Escalation)
- Trace ID support for AR 19.x+
- RPC ID fallback for earlier versions

### 6. Anomaly Detection

- Statistical baselines calculated automatically
- Z-score and IQR-based detection
- Time-series pattern recognition
- Alert grouping and correlation
- AI-powered explanations

### 7. Multi-Tenant SaaS

- Organization-level data isolation
- Quota management per tenant
- Role-based access control via Clerk
- Dedicated storage prefixes

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
| `POST` | `/api/v1/auth/login` | Authenticate user |
| `POST` | `/api/v1/logs/upload` | Upload log file |
| `GET` | `/api/v1/jobs/:id` | Get job status |
| `GET` | `/api/v1/jobs` | List all jobs |
| `GET` | `/api/v1/search` | Search log entries |
| `POST` | `/api/v1/ai/query` | AI-powered query |
| `GET` | `/api/v1/dashboard/stats` | Dashboard statistics |
| `GET` | `/api/v1/trace/:id` | Get transaction trace |

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
| Dashboard load | < 3 sec | ✓ |

---

## Roadmap

### Phase 1: Foundation ✅
- [x] Log parsing and ingestion
- [x] ClickHouse storage
- [x] Basic dashboard
- [x] KQL search
- [x] Multi-tenant auth

### Phase 2: AI & Analysis 🚧
- [ ] AI skill orchestration
- [ ] Anomaly detection
- [ ] Root cause analysis
- [ ] Executive summary reports

### Phase 3: Advanced Features 📋
- [ ] Transaction tracer UI
- [ ] Custom alert rules
- [ ] Scheduled reports
- [ ] ITSM integrations (ServiceNow, Jira)

### Phase 4: Scale & Polish 🔮
- [ ] Kubernetes deployment
- [ ] ClickHouse clustering
- [ ] Advanced caching strategies
- [ ] Performance optimizations

---

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Getting Started with Development

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes following the code style in [AGENTS.md](AGENTS.md)
4. Run tests: `make test`
5. Run linter: `make lint`
6. Commit your changes: `git commit -m "Add feature"`
7. Push to branch: `git push origin feature/my-feature`
8. Open a Pull Request

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

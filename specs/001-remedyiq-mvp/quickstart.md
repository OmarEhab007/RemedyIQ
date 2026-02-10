# RemedyIQ Quickstart Guide

## Prerequisites

- Go 1.22+
- Node.js 20+
- Docker & Docker Compose
- Java 11+ (for ARLogAnalyzer.jar)
- `make` (build automation)

## Quick Start

### 1. Start Infrastructure

```bash
# Start ClickHouse, PostgreSQL, NATS, Redis, MinIO
docker compose up -d

# Verify all services are healthy
docker compose ps
```

Expected services:
| Service | Port | Purpose |
|---------|------|---------|
| PostgreSQL | 5432 | Metadata, auth, jobs |
| ClickHouse | 8123 (HTTP), 9000 (native) | Log entry storage |
| NATS | 4222 (client), 8222 (monitoring) | Message bus |
| Redis | 6379 | Cache, rate limiting |
| MinIO | 9000 (API), 9001 (console) | S3-compatible file storage |

### 2. Initialize Databases

```bash
# Run PostgreSQL migrations
make migrate-up

# Create ClickHouse tables
make ch-init
```

### 3. Start Backend

```bash
# Start API server (port 8080)
make api

# In another terminal, start Worker
make worker
```

Or run both:
```bash
make dev
```

### 4. Start Frontend

```bash
cd frontend
npm install
npm run dev
# → http://localhost:3000
```

### 5. Verify

```bash
# Health check
curl http://localhost:8080/api/v1/health

# Expected: {"status":"healthy","version":"0.1.0"}
```

## Environment Variables

Create `.env` in the project root:

```bash
# Database
POSTGRES_URL=postgres://remedyiq:remedyiq@localhost:5432/remedyiq?sslmode=disable
CLICKHOUSE_URL=clickhouse://localhost:9000/remedyiq

# Message bus
NATS_URL=nats://localhost:4222

# Cache
REDIS_URL=redis://localhost:6379

# File storage
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_BUCKET=remedyiq-logs

# JAR path
JAR_PATH=./ARLogAnalyzer.jar

# AI (optional for development)
ANTHROPIC_API_KEY=sk-ant-...

# Auth (for Clerk)
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
```

## Makefile Targets

```bash
make dev        # Start API + Worker with live reload
make api        # Start API server only
make worker     # Start Worker only
make test       # Run all tests
make lint       # Run linters
make build      # Build production binaries
make migrate-up # Run PostgreSQL migrations
make ch-init    # Initialize ClickHouse schema
make docker     # Build Docker images
make clean      # Clean build artifacts
```

## Testing

```bash
# Run all Go tests
make test

# Run with verbose output
go test -v ./backend/...

# Run specific package tests
go test -v ./backend/internal/jar/...

# Run frontend tests
cd frontend && npm test
```

## Upload & Analyze a Log File

```bash
# 1. Upload a file
curl -X POST http://localhost:8080/api/v1/files/upload \
  -H "Authorization: Bearer <token>" \
  -F "file=@/path/to/arapi.log"

# 2. Start analysis (use file_id from response)
curl -X POST http://localhost:8080/api/v1/analysis \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"file_id": "<file-id>"}'

# 3. Check job progress
curl http://localhost:8080/api/v1/analysis/<job-id> \
  -H "Authorization: Bearer <token>"

# 4. View dashboard
curl http://localhost:8080/api/v1/analysis/<job-id>/dashboard \
  -H "Authorization: Bearer <token>"
```

## Docker Compose Services

The `docker-compose.yml` includes:

```yaml
services:
  postgres:    # PostgreSQL 16 with RLS enabled
  clickhouse:  # ClickHouse for log storage
  nats:        # NATS with JetStream enabled
  redis:       # Redis 7 for caching
  minio:       # S3-compatible storage
```

All data is persisted in Docker volumes. To reset:

```bash
docker compose down -v  # Remove volumes
docker compose up -d    # Fresh start
```

# Local Development Quickstart

## Prerequisites

| Tool | Minimum Version | Check Command | Install |
|------|----------------|---------------|---------|
| Docker Desktop | 4.0+ | `docker --version` | [docker.com](https://www.docker.com/products/docker-desktop/) |
| Docker Compose | 2.0+ | `docker compose version` | Included with Docker Desktop |
| Go | 1.22+ | `go version` | [go.dev](https://go.dev/dl/) |
| Node.js | 20+ | `node --version` | [nodejs.org](https://nodejs.org/) |
| npm | 10+ | `npm --version` | Included with Node.js |
| make | any | `make --version` | Pre-installed on macOS (Xcode CLI tools) |
| Java | 11+ (optional) | `java --version` | [adoptium.net](https://adoptium.net/) — only needed for JAR-based analysis |

## One-Command Setup

```bash
# From repository root:
make setup       # First-time setup (checks prereqs, starts Docker, installs deps)
make run         # Start full stack (infra + API + Worker + Frontend)
```

This script:
1. Checks all prerequisites are installed
2. Detects port conflicts
3. Creates `.env` and `frontend/.env.local` from templates
4. Starts all Docker infrastructure services
5. Waits for health checks to pass
6. Runs database migrations (PostgreSQL + ClickHouse)
7. Installs Go and Node.js dependencies

## Manual Setup (Step by Step)

### 1. Create Environment Files

```bash
# Backend environment (if not already present)
cp .env.example .env

# Frontend environment (if not already present)
cp frontend/.env.local.example frontend/.env.local
```

### 2. Start Infrastructure

```bash
make docker-up
```

Wait for all 5 services to report healthy:
| Service | Host Port | Purpose |
|---------|-----------|---------|
| PostgreSQL | 5432 | Metadata, auth, jobs |
| ClickHouse (HTTP) | 8123 | Log entry queries |
| ClickHouse (Native) | 9004 | Bulk log ingestion |
| NATS | 4222 | Message bus |
| NATS Monitor | 8222 | NATS dashboard |
| Redis | 6379 | Cache, rate limiting |
| MinIO API | 9002 | S3-compatible storage |
| MinIO Console | 9001 | MinIO web UI |

### 3. Database Migrations

Database schemas are **auto-initialized** on first Docker start via `docker-entrypoint-initdb.d` mounts. No manual migration step is needed.

To re-run manually if needed:
```bash
make migrate-up    # PostgreSQL schema
make ch-init       # ClickHouse schema
```

Migrations are idempotent — safe to run multiple times.

### 4. Start Backend

```bash
# Option A: Start both API and Worker
make dev

# Option B: Start individually (separate terminals)
make api      # API server on :8080
make worker   # Worker process
```

### 5. Start Frontend

```bash
cd frontend && npm install && npm run dev
# → http://localhost:3000
```

### 6. Verify

```bash
# Health check endpoint
curl http://localhost:8080/api/v1/health

# Expected: {"status":"healthy","version":"0.1.0"}

# Full service health check
make check-services
```

## Development Mode

### Authentication Bypass

When running without Clerk keys (default for local dev), the system operates in development mode:

**Backend**: Send dev headers with every request:
```bash
curl -H "X-Dev-User-ID: dev-user" \
     -H "X-Dev-Tenant-ID: dev-tenant" \
     http://localhost:8080/api/v1/analysis
```

**Frontend**: Automatically detects missing Clerk keys and renders without authentication. A "DEV MODE" banner is shown.

### AI Features

AI features require an Anthropic API key. Without one:
- The API server starts normally
- AI endpoints return a "not configured" response
- All non-AI features work fully

To enable AI, add to `.env`:
```bash
ANTHROPIC_API_KEY=sk-ant-api03-your-key-here
```

### ARLogAnalyzer.jar

The JAR file is included at the repository root. If Java 11+ is installed, the Worker uses it for log analysis. Without Java, the system falls back to native Go parsers.

## Known Limitations

- **Worker job processing**: The Worker starts and validates connections but does not yet process analysis jobs from the NATS queue. File upload and job creation work, but analysis processing is pending implementation.
- **Frontend Clerk features**: User management, organization switching, and sign-in/sign-up flows are disabled in dev mode.

## Troubleshooting

### Port Conflicts

If Docker services fail to start, check for port conflicts:
```bash
# Check which process is using a port
lsof -i :9000  # Common conflict with macOS AirPlay
lsof -i :5432  # Conflict with local PostgreSQL
```

**macOS AirPlay on port 9000**: ClickHouse native port has been remapped to 9004 to avoid this. If you still see conflicts, disable AirPlay Receiver in System Settings > General > AirDrop & Handoff.

### Docker Resources

ClickHouse and PostgreSQL require adequate memory. Ensure Docker Desktop is configured with at least 4 GB of RAM (Settings > Resources > Memory).

### Resetting Everything

```bash
# Stop all services and remove data
docker compose down -v

# Re-run setup
bash scripts/setup.sh
```

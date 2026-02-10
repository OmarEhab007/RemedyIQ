#!/bin/bash

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$REPO_ROOT"

echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  RemedyIQ Local Development Setup${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
echo ""

# Phase 1: Check prerequisites
echo -e "${YELLOW}[1/8] Checking prerequisites...${NC}"

check_command() {
    if command -v "$1" &> /dev/null; then
        local version
        case "$1" in
            docker) version=$(docker --version 2>/dev/null | head -1) ;;
            go) version=$(go version 2>/dev/null) ;;
            node) version="v$(node --version 2>/dev/null)" ;;
            npm) version="v$(npm --version 2>/dev/null)" ;;
            make) version="installed" ;;
            java) version=$(java -version 2>&1 | head -1) ;;
        esac
        echo -e "  ${GREEN}✓${NC} $1 ($version)"
        return 0
    else
        echo -e "  ${RED}✗${NC} $1 not found"
        return 1
    fi
}

missing=0

check_command docker || missing=1
check_command go || missing=1
check_command node || missing=1
check_command npm || missing=1
check_command make || missing=1

# Java is optional - needed for ARLogAnalyzer.jar
if ! check_command java; then
    echo -e "  ${YELLOW}!${NC} Java is optional (needed for ARLogAnalyzer.jar; Go fallback parser will be used)"
fi

# Check Docker is running
if ! docker info &> /dev/null; then
    echo -e "  ${RED}✗${NC} Docker daemon is not running"
    echo -e "${RED}Error: Please start Docker Desktop and try again.${NC}"
    exit 1
else
    echo -e "  ${GREEN}✓${NC} Docker daemon is running"
fi

if [ "$missing" -eq 1 ]; then
    echo -e "${RED}Error: Missing required tools. Please install them and try again.${NC}"
    echo ""
    echo "Install instructions:"
    echo "  - Docker: https://www.docker.com/products/docker-desktop/"
    echo "  - Go:     https://go.dev/dl/"
    echo "  - Node.js: https://nodejs.org/ (includes npm)"
    echo "  - make:   Pre-installed on macOS (install Xcode CLI tools: xcode-select --install)"
    exit 1
fi

echo ""

# Phase 2: Check for port conflicts
echo -e "${YELLOW}[2/8] Checking for port conflicts...${NC}"

check_port() {
    local port=$1
    local service=$2
    if lsof -Pi :"$port" -sTCP:LISTEN -t &> /dev/null; then
        echo -e "  ${RED}✗${NC} Port $port ($service) is in use"
        return 1
    else
        echo -e "  ${GREEN}✓${NC} Port $port ($service) is available"
        return 0
    fi
}

conflict=0
check_port 3000 "Frontend" || conflict=1
check_port 4222 "NATS" || conflict=1
check_port 5432 "PostgreSQL" || conflict=1
check_port 6379 "Redis" || conflict=1
check_port 8080 "API Server" || conflict=1
check_port 8123 "ClickHouse HTTP" || conflict=1
check_port 8222 "NATS Monitor" || conflict=1
check_port 9001 "MinIO Console" || conflict=1
check_port 9002 "MinIO API" || conflict=1
check_port 9004 "ClickHouse Native" || conflict=1

if [ "$conflict" -eq 1 ]; then
    echo -e "${YELLOW}Warning: Port conflicts detected. Services may fail to start.${NC}"
    echo "You can identify which process is using a port with: lsof -i :PORT"
    read -p "Continue anyway? [y/N] " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Setup cancelled."
        exit 1
    fi
fi

echo ""

# Phase 3: Generate environment files
echo -e "${YELLOW}[3/8] Generating environment files...${NC}"

if [ ! -f .env ]; then
    cp .env.example .env
    echo -e "  ${GREEN}✓${NC} Created .env from .env.example"
else
    echo -e "  ${GREEN}✓${NC} .env already exists, skipping"
fi

if [ ! -f frontend/.env.local ]; then
    if [ -f frontend/.env.local.example ]; then
        cp frontend/.env.local.example frontend/.env.local
        echo -e "  ${GREEN}✓${NC} Created frontend/.env.local from .env.local.example"
    else
        cat > frontend/.env.local << 'ENVEOF'
# Frontend Environment Configuration for Local Development
NEXT_PUBLIC_API_URL=http://localhost:8080
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
ENVEOF
        echo -e "  ${GREEN}✓${NC} Created frontend/.env.local with defaults"
    fi
else
    echo -e "  ${GREEN}✓${NC} frontend/.env.local already exists, skipping"
fi

echo ""

# Phase 4: Start Docker services
echo -e "${YELLOW}[4/8] Starting Docker infrastructure services...${NC}"

docker compose up -d

echo ""
echo -e "${YELLOW}[5/8] Waiting for services to be healthy...${NC}"

wait_for_healthy() {
    local service="$1"
    local name="$2"
    local max_attempts=30
    local attempt=0

    printf "  Waiting for %-15s" "$name..."
    while [ $attempt -lt $max_attempts ]; do
        local health
        health=$(docker inspect --format='{{.State.Health.Status}}' "remedyiq-$service" 2>/dev/null || echo "missing")
        if [ "$health" = "healthy" ]; then
            echo -e " ${GREEN}✓${NC}"
            return 0
        fi
        attempt=$((attempt + 1))
        sleep 2
        printf "."
    done
    echo -e " ${RED}✗${NC} Timeout"
    return 1
}

wait_for_healthy postgres "PostgreSQL"
wait_for_healthy clickhouse "ClickHouse"
wait_for_healthy nats "NATS"
wait_for_healthy redis "Redis"
wait_for_healthy minio "MinIO"

echo ""

# Phase 6: Verify database schemas (auto-init via docker-entrypoint-initdb.d)
echo -e "${YELLOW}[6/8] Verifying database schemas...${NC}"

# PostgreSQL schemas are auto-initialized via docker-entrypoint-initdb.d mount
# Only run migrations manually if tables don't exist (e.g., existing volume)
PG_TABLE_COUNT=$(docker compose exec -T postgres psql -U remedyiq -d remedyiq -tAc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'" 2>/dev/null || echo "0")
PG_TABLE_COUNT=$(echo "$PG_TABLE_COUNT" | tr -d '[:space:]')

if [ "$PG_TABLE_COUNT" -ge 5 ] 2>/dev/null; then
    echo -e "  ${GREEN}✓${NC} PostgreSQL schema verified ($PG_TABLE_COUNT tables)"
else
    echo -e "  ${YELLOW}!${NC} PostgreSQL tables not found, running migrations..."
    docker compose exec -T postgres psql -U remedyiq -d remedyiq < backend/migrations/001_initial.up.sql
    echo -e "  ${GREEN}✓${NC} PostgreSQL migrations complete"
fi

# ClickHouse schemas are auto-initialized via docker-entrypoint-initdb.d mount
CH_TABLE_COUNT=$(docker compose exec -T clickhouse clickhouse-client --query "SELECT count() FROM system.tables WHERE database='remedyiq'" 2>/dev/null || echo "0")
CH_TABLE_COUNT=$(echo "$CH_TABLE_COUNT" | tr -d '[:space:]')

if [ "$CH_TABLE_COUNT" -ge 2 ] 2>/dev/null; then
    echo -e "  ${GREEN}✓${NC} ClickHouse schema verified ($CH_TABLE_COUNT tables/views)"
else
    echo -e "  ${YELLOW}!${NC} ClickHouse tables not found, running init..."
    docker compose exec -T clickhouse clickhouse-client --queries-file /dev/stdin < backend/migrations/clickhouse/001_init.sql
    echo -e "  ${GREEN}✓${NC} ClickHouse migrations complete"
fi

echo ""

# Phase 7: Install Go dependencies
echo -e "${YELLOW}[7/8] Installing Go dependencies...${NC}"

cd backend
go mod download
go mod tidy 2>/dev/null || true
cd ..
echo -e "  ${GREEN}✓${NC} Go dependencies installed"

echo ""

# Phase 8: Install frontend dependencies
echo -e "${YELLOW}[8/8] Installing frontend dependencies...${NC}"

cd frontend
npm install --prefer-offline 2>/dev/null || npm install
cd ..
echo -e "  ${GREEN}✓${NC} Frontend dependencies installed"

echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  Setup Complete!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
echo ""
echo -e "${BLUE}Infrastructure Services:${NC}"
echo "  PostgreSQL:       localhost:5432    (user: remedyiq / pass: remedyiq)"
echo "  ClickHouse HTTP:  localhost:8123"
echo "  ClickHouse TCP:   localhost:9004"
echo "  NATS:             localhost:4222"
echo "  NATS Monitor:     http://localhost:8222"
echo "  Redis:            localhost:6379"
echo "  MinIO API:        http://localhost:9002"
echo "  MinIO Console:    http://localhost:9001  (user: minioadmin / pass: minioadmin)"
echo ""
echo -e "${BLUE}Quick Start Commands:${NC}"
echo -e "  ${YELLOW}make run${NC}           Start full stack (infra + API + Worker + Frontend)"
echo -e "  ${YELLOW}make dev${NC}           Start API + Worker only (infra must be running)"
echo -e "  ${YELLOW}make frontend${NC}      Start frontend dev server only"
echo -e "  ${YELLOW}make check-services${NC} Check health of all services"
echo ""
echo -e "${BLUE}Application URLs (after starting):${NC}"
echo "  Frontend:    http://localhost:3000"
echo "  API Health:  http://localhost:8080/api/v1/health"
echo ""
echo -e "${BLUE}Development Mode:${NC}"
echo "  Auth is bypassed (no Clerk keys needed)."
echo "  API requests use headers: X-Dev-User-ID, X-Dev-Tenant-ID"
echo "  Frontend shows a dev-mode banner."
echo ""

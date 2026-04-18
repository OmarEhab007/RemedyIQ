.PHONY: all help dev api worker frontend test test-coverage lint build migrate-up migrate-down ch-init seed-dev-tenant db-setup docker-up docker-down docker-build docker-logs docker-restart docker-clean clean deps setup run check-services docker-up-all helm-lint helm-dry-run

# Default target
.DEFAULT_GOAL := help

all: help

# Colors for output
GREEN  := \033[0;32m
YELLOW := \033[0;33m
RESET  := \033[0m

help: ## Show this help message
	@echo '$(GREEN)RemedyIQ - Available Targets:$(RESET)'
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(YELLOW)%-20s$(RESET) %s\n", $$1, $$2}'

##@ Development

dev: ## Start API and Worker in parallel (requires docker-up first)
	@echo "$(GREEN)Starting API and Worker...$(RESET)"
	@trap 'kill 0' INT; \
	$(MAKE) api & $(MAKE) worker & wait

api: ## Run API server locally
	@echo "$(GREEN)Starting API server...$(RESET)"
	cd backend && go run ./cmd/api/...

worker: ## Run worker process locally
	@echo "$(GREEN)Starting worker...$(RESET)"
	cd backend && go run ./cmd/worker/...

frontend: ## Run frontend dev server
	@echo "$(GREEN)Starting frontend dev server...$(RESET)"
	cd frontend && npm run dev

deps: ## Install all dependencies (Go + npm)
	@echo "$(GREEN)Installing Go dependencies...$(RESET)"
	cd backend && go mod download && go mod tidy
	@echo "$(GREEN)Installing frontend dependencies...$(RESET)"
	cd frontend && npm install --legacy-peer-deps

##@ Testing & Quality

test: ## Run unit tests only (no external services required)
	@echo "$(GREEN)Running unit tests...$(RESET)"
	cd backend && go test -v -race -count=1 -coverprofile=coverage.out ./...
	@echo "Coverage report:"
	@cd backend && go tool cover -func=coverage.out | tail -1

test-integration: ## Run integration tests only (requires Docker services)
	@echo "$(GREEN)Running integration tests...$(RESET)"
	cd backend && go test -v -race -count=1 -tags=integration -coverprofile=coverage-integration.out ./...

test-all: test test-integration ## Run all tests (unit + integration)

test-coverage: ## Generate HTML coverage report
	@echo "$(GREEN)Generating coverage report...$(RESET)"
	cd backend && go test -v -race -count=1 -coverprofile=coverage.out ./...
	cd backend && go tool cover -html=coverage.out -o coverage.html
	@echo "$(GREEN)Coverage report: backend/coverage.html$(RESET)"

test-coverage-detail: ## Generate per-package coverage breakdown
	@echo "$(GREEN)Generating per-package coverage...$(RESET)"
	@cd backend && go test -coverprofile=coverage.out ./... 2>/dev/null
	@cd backend && go tool cover -func=coverage.out

test-frontend: ## Run frontend tests
	@echo "$(GREEN)Running frontend tests...$(RESET)"
	cd frontend && npx vitest run --coverage

test-frontend-watch: ## Run frontend tests in watch mode
	@echo "$(GREEN)Running frontend tests in watch mode...$(RESET)"
	cd frontend && npx vitest

test-full: test test-frontend ## Run all tests (backend + frontend)

lint: ## Run linter
	@echo "$(GREEN)Running linter...$(RESET)"
	cd backend && go vet ./...
	cd backend && go fmt ./...

##@ Build

build: ## Build API and Worker binaries
	@echo "$(GREEN)Building binaries...$(RESET)"
	cd backend && go build -o bin/api ./cmd/api/...
	cd backend && go build -o bin/worker ./cmd/worker/...
	@echo "$(GREEN)Binaries built: backend/bin/api, backend/bin/worker$(RESET)"

docker-build: ## Build Docker images for API and Frontend
	@echo "$(GREEN)Building Docker images...$(RESET)"
	docker build -t remedyiq-api:latest -f backend/Dockerfile .
	docker build -t remedyiq-frontend:latest -f frontend/Dockerfile frontend/

##@ Database

migrate-up: ## Run PostgreSQL migrations (up)
	@echo "$(GREEN)Running PostgreSQL migrations...$(RESET)"
	docker compose exec -T postgres psql -U remedyiq -d remedyiq -v ON_ERROR_STOP=1 < backend/migrations/001_initial.up.sql
	docker compose exec -T postgres psql -U remedyiq -d remedyiq -v ON_ERROR_STOP=1 < backend/migrations/002_search_features.up.sql
	docker compose exec -T postgres psql -U remedyiq -d remedyiq -v ON_ERROR_STOP=1 < backend/migrations/003_conversations.up.sql

migrate-down: ## Rollback PostgreSQL migrations (down)
	@echo "$(YELLOW)Rolling back PostgreSQL migrations...$(RESET)"
	docker compose exec -T postgres psql -U remedyiq -d remedyiq < backend/migrations/001_initial.down.sql

ch-init: ## Initialize ClickHouse schema
	@echo "$(GREEN)Initializing ClickHouse schema...$(RESET)"
	docker compose exec -T clickhouse clickhouse-client --queries-file /dev/stdin < backend/migrations/clickhouse/001_init.sql

seed-dev-tenant: ## Ensure local dev tenant row exists (run after migrate-up; idempotent)
	@echo "$(GREEN)Seeding dev tenant...$(RESET)"
	docker compose exec -T postgres psql -U remedyiq -d remedyiq -v ON_ERROR_STOP=1 < scripts/seed_dev_tenant.sql

db-setup: docker-up migrate-up ch-init seed-dev-tenant ## Complete database setup (Docker + migrations + ClickHouse + dev tenant)
	@echo "$(GREEN)Database setup complete!$(RESET)"

##@ Docker

docker-up: ## Start all infrastructure services (Postgres, ClickHouse, NATS, Redis, MinIO)
	@echo "$(GREEN)Starting Docker services...$(RESET)"
	docker compose up -d
	@echo "$(GREEN)Waiting for services to be healthy...$(RESET)"
	@sleep 5
	@docker compose ps

docker-down: ## Stop all Docker services
	@echo "$(YELLOW)Stopping Docker services...$(RESET)"
	docker compose down

docker-logs: ## View logs from all Docker services
	docker compose logs -f

docker-restart: docker-down docker-up ## Restart all Docker services

docker-clean: ## Remove all Docker volumes (WARNING: destroys all data)
	@echo "$(YELLOW)WARNING: This will delete all data in Docker volumes!$(RESET)"
	@printf "Are you sure? [y/N] "; \
	read REPLY; \
	case "$$REPLY" in \
	  [Yy]*) \
		docker compose down -v; \
		echo "$(GREEN)Volumes removed.$(RESET)";; \
	esac

##@ Utilities

clean: ## Clean build artifacts and temporary files
	@echo "$(GREEN)Cleaning build artifacts...$(RESET)"
	rm -rf backend/bin/
	rm -f backend/coverage.out backend/coverage.html
	cd frontend && rm -rf .next/ node_modules/ .turbo/
	@echo "$(GREEN)Clean complete!$(RESET)"

check-services: ## Check health of all services
	@echo "$(GREEN)Checking service health...$(RESET)"
	@echo "PostgreSQL:  $$(docker compose exec -T postgres pg_isready -U remedyiq >/dev/null 2>&1 && echo '  OK' || echo '  FAIL')"
	@echo "ClickHouse:  $$(docker compose exec -T clickhouse wget -q --spider http://localhost:8123/ping 2>/dev/null && echo '  OK' || echo '  FAIL')"
	@echo "NATS:        $$(docker compose exec -T nats wget -q --spider http://localhost:8222/healthz 2>/dev/null && echo '  OK' || echo '  FAIL')"
	@echo "Redis:       $$(docker compose exec -T redis redis-cli ping 2>/dev/null | grep -q PONG && echo '  OK' || echo '  FAIL')"
	@echo "MinIO:       $$(curl -sf http://localhost:9002/minio/health/live 2>/dev/null && echo '  OK' || echo '  FAIL')"
	@echo ""
	@echo "API Server:  $$(curl -sf http://localhost:8080/api/v1/health 2>/dev/null && echo '  OK' || echo '  NOT RUNNING')"
	@echo "Frontend:    $$(curl -sf http://localhost:3000 2>/dev/null | head -c1 | grep -q . && echo '  OK' || echo '  NOT RUNNING')"

##@ Quick Start

setup: ## Complete initial setup (prerequisites check + docker + migrations + deps)
	@bash scripts/setup.sh

run: ## Full stack: Start all services + API + Worker + Frontend (one command)
	@echo "$(GREEN)Starting full RemedyIQ stack...$(RESET)"
	@$(MAKE) docker-up
	@sleep 3
	@trap 'kill 0' INT; \
	$(MAKE) api & $(MAKE) worker & $(MAKE) frontend & wait

##@ Containerization (EKS)

docker-up-all: ## Start ALL services including API, Worker, Frontend via docker compose
	@echo "$(GREEN)Starting all services (infrastructure + application)...$(RESET)"
	docker compose up --build
	@echo "$(GREEN)All services started!$(RESET)"
	@echo "Frontend: http://localhost:3000"
	@echo "API:      http://localhost:8080/api/v1/health"

helm-lint: ## Lint Helm charts (staging + prod)
	@echo "$(GREEN)Linting Helm charts...$(RESET)"
	helm dependency update helm/remedyiq
	helm lint helm/remedyiq -f helm/remedyiq/values-staging.yaml
	helm lint helm/remedyiq -f helm/remedyiq/values-prod.yaml
	@echo "$(GREEN)Helm lint passed!$(RESET)"

helm-dry-run: ## Dry-run Helm template deployment (requires kubectl)
	@echo "$(GREEN)Running Helm template dry-run...$(RESET)"
	helm dependency update helm/remedyiq
	helm template remedyiq-staging helm/remedyiq \
		-f helm/remedyiq/values-staging.yaml \
		--set image.tag=dev \
		--set image.registry=localhost \
		| kubectl apply --dry-run=client -f -
	@echo "$(GREEN)Dry-run complete!$(RESET)"

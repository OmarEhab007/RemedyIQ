.PHONY: help dev api worker test lint build migrate-up migrate-down ch-init docker-up docker-down docker-build clean deps

# Default target
.DEFAULT_GOAL := help

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

deps: ## Install Go dependencies
	@echo "$(GREEN)Installing Go dependencies...$(RESET)"
	cd backend && go mod download
	cd backend && go mod tidy

##@ Testing & Quality

test: ## Run all tests
	@echo "$(GREEN)Running tests...$(RESET)"
	cd backend && go test -v -race -coverprofile=coverage.out ./...

test-coverage: test ## Run tests with coverage report
	@echo "$(GREEN)Generating coverage report...$(RESET)"
	cd backend && go tool cover -html=coverage.out -o coverage.html
	@echo "$(GREEN)Coverage report: backend/coverage.html$(RESET)"

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
	docker build -t remedyiq-api:latest -f backend/Dockerfile backend/
	docker build -t remedyiq-frontend:latest -f frontend/Dockerfile frontend/

##@ Database

migrate-up: ## Run PostgreSQL migrations (up)
	@echo "$(GREEN)Running PostgreSQL migrations...$(RESET)"
	PGPASSWORD=remedyiq psql -h localhost -U remedyiq -d remedyiq -f backend/migrations/001_initial.up.sql

migrate-down: ## Rollback PostgreSQL migrations (down)
	@echo "$(YELLOW)Rolling back PostgreSQL migrations...$(RESET)"
	PGPASSWORD=remedyiq psql -h localhost -U remedyiq -d remedyiq -f backend/migrations/001_initial.down.sql

ch-init: ## Initialize ClickHouse schema
	@echo "$(GREEN)Initializing ClickHouse schema...$(RESET)"
	clickhouse-client --host localhost --port 9000 --queries-file backend/migrations/clickhouse/001_init.sql

db-setup: docker-up migrate-up ch-init ## Complete database setup (Docker + migrations + ClickHouse)
	@echo "$(GREEN)Database setup complete!$(RESET)"

##@ Docker

docker-up: ## Start all infrastructure services (Postgres, ClickHouse, NATS, Redis, MinIO)
	@echo "$(GREEN)Starting Docker services...$(RESET)"
	docker-compose up -d
	@echo "$(GREEN)Waiting for services to be healthy...$(RESET)"
	@sleep 5
	@docker-compose ps

docker-down: ## Stop all Docker services
	@echo "$(YELLOW)Stopping Docker services...$(RESET)"
	docker-compose down

docker-logs: ## View logs from all Docker services
	docker-compose logs -f

docker-restart: docker-down docker-up ## Restart all Docker services

docker-clean: ## Remove all Docker volumes (WARNING: destroys all data)
	@echo "$(YELLOW)WARNING: This will delete all data in Docker volumes!$(RESET)"
	@printf "Are you sure? [y/N] "; \
	read REPLY; \
	case "$$REPLY" in \
	  [Yy]*) \
		docker-compose down -v; \
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
	@echo "PostgreSQL:  $$(docker-compose exec -T postgres pg_isready -U remedyiq && echo '✓' || echo '✗')"
	@echo "ClickHouse:  $$(docker-compose exec -T clickhouse wget -q --spider http://localhost:8123/ping && echo '✓' || echo '✗')"
	@echo "NATS:        $$(docker-compose exec -T nats wget -q --spider http://localhost:8222/healthz && echo '✓' || echo '✗')"
	@echo "Redis:       $$(docker-compose exec -T redis redis-cli ping | grep -q PONG && echo '✓' || echo '✗')"
	@echo "MinIO:       $$(docker-compose exec -T minio curl -f http://localhost:9000/minio/health/live 2>/dev/null && echo '✓' || echo '✗')"

##@ Quick Start

setup: deps docker-up db-setup ## Complete initial setup (deps + docker + migrations)
	@echo "$(GREEN)═══════════════════════════════════════════════════$(RESET)"
	@echo "$(GREEN)  RemedyIQ Setup Complete!$(RESET)"
	@echo "$(GREEN)═══════════════════════════════════════════════════$(RESET)"
	@echo ""
	@echo "Services available at:"
	@echo "  PostgreSQL:      localhost:5432"
	@echo "  ClickHouse HTTP: localhost:8123"
	@echo "  ClickHouse TCP:  localhost:9000"
	@echo "  NATS:            localhost:4222"
	@echo "  NATS Monitor:    http://localhost:8222"
	@echo "  Redis:           localhost:6379"
	@echo "  MinIO API:       http://localhost:9002"
	@echo "  MinIO Console:   http://localhost:9001"
	@echo ""
	@echo "Next steps:"
	@echo "  1. Run '$(YELLOW)make dev$(RESET)' to start API and Worker"
	@echo "  2. Run '$(YELLOW)cd frontend && npm run dev$(RESET)' to start frontend"
	@echo ""

run: ## Full stack: Start all services + API + Worker (one command)
	@echo "$(GREEN)Starting full RemedyIQ stack...$(RESET)"
	@$(MAKE) docker-up
	@sleep 3
	@$(MAKE) dev

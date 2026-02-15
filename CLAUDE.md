# ARLogAnalyzer-25-local-dev Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-02-11

## Active Technologies
- Go 1.24.1 (backend), TypeScript 5.x / Next.js 16.1.6 (frontend) + gorilla/mux, clickhouse-go v2, pgx v5 (backend); React 19, shadcn/ui, Recharts, react-window (frontend) (004-complete-dashboard-features)
- ClickHouse (log_entries table, log_entries_aggregates materialized view), PostgreSQL (jobs/tenants with RLS), Redis (caching) (004-complete-dashboard-features)
- Go 1.24.1 (backend), TypeScript 5.x / Next.js 16.1.6 (frontend) + estify v1.11.1 (Go assertions/mocks), Vitest 3.x + React Testing Library 16.x (frontend), gorilla/mux, pgx v5, clickhouse-go v2, redis v9, nats.go, anthropic-sdk-go, bleve v2 (005-test-coverage)
- PostgreSQL 16 (RLS), ClickHouse 24 (analytics), Redis 7 (cache), MinIO (S3-compatible) (005-test-coverage)
- Go 1.24.1 (backend), TypeScript 5.x / Next.js 16.1.6 (frontend) + gorilla/mux, pgx v5, redis v9, nats.go (backend); React 19, shadcn/ui, Recharts (frontend) (006-fix-dashboard-data)
- Redis 7 (cache - sole storage for this feature), PostgreSQL 16 (job metadata), ClickHouse (unchanged) (006-fix-dashboard-data)
- Go 1.24.1 (backend), TypeScript 5.x / Next.js 16.1.6 (frontend) + gorilla/mux, clickhouse-go v2, pgx v5, bleve v2, redis v9 (backend); React 19, shadcn/ui, Recharts, react-window (frontend) (007-complete-log-explorer)
- ClickHouse (log_entries + materialized views), PostgreSQL (saved_searches, search_history), Redis (autocomplete cache, query history) (007-complete-log-explorer)

- Go 1.24.1 (backend), TypeScript 5.x / Next.js 16.1.6 (frontend) + gorilla/mux, clickhouse-go v2, pgx v5, shadcn/ui, Recharts, react-window (003-enhanced-analysis-dashboard)

## Project Structure

```text
src/
tests/
```

## Commands

npm test && npm run lint

## Code Style

Go 1.24.1 (backend), TypeScript 5.x / Next.js 16.1.6 (frontend): Follow standard conventions

## Recent Changes
- 007-complete-log-explorer: Added Go 1.24.1 (backend), TypeScript 5.x / Next.js 16.1.6 (frontend) + gorilla/mux, clickhouse-go v2, pgx v5, bleve v2, redis v9 (backend); React 19, shadcn/ui, Recharts, react-window (frontend)
- 006-fix-dashboard-data: Added Go 1.24.1 (backend), TypeScript 5.x / Next.js 16.1.6 (frontend) + gorilla/mux, pgx v5, redis v9, nats.go (backend); React 19, shadcn/ui, Recharts (frontend)
- 005-test-coverage: Added Go 1.24.1 (backend), TypeScript 5.x / Next.js 16.1.6 (frontend) + estify v1.11.1 (Go assertions/mocks), Vitest 3.x + React Testing Library 16.x (frontend), gorilla/mux, pgx v5, clickhouse-go v2, redis v9, nats.go, anthropic-sdk-go, bleve v2


<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->

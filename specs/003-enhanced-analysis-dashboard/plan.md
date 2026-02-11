# Implementation Plan: Enhanced Analysis Dashboard

**Branch**: `003-enhanced-analysis-dashboard` | **Date**: 2026-02-10 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/003-enhanced-analysis-dashboard/spec.md`

## Summary

Enhance the analysis dashboard to surface 100% of ARLogAnalyzer.jar output data. The current dashboard shows only general stats, top-N entries, a basic time-series, and type/queue distribution (~20% of JAR output). This plan extends the backend parser to extract aggregates, thread stats, exceptions, gaps, and filter complexity; adds lazy-loaded API endpoints for heavy sections; introduces a server-side health score; and builds new frontend components for each data section.

## Technical Context

**Language/Version**: Go 1.24.1 (backend), TypeScript 5.x / Next.js 16.1.6 (frontend)
**Primary Dependencies**: gorilla/mux, clickhouse-go v2, pgx v5, shadcn/ui, Recharts, react-window
**Storage**: ClickHouse (log entries + aggregates), PostgreSQL (metadata), Redis 7 (cache), S3/MinIO (files)
**Testing**: Go `testing` + testify (backend), Vitest + React Testing Library (frontend)
**Target Platform**: Docker Compose (local dev), Kubernetes (production)
**Project Type**: Web application (Go API server + Next.js frontend)
**Performance Goals**: Initial dashboard load <1s; lazy sections <500ms; aggregate tables scroll at 60fps with 500+ rows
**Constraints**: Two-tier loading (summary first, details on demand); all values match JAR output exactly
**Scale/Scope**: Single analysis can contain 1M+ log entries; aggregate tables up to 500+ rows

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Wrapper-First | PASS | All data comes from JAR output via extended parser. No new independent parsing. |
| II. API-First | PASS | 6 new lazy-load endpoints defined in OpenAPI before implementation. |
| III. Test-First | PASS | Each parser extension requires test against sample JAR output. Frontend components require unit tests. |
| IV. AI as a Skill | N/A | No AI skills added in this feature. Health score is deterministic, not AI. |
| V. Multi-Tenant | PASS | All new endpoints and cache keys are tenant-scoped. Existing tenant isolation patterns reused. |
| VI. Simplicity Gate | PASS | No new services. Extensions fit within existing API Server + Worker + Frontend. |
| VII. Log Format Fidelity | PASS | All new data matches JAR output. Aggregate totals validated against JAR plain-text report. |
| VIII. Streaming-Ready | N/A | Dashboard is batch-mode (post-analysis). No streaming changes needed. |
| IX. Incremental Delivery | PASS | P1 (aggregates + errors) delivers immediate value. P2 and P3 layers add progressively. |

## Project Structure

### Documentation (this feature)

```text
specs/003-enhanced-analysis-dashboard/
├── plan.md              # This file
├── research.md          # Phase 0: Technology decisions & resolved unknowns
├── data-model.md        # Phase 1: Extended domain models & schemas
├── quickstart.md        # Phase 1: Development setup for this feature
├── contracts/
│   └── openapi.yaml     # Phase 1: New lazy-load endpoints
└── tasks.md             # Phase 2 output (via /speckit.tasks)
```

### Source Code (repository root)

```text
backend/
├── internal/
│   ├── jar/
│   │   └── parser.go              # MODIFY: Extract aggregates, gaps, threads, exceptions, filter complexity
│   ├── domain/
│   │   └── models.go              # MODIFY: Add AggregateGroup, GapEntry, ThreadStatsEntry, ExceptionEntry, FilterComplexityEntry, HealthScore
│   ├── api/
│   │   ├── router.go              # MODIFY: Register 6 new lazy-load routes
│   │   └── handlers/
│   │       ├── dashboard.go       # MODIFY: Add health score to summary response
│   │       ├── aggregates.go      # NEW: Lazy-load aggregate data handler
│   │       ├── exceptions.go      # NEW: Lazy-load exception/error data handler
│   │       ├── gaps.go            # NEW: Lazy-load gap analysis data handler
│   │       ├── threads.go         # NEW: Lazy-load thread statistics handler
│   │       └── filters.go         # NEW: Lazy-load filter complexity handler
│   ├── storage/
│   │   └── clickhouse.go          # MODIFY: Add queries for new data sections
│   └── worker/
│       └── ingestion.go           # MODIFY: Store extended parsed data, compute health score
└── internal/jar/
    └── parser_test.go             # MODIFY: Add tests for new parser sections

frontend/
├── src/
│   ├── lib/
│   │   └── api.ts                 # MODIFY: Add types + fetch functions for lazy-load endpoints
│   ├── hooks/
│   │   └── use-lazy-section.ts    # NEW: Generic lazy-loading hook (Intersection Observer)
│   ├── components/
│   │   └── dashboard/
│   │       ├── health-score.tsx           # NEW: Health score display with factor breakdown
│   │       ├── aggregate-table.tsx        # NEW: Aggregate tables with virtual scrolling
│   │       ├── exception-panel.tsx        # NEW: Exception/error report panels
│   │       ├── gap-analysis.tsx           # NEW: Gap analysis with timeline visualization
│   │       ├── thread-stats.tsx           # NEW: Thread statistics with queue health
│   │       ├── filter-complexity.tsx      # NEW: Filter complexity insights
│   │       ├── time-series-chart.tsx      # MODIFY: Add duration/error toggles, zoom
│   │       ├── distribution-chart.tsx     # MODIFY: Add dimension switcher, top-N config
│   │       └── top-n-table.tsx            # MODIFY: Add type-specific columns, expandable rows
│   └── app/
│       └── (dashboard)/
│           └── analysis/
│               └── [id]/
│                   └── page.tsx           # MODIFY: Add new sections with lazy loading
└── src/components/dashboard/
    └── __tests__/                         # NEW: Component tests for new panels
```

**Structure Decision**: Web application pattern. All changes fit within existing `backend/` and `frontend/` directories. No new services or packages. 6 new handler files in backend, 6 new component files in frontend, plus modifications to existing files.

## Complexity Tracking

No constitution violations. All changes fit within the 3-service architecture (API Server, Worker, Frontend).

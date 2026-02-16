# Implementation Plan: Enhanced Trace Transaction Page

**Branch**: `008-trace-transaction` | **Date**: 2026-02-15 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/008-trace-transaction/spec.md`

## Summary

Redesign the Trace Transaction page from a basic Trace ID search with a flat vertical timeline into a world-class APM-style transaction tracing experience. The enhanced page features a horizontal waterfall/Gantt chart with parent-child span nesting, a detail sidebar with type-specific fields and SQL syntax highlighting, multi-field transaction search (Trace ID, RPC ID, Thread ID, User), in-trace filtering, flame graph and span list alternative views, critical path analysis, side-by-side trace comparison, and AI-powered trace insights via Claude. The hierarchy is inferred server-side using a Temporal + Thread Containment algorithm and cached in Redis.

## Technical Context

**Language/Version**: Go 1.24.1 (backend), TypeScript 5.x / Next.js 16.1.6 (frontend)
**Primary Dependencies**: gorilla/mux, clickhouse-go v2, pgx v5, redis v9 (backend); React 19, shadcn/ui, Recharts, react-window, prism-react-renderer v2, D3 scales (frontend)
**Storage**: ClickHouse (log_entries — existing, no schema changes), Redis (hierarchy cache, recent traces)
**Testing**: Go test + testify (backend), Vitest + React Testing Library (frontend)
**Target Platform**: Web application (Docker/Kubernetes)
**Project Type**: Web application (Go API + Next.js frontend)
**Performance Goals**: <2s waterfall render for 500 spans, <1s view switching, <200ms filter response, 60fps scroll for 1000 spans
**Constraints**: Virtualized rendering for 200+ spans, multi-tenant isolation, Redis cache TTL for hierarchy (5 min)
**Scale/Scope**: Up to 5000 spans per trace, 50 concurrent users per tenant

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Wrapper-First | PASS | Feature does not modify log parsing; extends visualization/search layer only |
| II. API-First | PASS | All new endpoints defined in OpenAPI contracts before implementation |
| III. Test-First | PASS | Test plan included in each task; existing test patterns followed |
| IV. AI as a Skill | PASS | Trace analyzer implemented as discrete skill with typed contract, fallback behavior, and evaluation examples |
| V. Multi-Tenant | PASS | All queries scoped by tenant_id; Redis keys prefixed with tenant_id; no cross-tenant trace access |
| VI. Simplicity Gate | PASS | No new services; extends existing API Server and Frontend only |
| VII. Log Format Fidelity | N/A | Feature does not modify parsing or data format |
| VIII. Streaming-Ready | PASS | AI analysis uses streaming response; waterfall compatible with future WebSocket live trace updates |
| IX. Incremental Delivery | PASS | 9 user stories prioritized P1-P5; each independently testable and deployable |

**Post-Phase 1 Re-check**: All gates still pass. No new services or schema changes. Hierarchy inference runs within existing API Server. AI skill follows existing pattern.

## Project Structure

### Documentation (this feature)

```text
specs/008-trace-transaction/
├── plan.md              # This file
├── spec.md              # Feature specification (9 user stories, 23 FRs)
├── research.md          # Phase 0 output (8 research decisions)
├── data-model.md        # Phase 1 output (response types, no schema changes)
├── quickstart.md        # Phase 1 output (dev setup guide)
├── contracts/
│   └── openapi.yaml     # Phase 1 output (new/modified endpoints)
├── checklists/
│   └── requirements.md  # Spec quality checklist
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
backend/
├── internal/api/
│   ├── router.go                           # MODIFY: Register new trace routes
│   └── handlers/
│       ├── trace.go                        # MODIFY: Enhance with waterfall hierarchy, transaction search
│       ├── trace_test.go                   # MODIFY: Add waterfall/search/compare tests
│       └── ai.go                           # MODIFY: Add trace-analyzer skill
├── internal/domain/
│   └── models.go                           # MODIFY: Add SpanNode, WaterfallResponse, TransactionSummary types
├── internal/storage/
│   ├── clickhouse.go                       # MODIFY: Add transaction search queries, hierarchy data fetch
│   └── interfaces.go                       # MODIFY: Extend ClickHouseStore with new methods
├── internal/trace/
│   ├── hierarchy.go                        # NEW: Temporal+Thread containment algorithm
│   ├── hierarchy_test.go                   # NEW: Hierarchy inference tests with sample data
│   ├── critical_path.go                    # NEW: Critical path computation
│   └── critical_path_test.go              # NEW: Critical path tests
└── internal/testutil/
    └── mocks.go                            # MODIFY: Update mocks for new interface methods

frontend/
├── src/app/(dashboard)/
│   └── trace/
│       └── page.tsx                        # MODIFY: Complete redesign with waterfall, sidebar, search
├── src/components/trace/
│   ├── timeline.tsx                        # REPLACE: Old vertical timeline → waterfall component
│   ├── waterfall.tsx                       # NEW: Canvas-based waterfall with react-window virtualization
│   ├── waterfall-row.tsx                   # NEW: Individual span row with duration bar
│   ├── timestamp-ruler.tsx                 # NEW: Fixed-position time axis with zoom
│   ├── span-detail-sidebar.tsx            # NEW: Type-specific span details with SQL highlighting
│   ├── trace-summary-header.tsx           # NEW: Summary stats, mini-timeline, error indicators
│   ├── trace-search.tsx                   # NEW: Multi-field search with recent traces dropdown
│   ├── trace-filters.tsx                  # NEW: In-trace filtering controls
│   ├── flame-graph.tsx                    # NEW: D3-based icicle/flame graph view
│   ├── span-list.tsx                      # NEW: Sortable table view using react-window
│   ├── view-switcher.tsx                  # NEW: Waterfall/FlameGraph/SpanList toggle
│   ├── trace-comparison.tsx               # NEW: Side-by-side comparison view
│   └── ai-insights.tsx                    # NEW: AI analysis panel with streaming response
├── src/hooks/
│   └── use-trace.ts                       # NEW: Trace data fetching, filtering, view state management
├── src/lib/
│   └── trace-utils.ts                     # NEW: Client-side span filtering, comparison alignment
└── src/components/dashboard/
    └── top-n-table.tsx                     # MODIFY: Add "Trace" link for rows with trace_id
```

**Structure Decision**: Extends the existing web application structure (backend/ + frontend/) with no new services. The only new backend package is `internal/trace/` for hierarchy inference logic, which runs within the existing API Server process. Follows the Simplicity Gate principle.

## Complexity Tracking

> No constitution violations. No complexity tracking needed.

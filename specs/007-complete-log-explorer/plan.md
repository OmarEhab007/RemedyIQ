# Implementation Plan: Complete Log Explorer

**Branch**: `007-complete-log-explorer` | **Date**: 2026-02-14 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/007-complete-log-explorer/spec.md`

## Summary

Complete the Log Explorer with job-scoped search, time range filtering, timeline histogram, autocomplete, entry detail fetch, related entries navigation, context view, column sorting, syntax highlighting, saved searches, query history, export, keyboard shortcuts, and dashboard-to-explorer links. The existing foundation (KQL parser, Bleve search, virtual-scrolled log table, filter panel, detail panel) is extended rather than replaced.

## Technical Context

**Language/Version**: Go 1.24.1 (backend), TypeScript 5.x / Next.js 16.1.6 (frontend)
**Primary Dependencies**: gorilla/mux, clickhouse-go v2, pgx v5, bleve v2, redis v9 (backend); React 19, shadcn/ui, Recharts, react-window (frontend)
**Storage**: ClickHouse (log_entries + materialized views), PostgreSQL (saved_searches, search_history), Redis (autocomplete cache, query history)
**Testing**: Go test + testify (backend), Vitest + React Testing Library (frontend)
**Target Platform**: Web application (Docker/Kubernetes)
**Project Type**: Web application (Go API + Next.js frontend)
**Performance Goals**: <2s search response for 10M entries, <200ms autocomplete, <1s histogram render
**Constraints**: 10,000 row export cap, 20-entry query history limit, multi-tenant isolation at every layer
**Scale/Scope**: Up to 10M log entries per job, 50 concurrent users per tenant

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Wrapper-First | PASS | Feature does not modify log parsing; extends search/display layer only |
| II. API-First | PASS | All new endpoints defined in OpenAPI contracts before implementation |
| III. Test-First | PASS | Test plan included in each task; existing test patterns followed |
| IV. AI as a Skill | N/A | No AI features in this feature scope |
| V. Multi-Tenant | PASS | All queries scoped by tenant_id; PostgreSQL RLS on new tables; Redis keys prefixed |
| VI. Simplicity Gate | PASS | No new services; extends existing API Server and Frontend only |
| VII. Log Format Fidelity | N/A | Feature does not modify parsing or data format |
| VIII. Streaming-Ready | PASS | Architecture compatible; WebSocket live tail integration point preserved |
| IX. Incremental Delivery | PASS | 8 user stories prioritized P1/P2/P3; each independently testable and deployable |

**Post-Phase 1 Re-check**: All gates still pass. New tables (search_history) follow existing patterns. No new services introduced.

## Project Structure

### Documentation (this feature)

```text
specs/007-complete-log-explorer/
├── plan.md              # This file
├── research.md          # Phase 0 output (8 research decisions)
├── data-model.md        # Phase 1 output (schema changes)
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
├── cmd/api/main.go                         # Wire new handlers into RouterConfig
├── internal/api/
│   ├── router.go                           # Register new routes (context, export, saved, history)
│   └── handlers/
│       ├── search.go                       # MODIFY: job-scoped, time range, histogram, sort
│       ├── autocomplete.go                 # NEW: field/value autocomplete
│       ├── entry.go                        # NEW: single entry fetch + context window
│       ├── export.go                       # NEW: CSV/JSON streaming export
│       ├── saved_search.go                 # NEW: saved searches CRUD
│       └── search_history.go              # NEW: query history
├── internal/storage/
│   ├── clickhouse.go                       # MODIFY: add histogram, context, autocomplete queries
│   ├── interfaces.go                       # MODIFY: extend ClickHouseStore + PostgresStore
│   └── postgres.go                         # MODIFY: add saved search + history CRUD
├── internal/search/
│   └── kql.go                              # EXISTING: KQL parser (no changes needed)
└── internal/testutil/
    └── mocks.go                            # MODIFY: update mocks for new interface methods

frontend/
├── src/app/(dashboard)/
│   └── analysis/[id]/
│       ├── page.tsx                        # MODIFY: add "Explore Logs" link
│       └── explorer/page.tsx              # NEW: job-scoped explorer (moved from explorer/page.tsx)
├── src/components/explorer/
│   ├── search-bar.tsx                      # MODIFY: autocomplete, syntax highlighting, history
│   ├── log-table.tsx                       # MODIFY: column sorting headers
│   ├── filter-panel.tsx                    # EXISTING: no changes
│   ├── detail-panel.tsx                    # MODIFY: related entries links, context button
│   ├── time-range-picker.tsx              # NEW: relative/absolute time range selector
│   ├── timeline-histogram.tsx             # NEW: Recharts stacked bar chart
│   ├── context-view.tsx                   # NEW: surrounding entries display
│   ├── saved-searches.tsx                 # NEW: save/load search panel
│   └── export-button.tsx                  # NEW: export dropdown
├── src/hooks/
│   └── use-search.ts                       # MODIFY: job_id, time range, histogram, sort, history
├── src/lib/
│   └── kql-tokenizer.ts                   # NEW: TypeScript KQL tokenizer for syntax highlighting
└── src/components/dashboard/
    └── top-n-table.tsx                     # MODIFY: add "View in Explorer" links
```

**Structure Decision**: Extends the existing web application structure (backend/ + frontend/) with no new services, following the Simplicity Gate principle.

## Complexity Tracking

> No constitution violations. No complexity tracking needed.

# Implementation Plan: ARLogAnalyzer Insights Enhancement

**Branch**: `012-analyzer-insights` | **Date**: 2026-02-18 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/012-analyzer-insights/spec.md`

## Summary

Surface 8 ARLogAnalyzer JAR output features in the RemedyIQ dashboard. Most data is already parsed by the Go backend and stored in Redis cache. The work is primarily frontend rendering (adding columns, tabs, tooltips, and sections) with minor backend additions (2 new endpoints, 2 new parser sections). Implementation follows priority order: P1 (API Legend, Thread Busy%), P2 (FPS, Queued Calls, Filter Levels), P3 (Logging Activity, Source Files, Delayed Escalations).

## Technical Context

**Language/Version**: Go 1.24.1 (backend), TypeScript 5.x / Next.js 16.1.6 (frontend)
**Primary Dependencies**: gorilla/mux, clickhouse-go v2, pgx v5, redis v9 (backend); React 19, shadcn/ui, Recharts, Zustand (frontend)
**Storage**: Redis 7 (primary data source via cached ParseResult), ClickHouse (log_entries for delayed escalations query), PostgreSQL (job metadata)
**Testing**: `go test ./...` (backend), Vitest 3.x + React Testing Library 16.x (frontend)
**Target Platform**: Web application (SaaS)
**Project Type**: Web (Go backend + Next.js frontend)
**Performance Goals**: Dashboard sections render in <500ms, tooltips appear in <100ms
**Constraints**: All new data flows through existing Redis cache pattern; no new services
**Scale/Scope**: 8 features across ~15 files modified, ~8 files created

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
| --------- | ------ | ----- |
| I. Wrapper-First | PASS | All data originates from JAR parser output; no new native parsers needed |
| II. API-First | PASS | New endpoints follow existing REST pattern; OpenAPI contracts defined |
| III. Test-First | PASS | Each feature includes unit tests for new/modified components |
| IV. AI as a Skill | N/A | No AI capabilities in this feature |
| V. Multi-Tenant | PASS | All new endpoints use existing tenant-scoped Redis keys and middleware |
| VI. Simplicity Gate | PASS | No new services; extends existing 3-service architecture |
| VII. Log Format Fidelity | N/A | No new parsers; surfacing existing JAR output |
| VIII. Streaming-Ready | N/A | Dashboard features, no streaming component |
| IX. Incremental Delivery | PASS | 8 features are independently deployable in priority order |

No violations. No complexity tracking needed.

## Project Structure

### Documentation (this feature)

```text
specs/012-analyzer-insights/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── openapi.yaml     # New/modified endpoints
├── quickstart.md        # Phase 1 output
└── tasks.md             # Phase 2 output (via /speckit.tasks)
```

### Source Code (repository root)

```text
backend/
├── internal/
│   ├── domain/
│   │   └── models.go                     # Add DelayedEscalationEntry, FileMetadata, LoggingActivity structs
│   ├── api/
│   │   ├── router.go                     # Register 2 new handler fields
│   │   └── handlers/
│   │       ├── enhanced_helpers.go       # Add getOrComputeQueuedCalls, getOrComputeDelayedEscalations
│   │       ├── queued_calls.go           # NEW: handler for queued API calls endpoint
│   │       ├── queued_calls_test.go      # NEW: tests
│   │       ├── delayed_escalations.go    # NEW: handler for delayed escalations endpoint
│   │       └── delayed_escalations_test.go # NEW: tests
│   ├── jar/
│   │   ├── parser.go                     # Add parseFileMetadata, parseLoggingActivity sections
│   │   └── parser_test.go               # Add tests for new parser sections
│   └── storage/
│       ├── clickhouse.go                 # Add QueryDelayedEscalations method
│       └── interfaces.go                # Add interface method

frontend/
├── src/
│   ├── lib/
│   │   ├── api-types.ts                  # Add busy_pct, filters_per_sec, new interfaces
│   │   ├── api.ts                        # Add fetch functions for new endpoints
│   │   └── constants.ts                  # Verify AR_API_CODES completeness
│   ├── components/
│   │   ├── shared/
│   │   │   ├── api-code-badge.tsx        # NEW: tooltip component for API codes
│   │   │   └── api-code-badge.test.tsx   # NEW: tests
│   │   ├── dashboard/
│   │   │   ├── threads-section.tsx       # Add busy% column with progress bar
│   │   │   ├── threads-section.test.tsx  # Update tests
│   │   │   ├── filters-section.tsx       # Add FPS column + filter levels table
│   │   │   ├── filters-section.test.tsx  # Update tests
│   │   │   ├── delayed-escalations-section.tsx   # NEW
│   │   │   ├── delayed-escalations-section.test.tsx # NEW
│   │   │   ├── source-files-section.tsx           # NEW
│   │   │   ├── source-files-section.test.tsx      # NEW
│   │   │   ├── logging-activity-section.tsx       # NEW
│   │   │   └── logging-activity-section.test.tsx  # NEW
│   │   ├── explorer/
│   │   │   └── log-table.tsx             # Integrate ApiCodeBadge
│   │   └── trace/
│   │       └── waterfall-row.tsx         # Integrate ApiCodeBadge
│   └── app/
│       └── (dashboard)/
│           └── analysis/[id]/page.tsx    # Add Queued tab + new collapsible sections
```

**Structure Decision**: Extends existing web application structure. 3 new dashboard component files, 1 shared component, and 2 new backend handler files. All follow established patterns.

# Implementation Plan: Complete Frontend Redesign

**Branch**: `011-frontend-redesign` | **Date**: 2026-02-17 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/011-frontend-redesign/spec.md`

## Summary

Replace the entire RemedyIQ frontend with a production-grade, accessibility-first UI built from scratch. The new frontend consumes the existing Go backend API (35+ endpoints, WebSocket, SSE) and is informed by competitor research across 8 leading observability platforms. The design follows a sidebar-navigation layout with progressive disclosure, semantic color coding, dark mode from day 1, and virtualized data tables for large datasets.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode), React 19, Next.js 16.1.6
**Primary Dependencies**: shadcn/ui (New York style), Tailwind CSS 4, Recharts, react-window, TanStack Query, Zustand, Sonner, Lucide React, streamdown
**Storage**: Browser localStorage (theme preference, recent searches), Clerk session tokens only
**Testing**: Vitest 3.x + React Testing Library 16.x + @vitest/coverage-v8
**Target Platform**: Web (desktop + mobile browsers, 375px to 2560px)
**Project Type**: Web application (frontend-only rewrite, existing backend)
**Performance Goals**: Lighthouse >= 90, FCP < 1.5s, LCP < 2.5s, 60 FPS scroll at 10K+ rows
**Constraints**: WCAG 2.1 AA, zero console errors, 80%+ test coverage, CSP headers
**Scale/Scope**: 6 main pages, ~80 components, consuming 35+ backend API endpoints

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Wrapper-First | N/A | Frontend-only change; JAR untouched |
| II. API-First | PASS | Frontend consumes existing versioned REST + WS + SSE APIs. No direct backend access. |
| III. Test-First | PASS | Vitest + RTL; target 80% coverage. Tests written alongside components. |
| IV. AI as a Skill | PASS | Frontend calls `/api/v1/ai/stream` and `/api/v1/ai/skills`; skill registry on backend. |
| V. Multi-Tenant | PASS | Clerk auth provides tenant context; all API calls include auth tokens via middleware. |
| VI. Simplicity Gate | PASS | Still 3 services (API, Worker, Frontend). No new services added. |
| VII. Log Format Fidelity | N/A | Frontend displays parsed data; no parsing logic. |
| VIII. Streaming-Ready | PASS | WebSocket client for job progress; SSE client for AI streaming. |
| IX. Incremental Delivery | PASS | 5-phase build: each phase delivers usable, deployable frontend. |

## Project Structure

### Documentation (this feature)

```text
specs/011-frontend-redesign/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Competitor research summary (already in docs/)
└── checklists/
    └── requirements.md  # Spec quality checklist
```

### Source Code (repository root)

```text
frontend/
├── public/                    # Static assets (favicon, fonts)
├── src/
│   ├── app/                   # Next.js App Router
│   │   ├── (auth)/            # Auth pages (sign-in, sign-up) — Clerk hosted UI
│   │   ├── (dashboard)/       # Main app layout with sidebar
│   │   │   ├── layout.tsx     # Sidebar + breadcrumb + main content area
│   │   │   ├── page.tsx       # Redirect to /upload or /analysis
│   │   │   ├── upload/        # Upload page (drag-drop, job queue)
│   │   │   ├── analysis/      # Analysis listing + [id]/ dashboard routes
│   │   │   │   ├── page.tsx   # Job list (analyses)
│   │   │   │   └── [id]/
│   │   │   │       ├── page.tsx        # Dashboard
│   │   │   │       ├── explorer/       # Log explorer (job-scoped)
│   │   │   │       └── trace/[traceId] # Trace waterfall (job+trace scoped)
│   │   │   ├── explorer/      # Global log explorer (cross-job search)
│   │   │   ├── trace/         # Trace search + recent traces
│   │   │   └── ai/            # AI assistant page
│   │   ├── globals.css        # CSS variables, theme tokens, Tailwind imports
│   │   ├── layout.tsx         # Root layout (Clerk provider, theme provider, Sonner)
│   │   └── not-found.tsx      # 404 page
│   ├── components/
│   │   ├── ui/                # shadcn/ui primitives (Button, Card, Input, etc.)
│   │   ├── layout/            # Sidebar, Breadcrumb, PageHeader, CommandPalette
│   │   ├── upload/            # DropZone, UploadProgress, JobQueue
│   │   ├── dashboard/         # HealthScore, StatsCards, TopNTable, ChartTile, CollapsibleSection
│   │   ├── explorer/          # SearchBar, LogTable, DetailPanel, FilterPanel, Timeline
│   │   ├── trace/             # Waterfall, FlameGraph, SpanList, SpanDetail, TraceFilters
│   │   ├── ai/                # ChatPanel, MessageView, SkillSelector, ConversationList
│   │   └── shared/            # ErrorBoundary, EmptyState, LoadingState, PageState
│   ├── hooks/                 # Custom React hooks
│   │   ├── use-api.ts         # TanStack Query wrappers per endpoint
│   │   ├── use-websocket.ts   # WebSocket connection + job progress subscription
│   │   ├── use-theme.ts       # Dark/light mode toggle + persistence
│   │   ├── use-keyboard.ts    # Keyboard shortcut registration
│   │   └── use-debounce.ts    # Input debouncing
│   ├── lib/
│   │   ├── api.ts             # API client (fetch wrappers, types, error handling)
│   │   ├── api-types.ts       # TypeScript types matching backend domain models
│   │   ├── websocket.ts       # WebSocket client (connect, subscribe, reconnect)
│   │   ├── sse.ts             # SSE client for AI streaming
│   │   ├── utils.ts           # Utility functions (cn, formatDate, formatDuration)
│   │   └── constants.ts       # Route paths, log type colors, keyboard shortcuts
│   ├── stores/
│   │   ├── theme-store.ts     # Zustand: dark/light mode
│   │   ├── explorer-store.ts  # Zustand: search query, filters, selected entry
│   │   └── ai-store.ts        # Zustand: active conversation, streaming state
│   └── providers/
│       ├── query-provider.tsx  # TanStack QueryClientProvider
│       └── theme-provider.tsx  # Theme context + class toggling
├── vitest.config.ts
├── next.config.ts
├── tailwind.config.ts         # Only if customization needed beyond globals.css
├── components.json            # shadcn/ui configuration
├── tsconfig.json
└── package.json
```

**Structure Decision**: Web application frontend-only rewrite. The existing `backend/` directory is untouched. The `frontend/src/` directory is completely replaced with the new structure above. Configuration files (`package.json`, `tsconfig.json`, `next.config.ts`) are updated in place. The existing `frontend/src/lib/api.ts` type definitions are preserved and expanded — they already mirror the backend domain models accurately.

## Backend API Contract (existing — no changes needed)

The Go backend at `localhost:8080/api/v1` provides all endpoints the new frontend needs:

### REST Endpoints (35 total)

| Method | Path | Handler | Purpose |
|--------|------|---------|---------|
| GET | `/health` | HealthHandler | Service health check |
| POST | `/files/upload` | UploadFileHandler | Upload log file (multipart) |
| GET | `/files` | ListFilesHandler | List uploaded files |
| POST | `/analysis` | CreateAnalysisHandler | Start analysis job |
| GET | `/analysis` | ListAnalysesHandler | List all jobs |
| GET | `/analysis/{job_id}` | GetAnalysisHandler | Get job details |
| GET | `/analysis/{job_id}/dashboard` | GetDashboardHandler | Dashboard data (stats, charts, health) |
| GET | `/analysis/{job_id}/dashboard/aggregates` | AggregatesHandler | Aggregate breakdowns |
| GET | `/analysis/{job_id}/dashboard/exceptions` | ExceptionsHandler | Error/exception data |
| GET | `/analysis/{job_id}/dashboard/gaps` | GapsHandler | Activity gaps + queue health |
| GET | `/analysis/{job_id}/dashboard/threads` | ThreadsHandler | Thread statistics |
| GET | `/analysis/{job_id}/dashboard/filters` | FiltersHandler | Filter complexity data |
| POST | `/analysis/{job_id}/report` | GenerateReportHandler | Generate analysis report |
| GET | `/analysis/{job_id}/search` | SearchLogsHandler | Search log entries (KQL) |
| GET | `/analysis/{job_id}/search/export` | ExportHandler | Export search results |
| GET | `/analysis/{job_id}/entries/{entry_id}` | GetLogEntryHandler | Single log entry |
| GET | `/analysis/{job_id}/entries/{entry_id}/context` | GetEntryContextHandler | Surrounding entries |
| GET | `/analysis/{job_id}/trace/{trace_id}` | GetTraceHandler | Trace summary |
| GET | `/analysis/{job_id}/trace/{trace_id}/waterfall` | GetWaterfallHandler | Waterfall spans |
| GET | `/analysis/{job_id}/trace/{trace_id}/export` | ExportTraceHandler | Export trace data |
| GET | `/analysis/{job_id}/transactions` | SearchTransactionsHandler | Search transactions |
| POST | `/analysis/{job_id}/trace/ai-analyze` | TraceAIHandler | AI trace analysis |
| POST | `/analysis/{job_id}/ai` | QueryAIHandler | AI query (non-streaming) |
| GET | `/trace/recent` | GetRecentTracesHandler | Recent traces |
| GET | `/search/autocomplete` | AutocompleteHandler | Field autocomplete |
| GET/POST | `/search/saved` | SavedSearchHandler | List/create saved searches |
| DELETE | `/search/saved/{search_id}` | DeleteSavedSearchHandler | Delete saved search |
| GET | `/search/history` | SearchHistoryHandler | Search history |
| POST | `/ai/stream` | AIStreamHandler | AI streaming (SSE) |
| GET | `/ai/skills` | ListSkillsHandler | List AI skills |
| GET/POST | `/ai/conversations` | ConversationsHandler | List/create conversations |
| GET/DELETE | `/ai/conversations/{id}` | ConversationDetailHandler | Get/delete conversation |
| GET | `/ws` | WSHandler | WebSocket connection |

### Authentication

- **Production**: Clerk JWT in `Authorization: Bearer <token>` header
- **Dev mode** (`DEV_MODE=true`): Headers `X-Dev-User-Id` and `X-Dev-Tenant-Id` bypass Clerk validation
- Tenant middleware injects `tenant_id` into request context after auth

### WebSocket Protocol

- **Client→Server**: `subscribe_job_progress`, `unsubscribe_job_progress`, `subscribe_live_tail`, `unsubscribe_live_tail`, `ping`
- **Server→Client**: `job_progress`, `job_complete`, `live_tail_entry`, `error`, `pong`
- Envelope: `{ "type": string, "payload": any }`

### SSE (AI Streaming)

- Endpoint: `POST /api/v1/ai/stream`
- Events streamed as `data: {"type": "token"|"done"|"error", "content": "..."}\n\n`

## Design System

### Color Tokens (CSS Variables)

Based on competitor research across 8 platforms. Dual-mode (light + dark):

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `--color-primary` | `#0066CC` | `#4DADF7` | Actions, links, active nav |
| `--color-success` | `#28A745` | `#51CF66` | Healthy, complete |
| `--color-warning` | `#FFC107` | `#FFD93D` | Slow, degraded |
| `--color-error` | `#DC3545` | `#FF6B6B` | Failed, critical |
| `--color-info` | `#17A2B8` | `#4DADF7` | Information |
| `--color-escalation` | `#8B0000` | `#FF8A8A` | AR Server escalation (unique) |
| `--color-bg-primary` | `#FFFFFF` | `#0F1419` | Page background |
| `--color-bg-secondary` | `#F8F9FA` | `#1A1E27` | Card/panel background |
| `--color-text-primary` | `#212529` | `#E8EAED` | Primary text |
| `--color-text-secondary` | `#6C757D` | `#A6ADBA` | Secondary text |

All pairs verified for WCAG 2.1 AA contrast (4.5:1 minimum for normal text).

### Log Type Color Coding

| Log Type | Color | Badge Text |
|----------|-------|-----------|
| API | Blue (`--color-primary`) | API |
| SQL | Green (`--color-success`) | SQL |
| Filter | Amber (`--color-warning`) | FLTR |
| Escalation | Dark Red (`--color-escalation`) | ESCL |

### Typography

- **UI text**: System font stack (`-apple-system, BlinkMacSystemFont, 'Segoe UI', ...`)
- **Data/logs**: Monospace (`Monaco, 'Courier New', monospace`)
- **Scale**: 12px (xs), 14px (sm/base), 16px (lg), 18px (xl), 22px (2xl)

## Architecture Decisions

### 1. State Management (TanStack Query + Zustand)

- **Server state** (API data): TanStack Query handles caching, refetching, pagination, optimistic updates
- **Client state** (UI state): Zustand stores for theme, explorer filters, AI conversation state
- No Redux, no React Context for data (only providers)

### 2. API Client Pattern

Preserve and extend the existing `frontend/src/lib/api.ts` which already has:
- 67 exported functions matching all backend endpoints
- TypeScript types mirroring Go domain models
- Auth token passing via Clerk's `getToken()`
- Error class (`ApiError`) with code/message

Wrap API functions with TanStack Query hooks in `src/hooks/use-api.ts`:
```typescript
// Example pattern
export function useAnalysis(jobId: string) {
  return useQuery({
    queryKey: ['analysis', jobId],
    queryFn: () => getAnalysis(jobId),
  });
}
```

### 3. Routing Strategy

Next.js App Router with route groups:
- `(auth)` — Clerk sign-in/sign-up (unchanged)
- `(dashboard)` — All authenticated pages, shared sidebar layout
- Dynamic routes: `/analysis/[id]`, `/analysis/[id]/trace/[traceId]`

### 4. Component Architecture

Three tiers:
1. **Primitives** (`ui/`): shadcn/ui components, unstyled or minimally themed
2. **Feature components** (`dashboard/`, `explorer/`, etc.): Composed from primitives, feature-specific logic
3. **Pages** (`app/`): Route handlers, data fetching via hooks, layout composition

### 5. Real-Time Strategy

- **Job progress**: WebSocket with auto-reconnect (exponential backoff). `useWebSocket` hook manages connection lifecycle and `subscribe_job_progress` / `unsubscribe_job_progress` messages.
- **AI streaming**: SSE via `EventSource` or fetch with ReadableStream. `streamdown` library for markdown rendering of streamed tokens.

### 6. Theme System

- CSS variables defined in `globals.css` under `:root` (light) and `.dark` (dark)
- Tailwind CSS 4 references CSS variables via `theme()` or direct `var()` usage
- Theme toggle stored in `localStorage`, defaults to `prefers-color-scheme`
- `<html>` element class toggled between `''` and `'dark'`
- No FOUC: theme applied before first paint via inline script in `<head>`

## Implementation Phases

### Phase 1: Foundation (Design System + Layout + Upload)
**Goal**: Skeleton app with navigation, theming, and file upload working

1. Set up design tokens (CSS variables for both modes)
2. Configure shadcn/ui (New York style, custom colors)
3. Build sidebar navigation component (persistent desktop, drawer mobile)
4. Build breadcrumb navigation
5. Build command palette (Cmd+K)
6. Implement theme toggle (dark/light, no flicker)
7. Create shared components (ErrorBoundary, EmptyState, LoadingState, PageState)
8. Build upload page (drag-drop zone, file picker, progress indicator)
9. Build job queue component (real-time via WebSocket)
10. Create TanStack Query provider + API hooks for files/analysis endpoints
11. Tests for layout, navigation, upload flow

### Phase 2: Dashboard + Job Management
**Goal**: Analysis dashboard rendering all data from existing API

1. Build analysis list page (job history, status filters, navigation to dashboard)
2. Build dashboard layout (responsive grid, collapsible sections)
3. Implement health score card
4. Implement stats cards (API, SQL, Filter, Escalation counts + trends)
5. Build time series chart (Recharts, responsive, themed)
6. Build distribution charts
7. Build top-N tables (sortable, clickable → drill-down)
8. Implement collapsible sections (aggregates, exceptions, gaps, threads, filters)
9. Lazy load section data on expand
10. Implement report generation (POST to API, download result)
11. Tests for dashboard components + data flow

### Phase 3: Log Explorer
**Goal**: Full search, filter, virtualized table, detail panel

1. Build search bar with KQL syntax support
2. Implement field autocomplete (from `/search/autocomplete`)
3. Build filter panel (log type, user, form, queue, time range, duration, error status)
4. Build virtualized log table (react-window, 10K+ rows)
5. Build timeline histogram (entry distribution over time, color-coded by type)
6. Build detail panel (full entry, raw text, contextual entries)
7. Implement saved searches (CRUD via `/search/saved`)
8. Implement export (CSV/JSON via `/search/export`)
9. Build search history display
10. Tests for search, filters, virtualization, detail panel

### Phase 4: Trace Viewer + AI Assistant
**Goal**: Waterfall diagram, flame graph, AI chat with streaming

1. Build trace search page (by trace ID, user, thread, RPC)
2. Build waterfall diagram (hierarchical spans, duration bars, log-type colors)
3. Build span detail sidebar (all metadata, raw fields)
4. Implement critical path highlighting
5. Build flame graph view
6. Build span list view
7. Implement view switcher (waterfall/flame/list)
8. Build trace comparison (side-by-side)
9. Build AI chat panel (message list, input, streaming display)
10. Implement SSE streaming client (token-by-token rendering via streamdown)
11. Build skill selector (5 skills + auto-routing display)
12. Build conversation list (history sidebar, new conversation)
13. Implement follow-up suggestions
14. Tests for trace views, AI streaming, conversation management

### Phase 5: Polish + Accessibility + Performance
**Goal**: Production-ready, passing all success criteria

1. WCAG 2.1 AA audit (axe-core automated + manual screen reader testing)
2. Keyboard navigation audit (all interactive elements)
3. Focus indicator styling (visible, consistent)
4. Mobile responsiveness audit (375px through 2560px)
5. Lighthouse performance optimization (code splitting, lazy loading)
6. Error boundary coverage (every page and feature section)
7. Toast notification system (Sonner) for transient errors
8. CSP header configuration
9. Test coverage gap analysis + remaining tests to reach 80%
10. Cross-browser testing (Chrome, Firefox, Safari, Edge)
11. Console error audit (zero unhandled errors)

## Complexity Tracking

No constitution violations. The rewrite stays within the existing 3-service architecture and uses the established backend API contract without modifications.

## Key Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Virtual scrolling performance at 10K+ rows | Test with react-window early (Phase 3); fallback to TanStack Virtual |
| Dark mode contrast issues | Verify all color pairs against WCAG AA (4.5:1) during Phase 1 |
| WebSocket reconnection reliability | Exponential backoff with max retry; show reconnecting indicator |
| SSE streaming token rendering | Use streamdown (already in deps); test with long responses |
| Bundle size > Lighthouse target | Code split pages, lazy load charts/waterfall; analyze with webpack-bundle-analyzer |
| Existing API types drift | Keep `api-types.ts` as single source of truth; generate from OpenAPI if drift detected |

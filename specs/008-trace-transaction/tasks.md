# Tasks: Enhanced Trace Transaction Page

**Input**: Design documents from `/specs/008-trace-transaction/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/openapi.yaml

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: Install dependencies and create package structure

- [X] T001 Install frontend dependencies: `npm install prism-react-renderer d3-scale d3-array` and dev deps `npm install -D @types/d3-scale @types/d3-array` in `frontend/`
- [X] T002 Create `backend/internal/trace/` package directory with empty `hierarchy.go` and `critical_path.go` files

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core backend types, hierarchy algorithm, and shared frontend hooks that ALL user stories depend on

**CRITICAL**: No user story work can begin until this phase is complete

- [X] T003 Add SpanNode, WaterfallResponse, TransactionSummary, and TransactionSearchResponse types to `backend/internal/domain/models.go` per data-model.md
- [X] T004 Implement Temporal+Thread Containment hierarchy inference algorithm in `backend/internal/trace/hierarchy.go`. Accept flat `[]LogEntry` sorted by timestamp, return `[]SpanNode` tree. Group by thread_id, apply temporal containment (parent fully contains child in time), use filter_level for filter nesting depth, API spans as roots, SQL as children of preceding filter/API on same thread. Handle edge cases: missing thread_id, clock skew (fall back to line_number ordering), concurrent non-contained spans as siblings.
- [X] T005 [P] Write hierarchy inference tests in `backend/internal/trace/hierarchy_test.go`. Test cases: single API root with nested filters+SQL, pre-19.x RPC ID fallback, flat trace (no nesting), 3-level filter depth, concurrent sibling spans, empty trace, single log type only.
- [X] T006 Extend ClickHouseStore interface in `backend/internal/storage/interfaces.go` with: `SearchTransactions(ctx, tenantID, jobID string, params TransactionSearchParams) ([]TransactionSummary, int, error)` method
- [X] T007 Implement `SearchTransactions` in `backend/internal/storage/clickhouse.go` — ClickHouse query that groups log_entries by trace_id with aggregated metrics (span_count, total_duration, error_count, primary_user, primary_form). Support filtering by user, thread_id, rpc_id, has_errors, min_duration_ms. Use parameterized queries with tenant_id scoping.
- [X] T008 [P] Update mocks in `backend/internal/testutil/mocks.go` to include `SearchTransactions` mock method
- [X] T009 Enhance `TraceHandler` in `backend/internal/api/handlers/trace.go`: add a new `WaterfallHandler` that calls `GetTraceEntries`, passes results through `trace.BuildHierarchy()`, computes summary stats (span_count, error_count, type_breakdown, total_duration), caches result in Redis with key `{tenant_id}:trace:waterfall:{job_id}:{trace_id}` (5 min TTL), returns `WaterfallResponse` JSON. Check Redis cache first before computing.
- [X] T010 Add `TransactionSearchHandler` in `backend/internal/api/handlers/trace.go` — handles `GET /api/v1/analysis/{job_id}/transactions` with query params: user, thread_id, trace_id, rpc_id, has_errors, min_duration_ms, limit, offset. Calls `SearchTransactions` on ClickHouseStore.
- [X] T011 Register new routes in `backend/internal/api/router.go`: `GET /analysis/{job_id}/trace/{trace_id}/waterfall`, `GET /analysis/{job_id}/transactions`, `GET /analysis/{job_id}/trace/{trace_id}/export`, `POST /analysis/{job_id}/trace/ai-analyze`, `GET /trace/recent`
- [X] T012 [P] Create `frontend/src/hooks/use-trace.ts` — React hook managing trace state: traceId, waterfall data, selectedSpanId, activeView (waterfall/flamegraph/spanlist), filters (logTypes, errorsOnly, minDurationMs, searchText), comparisonTrace, aiInsights, loading, error. Functions: fetchWaterfall(jobId, traceId), searchTransactions(jobId, params), applyFilters(), clearFilters(), setSelectedSpan(), switchView(). Uses SWR or fetch for data loading.
- [X] T013 [P] Create `frontend/src/lib/trace-utils.ts` — utility functions: `flattenSpanTree(spans: SpanNode[]): SpanNode[]` (DFS flatten for rendering), `filterSpans(spans, filters): SpanNode[]` (client-side filter), `getSpanColor(logType): {bg, border, text}` (color mapping), `formatDuration(ms): string`, `calculateStartOffset(span, traceStart): number`, `buildComparisonAlignment(traceA, traceB): AlignedSpan[]`

**Checkpoint**: Foundation ready — backend serves hierarchical waterfall data, frontend has state management and utilities. User story implementation can begin.

---

## Phase 3: User Story 1 — Waterfall Transaction View (Priority: P1) MVP

**Goal**: Render the complete execution flow of a transaction as a horizontal waterfall/Gantt chart with parent-child nesting, color-coded log types, error highlighting, and virtualized scrolling.

**Independent Test**: Enter a known Trace ID, verify waterfall shows all entries with correct nesting (API > Filter > SQL), proportional duration bars, color coding, and error highlighting.

### Implementation

- [X] T014 [P] [US1] Create `frontend/src/components/trace/timestamp-ruler.tsx` — fixed-position horizontal time axis at top of waterfall. Accept traceStart, traceEnd, zoomLevel props. Render tick marks with millisecond labels using D3 scaleTime. Support zoom via mouse wheel. Stick to top on vertical scroll.
- [X] T015 [P] [US1] Create `frontend/src/components/trace/waterfall-row.tsx` — individual span row component. Props: span (SpanNode), traceStart, totalDuration, depth, isSelected, isExpanded, onSelect, onToggleExpand. Render: indentation based on depth, colored duration bar proportional to time (left offset = start_offset_ms / totalDuration, width = duration_ms / totalDuration), log type badge, operation label, duration text, error indicator (red highlight if success=false). Use the color scheme: API=blue, SQL=green, FLTR=purple, ESCL=orange.
- [X] T016 [US1] Create `frontend/src/components/trace/waterfall.tsx` — main waterfall container. Accept WaterfallResponse data. Flatten span tree to ordered render list (DFS with depth tracking). Use react-window FixedSizeList for virtualization (row height ~48px). Render timestamp-ruler at top (sticky). For each visible row, render waterfall-row with correct depth, selection state, and expand/collapse state. Manage expanded/collapsed state for each parent span. Support click to select span (triggers detail sidebar). Handle empty state and loading skeleton.
- [X] T017 [US1] Redesign `frontend/src/app/(dashboard)/trace/page.tsx` — replace entire page with new layout. Add job_id context (from URL or selection). On load, show trace search input. When trace is loaded via use-trace hook, render: summary header area (placeholder for US4), waterfall component as main content, detail sidebar area (placeholder for US2). Add RPC ID fallback warning banner when `correlation_type === "rpc_id"`. Handle empty trace (0 entries) with helpful message. Handle loading and error states.
- [X] T018 [US1] Add expand/collapse behavior to waterfall — when a parent span is collapsed, hide all descendants. Show expand/collapse chevron icon on parent spans. Track collapsed span IDs in state. Default: top-level expanded, deeper levels collapsed for traces with 100+ spans.
- [X] T019 [US1] Implement error highlighting in waterfall rows — spans with `success=false` or `error_message != ""` get red-tinted background, red left border, and error indicator (red highlight if success=false).

**Checkpoint**: Waterfall renders hierarchical trace data with color coding, nesting, error highlights, and virtualized scrolling. Core visualization is complete.

---

## Phase 4: User Story 2 — Span Detail Sidebar (Priority: P1)

**Goal**: Click any span to open a detail sidebar showing type-specific fields, correlation IDs, SQL syntax highlighting, and a link to the Log Explorer.

**Independent Test**: Click a SQL span, verify sidebar shows SQL query with syntax highlighting, duration, percentage of total, all IDs, and working "View in Log Explorer" link.

### Implementation

- [X] T020 [US2] Create `frontend/src/components/trace/span-detail-sidebar.tsx` — slide-in sidebar panel (right side, ~400px wide). Accept selectedSpan (SpanNode | null), totalDuration, traceId, jobId. When span is selected: show close button, span type badge, common fields section (timestamp, duration, % of total trace, thread_id, trace_id, rpc_id, user, queue, form), then type-specific section based on log_type. Include "View in Log Explorer" button at bottom that navigates to `/explorer?job_id={jobId}&entry_id={span.id}`. Show correlation IDs as copyable text.
- [X] T021 [P] [US2] Add API span detail section in sidebar — show: operation type (GET/SET/CREATE/DELETE/MERGE), API code, form name, user, queue, overlay group (from fields.overlay_group if present), request_id.
- [X] T022 [P] [US2] Add SQL span detail section with syntax highlighting — use prism-react-renderer v2 with SQL language. Show: sql_statement (highlighted in a code block), sql_table, execution time (duration_ms), queue_time_ms (if > 0), success/failure status with error_message if failed.
- [X] T023 [P] [US2] Add Filter span detail section — show: filter_name, filter_level (displayed as "Phase 1/2/3"), operation that triggered it, form, pass/fail status (from success field), request_id.
- [X] T024 [P] [US2] Add Escalation span detail section — show: esc_name, esc_pool, scheduled_time vs actual timestamp (with delay_ms if > 0), error_encountered flag, error_message if present.
- [X] T025 [US2] Wire span selection from waterfall to sidebar — when waterfall-row is clicked, call use-trace setSelectedSpan(). Sidebar renders based on selectedSpan state. Clicking outside sidebar or pressing Escape closes it. Highlight selected span row in waterfall.

**Checkpoint**: Full drill-down capability. Users can click any span to see complete details with SQL highlighting and Log Explorer links.

---

## Phase 5: User Story 3 — Transaction Search & Discovery (Priority: P2)

**Goal**: Search for transactions by Trace ID, RPC ID, Thread ID, or User. Browse recently viewed traces.

**Independent Test**: Search by username, verify transaction list appears with IDs/durations/counts. Click one to load waterfall.

### Implementation

- [X] T026 [US3] Create `frontend/src/components/trace/trace-search.tsx` — search input with dropdown. Accept onTraceSelected(traceId, jobId) callback. Input field accepts Trace ID, RPC ID, Thread ID, or username. Auto-detect input type: if matches UUID-like pattern → trace_id search, if starts with digit and is short → thread_id, else → user search. On Enter, call searchTransactions from use-trace hook. Show results as dropdown list with: trace_id (truncated), user, timestamp, duration, span count, error count badge. Click result → load waterfall. Show "No transactions found" empty state.
- [X] T027 [US3] Add recent traces storage — in use-trace hook, maintain a `recentTraces` array (max 20) in React state (session-scoped). When a trace is loaded, add to front of array (deduplicate by traceId). On search input focus, show recent traces dropdown if no search text. Each recent item shows: trace_id, user, timestamp, duration.
- [X] T028 [US3] Add `RecentTracesHandler` in `backend/internal/api/handlers/trace.go` — `GET /api/v1/trace/recent`. Read recent trace summaries from Redis list at key `{tenant_id}:trace:recent:{user_id}`. Return up to 20 entries. When waterfall is loaded, push trace summary to Redis list with LPUSH + LTRIM to 20.
- [X] T029 [US3] Integrate trace search into page — replace the simple text input in trace page.tsx with the trace-search component. Pass job_id from URL context. Wire onTraceSelected to load waterfall. Support deep-linking via URL query params: `/trace?job_id=X&trace_id=Y` auto-loads the waterfall on page load.

**Checkpoint**: Users can discover transactions by multiple criteria and access recent traces. Search → waterfall flow is complete.

---

## Phase 6: User Story 4 — Trace Summary Header (Priority: P2)

**Goal**: Display a summary header above the waterfall with key metrics, type breakdown, error count, and mini-timeline.

**Independent Test**: Load a trace, verify header shows correct total duration, accurate entry counts per type, error count, and mini-timeline.

### Implementation

- [X] T030 [P] [US4] Create `frontend/src/components/trace/trace-summary-header.tsx` — accepts WaterfallResponse data. Layout: row of stat cards. Show: Trace ID with copy-to-clipboard button, primary user, primary queue, total duration (formatted: "1.2s" or "345ms"), total span count. Below stats row: type breakdown badges (colored pills: "12 API" in blue, "45 SQL" in green, "23 Filter" in purple, "2 Escalation" in orange). Error count badge in red if > 0 (e.g., "3 errors"). Correlation type indicator ("Trace ID" or "RPC ID fallback" with warning icon).
- [X] T031 [P] [US4] Add mini-timeline bar to summary header — horizontal bar showing proportional distribution of spans over the trace duration. Each span rendered as a thin colored tick mark (by log type). Error spans marked in red. Gives at-a-glance view of where activity is concentrated.
- [X] T032 [US4] Wire summary header into trace page — render trace-summary-header above waterfall when trace is loaded. Pass waterfall response data.

**Checkpoint**: Users see a complete overview before diving into waterfall detail.

---

## Phase 7: User Story 5 — In-Trace Filtering (Priority: P3)

**Goal**: Filter within a loaded trace by log type, errors, duration, and text search without reloading data.

**Independent Test**: Load a 100+ span trace, filter to SQL only, verify only SQL spans shown with "filtered" indicator.

### Implementation

- [X] T033 [US5] Create `frontend/src/components/trace/trace-filters.tsx` — filter toolbar above waterfall. Contains: text search input (debounced 300ms), log type checkbox group (API/SQL/Filter/Escalation — all checked by default), "Errors only" toggle switch, duration threshold input ("Min duration" with ms suffix), active filter count badge, "Clear all" button. Emits filter state changes to use-trace hook.
- [X] T034 [US5] Implement client-side filter logic in `frontend/src/hooks/use-trace.ts` — add `filteredSpans` computed from waterfall.spans + active filters. Text search: match against operation, filter_name, form, user, sql_statement, error_message fields — matching spans highlighted, non-matching dimmed (opacity 0.3). Log type filter: show only matching types but preserve parent chain for context. Errors only: show failed spans + their ancestor chain. Duration threshold: show spans with duration_ms >= threshold. Multiple filters AND together.
- [X] T035 [US5] Wire filters into waterfall — waterfall component receives filtered/highlighted span list from use-trace. Filtered-out spans are either hidden or dimmed based on filter type (text search = dim, type filter = hide). Show "Showing X of Y spans" indicator when filters active. "Clear all" resets to full trace.

**Checkpoint**: Users can focus on relevant spans in large traces. All filter types work in combination.

---

## Phase 8: User Story 6 — Alternative Views (Priority: P3)

**Goal**: Switch between Waterfall, Flame Graph, and Span List views. Filters persist across views.

**Independent Test**: Load trace, switch to Flame Graph (verify hierarchy), switch to Span List (verify sortable table), verify filters persist.

### Implementation

- [X] T036 [P] [US6] Create `frontend/src/components/trace/view-switcher.tsx` — segmented control with 3 options: Waterfall (default), Flame Graph, Span List. Uses shadcn/ui Tabs or ToggleGroup. Emits activeView change to use-trace hook.
- [X] T037 [P] [US6] Create `frontend/src/components/trace/flame-graph.tsx` — D3-based icicle chart (top-down). Accept spans (SpanNode tree) and filters. Each span = horizontal rectangle, width proportional to duration relative to parent. Stacked vertically by depth. Color by log type. Click span → open detail sidebar. Hover tooltip with span name + duration. Root spans at top, children below. SVG-based rendering. Handle zoom via click-to-zoom-into-subtree.
- [X] T038 [P] [US6] Create `frontend/src/components/trace/span-list.tsx` — sortable table using react-window for virtualization. Columns: timestamp, log type (colored badge), operation/name, duration (ms), user, form, status (success/fail icon). Click column header → sort ascending/descending. Click row → open detail sidebar. Accept filtered span list from use-trace. Show all spans flat (ignore hierarchy).
- [X] T039 [US6] Integrate view switcher into trace page — render view-switcher below summary header, above main content. Based on activeView from use-trace: render waterfall, flame-graph, or span-list. All views receive the same filtered span data. All views trigger the same detail sidebar on span click. Filters persist when switching views (FR-023).

**Checkpoint**: Three visualization modes available. Same data, same filters, different perspectives.

---

## Phase 9: User Story 7 — Critical Path Analysis (Priority: P4)

**Goal**: Highlight the critical path in the waterfall showing which spans contributed to total latency.

**Independent Test**: Load trace with parallel operations, enable critical path, verify longest chain highlighted and parallel spans dimmed.

### Implementation

- [X] T040 Implement critical path algorithm in `backend/internal/trace/critical_path.go` — longest-path computation on span tree. For each span, compute: self_time = duration - sum(children durations), contribution = time this span adds to total trace duration considering parallelism. Mark spans on the critical path (longest sequential chain from root to leaf). Return ordered list of span IDs on critical path.
- [X] T041 [P] Write critical path tests in `backend/internal/trace/critical_path_test.go` — test cases: single linear chain (all on critical path), parallel branches (only longest marked), nested parallelism, single-span trace, trace with gaps.
- [X] T042 Wire critical path into waterfall handler — in `backend/internal/api/handlers/trace.go` WaterfallHandler, after building hierarchy, call `ComputeCriticalPath(spans)`. Set `on_critical_path=true` on matching spans. Include `critical_path` array in WaterfallResponse. Controlled by `include_critical_path=true` query param (default true).
- [X] T043 [US7] Add critical path toggle and visualization in waterfall — add "Show Critical Path" toggle button in filter toolbar. When enabled, spans on critical path get bold left border (2px solid) in their type color. Non-critical spans are visually dimmed (opacity 0.5). In detail sidebar, show "Critical Path: X% contribution to total latency" for spans on the path.

**Checkpoint**: Critical path analysis reveals true bottlenecks vs concurrent noise.

---

## Phase 10: User Story 8 — Trace Comparison (Priority: P4)

**Goal**: Compare two traces side-by-side with aligned operations and duration differences highlighted.

**Independent Test**: Load two traces of same operation, verify split-view shows both waterfalls with duration deltas highlighted.

### Implementation

- [X] T044 [P] [US8] Implement comparison alignment in `frontend/src/lib/trace-utils.ts` — `buildComparisonAlignment(traceA, traceB)` function. Align spans by: (1) same operation type + form name, (2) same log type at same depth, (3) same filter_name or api_code. For each aligned pair, compute duration delta (B.duration - A.duration). Flag as "anomalous" if delta > 2x standard deviation. Return aligned pairs with deltas.
- [X] T045 [US8] Create `frontend/src/components/trace/trace-comparison.tsx` — split-view layout (50/50 horizontal split). Left: Trace A waterfall (compact mode). Right: Trace B waterfall (compact mode). Aligned rows connected by a center column showing duration delta (green if faster, red if slower, with ms delta label). Click "Compare" button → show trace search to select second trace. Both sides support span click → shared detail sidebar showing both spans side by side.
- [X] T046 [US8] Integrate comparison into trace page — add "Compare" button in summary header (only when a trace is loaded). When clicked, show a trace search modal for second trace. Load second trace via use-trace comparisonTrace state. When both traces loaded, switch to comparison view. Add "Exit Comparison" button to return to single trace view.

**Checkpoint**: Side-by-side comparison reveals where and why performance differs between traces.

---

## Phase 11: User Story 9 — AI-Powered Trace Insights (Priority: P5)

**Goal**: AI analysis of the trace providing natural-language explanation, bottleneck identification, and optimization suggestions.

**Independent Test**: Load trace with known bottleneck, click "Analyze with AI", verify streaming response identifies the issue.

### Implementation

- [X] T047 [US9] Add trace-analyzer AI skill in `backend/internal/api/handlers/ai.go` — new `TraceAnalyzeHandler` at `POST /api/v1/analysis/{job_id}/trace/ai-analyze`. Accept `{trace_id, focus}` body. Load waterfall data (from cache or compute). Build prompt with trace hierarchy summary: span count, duration, error count, top 10 slowest spans, critical path description, error details. Send to Claude API via anthropic-sdk-go with streaming. Stream SSE response to client. Support focus modes: "bottleneck" (default), "errors", "flow", "optimization". Handle AI service unavailable with 503 + fallback message. Follow AI-as-a-Skill pattern: typed input/output, evaluation examples, fallback behavior.
- [X] T048 [US9] Create `frontend/src/components/trace/ai-insights.tsx` — collapsible panel below waterfall. "Analyze with AI" button triggers POST to ai-analyze endpoint. Display streaming response using EventSource/fetch with ReadableStream. Show loading state with animated indicator. Render markdown response with proper formatting. Show focus mode selector (Bottleneck/Errors/Flow/Optimization). Handle error state: show "AI analysis unavailable" message with retry option. Close button to dismiss panel.
- [X] T049 [US9] Integrate AI insights into trace page — add "Analyze with AI" button in summary header or toolbar. When clicked, expand ai-insights panel below waterfall. Pass current traceId and jobId. AI panel persists until manually closed.

**Checkpoint**: AI-powered analysis provides actionable insights for trace troubleshooting.

---

## Phase 12: Polish & Cross-Cutting Concerns

**Purpose**: Navigation, sharing, export, and integration with other pages

- [X] T050 Add breadcrumb navigation to trace page in `frontend/src/app/(dashboard)/trace/page.tsx` — show "Dashboard > Job {name} > Trace {id}" breadcrumbs at top. Link Dashboard to `/`, Job to `/analysis/{job_id}`. Use shadcn/ui Breadcrumb component.
- [X] T051 [P] Implement permalink/share URL support — ensure trace page URL includes all state: `/trace?job_id=X&trace_id=Y&view=waterfall`. Update URL on trace load and view change using Next.js useRouter/useSearchParams. Support direct navigation to a trace via URL.
- [X] T052 [P] Implement trace export in `backend/internal/api/handlers/trace.go` — new `ExportHandler` at `GET /api/v1/analysis/{job_id}/trace/{trace_id}/export?format=json|csv`. JSON: stream WaterfallResponse. CSV: flatten spans with columns (id, log_type, timestamp, duration_ms, operation, user, form, status, parent_id, depth). Set Content-Disposition header for download.
- [X] T053 [P] Add export button in frontend — add "Export" dropdown button in summary header with JSON and CSV options. On click, trigger download via fetch with blob response. Show download progress indicator.
- [X] T054 Add "Trace" link to dashboard top-N tables in `frontend/src/components/dashboard/top-n-table.tsx` — for rows that have a trace_id field, render the trace_id as a clickable link navigating to `/trace?job_id={jobId}&trace_id={traceId}`. Use the same link style as existing "View in Explorer" links.
- [X] T055 Handle edge cases in trace page — empty trace (0 spans): show "No entries found" with suggestions. Very large trace (1000+ spans): ensure virtualization handles it smoothly, default collapse deeper nesting. Single log type: show notice "Only {type} logs available". Mixed correlation (trace_id + rpc_id): prefer trace_id, show info banner.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 — BLOCKS all user stories
- **US1 Waterfall (Phase 3)**: Depends on Phase 2 — MVP deliverable
- **US2 Sidebar (Phase 4)**: Depends on Phase 2 + T016 (waterfall click handler)
- **US3 Search (Phase 5)**: Depends on Phase 2 — can run in parallel with US1/US2
- **US4 Header (Phase 6)**: Depends on Phase 2 — can run in parallel with US1/US2/US3
- **US5 Filtering (Phase 7)**: Depends on US1 (waterfall must exist to filter)
- **US6 Alt Views (Phase 8)**: Depends on US1 (waterfall as default view)
- **US7 Critical Path (Phase 9)**: Depends on Phase 2 (hierarchy algorithm)
- **US8 Comparison (Phase 10)**: Depends on US1 (waterfall component to reuse)
- **US9 AI Insights (Phase 11)**: Depends on Phase 2 (waterfall data)
- **Polish (Phase 12)**: Depends on US1-US4 at minimum

### User Story Dependencies

```
Phase 2 (Foundational)
  ├── US1 (P1: Waterfall) ──→ US5 (P3: Filtering)
  │                       ──→ US6 (P3: Alt Views)
  │                       ──→ US8 (P4: Comparison)
  ├── US2 (P1: Sidebar)   [parallel with US1 after T016]
  ├── US3 (P2: Search)    [parallel with US1]
  ├── US4 (P2: Header)    [parallel with US1]
  ├── US7 (P4: Critical)  [parallel with US1]
  └── US9 (P5: AI)        [parallel with US1]
```

### Within Each User Story

- Backend tasks before frontend tasks (when backend provides data)
- Shared components before integration tasks
- Core rendering before interactive features (expand/collapse, click handling)

### Parallel Opportunities

**During Phase 2** (after T003 types are defined):
- T004 + T005 (hierarchy algo + tests) in parallel with T006 + T007 (ClickHouse queries)
- T012 + T013 (frontend hook + utils) in parallel with backend tasks

**During Phase 3 (US1)**:
- T014 + T015 (timestamp-ruler + waterfall-row) in parallel

**During Phase 4 (US2)**:
- T021 + T022 + T023 + T024 (all four type-specific detail sections) in parallel

**During Phase 5-6 (US3 + US4)**:
- Entire US3 and US4 can run in parallel with each other

**During Phase 7-8 (US5 + US6)**:
- T036 + T037 + T038 (view-switcher + flame-graph + span-list) in parallel

**During Phase 9-11**:
- US7, US8, US9 can all run in parallel (independent features)

**During Phase 12**:
- T050 + T051 + T052 + T053 + T054 all touch different files, can run in parallel

---

## Parallel Example: Phase 2 (Foundational)

```
# Batch 1 — backend types + frontend scaffolding:
Task T003: Add domain types to models.go
Task T012: Create use-trace.ts hook
Task T013: Create trace-utils.ts

# Batch 2 — backend logic (after T003):
Task T004: Hierarchy algorithm in hierarchy.go
Task T005: Hierarchy tests in hierarchy_test.go
Task T006: Extend ClickHouseStore interface
Task T008: Update mocks

# Batch 3 — backend wiring (after T004, T006):
Task T007: Implement SearchTransactions in clickhouse.go
Task T009: Waterfall handler in trace.go
Task T010: Transaction search handler in trace.go
Task T011: Register routes in router.go
```

## Parallel Example: Phase 4 (US2 — Sidebar)

```
# All four type-specific sections can be built simultaneously:
Task T021: API span detail section
Task T022: SQL span detail with syntax highlighting
Task T023: Filter span detail section
Task T024: Escalation span detail section
```

---

## Implementation Strategy

### MVP First (US1 + US2 = Waterfall + Sidebar)

1. Complete Phase 1: Setup (T001-T002)
2. Complete Phase 2: Foundational (T003-T013)
3. Complete Phase 3: US1 Waterfall (T014-T019)
4. Complete Phase 4: US2 Sidebar (T020-T025)
5. **STOP and VALIDATE**: Waterfall + sidebar working end-to-end
6. Deploy/demo: users can enter Trace ID → see hierarchical waterfall → click spans for details

### Incremental Delivery

1. **MVP**: Setup + Foundation + US1 + US2 → Waterfall with drill-down (19 tasks)
2. **+Discovery**: US3 + US4 → Search + summary header (7 tasks)
3. **+Filtering/Views**: US5 + US6 → In-trace filtering + flame graph + span list (7 tasks)
4. **+Advanced**: US7 + US8 → Critical path + comparison (7 tasks)
5. **+AI**: US9 → AI insights (3 tasks)
6. **+Polish**: Navigation, export, links (6 tasks)

Each increment is independently deployable and adds value.

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks
- [Story] label maps task to specific user story for traceability
- No ClickHouse or PostgreSQL schema changes needed — all fields already exist
- Redis used for caching (hierarchy computation) and session data (recent traces)
- Frontend dependencies: prism-react-renderer (SQL highlighting), d3-scale/d3-array (axes), react-window (virtualization)
- Total: 55 tasks across 12 phases, 9 user stories

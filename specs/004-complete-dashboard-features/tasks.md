# Tasks: Complete Dashboard Features

**Input**: Design documents from `/specs/004-complete-dashboard-features/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

**Tests**: Tests are included as the spec explicitly requires unit tests (FR-018, FR-019) and the constitution mandates test-first development (Article III).

**Organization**: Tasks are grouped by user story. Stories within the same priority level can be parallelized. All backend query functions are in the Foundational phase because multiple stories depend on them.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Backend**: `backend/internal/` (Go)
- **Frontend**: `frontend/src/` (TypeScript/React)
- **Tests**: `backend/internal/api/handlers/*_test.go`, `backend/internal/storage/*_test.go`

---

## Phase 1: Setup

**Purpose**: No new project setup needed. All infrastructure exists. This phase ensures the branch is ready and validates existing code compiles.

- [x] T001 Verify backend compiles cleanly by running `go build ./...` from `backend/`
- [x] T002 Verify frontend compiles cleanly by running `npm run build` from `frontend/`

---

## Phase 2: Foundational (Backend ClickHouse Query Functions)

**Purpose**: Add all 6 new ClickHouse query methods that multiple user stories depend on. These MUST complete before any handler or frontend work begins.

- [x] T003 [P] Implement `GetAggregates(ctx, tenantID, jobID string) (*domain.AggregatesResponse, error)` method in `backend/internal/storage/clickhouse.go` — Three GROUP BY queries: API by form, API by user, SQL by sql_table. Each returns AggregateGroup with name, count, total_ms, avg_ms, min_ms, max_ms, error_count, error_rate, unique_traces. Compute grand totals per section. Use SQL patterns from `data-model.md`.

- [x] T004 [P] Implement `GetExceptions(ctx, tenantID, jobID string) (*domain.ExceptionsResponse, error)` method in `backend/internal/storage/clickhouse.go` — GROUP BY error pattern (first 100 chars of error_message) with count, first/last seen, sample context fields. Also compute per-log-type error rates (countIf(success=false AND log_type=X) / countIf(log_type=X)) and extract top error codes. Use SQL patterns from `data-model.md`.

- [x] T005 [P] Implement `GetGaps(ctx, tenantID, jobID string) (*domain.GapsResponse, error)` method in `backend/internal/storage/clickhouse.go` — Two subqueries using `neighbor()` function: (1) line gaps across all entries ordered by timestamp, (2) thread gaps per thread_id. Each returns top 50 by duration_ms DESC. Filter out last-row artifacts where neighbor returns zero. Use SQL patterns from `data-model.md`.

- [x] T006 [P] Implement `GetThreadStats(ctx, tenantID, jobID string) (*domain.ThreadStatsResponse, error)` method in `backend/internal/storage/clickhouse.go` — GROUP BY thread_id with total_calls, total_ms, avg_ms, max_ms, error_count. Compute busy_pct as `SUM(duration_ms) / dateDiff('millisecond', MIN(timestamp), MAX(timestamp)) * 100`. Cap at 100. Include total_threads count. Use SQL patterns from `data-model.md`.

- [x] T007 [P] Implement `GetFilterComplexity(ctx, tenantID, jobID string) (*domain.FilterComplexityResponse, error)` method in `backend/internal/storage/clickhouse.go` — Two queries: (1) most_executed: GROUP BY filter_name ORDER BY count DESC LIMIT 50, (2) per_transaction: GROUP BY trace_id, filter_name with execution_count, total_ms, avg_ms, max_ms. Include total_filter_time_ms. Use SQL patterns from `data-model.md`.

- [x] T008 [P] Implement `ComputeHealthScore(ctx, tenantID, jobID string) (*domain.HealthScore, error)` method in `backend/internal/storage/clickhouse.go` — Single compound query to fetch: overall error rate, average duration_ms, max thread busy_pct (from subquery), max gap duration. Apply weighted scoring algorithm from research.md (R4): Error Rate 0.30, Avg Response Time 0.25, Thread Saturation 0.25, Gap Frequency 0.20. Return HealthScore with factors array and composite score/status.

- [x] T009 Update `queryTopN` function in `backend/internal/storage/clickhouse.go` to SELECT additional type-specific fields (sql_statement, sql_table for SQL; filter_name, filter_level for FLTR; esc_name, esc_pool, delay_ms for ESCL; queue_time_ms for all types) and encode them as JSON in the TopNEntry.Details field per research.md (R5).

**Checkpoint**: All ClickHouse query functions ready. Run `go build ./...` to verify compilation.

---

## Phase 3: User Story 1 — Performance Aggregates Dashboard (Priority: P1) MVP

**Goal**: Users can view aggregated performance statistics grouped by form, user, and table on the analysis dashboard.

**Independent Test**: Complete an analysis, navigate to dashboard, scroll to Aggregates section, verify tabbed tables show per-form, per-user, per-table data with correct totals.

### Tests for User Story 1

- [x] T010 [P] [US1] Write unit tests for AggregatesHandler in `backend/internal/api/handlers/aggregates_test.go` — Test cases: (1) success path returns 200 with valid JSON matching AggregatesResponse schema, (2) cache hit returns cached data without calling ClickHouse, (3) missing job returns 404, (4) incomplete job returns 409, (5) wrong tenant returns 404. Mock ClickHouseClient and RedisClient interfaces.

### Implementation for User Story 1

- [x] T011 [US1] Replace stub in `backend/internal/api/handlers/aggregates.go` with full AggregatesHandler implementation — Follow DashboardHandler pattern from `backend/internal/api/handlers/dashboard.go`: inject ClickHouseClient, RedisClient, PostgresClient. Extract tenant_id from context, parse job_id from mux.Vars. Validate job ownership and completion status via PostgresClient. Check Redis cache key `remedyiq:{tenantID}:aggregates:{jobID}`. On miss, call `clickhouse.GetAggregates()`. Cache result with 5-min TTL. Return JSON via `api.JSON()`.

- [x] T012 [P] [US1] Create `frontend/src/components/dashboard/aggregates-section.tsx` — Tabbed interface using shadcn/ui Tabs with three tabs: "API by Form", "API by User", "SQL by Table". Each tab renders a sortable Table (shadcn/ui Table) with columns: Name, Count, OK, Fail, MIN (ms), MAX (ms), AVG (ms), SUM (ms). Default sort by SUM Time descending. Grand total row at bottom with bold styling. Client-side sorting via React state. Handle loading state with skeleton rows, error state with retry button, empty state with "No [type] activity detected" message. Use react-window for virtual scrolling if rows > 100.

- [x] T013 [US1] Integrate aggregates section into `frontend/src/app/(dashboard)/analysis/[id]/page.tsx` — Import AggregatesSection component. Add `useLazySection` hook call with `getDashboardAggregates(id)` fetch function. Place the section below the existing distribution chart with a ref div for intersection observer. Pass data, loading, error, and refetch to the component.

**Checkpoint**: Aggregates endpoint returns real data; frontend shows tabbed tables with lazy loading. Verify by uploading a sample log and checking dashboard.

---

## Phase 4: User Story 2 — Exception and Error Reports (Priority: P1)

**Goal**: Users can see all exceptions/errors grouped by code with frequency, error rates, and sample context.

**Independent Test**: Analyze a log file with errors, open Exceptions section, verify error groups, rates, and expandable details.

### Tests for User Story 2

- [x] T014 [P] [US2] Write unit tests for ExceptionsHandler in `backend/internal/api/handlers/exceptions_test.go` — Same test pattern as T010: success, cache hit, missing job, incomplete job, wrong tenant. Additionally test that zero-error analysis returns empty exceptions array with zero error_rates.

### Implementation for User Story 2

- [x] T015 [US2] Replace stub in `backend/internal/api/handlers/exceptions.go` with full ExceptionsHandler implementation — Same handler pattern as aggregates (T011). Cache key: `remedyiq:{tenantID}:exceptions:{jobID}`. Call `clickhouse.GetExceptions()`.

- [x] T016 [P] [US2] Create `frontend/src/components/dashboard/exceptions-section.tsx` — Top section: error rate badges per log type (API, SQL, FLTR, ESCL) using shadcn/ui Badge with color coding (green <1%, yellow <5%, red >=5%). Summary bar showing top 3 error codes by frequency. Below: expandable list of exception entries using shadcn/ui Collapsible. Each entry shows error_code, count, log_type, first/last seen. Expanded view shows sample_line, sample_trace, queue, form, user. Zero-errors state: green checkmark with "No errors detected in this analysis".

- [x] T017 [US2] Integrate exceptions section into `frontend/src/app/(dashboard)/analysis/[id]/page.tsx` — Same lazy-loading pattern as aggregates (T013). Place after the aggregates section.

**Checkpoint**: Exceptions endpoint returns error data; frontend shows error rates and expandable exception list.

---

## Phase 5: User Story 3 — Gap Analysis (Priority: P2)

**Goal**: Users can see the longest periods of log silence (line gaps and thread gaps) for identifying system hangs.

**Independent Test**: Analyze a log file, open Gap Analysis section, verify line gaps and thread gaps are listed with durations and line references.

### Tests for User Story 3

- [x] T018 [P] [US3] Write unit tests for GapsHandler in `backend/internal/api/handlers/gaps_test.go` — Same handler test pattern. Additionally test that response with no gaps returns empty gaps array.

### Implementation for User Story 3

- [x] T019 [US3] Replace stub in `backend/internal/api/handlers/gaps.go` with full GapsHandler implementation — Same handler pattern. Cache key: `remedyiq:{tenantID}:gaps:{jobID}`. Call `clickhouse.GetGaps()`.

- [x] T020 [P] [US3] Create `frontend/src/components/dashboard/gaps-section.tsx` — Tabbed interface: "Line Gaps" and "Thread Gaps" using shadcn/ui Tabs. Each tab renders a ranked table with columns: Rank, Gap Duration (auto-formatted: ms/s/min based on magnitude per FR-014), Start Time, End Time, Before Line, After Line, Log Type. Thread gaps tab adds Thread ID column. Highlight gaps >60s as critical with red left border and warning icon. Empty state: green checkmark with "Log shows continuous activity - no significant gaps detected". Gaps >1 hour marked as "Critical Gaps" with distinct red styling.

- [x] T021 [US3] Integrate gaps section into `frontend/src/app/(dashboard)/analysis/[id]/page.tsx` — Same lazy-loading pattern. Place after exceptions section.

**Checkpoint**: Gaps endpoint returns line/thread gap data; frontend shows ranked gap tables with critical highlighting.

---

## Phase 6: User Story 4 — Thread Statistics and Queue Health (Priority: P2)

**Goal**: Users can see per-thread utilization statistics to identify thread saturation.

**Independent Test**: Analyze a log file, open Thread Statistics section, verify thread table with busy percentages and warning indicators.

### Tests for User Story 4

- [x] T022 [P] [US4] Write unit tests for ThreadsHandler in `backend/internal/api/handlers/threads_test.go` — Same handler test pattern. Test that threads with 0% busy are returned without warning flags.

### Implementation for User Story 4

- [x] T023 [US4] Replace stub in `backend/internal/api/handlers/threads.go` with full ThreadsHandler implementation — Same handler pattern. Cache key: `remedyiq:{tenantID}:threads:{jobID}`. Call `clickhouse.GetThreadStats()`.

- [x] T024 [P] [US4] Create `frontend/src/components/dashboard/threads-section.tsx` — Summary badge: "N threads detected". Table with columns: Thread ID, Total Calls, Total Time (ms), Avg Time (ms), Max Time (ms), Errors, Busy %. Busy% cell rendered as a colored progress bar (green <50%, yellow 50-89%, red >=90%). Rows with busy >90% get a warning icon and amber background per FR-012. Sortable columns, default sort by busy_pct descending. Empty state: "No thread data available".

- [x] T025 [US4] Integrate threads section into `frontend/src/app/(dashboard)/analysis/[id]/page.tsx` — Same lazy-loading pattern. Place after gaps section.

**Checkpoint**: Threads endpoint returns per-thread stats; frontend shows utilization table with saturation warnings.

---

## Phase 7: User Story 5 — Enhanced Top-N Tables (Priority: P2)

**Goal**: Existing top-N tables show type-specific columns, expandable detail rows, and "View in Explorer" links.

**Independent Test**: Analyze a log file, check each top-N tab shows type-specific columns, expand a row to see full details, click "View in Explorer" to navigate.

### Implementation for User Story 5

- [x] T026 [US5] Enhance `frontend/src/components/dashboard/top-n-table.tsx` — (a) Parse the `details` JSON field from TopNEntry to extract type-specific data. (b) SQL tab: add columns for Table Name, SQL Statement (truncated to 80 chars), Queue Wait Time. (c) Filters tab: add columns for Filter Name, Filter Level, Filters/Second. (d) Escalations tab: add columns for Escalation Name, Pool, Delay Duration. (e) All tabs: add Queue Wait Time column. (f) Add expandable row: clicking a row or "Expand" button reveals a detail panel showing raw_text, trace_id, rpc_id, thread_id, and all available fields. (g) Add "View in Explorer" link per row that navigates to `/explorer?line={lineNumber}&job={jobId}`.

**Checkpoint**: All 4 top-N tabs show type-specific data; rows expand; explorer links work.

---

## Phase 8: User Story 7 — Performance Health Score (Priority: P2)

**Goal**: Composite health score (0-100) appears at the top of the dashboard with color coding and factor breakdown.

**Independent Test**: Analyze a log file, verify health score appears above the fold with correct color and factor breakdown.

### Implementation for User Story 7

- [x] T027 [US7] Update `backend/internal/api/handlers/dashboard.go` — After calling `GetDashboardData()`, call `clickhouse.ComputeHealthScore(ctx, tenantID, jobID)` and assign the result to `dash.HealthScore`. The health score is included in the cached dashboard response (same cache key, same TTL).

- [x] T028 [P] [US7] Create `frontend/src/components/dashboard/health-score-card.tsx` — Circular score indicator (SVG ring) colored by status: green >80, yellow 50-80, red <50. Score number in center. Below the score: grid of 4 factor cards, each showing factor name, individual score/maxScore, a mini progress bar, and description text. Red-zone factors get a warning icon and red accent per FR-030. Responsive: 2-column grid on desktop, stacked on mobile.

- [x] T029 [US7] Integrate health score into `frontend/src/app/(dashboard)/analysis/[id]/page.tsx` — Import HealthScoreCard. Render it at the top of the dashboard, before stats cards. Pass `dashboard.health_score` data. No lazy loading needed (part of initial dashboard fetch per FR-031).

**Checkpoint**: Dashboard shows health score at top. Green for clean logs, red for error-heavy logs.

---

## Phase 9: User Story 6 — Enhanced Time-Series and Distribution Charts (Priority: P3)

**Goal**: Time-series chart shows duration/error overlays with zoom; distribution chart supports dimension switching.

**Independent Test**: Analyze a log file, toggle duration/error overlays on time-series chart, zoom into a time range, switch distribution chart dimensions.

### Implementation for User Story 6

- [x] T030 [US6] Enhance `frontend/src/components/dashboard/time-series-chart.tsx` — (a) Add two toggle buttons using shadcn/ui Switch: "Show Duration" and "Show Errors". (b) When "Show Duration" is on, render an additional Line for `avg_duration_ms` on a secondary YAxis (right side, yAxisId="duration"). (c) When "Show Errors" is on, render an Area for `error_count` with semi-transparent red fill. (d) Add Recharts Brush component below the chart for click-and-drag time range zoom. (e) Handle sub-minute data: if all timestamps within same minute, group by second instead.

- [x] T031 [US6] Enhance `frontend/src/components/dashboard/distribution-chart.tsx` — (a) Add a dimension selector dropdown using shadcn/ui Select with options: "By Type" (default), "By Queue", "By Form", "By User", "By Table". (b) "By Type" and "By Queue" use existing dashboard.distribution data. (c) "By Form", "By User", "By Table" require aggregates data — accept an optional `aggregatesData` prop and compute distribution from aggregate groups. (d) Add a "Show top N" selector with options: 5, 10 (default), 15, 25, 50. (e) Update the chart to respect the selected dimension and top-N limit.

**Checkpoint**: Charts have working toggles, zoom, and dimension switching.

---

## Phase 10: User Story 8 — Filter Complexity Insights (Priority: P3)

**Goal**: Users can see filter execution complexity metrics to identify runaway filter chains.

**Independent Test**: Analyze a log file with filter activity, open Filter Complexity section, verify most-executed filters and per-transaction data.

### Tests for User Story 8

- [x] T032 [P] [US8] Write unit tests for FiltersHandler in `backend/internal/api/handlers/filters_test.go` — Same handler test pattern. Test zero-filter analysis returns empty response with zero total_filter_time_ms.

### Implementation for User Story 8

- [x] T033 [US8] Replace stub in `backend/internal/api/handlers/filters.go` with full FiltersHandler implementation — Same handler pattern. Cache key: `remedyiq:{tenantID}:filters:{jobID}`. Call `clickhouse.GetFilterComplexity()`.

- [x] T034 [P] [US8] Create `frontend/src/components/dashboard/filters-section.tsx` — Summary metric: "Total filter processing time: X ms". Two sub-views using shadcn/ui Tabs: (1) "Most Executed Filters" table with columns: Rank, Filter Name, Execution Count, Total Time (ms) — sorted by count desc. (2) "Filters Per Transaction" table with columns: Transaction ID, Filter Name, Count, Total (ms), Avg (ms), Max (ms). Highlight transactions with >100 filter executions as potential performance risks (amber background). Empty state: "No filter activity detected in this analysis".

- [x] T035 [US8] Integrate filters section into `frontend/src/app/(dashboard)/analysis/[id]/page.tsx` — Same lazy-loading pattern. Place after threads section.

**Checkpoint**: Filters endpoint returns complexity data; frontend shows ranked filter tables.

---

## Phase 11: User Story 9 — AI Skills Production Readiness (Priority: P3)

**Goal**: All 6 AI skills produce reliable output with proper error handling.

**Independent Test**: Complete an analysis, open AI chat, execute each skill type, verify non-error responses.

### Implementation for User Story 9

- [x] T036 [P] [US9] Review and fix `backend/internal/ai/skills/nl_query.go` — Ensure the skill correctly queries ClickHouse for the target job's data. Add error handling: catch ClickHouse query errors, AI API timeouts, and malformed responses. Return user-friendly error messages. Add fallback response when AI service is unavailable: "AI service is temporarily unavailable. Please try again later."

- [x] T037 [P] [US9] Review and fix `backend/internal/ai/skills/summarizer.go` — Ensure the skill fetches dashboard data (general stats, top issues, error rates) and produces a multi-paragraph executive summary. Add error handling and fallback behavior.

- [x] T038 [P] [US9] Review and fix `backend/internal/ai/skills/anomaly.go` — Ensure anomaly detection queries relevant metrics (spikes in error rate, unusual duration patterns). Add error handling and fallback.

- [x] T039 [P] [US9] Review and fix `backend/internal/ai/skills/error_explainer.go` — Ensure the skill can explain specific AR Server error codes with likely causes and remediation. Add error handling and fallback.

- [x] T040 [P] [US9] Review and fix `backend/internal/ai/skills/root_cause.go` — Ensure root cause analysis correlates errors, gaps, and thread saturation data. Add error handling and fallback.

- [x] T041 [P] [US9] Review and fix `backend/internal/ai/skills/performance.go` — Ensure performance analysis skill identifies slowest operations, bottlenecks, and optimization recommendations. Add error handling and fallback.

- [x] T042 [US9] Verify AI handler error responses in `backend/internal/api/handlers/ai.go` — Ensure the handler catches all skill execution errors and returns structured error responses (not raw stack traces) per FR-017. Test that each of the 6 skills can be invoked without error for a valid analysis.

**Checkpoint**: All 6 AI skills return useful output for valid analyses and graceful errors for failures.

---

## Phase 12: Polish & Cross-Cutting Concerns

**Purpose**: Final validation, cross-story integration testing, and cleanup.

- [x] T043 Run all backend tests with `cd backend && go test ./...` and verify all pass
- [x] T044 Run frontend lint and type check with `cd frontend && npm run lint && npx tsc --noEmit` and fix any issues
- [x] T045 Verify all 5 lazy-loaded sections in `frontend/src/app/(dashboard)/analysis/[id]/page.tsx` have independent error states with retry buttons, and that navigating away cancels in-flight requests
- [x] T046 Verify mobile responsiveness of all new components at 375px width — Check health score card, aggregate tables, exception list, gap tables, thread table, filter tables all render correctly on narrow viewports
- [ ] T047 Run quickstart.md validation: upload a sample log file, wait for analysis, verify all dashboard sections populate correctly, test chart toggles, expand top-N rows, check AI skills

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — verify existing code compiles
- **Foundational (Phase 2)**: Depends on Phase 1 — adds all ClickHouse query functions. BLOCKS all user stories.
- **US1 Aggregates (Phase 3)**: Depends on Phase 2 (T003)
- **US2 Exceptions (Phase 4)**: Depends on Phase 2 (T004)
- **US3 Gaps (Phase 5)**: Depends on Phase 2 (T005)
- **US4 Threads (Phase 6)**: Depends on Phase 2 (T006)
- **US5 Enhanced Top-N (Phase 7)**: Depends on Phase 2 (T009)
- **US7 Health Score (Phase 8)**: Depends on Phase 2 (T008)
- **US6 Enhanced Charts (Phase 9)**: Depends on Phase 2 only; distribution dimension switching benefits from aggregates data (T003) being available
- **US8 Filters (Phase 10)**: Depends on Phase 2 (T007)
- **US9 AI Skills (Phase 11)**: No dependency on other user stories
- **Polish (Phase 12)**: Depends on all desired user stories being complete

### User Story Dependencies

- **US1 (P1)**: Independent — can start after Phase 2
- **US2 (P1)**: Independent — can start after Phase 2
- **US3 (P2)**: Independent — can start after Phase 2
- **US4 (P2)**: Independent — can start after Phase 2
- **US5 (P2)**: Independent — can start after Phase 2 (T009)
- **US7 (P2)**: Independent — can start after Phase 2 (T008)
- **US6 (P3)**: Mostly independent — distribution dimension switching optionally uses aggregates data
- **US8 (P3)**: Independent — can start after Phase 2
- **US9 (P3)**: Independent — no dependency on other stories

### Within Each User Story

- Tests written FIRST (where included)
- Backend handler before frontend component
- Frontend component before dashboard integration
- Story complete before checkpoint validation

### Parallel Opportunities

**Phase 2** (all 7 tasks are parallel — different functions in same file, but no interdependence):
```
T003 || T004 || T005 || T006 || T007 || T008 || T009
```

**After Phase 2, all 9 user stories can run in parallel**:
```
US1 (T010-T013) || US2 (T014-T017) || US3 (T018-T021) || US4 (T022-T025)
|| US5 (T026) || US7 (T027-T029) || US6 (T030-T031) || US8 (T032-T035) || US9 (T036-T042)
```

**Within each story, [P] tasks are parallelizable**:
- US1: T010 || T012 (test and frontend component in parallel)
- US2: T014 || T016
- US3: T018 || T020
- US4: T022 || T024
- US8: T032 || T034
- US9: T036 || T037 || T038 || T039 || T040 || T041 (all 6 skill fixes in parallel)

---

## Parallel Example: User Story 1

```bash
# After Phase 2 completes, launch in parallel:
Task: "Write unit tests for AggregatesHandler in backend/internal/api/handlers/aggregates_test.go"
Task: "Create aggregates-section.tsx in frontend/src/components/dashboard/aggregates-section.tsx"

# Then sequentially:
Task: "Replace stub in backend/internal/api/handlers/aggregates.go"
Task: "Integrate aggregates section into frontend/src/app/(dashboard)/analysis/[id]/page.tsx"
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2 Only)

1. Complete Phase 1: Setup (T001-T002)
2. Complete Phase 2: Foundational — only T003, T004, T008 needed for MVP
3. Complete Phase 3: US1 Aggregates (T010-T013)
4. Complete Phase 4: US2 Exceptions (T014-T017)
5. **STOP and VALIDATE**: Both P1 stories are independently testable
6. Deploy/demo — users get the two highest-value features

### Incremental Delivery

1. Setup + Foundational (Phase 1-2) → All query functions ready
2. US1 Aggregates → Test → Deploy (MVP!)
3. US2 Exceptions → Test → Deploy
4. US7 Health Score → Test → Deploy (above-the-fold impact)
5. US3 Gaps + US4 Threads → Test → Deploy (P2 diagnostics)
6. US5 Enhanced Top-N → Test → Deploy (enriched existing feature)
7. US6 Charts + US8 Filters → Test → Deploy (P3 enhancements)
8. US9 AI Skills → Test → Deploy (polish)
9. Phase 12 Polish → Final validation

### Parallel Team Strategy

With multiple developers after Phase 2:
- Developer A: US1 (Aggregates) then US3 (Gaps)
- Developer B: US2 (Exceptions) then US4 (Threads)
- Developer C: US7 (Health Score) then US5 (Enhanced Top-N)
- Developer D: US8 (Filters) then US6 (Charts) then US9 (AI Skills)

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- All domain models already exist — no model creation tasks needed
- All frontend API client functions already exist — no API client tasks needed
- Each handler follows the exact same pattern (DashboardHandler) — copy and adapt
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently

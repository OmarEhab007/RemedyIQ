# Tasks: Enhanced Analysis Dashboard

**Input**: Design documents from `/specs/003-enhanced-analysis-dashboard/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/openapi.yaml, quickstart.md

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: Verify local dev environment is ready for enhanced dashboard work

- [X] T001 Verify Docker Compose services are healthy (PostgreSQL, ClickHouse, NATS, Redis, MinIO) and backend compiles with `go build ./...` in `backend/`
- [X] T002 [P] Verify frontend compiles with `npm run build` in `frontend/` and existing dashboard renders at http://localhost:3000

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Add all new domain types, extend parser return type, create shared frontend infrastructure, and register new API routes. MUST complete before any user story work begins.

**CRITICAL**: No user story work can begin until this phase is complete.

### Backend Domain Types

- [X] T003 Add AggregateGroup and AggregateSection structs to `backend/internal/domain/models.go` per data-model.md (PrimaryKey, SecondaryKey, OKCount, FailCount, TotalCount, MinTimeMS, MaxTimeMS, AvgTimeMS, SumTimeMS; GrandTotal pointer)
- [X] T004 [P] Add GapEntry struct to `backend/internal/domain/models.go` per data-model.md (Rank, DurationMS, LineNumber, FileNumber, Timestamp, TraceID, ThreadID, Details)
- [X] T005 [P] Add ThreadStatsEntry struct to `backend/internal/domain/models.go` per data-model.md (Queue, ThreadID, FirstSeen, LastSeen, OperationCount, QueueCount, QueueTimeMS, TotalTimeMS, BusyPct)
- [X] T006 [P] Add ExceptionEntry struct to `backend/internal/domain/models.go` per data-model.md (LineNumber, FileNumber, Timestamp, TraceID, RPCID, LogType, Identifier, User, ErrorType, ErrorMessage, Details)
- [X] T007 [P] Add MostExecutedFilter, FilterPerTransaction, and FilterComplexityData structs to `backend/internal/domain/models.go` per data-model.md
- [X] T008 [P] Add HealthScore and HealthScoreFactor structs to `backend/internal/domain/models.go` per data-model.md (Score 0-100, Status green/yellow/red, Factors array of 4)
- [X] T009 [P] Add QueueHealthSummary struct to `backend/internal/domain/models.go` per data-model.md (Queue, ThreadCount, AvgBusyPct, MaxBusyPct, Status normal/warning/critical)
- [X] T010 Add all lazy-load response types to `backend/internal/domain/models.go`: AggregatesResponse, ExceptionsResponse, GapsResponse, ThreadStatsResponse, FilterComplexityResponse with JSON tags per data-model.md
- [X] T011 Add ParseResult struct to `backend/internal/domain/models.go` wrapping DashboardData plus Aggregates, Exceptions, Gaps, ThreadStats, Filters pointers. Add HealthScore pointer field to existing DashboardData struct.

### Backend Parser & Worker Foundation

- [X] T012 Update `ParseOutput()` signature in `backend/internal/jar/parser.go` to return `*domain.ParseResult` instead of `*domain.DashboardData`. Initially populate only the Dashboard field (existing behavior), leaving Aggregates/Exceptions/Gaps/ThreadStats/Filters nil. Update all callers.
- [X] T013 Update worker pipeline in `backend/internal/worker/ingestion.go` to accept `*domain.ParseResult`, store each non-nil section in its own Redis key (`cache:{tenant_id}:dashboard:{job_id}:agg`, `:exc`, `:gaps`, `:threads`, `:filters`) with 24h TTL alongside the existing dashboard cache key.

### Backend API Routes

- [X] T014 Register 5 new lazy-load routes in `backend/internal/api/router.go` under the authenticated group: `GET /analysis/{job_id}/dashboard/aggregates`, `/exceptions`, `/gaps`, `/threads`, `/filters`. Create stub handler files that return 501 Not Implemented for now.
- [X] T015 [P] Create stub handler `backend/internal/api/handlers/aggregates.go` with AggregatesHandler struct following the pattern in dashboard.go (extract tenant, parse job_id, verify job complete, check Redis cache key `:agg`, return AggregatesResponse JSON)
- [X] T016 [P] Create stub handler `backend/internal/api/handlers/exceptions.go` with ExceptionsHandler struct following same pattern (Redis key `:exc`, return ExceptionsResponse JSON)
- [X] T017 [P] Create stub handler `backend/internal/api/handlers/gaps.go` with GapsHandler struct following same pattern (Redis key `:gaps`, return GapsResponse JSON)
- [X] T018 [P] Create stub handler `backend/internal/api/handlers/threads.go` with ThreadsHandler struct following same pattern (Redis key `:threads`, return ThreadStatsResponse JSON)
- [X] T019 [P] Create stub handler `backend/internal/api/handlers/filters.go` with FiltersHandler struct following same pattern (Redis key `:filters`, return FilterComplexityResponse JSON)

### Frontend Foundation

- [X] T020 Add all new TypeScript interfaces to `frontend/src/lib/api.ts` per data-model.md: AggregateGroup, AggregateSection, AggregatesResponse, GapEntry, GapsResponse, ThreadStatsEntry, QueueHealthSummary, ThreadStatsResponse, ExceptionEntry, ExceptionsResponse, MostExecutedFilter, FilterPerTransaction, FilterComplexityResponse, HealthScoreFactor, HealthScore. Update DashboardData interface to include `health_score: HealthScore | null`.
- [X] T021 Add 5 lazy-load fetch functions to `frontend/src/lib/api.ts`: `getDashboardAggregates(jobId, type?)`, `getDashboardExceptions(jobId, type?)`, `getDashboardGaps(jobId, type?)`, `getDashboardThreads(jobId)`, `getDashboardFilters(jobId)` following existing `getDashboard()` pattern.
- [X] T022 Create `frontend/src/hooks/use-lazy-section.ts` — a reusable hook that accepts a fetch function and returns `{ data, loading, error, ref }`. Uses Intersection Observer to trigger the fetch when the section scrolls into view. Supports manual `refetch()`. Caches result in component state.

**Checkpoint**: Foundation ready. All types defined, parser returns ParseResult, worker stores sections in Redis, routes registered, frontend types and lazy-section hook ready. Backend compiles, frontend compiles.

---

## Phase 3: User Story 1 — Performance Aggregates by Form, User, and Table (Priority: P1)

**Goal**: Display API by Form, API by User, and SQL by Table aggregate tables with full timing breakdowns (OK/Fail/Total counts, MIN/MAX/AVG/SUM times), subtotals, grand total, and column sorting.

**Independent Test**: Run an analysis, navigate to dashboard, verify "Aggregates" section shows 3 tabs with correct data matching JAR plain-text output.

### Backend — Parser & Handler

- [ ] T023 [US1] Extend `parseAggregateByPrimaryKey()` in `backend/internal/jar/parser.go` to return `[]domain.AggregateGroup` with full timing breakdown (OKCount, FailCount, TotalCount, MinTimeMS, MaxTimeMS, AvgTimeMS, SumTimeMS) instead of the current `map[string]int`. Parse subtotal rows into per-group entries and the grand total `====` row into `GrandTotal`. Build AggregatesResponse with APIByForm, APIByUser, SQLByTable sections.
- [ ] T024 [US1] Wire aggregate parsing into `ParseOutput()` in `backend/internal/jar/parser.go` — populate `ParseResult.Aggregates` field from API section ("Aggregates by Form", "Aggregates by Client") and SQL section ("Aggregates by Table") subsections.
- [ ] T025 [US1] Implement full aggregates handler in `backend/internal/api/handlers/aggregates.go` — replace 501 stub with Redis cache lookup (`:agg`), support `?type=api_by_form|api_by_user|sql_by_table` query param filtering, return 404 if no data cached.

### Frontend — Component & Wiring

- [ ] T026 [US1] Create `frontend/src/components/dashboard/aggregate-table.tsx` — tabbed component with "API by Form", "API by User", "SQL by Table" tabs. Each tab renders a sortable table with columns: Primary Key, Secondary Key, OK, Fail, Total, MIN, MAX, AVG, SUM Time. Default sort: SUM Time descending. Show subtotal rows per group and pinned grand total row at bottom. Use react-window FixedSizeList for tables >100 rows per research.md TU-4.
- [ ] T027 [US1] Wire aggregate-table into `frontend/src/app/(dashboard)/analysis/[id]/page.tsx` — add an "Aggregates" section below existing panels. Use `useLazySection` hook with `getDashboardAggregates` fetch function. Show loading skeleton while fetching. Show "No aggregate data available" empty state.

**Checkpoint**: Aggregates section fully functional. Admin can see per-form, per-user, per-table performance breakdowns with sorting. Values match JAR output.

---

## Phase 4: User Story 2 — Exception and Error Reports (Priority: P1)

**Goal**: Display API exceptions, SQL errors, and escalation errors in dedicated panels with error rate calculations per log type. Expandable rows show full error details.

**Independent Test**: Analyze a log file containing errors, verify exception panels show correct error counts, entries, and error rate percentages matching JAR output.

### Backend — Parser & Handler

- [ ] T028 [US2] Extend `parseExceptionReport()` in `backend/internal/jar/parser.go` to return `[]domain.ExceptionEntry` with structured fields (LineNumber, TraceID, RPCID, LogType, Identifier, User, ErrorType, ErrorMessage, Details/stack trace) instead of discarding them. Parse both API Exception Report and SQL Error Report subsections.
- [ ] T029 [US2] Wire exception parsing into `ParseOutput()` in `backend/internal/jar/parser.go` — populate `ParseResult.Exceptions` field. Compute `ErrorRates` map by dividing exception counts by total operation counts from GeneralStatistics per log type.
- [ ] T030 [US2] Implement full exceptions handler in `backend/internal/api/handlers/exceptions.go` — replace 501 stub with Redis cache lookup (`:exc`), support `?type=api|sql|escalation` filtering, return ExceptionsResponse with error_rates.

### Frontend — Component & Wiring

- [ ] T031 [US2] Create `frontend/src/components/dashboard/exception-panel.tsx` — tabbed component with "API Exceptions", "SQL Errors", "Escalation Errors" tabs. Each tab shows count badge and a table with columns: Line Number, Trace ID, Identifier, Error Type, Error Message (truncated). Clicking a row expands to show full Details (stack trace or SQL statement). Display error rate percentage per tab. Show "No errors detected" confirmation when empty.
- [ ] T032 [US2] Wire exception-panel into `frontend/src/app/(dashboard)/analysis/[id]/page.tsx` — add "Exceptions & Errors" section. Use `useLazySection` hook with `getDashboardExceptions`. Show loading skeleton while fetching.

**Checkpoint**: Error panels fully functional. Admin sees all exceptions/errors with rates. Expandable rows show full details.

---

## Phase 5: User Story 3 — Gap Analysis (Priority: P2)

**Goal**: Display top 50 line gaps and top 50 thread gaps with duration, position, and a visual timeline showing gap positions relative to the log timespan.

**Independent Test**: Analyze a log file, verify gap analysis shows correct gaps with durations and timestamps matching JAR output, and the timeline correctly positions gaps.

### Backend — Parser & Handler

- [ ] T033 [US3] Add `parseGapAnalysis()` method to `backend/internal/jar/parser.go` — parse "Top 50 Longest Line Gaps" and "Top 50 Longest Thread Gaps" subsections from the GAP section using existing `extractDataRows()` pipeline. Map columns to `[]domain.GapEntry` (Rank, DurationMS, LineNumber, FileNumber, Timestamp, TraceID, ThreadID for thread gaps, Details).
- [ ] T034 [US3] Wire gap parsing into `ParseOutput()` in `backend/internal/jar/parser.go` — call `parseGapAnalysis()` for GAP section, populate `ParseResult.Gaps` with GapsResponse containing LineGaps and ThreadGaps slices.
- [ ] T035 [US3] Implement full gaps handler in `backend/internal/api/handlers/gaps.go` — replace 501 stub with Redis cache lookup (`:gaps`), support `?type=line|thread` filtering.

### Frontend — Component & Wiring

- [ ] T036 [US3] Create `frontend/src/components/dashboard/gap-analysis.tsx` — tabbed component with "Line Gaps" and "Thread Gaps" tabs. Each tab shows a sortable table: Rank, Gap Duration (human-readable), Line Number, Trace/Thread ID, Timestamp, Details. Above the table, render a Recharts ScatterChart timeline showing gap positions (x=timestamp, y=duration) relative to log_start/log_end from GeneralStats. Highlight gaps >1 hour as "Critical Gaps" with distinct red styling. Show "No significant gaps detected — log shows continuous activity" when empty.
- [ ] T037 [US3] Wire gap-analysis into `frontend/src/app/(dashboard)/analysis/[id]/page.tsx` — add "Gap Analysis" section. Use `useLazySection` hook with `getDashboardGaps`.

**Checkpoint**: Gap analysis fully functional. Admin sees gaps with timeline visualization. Critical gaps highlighted.

---

## Phase 6: User Story 4 — Thread Statistics and Queue Health (Priority: P2)

**Goal**: Display per-thread utilization statistics grouped by queue with busy percentages, warning indicators for saturated threads, and queue-level health summary.

**Independent Test**: Analyze a log file, verify thread statistics show per-queue/per-thread utilization with correct busy percentages matching JAR output and appropriate health indicators.

### Backend — Parser & Handler

- [ ] T038 [US4] Extend `parseThreadStats()` in `backend/internal/jar/parser.go` to return `[]domain.ThreadStatsEntry` with full utilization data (Queue, ThreadID, FirstSeen, LastSeen, OperationCount, QueueCount, QueueTimeMS, TotalTimeMS, BusyPct) instead of the current limited capture. Parse both API and SQL thread statistics subsections.
- [ ] T039 [US4] Wire thread stats parsing into `ParseOutput()` in `backend/internal/jar/parser.go` — populate `ParseResult.ThreadStats` with ThreadStatsResponse. Compute QueueSummary by aggregating per-queue: count threads, average BusyPct, max BusyPct, derive Status (normal <70%, warning 70-90%, critical >90%).
- [ ] T040 [US4] Implement full threads handler in `backend/internal/api/handlers/threads.go` — replace 501 stub with Redis cache lookup (`:threads`), return ThreadStatsResponse with entries and queue_summary.

### Frontend — Component & Wiring

- [ ] T041 [US4] Create `frontend/src/components/dashboard/thread-stats.tsx` — two sections: (1) Queue Health Summary cards showing each queue name, thread count, avg/max busy %, and color-coded status badge (green=normal, yellow=warning, red=critical). (2) Detailed table grouped by queue: Queue Name, Thread ID, First Seen, Last Seen, Operation Count, Queue Count, Queue Time, Total Time, Busy %. Highlight rows >90% busy with warning background. Show "No thread statistics available" when empty.
- [ ] T042 [US4] Wire thread-stats into `frontend/src/app/(dashboard)/analysis/[id]/page.tsx` — add "Thread Statistics" section. Use `useLazySection` hook with `getDashboardThreads`.

**Checkpoint**: Thread statistics fully functional. Admin sees queue health at a glance and per-thread details with saturation warnings.

---

## Phase 7: User Story 5 — Enhanced Top-N Tables with Type-Specific Details (Priority: P2)

**Goal**: Enhance existing top-N tables to show type-specific columns (SQL statement, filter level, escalation pool/delay), queue wait time, expandable detail rows, and "View in Explorer" links.

**Independent Test**: Analyze a log file, verify each top-N tab shows its type-specific columns, rows expand to show full context, and "View in Explorer" navigates correctly.

### Frontend — Component Enhancement (no new backend endpoint needed)

- [ ] T043 [US5] Enhance SQL tab in `frontend/src/components/dashboard/top-n-table.tsx` — add columns: Table Name (from identifier), SQL Operation Type, Queue Wait Time. Add an expandable row toggle that shows the full SQL statement preview in a monospace code block below the row.
- [ ] T044 [US5] Enhance Filters tab in `frontend/src/components/dashboard/top-n-table.tsx` — add columns: Filter Name (from identifier), Filter Level, Filters/Second, Queue Wait Time.
- [ ] T045 [US5] Enhance Escalations tab in `frontend/src/components/dashboard/top-n-table.tsx` — add columns: Escalation Name (from identifier), Pool, Delay Duration, Queue Wait Time.
- [ ] T046 [US5] Add expandable detail rows to all top-N tabs in `frontend/src/components/dashboard/top-n-table.tsx` — clicking a row reveals a detail panel showing: Trace ID, RPC ID, Queue Wait Time, raw Details field, and all available fields for that entry type.
- [ ] T047 [US5] Add "View in Explorer" link to each top-N entry in `frontend/src/components/dashboard/top-n-table.tsx` — link navigates to `/search?job_id={jobId}&line={lineNumber}` to open the log explorer filtered to that specific entry.

**Checkpoint**: Top-N tables show rich type-specific data. Expandable rows and explorer links eliminate need to manually inspect logs.

---

## Phase 8: User Story 6 — Filter Complexity Insights (Priority: P3)

**Goal**: Display most executed filters, filters per transaction, and maximum nesting depth. Highlight transactions with >100 filters as performance risks.

**Independent Test**: Analyze a log file with filter activity, verify filter complexity panel shows correct data matching JAR output with appropriate risk highlighting.

### Backend — Parser & Handler

- [ ] T048 [US6] Add `parseFilterComplexity()` method to `backend/internal/jar/parser.go` — parse "Most Executed Filters" subsection into `[]domain.MostExecutedFilter` (Rank, FilterName, ExecutionCount), "Filters per Transaction" into `[]domain.FilterPerTransaction` (Rank, LineNumber, TraceID, FilterCount, Operation, Form, RequestID, FiltersPerSec), and extract max nesting depth.
- [ ] T049 [US6] Wire filter complexity parsing into `ParseOutput()` in `backend/internal/jar/parser.go` — call `parseFilterComplexity()` for FLTR section, populate `ParseResult.Filters` with FilterComplexityResponse.
- [ ] T050 [US6] Implement full filters handler in `backend/internal/api/handlers/filters.go` — replace 501 stub with Redis cache lookup (`:filters`), return FilterComplexityResponse.

### Frontend — Component & Wiring

- [ ] T051 [US6] Create `frontend/src/components/dashboard/filter-complexity.tsx` — three sub-sections: (1) "Most Executed Filters" table: Rank, Filter Name, Execution Count (sorted by count desc). (2) "Filters Per Transaction" table: Rank, Line Number, Trace ID, Filter Count, Operation, Form, Request ID, Filters/Second. Highlight rows with filter_count >100 with warning background. (3) "Max Nesting Depth" stat card. Show "No filter complexity data available" when empty.
- [ ] T052 [US6] Wire filter-complexity into `frontend/src/app/(dashboard)/analysis/[id]/page.tsx` — add "Filter Complexity" section. Use `useLazySection` hook with `getDashboardFilters`.

**Checkpoint**: Filter complexity fully functional. Admin identifies runaway filter chains and excessive nesting.

---

## Phase 9: User Story 7 — Enhanced Time-Series and Distribution Charts (Priority: P3)

**Goal**: Add duration/error overlays to time-series chart with click-and-drag zoom. Add dimension switcher and configurable top-N to distribution chart.

**Independent Test**: Analyze a log file, verify time-series toggles show duration/error overlays on secondary axis, zoom works, distribution chart switches dimensions and top-N count.

### Frontend — Component Enhancement (no new backend endpoint needed)

- [ ] T053 [US7] Add toggle controls to `frontend/src/components/dashboard/time-series-chart.tsx` — "Show Duration" toggle adds an avg_duration_ms line on a secondary Y-axis (right side). "Show Errors" toggle adds an error_count shaded Area overlay. Use Recharts YAxis with yAxisId for dual-axis rendering. Toggles use local component state.
- [ ] T054 [US7] Add click-and-drag zoom to `frontend/src/components/dashboard/time-series-chart.tsx` — use Recharts ReferenceArea for brush selection. On mouse drag, zoom the chart to the selected time interval. Add a "Reset Zoom" button to restore the full range.
- [ ] T055 [US7] Add dimension switcher to `frontend/src/components/dashboard/distribution-chart.tsx` — dropdown to select grouping: "By Type" (default), "By Queue", "By Form", "By User", "By Table". Each dimension reads from the corresponding key in the `distribution` map. The distribution map already contains `by_type` and `by_queue`; extend `getDashboard()` response to include `by_form`, `by_user`, `by_table` from existing Distribution data.
- [ ] T056 [US7] Add configurable top-N to `frontend/src/components/dashboard/distribution-chart.tsx` — selector for 5, 10, 15, 25, 50 categories. Applies client-side slice to the sorted distribution data before rendering.

**Checkpoint**: Charts are now diagnostic tools. Duration/error overlays and zoom enable pattern detection. Distribution dimensions reveal load distribution.

---

## Phase 10: User Story 8 — Performance Health Score (Priority: P3)

**Goal**: Display a composite health score (0-100) at the top of the dashboard with color coding and factor breakdown.

**Independent Test**: Analyze a log file, verify health score appears at top with correct color, score breakdown shows 4 factors, and score satisfies SC-007 thresholds.

### Backend — Worker Computation

- [ ] T057 [US8] Implement `computeHealthScore()` function in `backend/internal/worker/ingestion.go` per research.md TU-3 algorithm: 4 factors x 25 points each — Error Rate (from GeneralStats + ExceptionsResponse), Response Time (median of TopAPICalls durations), Thread Saturation (max BusyPct from ThreadStatsResponse), Gap Frequency (count of gaps >10s from GapsResponse). Handle special cases (no data = 25 pts). Return `*domain.HealthScore` with factor breakdown.
- [ ] T058 [US8] Call `computeHealthScore()` in worker pipeline after parsing, set `ParseResult.Dashboard.HealthScore` before caching. The health score is included in the main dashboard Redis key so the existing `GET /dashboard` endpoint returns it without any handler changes.

### Frontend — Component & Wiring

- [ ] T059 [US8] Create `frontend/src/components/dashboard/health-score.tsx` — prominent card showing the score (large number), color-coded ring/badge (green >80, yellow 50-80, red <50), and 4 factor bars below: Error Rate, Response Time, Thread Saturation, Gap Frequency. Each factor shows its score/25, human-readable value, color indicator, and description when not green. Responsive: stack factors vertically on mobile.
- [ ] T060 [US8] Wire health-score into `frontend/src/app/(dashboard)/analysis/[id]/page.tsx` — render ABOVE existing stats cards (above the fold per SC-005). Read `health_score` from the existing `DashboardData` response (no lazy loading needed — included in initial fetch). Show nothing gracefully if health_score is null (for jobs analyzed before this feature).

**Checkpoint**: Health score appears above the fold. Admin instantly assesses system health. Score breakdown explains contributing factors.

---

## Phase 11: Polish & Cross-Cutting Concerns

**Purpose**: Edge cases, responsive design, and validation across all stories

- [ ] T061 Handle empty state across all new panels — when a log type has zero entries, display "No [type] activity detected in this log" instead of empty tables (per edge case in spec.md)
- [ ] T062 Handle sub-minute log resolution — if log_duration < 1 minute in GeneralStats, pass a flag to time-series-chart to use second-level bucketing instead of minute-level (per edge case in spec.md)
- [ ] T063 Ensure all new dashboard sections are responsive at 375px minimum viewport width — tables use horizontal scroll, cards stack vertically, charts resize proportionally (per SC-008)
- [ ] T064 Validate numerical fidelity — compare all dashboard values against JAR plain-text output for at least 2 sample log files covering all 4 log types (per SC-006 and FR-031). Document any discrepancies.
- [ ] T065 Run full quickstart.md validation — follow all steps in `specs/003-enhanced-analysis-dashboard/quickstart.md`, verify all 6 curl commands return valid JSON, and the dashboard renders all new sections at http://localhost:3000

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 — BLOCKS all user stories
- **US1 Aggregates (Phase 3)**: Depends on Phase 2 only
- **US2 Exceptions (Phase 4)**: Depends on Phase 2 only
- **US3 Gaps (Phase 5)**: Depends on Phase 2 only
- **US4 Threads (Phase 6)**: Depends on Phase 2 only
- **US5 Enhanced Top-N (Phase 7)**: Depends on Phase 2 only (frontend-only changes)
- **US6 Filters (Phase 8)**: Depends on Phase 2 only
- **US7 Enhanced Charts (Phase 9)**: Depends on Phase 2 only (frontend-only changes)
- **US8 Health Score (Phase 10)**: Depends on Phase 2 + benefits from Phase 3-6 data (parser extensions) for full score computation. Can start after Phase 2 with partial scores (missing factors = 25 pts), but ideally implemented after US1-US4 parser extensions are complete.
- **Polish (Phase 11)**: Depends on all desired user stories being complete

### User Story Dependencies

- **US1 (P1)**: Independent — can start immediately after Phase 2
- **US2 (P1)**: Independent — can start immediately after Phase 2, parallel with US1
- **US3 (P2)**: Independent — can start after Phase 2
- **US4 (P2)**: Independent — can start after Phase 2
- **US5 (P2)**: Independent — frontend-only, no backend dependencies beyond Phase 2
- **US6 (P3)**: Independent — can start after Phase 2
- **US7 (P3)**: Independent — frontend-only, no backend dependencies beyond Phase 2
- **US8 (P3)**: Soft dependency on US1-US4 (health score uses their parser output for full accuracy)

### Within Each User Story

1. Parser extension first (backend)
2. Wire into ParseOutput (backend)
3. Implement handler (backend)
4. Create component (frontend) — can parallel with handler
5. Wire into page (frontend) — depends on component

### Parallel Opportunities

Within Phase 2 (Foundational):
```
Parallel group 1: T003, T004, T005, T006, T007, T008, T009 (all add types to models.go — different structs, but SAME FILE, so execute sequentially or batch)
Parallel group 2: T015, T016, T017, T018, T019 (stub handlers — different files)
Parallel group 3: T020, T021, T022 (frontend files — different files)
```

After Phase 2 completes, stories can run in parallel:
```
Developer A: US1 (T023-T027) → US2 (T028-T032)
Developer B: US3 (T033-T037) → US4 (T038-T042)
Developer C: US5 (T043-T047) → US7 (T053-T056)
Developer D: US6 (T048-T052) → US8 (T057-T060)
```

Within each story, backend and frontend can partially overlap:
```
US1 example:
  Sequential: T023 → T024 → T025 (backend parser → wire → handler)
  Parallel:   T025 + T026 (handler + component — different repos)
  Sequential: T026 → T027 (component → page wiring)
```

---

## Parallel Example: User Story 1

```
# Backend parser (sequential — same file):
Task T023: Extend parseAggregateByPrimaryKey() in backend/internal/jar/parser.go
Task T024: Wire aggregate parsing into ParseOutput() in backend/internal/jar/parser.go

# Backend handler (after parser):
Task T025: Implement aggregates handler in backend/internal/api/handlers/aggregates.go

# Frontend (can start T026 in parallel with T025):
Task T026: Create aggregate-table.tsx in frontend/src/components/dashboard/aggregate-table.tsx
Task T027: Wire into page.tsx in frontend/src/app/(dashboard)/analysis/[id]/page.tsx
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2 Only)

1. Complete Phase 1: Setup (T001-T002)
2. Complete Phase 2: Foundational (T003-T022)
3. Complete Phase 3: US1 Aggregates (T023-T027)
4. Complete Phase 4: US2 Exceptions (T028-T032)
5. **STOP and VALIDATE**: Test aggregates and error panels independently
6. Deploy/demo — admin can now see 80% of the most valuable JAR data

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. US1 + US2 → Test → Deploy (MVP! Aggregates + Errors = highest value)
3. US3 + US4 → Test → Deploy (Gap analysis + Thread stats)
4. US5 → Test → Deploy (Enhanced top-N tables)
5. US6 + US7 → Test → Deploy (Filter complexity + Chart enhancements)
6. US8 → Test → Deploy (Health score — benefits from all previous data)
7. Phase 11 Polish → Final validation → Release

### Parallel Team Strategy

With 2 developers:
1. Both complete Setup + Foundational together
2. Once Phase 2 done:
   - Dev A: US1 → US2 → US5 → US7 → US8
   - Dev B: US3 → US4 → US6 → Phase 11
3. Stories integrate independently via lazy-loading

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks
- [USn] label maps task to specific user story for traceability
- Each user story is independently completable and testable
- No ClickHouse or PostgreSQL schema changes required (all data from JAR parser → Redis)
- All frontend sections use lazy loading via Intersection Observer hook
- Health score computation runs in worker, not API handler — no request-time cost
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently

# Tasks: ARLogAnalyzer Insights Enhancement

**Input**: Design documents from `/specs/012-analyzer-insights/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

**Tests**: Included — spec.md SC-008 requires unit test coverage for all new components.

**Organization**: Tasks grouped by user story (US1-US8) in priority order (P1 → P2 → P3).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: Verify existing test suites pass before making changes

- [ ] T001 Run frontend tests to establish baseline (`cd frontend && npm test` — expect 1077 passing)
- [ ] T002 Run backend tests to establish baseline (`cd backend && go test ./...`)

---

## Phase 2: Foundational (Shared Type Extensions)

**Purpose**: Add all new/missing fields and interfaces to frontend types that multiple user stories depend on

**CRITICAL**: Must complete before user story implementation begins

- [X] T003 Add `busy_pct: number` field to `ThreadStatsEntry` interface in `frontend/src/lib/api-types.ts`
- [X] T004 [P] Add `filters_per_sec: number` field to `FilterPerTransaction` interface in `frontend/src/lib/api-types.ts`
- [X] T005 [P] Add `QueuedCallsResponse`, `DelayedEscalationsResponse`, `DelayedEscalationEntry`, `FileMetadataEntry`, and `LoggingActivityEntry` interfaces to `frontend/src/lib/api-types.ts`
- [X] T006 [P] Add `fetchQueuedCalls(jobId)` and `fetchDelayedEscalations(jobId)` functions plus `useQueuedCalls` and `useDelayedEscalations` hooks to `frontend/src/hooks/use-api.ts`

**Checkpoint**: All shared types and API hooks ready for story implementation

---

## Phase 3: User Story 1 — Decode API Abbreviations at a Glance (Priority: P1) MVP

**Goal**: Hovering over any API code (RE, CE, SE...) shows a tooltip with the full name across all pages

**Independent Test**: Navigate to dashboard Top-N table, hover over API code → tooltip appears with full name

### Tests for US1

- [X] T007 [P] [US1] Create `ApiCodeBadge` test file at `frontend/src/components/shared/api-code-badge.test.tsx` — test tooltip renders for known codes (RE, CE, SE), no tooltip for unknown codes, graceful fallback for empty/null input

### Implementation for US1

- [X] T008 [US1] Create `ApiCodeBadge` shared component at `frontend/src/components/shared/api-code-badge.tsx` — uses `AR_API_CODES` from `constants.ts` + shadcn/ui `Tooltip`, renders code text with tooltip showing full name and description, falls back to plain text for unrecognized codes
- [X] T009 [P] [US1] Integrate `ApiCodeBadge` into `frontend/src/components/dashboard/top-n-table.tsx` — wrap API code display in the Name column with `ApiCodeBadge` when `logType` is `'API'`
- [X] T010 [P] [US1] Integrate `ApiCodeBadge` into `frontend/src/components/explorer/log-table.tsx` — wrap API operation column values with `ApiCodeBadge`
- [X] T011 [P] [US1] Integrate `ApiCodeBadge` into `frontend/src/components/trace/waterfall-row.tsx` — wrap API code display in span label with `ApiCodeBadge`
- [X] T012 [US1] Verify all US1 tests pass (`cd frontend && npx vitest run src/components/shared/api-code-badge.test.tsx`)

**Checkpoint**: API code tooltips visible on hover across dashboard, explorer, and trace views

---

## Phase 4: User Story 2 — Assess Thread Utilization (Priority: P1)

**Goal**: Thread Statistics section shows a visual busy% progress bar per thread with color-coded thresholds

**Independent Test**: Expand Thread Statistics → each thread row shows colored progress bar with percentage

### Tests for US2

- [X] T013 [P] [US2] Update tests in `frontend/src/components/dashboard/threads-section.test.tsx` — add tests for busy% progress bar rendering, color thresholds (<50% green, 50-80% amber, >80% red), N/A display when busy_pct is undefined

### Implementation for US2

- [X] T014 [US2] Update `normalizeThreads` function in `frontend/src/app/(dashboard)/analysis/[id]/page.tsx` — map `busy_pct` field from both JAR-native (`BusyPct`) and computed thread data
- [X] T015 [US2] Add "Busy %" column with progress bar to `frontend/src/components/dashboard/threads-section.tsx` — add to `SortKey` type, `columns` array, render `<div>` progress bar with CSS width from `busy_pct`, color-coded: green (<50%), amber (50-80%), red (>80%), show "—" when undefined
- [X] T016 [US2] Verify all US2 tests pass (`cd frontend && npx vitest run src/components/dashboard/threads-section.test.tsx`)

**Checkpoint**: Thread busy% visualization working with color-coded thresholds

---

## Phase 5: User Story 3 — View Filter Execution Rate (Priority: P2)

**Goal**: Filters-per-transaction table includes a "Filters/sec" column highlighting filter storms

**Independent Test**: Expand Filter Complexity → per-transaction table shows Filters/sec column with values

### Tests for US3

- [X] T017 [P] [US3] Update tests in `frontend/src/components/dashboard/filters-section.test.tsx` — add tests for Filters/sec column rendering, warning highlight for values >100, display of "0" or "—" when data missing

### Implementation for US3

- [X] T018 [US3] Update `normalizeFilters` function in `frontend/src/app/(dashboard)/analysis/[id]/page.tsx` — map `filters_per_sec` field from JAR-native `JARFilterPerTransaction` data into `FilterPerTransaction`
- [X] T019 [US3] Add "Filters/sec" column to per-transaction table in `frontend/src/components/dashboard/filters-section.tsx` — render numeric value formatted to 1 decimal place, apply warning color (text-[var(--color-warning)]) when value >100
- [X] T020 [US3] Verify all US3 tests pass (`cd frontend && npx vitest run src/components/dashboard/filters-section.test.tsx`)

**Checkpoint**: Filter execution rate visible in per-transaction table with storm warnings

---

## Phase 6: User Story 4 — Identify Queued API Bottlenecks (Priority: P2)

**Goal**: A "Queued" tab in the Top-N section shows API calls ranked by queue wait time

**Independent Test**: Click "Queued" tab on dashboard → table shows API calls sorted by queue time

### Tests for US4

- [X] T021 [P] [US4] Create handler test at `backend/internal/api/handlers/queued_calls_test.go` — test happy path (returns queued calls from cache), missing tenant context (401), job not found (404), job not complete (409), empty data returns empty array

### Implementation for US4

- [X] T022 [US4] Add `getOrComputeQueuedCalls` function to `backend/internal/api/handlers/enhanced_helpers.go` — read full ParseResult from Redis cache key `{tenant}:parseresult:{job_id}`, extract `.QueuedAPICalls`, return as `QueuedCallsResponse{JobID, QueuedAPICalls, Total}`
- [X] T023 [US4] Create `QueuedCallsHandler` at `backend/internal/api/handlers/queued_calls.go` — same pattern as `FiltersHandler`: validate tenant, parse job_id, check job status, call `getOrComputeQueuedCalls`, return JSON
- [X] T024 [US4] Add `QueuedCallsHandler` field to `RouterConfig` in `backend/internal/api/router.go` and register route `GET /api/v1/analysis/{job_id}/dashboard/queued-calls`
- [X] T025 [US4] Add "Queued" tab to `TOP_N_TABS` array in `frontend/src/app/(dashboard)/analysis/[id]/page.tsx` — key `'queued'`, label `'Queued'`, fetch data via new `useQueuedCalls(jobId)` hook, render using existing `TopNTable` component with `queue_time_ms` as primary sort
- [X] T026 [US4] Verify backend and frontend tests pass (`cd backend && go test ./internal/api/handlers/... && cd ../frontend && npx vitest run src/app`)

**Checkpoint**: Queued API bottlenecks visible via dedicated tab in Top-N section

---

## Phase 7: User Story 5 — Understand Filter Nesting Depth (Priority: P2)

**Goal**: Filter Complexity section shows a "Filter Levels" sub-table with nesting depth per transaction

**Independent Test**: Expand Filter Complexity → Filter Levels table shows nesting depth, operation, and form

### Tests for US5

- [X] T027 [P] [US5] Update tests in `frontend/src/components/dashboard/filters-section.test.tsx` — add tests for Filter Levels sub-table: renders when `filter_levels` data present, hidden when absent, depth >5 highlighted with warning color

### Implementation for US5

- [X] T028 [US5] Update `normalizeFilters` function in `frontend/src/app/(dashboard)/analysis/[id]/page.tsx` — pass through `filter_levels` from JAR-native `JARFilterComplexityResponse` when present
- [X] T029 [US5] Add "Filter Levels" sub-table to `frontend/src/components/dashboard/filters-section.tsx` — render below per-transaction table when `filter_levels` array is non-empty, show columns: Line, Level, Operation, Form; highlight level >5 with warning color; hide section entirely when no data
- [X] T030 [US5] Verify all US5 tests pass (`cd frontend && npx vitest run src/components/dashboard/filters-section.test.tsx`)

**Checkpoint**: Filter nesting depth visible with warning highlights for deep chains

---

## Phase 8: User Story 6 — View Logging Duration by Type (Priority: P3)

**Goal**: Dashboard shows a "Logging Activity" section with per-log-type first/last timestamps and duration

**Independent Test**: View dashboard → Logging Activity section shows each log type with time range and duration

### Tests for US6

- [X] T031 [P] [US6] Create test at `backend/internal/jar/parser_test.go` — add `TestParseLoggingActivity` testing the "LOGGING ACTIVITY" section parser with sample JAR output
- [X] T032 [P] [US6] Create test at `frontend/src/components/dashboard/logging-activity-section.test.tsx` — test renders 4 log types with timestamps and durations, handles missing types, displays human-readable durations

### Implementation for US6

- [X] T033 [US6] Add `LoggingActivity` struct to `backend/internal/domain/models.go` — fields: `LogType string`, `FirstTimestamp time.Time`, `LastTimestamp time.Time`, `DurationMS int64`, `EntryCount int`
- [X] T034 [US6] Add `LoggingActivities []LoggingActivity` field to `ParseResult` struct in `backend/internal/domain/models.go`
- [X] T035 [US6] Add `parseLoggingActivity` function to `backend/internal/jar/parser.go` — parse JAR "LOGGING ACTIVITY" section into `[]LoggingActivity`, wire into main `Parse` function
- [X] T036 [US6] Create `LoggingActivitySection` component at `frontend/src/components/dashboard/logging-activity-section.tsx` — render table/cards showing each log type with first/last timestamp (formatted), total duration (human-readable: "2h 15m 30s"), and entry count; use existing design patterns
- [X] T037 [US6] Wire `LoggingActivitySection` into dashboard page at `frontend/src/app/(dashboard)/analysis/[id]/page.tsx` — add as a `CollapsibleSection` with lazy-loading, fetch logging activity data from ParseResult cache
- [X] T038 [US6] Verify all US6 tests pass (`cd backend && go test ./internal/jar/... && cd ../frontend && npx vitest run src/components/dashboard/logging-activity-section.test.tsx`)

**Checkpoint**: Logging activity per type visible on dashboard with time ranges and durations

---

## Phase 9: User Story 7 — Review Source File Metadata (Priority: P3)

**Goal**: Dashboard shows a "Source Files" section with per-file time ranges and durations

**Independent Test**: View dashboard for multi-file analysis → Source Files section shows per-file metadata

### Tests for US7

- [X] T039 [P] [US7] Add `TestParseFileMetadata` to `backend/internal/jar/parser_test.go` — test "FILE INFORMATION" section parser with sample JAR output
- [X] T040 [P] [US7] Create test at `frontend/src/components/dashboard/source-files-section.test.tsx` — test renders file list with ordinals, time ranges, durations; handles single file; hides when no data

### Implementation for US7

- [X] T041 [US7] Add `FileMetadata` struct to `backend/internal/domain/models.go` — fields: `FileNumber int`, `FileName string`, `StartTime time.Time`, `EndTime time.Time`, `DurationMS int64`, `EntryCount int`
- [X] T042 [US7] Add `FileMetadataList []FileMetadata` field to `ParseResult` struct in `backend/internal/domain/models.go`
- [X] T043 [US7] Add `parseFileMetadata` function to `backend/internal/jar/parser.go` — parse JAR "FILE INFORMATION" section into `[]FileMetadata`, wire into main `Parse` function
- [X] T044 [US7] Create `SourceFilesSection` component at `frontend/src/components/dashboard/source-files-section.tsx` — render table showing file number, file name, start time, end time, duration (human-readable); hide when no data
- [X] T045 [US7] Wire `SourceFilesSection` into dashboard page at `frontend/src/app/(dashboard)/analysis/[id]/page.tsx` — add as `CollapsibleSection` with lazy-loading
- [X] T046 [US7] Verify all US7 tests pass (`cd backend && go test ./internal/jar/... && cd ../frontend && npx vitest run src/components/dashboard/source-files-section.test.tsx`)

**Checkpoint**: Source file metadata visible on dashboard for multi-file analyses

---

## Phase 10: User Story 8 — Diagnose Delayed Escalations (Priority: P3)

**Goal**: Dashboard shows a "Delayed Escalations" section with delay metrics from ClickHouse query

**Independent Test**: View dashboard for analysis with escalation delays → section shows entries with delay metrics

### Tests for US8

- [X] T047 [P] [US8] Create handler test at `backend/internal/api/handlers/delayed_escalations_test.go` — test happy path, missing tenant (401), job not found (404), job not complete (409), empty results
- [X] T048 [P] [US8] Create test at `frontend/src/components/dashboard/delayed-escalations-section.test.tsx` — test renders entries with esc name, pool, scheduled/actual time, delay; highlights delay >60s as severe; handles empty state

### Implementation for US8

- [X] T049 [US8] Add `DelayedEscalationEntry` struct to `backend/internal/domain/models.go` — fields: `EscName string`, `EscPool string`, `ScheduledTime *time.Time`, `ActualTime time.Time`, `DelayMS uint32`, `ThreadID string`, `TraceID string`, `LineNumber int64`
- [X] T050 [US8] Add `DelayedEscalationsResponse` struct to `backend/internal/domain/models.go` — fields: `JobID string`, `Entries []DelayedEscalationEntry`, `Total int`, `AvgDelayMS float64`, `MaxDelayMS uint32`
- [X] T051 [US8] Add `QueryDelayedEscalations(ctx, tenantID, jobID uuid, minDelayMS int, limit int)` method to ClickHouse store interface in `backend/internal/storage/interfaces.go`
- [X] T052 [US8] Implement `QueryDelayedEscalations` in `backend/internal/storage/clickhouse.go` — query `SELECT esc_name, esc_pool, scheduled_time, timestamp, delay_ms, thread_id, trace_id, line_number FROM log_entries WHERE tenant_id = ? AND job_id = ? AND log_type = 'ESCL' AND delay_ms > ? ORDER BY delay_ms DESC LIMIT ?`
- [X] T053 [US8] Create `DelayedEscalationsHandler` at `backend/internal/api/handlers/delayed_escalations.go` — validate tenant, parse job_id, parse query params (min_delay_ms, limit), check job status, call ClickHouse query, compute avg/max delay, return JSON
- [X] T054 [US8] Add `DelayedEscalationsHandler` field to `RouterConfig` in `backend/internal/api/router.go` and register route `GET /api/v1/analysis/{job_id}/dashboard/delayed-escalations`
- [X] T055 [US8] Create `DelayedEscalationsSection` component at `frontend/src/components/dashboard/delayed-escalations-section.tsx` — render sortable table with columns: Escalation Name, Pool, Scheduled Time, Actual Time, Delay (formatted), Thread ID; highlight delay >60s with error color; show summary metrics (avg/max delay, total count)
- [X] T056 [US8] Wire `DelayedEscalationsSection` into dashboard page at `frontend/src/app/(dashboard)/analysis/[id]/page.tsx` — add as `CollapsibleSection` with lazy-loading using `useDelayedEscalations(jobId)` hook
- [X] T057 [US8] Verify all US8 tests pass (`cd backend && go test ./internal/... && cd ../frontend && npx vitest run src/components/dashboard/delayed-escalations-section.test.tsx`)

**Checkpoint**: Delayed escalation diagnostics visible with severity highlighting and pool context

---

## Phase 11: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and integration testing across all features

- [X] T058 Run full frontend test suite (`cd frontend && npm test`) — all tests pass including new ones
- [X] T059 [P] Run full backend test suite (`cd backend && go test ./...`) — all tests pass including new ones
- [X] T060 [P] Run frontend build (`cd frontend && npm run build`) — production build succeeds with no errors
- [X] T061 Verify graceful degradation: all 8 sections render correctly when data is available and hide gracefully when data is absent (FR-009)
- [X] T062 Run quickstart.md verification steps: upload sample logs, verify all 8 insight features render

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — verify baseline
- **Foundational (Phase 2)**: Depends on Setup — adds shared types
- **US1-US2 (Phases 3-4)**: Depend on Foundational — P1 stories, can run in parallel
- **US3-US5 (Phases 5-7)**: Depend on Foundational — P2 stories, can run in parallel
- **US6-US8 (Phases 8-10)**: Depend on Foundational — P3 stories, can run in parallel
- **Polish (Phase 11)**: Depends on all desired stories being complete

### User Story Dependencies

- **US1 (P1)**: Independent — frontend-only, uses existing constants.ts data
- **US2 (P1)**: Independent — frontend-only, data already in Redis
- **US3 (P2)**: Independent — frontend-only, data already in Redis
- **US4 (P2)**: Independent — requires new backend endpoint + frontend tab
- **US5 (P2)**: Independent — frontend-only, data already in filters endpoint
- **US6 (P3)**: Independent — requires new backend parser + frontend section
- **US7 (P3)**: Independent — requires new backend parser + frontend section
- **US8 (P3)**: Independent — requires new backend endpoint + ClickHouse query + frontend section

### Within Each User Story

- Tests written first (TDD: verify they fail)
- Backend changes before frontend (when both exist)
- Type/model changes before component changes
- Verify tests pass as final step

### Parallel Opportunities

Within each priority tier, all stories can run in parallel:

```
Phase 2 (Foundational) ────────────────────────────┐
                                                     │
  ┌──── Phase 3: US1 (API Legend) ──────────────┐   │
  │                                              │   │
  ├──── Phase 4: US2 (Thread Busy%) ────────────┤ P1│
  │                                              │   │
  ├──── Phase 5: US3 (FPS Column) ──────────────┤   │
  │                                              │   │
  ├──── Phase 6: US4 (Queued Calls) ────────────┤ P2│
  │                                              │   │
  ├──── Phase 7: US5 (Filter Levels) ───────────┤   │
  │                                              │   │
  ├──── Phase 8: US6 (Logging Activity) ────────┤   │
  │                                              │   │
  ├──── Phase 9: US7 (Source Files) ────────────┤ P3│
  │                                              │   │
  └──── Phase 10: US8 (Delayed Escalations) ────┘   │
                                                     │
Phase 11 (Polish) ─────────────────────────────────┘
```

---

## Parallel Example: US1 + US2 (P1 Stories)

```bash
# After Phase 2 completes, launch P1 stories in parallel:

# US1: API Legend (frontend-only)
Task: "Create ApiCodeBadge component at frontend/src/components/shared/api-code-badge.tsx"
Task: "Create ApiCodeBadge tests at frontend/src/components/shared/api-code-badge.test.tsx"

# US2: Thread Busy % (frontend-only)
Task: "Update normalizeThreads in frontend/src/app/(dashboard)/analysis/[id]/page.tsx"
Task: "Add busy% column to frontend/src/components/dashboard/threads-section.tsx"

# Both touch different files — no conflicts
```

---

## Implementation Strategy

### MVP First (US1 + US2 Only)

1. Complete Phase 1: Setup (verify baselines)
2. Complete Phase 2: Foundational (type extensions)
3. Complete Phase 3: US1 — API tooltips across all pages
4. Complete Phase 4: US2 — Thread busy% progress bars
5. **STOP and VALIDATE**: Both P1 stories independently functional
6. Deploy/demo — immediate UX value

### Incremental Delivery

1. Setup + Foundational → Types ready
2. US1 + US2 → P1 complete (API Legend + Thread Busy%) → Deploy
3. US3 + US4 + US5 → P2 complete (FPS + Queued + Filter Levels) → Deploy
4. US6 + US7 + US8 → P3 complete (Logging Activity + Source Files + Delayed Escalations) → Deploy
5. Each priority tier adds value without breaking previous tiers

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- US1-US5 are primarily frontend changes (data already in backend)
- US6-US7 require new JAR parser sections (backend + frontend)
- US8 requires new ClickHouse query + endpoint (full stack)
- Commit after each completed user story
- Stop at any checkpoint to validate independently

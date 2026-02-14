# Tasks: Fix Dashboard Data Pipeline

**Input**: Design documents from `/specs/006-fix-dashboard-data/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/openapi.yaml

**Tests**: Required per FR-015 (new unit tests covering all newly parsed sections with real JAR output samples)

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: Prepare testdata and verify baseline

- [x] T001 Copy real JAR v3.2.2 output to `backend/testdata/jar_output_log1.txt` from `/tmp/jar_output_log1.txt` for deterministic tests
- [x] T002 Verify all existing backend tests pass by running `go test ./...` in `backend/` — record baseline (zero failures expected)
- [x] T003 Verify all existing frontend tests pass by running `npm test` in `frontend/` — record baseline (4 pre-existing websocket test failures)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Domain types, parser infrastructure, pipeline integration, and TypeScript interfaces that ALL user stories depend on

**CRITICAL**: No user story work can begin until this phase is complete

### Domain Types

- [x] T004 Add JAR gap types (`JARGapEntry`, `JARGapsResponse`) to `backend/internal/domain/models.go` per data-model.md
- [x] T005 [P] Add JAR aggregate types (`JARAggregateRow`, `JARAggregateGroup`, `JARAggregateTable`, `JARAggregatesResponse`) to `backend/internal/domain/models.go` per data-model.md
- [x] T006 [P] Add JAR thread stat types (`JARThreadStat`, `JARThreadStatsResponse`) to `backend/internal/domain/models.go` per data-model.md
- [x] T007 [P] Add JAR error/exception types (`JARAPIError`, `JARExceptionEntry`, `JARExceptionsResponse`) to `backend/internal/domain/models.go` per data-model.md
- [x] T008 [P] Add JAR filter types (`JARFilterMostExecuted`, `JARFilterPerTransaction`, `JARFilterExecutedPerTxn`, `JARFilterLevel`, `JARFilterComplexityResponse`) to `backend/internal/domain/models.go` per data-model.md
- [x] T009 [P] Add `JARAPIAbbreviation` type and extend `ParseResult` struct with JAR-native fields (`JARGaps`, `JARAggregates`, `JARExceptions`, `JARThreadStats`, `JARFilters`, `APIAbbreviations`, `QueuedAPICalls`) in `backend/internal/domain/models.go`

### Parser Infrastructure

- [x] T010 Extend `splitSections()` in `backend/internal/jar/parser.go` to split `###` subsections within major sections (GAP ANALYSIS, API, SQL, ESCALATIONS, FLTR) into a hierarchical map, producing subsection keys like `"API:AGGREGATES_BY_FORM"`, `"API:THREAD_STATS"`, `"API:ERRORS"`, `"API:EXCEPTION_REPORT"`, `"SQL:AGGREGATES_BY_TABLE"`, etc.
- [x] T011 Add generic `parseGroupedAggregateTable()` function in `backend/internal/jar/parser.go` that handles the two-pass grouped aggregate pattern: (1) detect column boundaries from dash separator, (2) iterate rows tracking current entity, operation sub-rows, subtotal separators (------), and grand total separators (======). Returns `*domain.JARAggregateTable`. Handle edge cases: empty Fail columns, multi-table names with commas, empty operation type on subtotal rows.
- [x] T012 Add `parseGapEntries()` function in `backend/internal/jar/parser.go` that parses fixed-width gap tables (line gaps and thread gaps) into `[]domain.JARGapEntry`. Handle: gap duration as float seconds, details column with long SQL or multi-word text, timestamp in `DDD MMM DD YYYY HH:MM:SS.fff` format.
- [x] T013 [P] Add `parseThreadStatsTable()` function in `backend/internal/jar/parser.go` that parses thread statistics tables into `[]domain.JARThreadStat`. Handle two variants: API threads (with QCount, QTime columns) and SQL threads (without QCount/QTime). Parse busy percentage from `"0.33%"` format.
- [x] T014 [P] Add `parseAPIErrors()` function in `backend/internal/jar/parser.go` that parses "API CALLS THAT ERRORED OUT" into `[]domain.JARAPIError`. Handle: error messages with dashes and special characters (e.g., `"-SE FAIL -- AR Error(45386) null : Required field..."`).
- [x] T015 [P] Add `parseExceptionReport()` function in `backend/internal/jar/parser.go` that parses API and SQL exception reports into `[]domain.JARExceptionEntry`. Handle two variants: API exceptions (Line#, TrID, Type, Message) and SQL exceptions (Line#, TrID, Message, SQL Statement).
- [x] T016 [P] Add filter section parsers in `backend/internal/jar/parser.go`: `parseMostExecutedFilters()` → `[]JARFilterMostExecuted`, `parseFilterPerTransaction()` → `[]JARFilterPerTransaction` (handle NaN FiltersPerSec → 0), `parseFilterExecutedPerTxn()` → `[]JARFilterExecutedPerTxn`, `parseFilterLevels()` → `[]JARFilterLevel`. Handle truncated filter names with backtick-exclamation (`\`!`).
- [x] T017 [P] Add `parseAPIAbbreviationLegend()` function in `backend/internal/jar/parser.go` that parses the abbreviation table into `[]domain.JARAPIAbbreviation`.

### Wire Parsers into ParseOutput

- [x] T018 Update `ParseOutput()` in `backend/internal/jar/parser.go` to call all new parse functions for their respective subsections and populate the new `ParseResult` JAR-native fields. Handle absent sections gracefully (e.g., "No Queued API's" → nil, missing filter section → nil). Detect empty sections by checking for text like "No Queued", "No data", or subsections with no data rows.

### Worker & Cache Integration

- [x] T019 Update `ProcessJob()` in `backend/internal/worker/ingestion.go` to cache all `ParseResult` JAR-native sections in Redis: `JARGaps` → `:gaps` key, `JARAggregates` → `:agg` key, `JARExceptions` → `:exc` key, `JARThreadStats` → `:threads` key, `JARFilters` → `:filters` key. Use 24h TTL. Set `Source: "jar_parsed"` on each response before caching.
- [x] T020 Update `ComputeEnhancedSections()` in `backend/internal/worker/enhanced.go` to check if JAR-native data is already present on `ParseResult` and skip computation for those sections. If `ParseResult.JARAggregates` is non-nil, skip `computeAggregates()`. Same for gaps, exceptions, threads, filters. Keep existing compute functions as fallback.

### API Handler Infrastructure

- [x] T021 Update `getOrComputeAggregates()` in `backend/internal/api/handlers/enhanced_helpers.go` to first attempt unmarshalling cached Redis value as `JARAggregatesResponse` (check for `"source":"jar_parsed"`). If found, return directly. Otherwise fall back to existing `ComputeEnhancedSections()` path. Apply same pattern to `getOrComputeExceptions()`, `getOrComputeGaps()`, `getOrComputeThreads()`, `getOrComputeFilters()`.

### Frontend TypeScript Interfaces

- [x] T022 Add all JAR-native TypeScript interfaces to `frontend/src/lib/api.ts` per contracts/openapi.yaml: `JARGapEntry`, `JARGapsResponse`, `JARAggregateRow`, `JARAggregateGroup`, `JARAggregateTable`, `JARAggregatesResponse`, `JARThreadStat`, `JARThreadStatsResponse`, `JARAPIError`, `JARExceptionEntry`, `JARExceptionsResponse`, `JARFilterMostExecuted`, `JARFilterPerTransaction`, `JARFilterExecutedPerTxn`, `JARFilterLevel`, `JARFilterComplexityResponse`. Each response type includes `source: "jar_parsed" | "computed"`.

**Checkpoint**: Foundation ready — all types defined, parsers implemented, pipeline wired, cache populated. User story implementation can begin.

---

## Phase 3: User Story 1 — View Complete Analysis Aggregates (Priority: P1)

**Goal**: Display performance aggregates grouped by Form, Client, Client IP, Table, and Pool with OK/Fail/Total counts and MIN/MAX/AVG/SUM timing.

**Independent Test**: Upload `error_logs/log1.log`, run analysis, navigate to dashboard. Aggregates section shows tabbed data with 6 grouping dimensions and full timing metrics.

### Tests for User Story 1

- [x] T023 [P] [US1] Write unit test `TestParseAggregateTable_APIByForm` in `backend/internal/jar/parser_test.go` using real JAR output snippet from `backend/testdata/jar_output_log1.txt` — verify correct group count, entity names, operation types, OK/Fail/Total counts, and MIN/MAX/AVG/SUM values match exactly
- [x] T024 [P] [US1] Write unit test `TestParseAggregateTable_SQLByTable` in `backend/internal/jar/parser_test.go` using real SQL aggregate snippet — verify table names (including multi-table names like "H373, T373"), SQL types (SELECT/INSERT/UPDATE/DELETE), and timing values
- [x] T025 [P] [US1] Write unit test `TestParseAggregateTable_EscByPool` in `backend/internal/jar/parser_test.go` using real escalation aggregate snippet — verify pool numbers, escalation names, counts
- [x] T026 [P] [US1] Write fidelity test `TestFidelity_Aggregates_FullOutput` in `backend/internal/jar/fidelity_test.go` that parses full `backend/testdata/jar_output_log1.txt` and verifies all 6 aggregate tables are populated with correct group counts

### Implementation for User Story 1

- [x] T027 [US1] Update `aggregates.go` handler in `backend/internal/api/handlers/aggregates.go` to return `JARAggregatesResponse` JSON (with all 6 tables) when source is `"jar_parsed"`, preserving existing response format as fallback for old analyses
- [x] T028 [US1] Update `AggregatesSection` component in `frontend/src/components/dashboard/aggregates-section.tsx` to render `JARAggregatesResponse`: add tabs for "By Form", "By Client", "By Client IP", "By Table", "By Esc Form", "By Esc Pool". Each tab displays a table with columns: Entity Name, Operation Type, OK, Fail, Total, MIN Time, MAX Time, AVG Time, SUM Time. Show entity groups with expandable/collapsible sub-rows per operation type. Display grand total row at bottom. Show "Re-analyze for full data" banner when `source === "computed"`.

**Checkpoint**: Aggregates section shows 6 tabs of grouped data matching JAR output exactly.

---

## Phase 4: User Story 2 — View Gap Analysis and Thread Statistics (Priority: P1)

**Goal**: Display 50 longest line gaps, 50 longest thread gaps, and per-queue/per-thread statistics with busy percentages.

**Independent Test**: Upload `error_logs/log1.log`, run analysis. Gap Analysis shows gap entries with durations. Thread Statistics shows queue-grouped stats with busy%.

### Tests for User Story 2

- [x] T029 [P] [US2] Write unit test `TestParseGapEntries_LineGaps` in `backend/internal/jar/parser_test.go` using real line gap snippet — verify gap durations (float seconds), line numbers, trace IDs, timestamps, and details text
- [x] T030 [P] [US2] Write unit test `TestParseGapEntries_ThreadGaps` in `backend/internal/jar/parser_test.go` using real thread gap snippet — verify same fields as line gaps
- [x] T031 [P] [US2] Write unit test `TestParseThreadStats_API` in `backend/internal/jar/parser_test.go` using real API thread stats snippet — verify queue names, thread IDs, first/last times, counts, QCount, QTime, TotalTime, BusyPct
- [x] T032 [P] [US2] Write unit test `TestParseThreadStats_SQL` in `backend/internal/jar/parser_test.go` using real SQL thread stats snippet — verify no QCount/QTime columns, correct busy percentages

### Implementation for User Story 2

- [x] T033 [US2] Update `gaps.go` handler in `backend/internal/api/handlers/gaps.go` to return `JARGapsResponse` JSON (with line_gaps, thread_gaps arrays) when source is `"jar_parsed"`
- [x] T034 [US2] Update `threads.go` handler in `backend/internal/api/handlers/threads.go` to return `JARThreadStatsResponse` JSON (with api_threads, sql_threads arrays grouped by queue) when source is `"jar_parsed"`
- [x] T035 [US2] Update `GapsSection` component in `frontend/src/components/dashboard/gaps-section.tsx` to render `JARGapsResponse`: tabs for "Line Gaps" and "Thread Gaps", each showing a sortable table with columns Gap Duration (formatted seconds), Line#, Trace ID, Timestamp, Details. Highlight gaps > 1 second. Show gap count badge per tab.
- [x] T036 [US2] Update `ThreadsSection` component in `frontend/src/components/dashboard/threads-section.tsx` to render `JARThreadStatsResponse`: tabs for "API Threads" and "SQL Threads", each showing a table grouped by queue name with columns Thread ID, First Time, Last Time, Count, Q Count (API only), Q Time (API only), Total Time, Busy%. Color-code busy% (red >=90%, yellow >=50%, green <50%). Show queue summary headers.

**Checkpoint**: Gap Analysis and Thread Statistics sections show full data from JAR output.

---

## Phase 5: User Story 3 — View Errors and Exceptions (Priority: P1)

**Goal**: Display API errors, API exceptions, and SQL exceptions with full detail.

**Independent Test**: Upload `error_logs/log1.log`, run analysis. Exceptions section shows API errors with full error messages, API exception warnings, and SQL exceptions.

### Tests for User Story 3

- [x] T037 [P] [US3] Write unit test `TestParseAPIErrors` in `backend/internal/jar/parser_test.go` using real "API CALLS THAT ERRORED OUT" snippet — verify end line, trace ID, queue, API type, form, user, start time, and full error message including special characters like `"-SE FAIL -- AR Error(45386)"`
- [x] T038 [P] [US3] Write unit test `TestParseExceptionReport_API` in `backend/internal/jar/parser_test.go` using real API exception report snippet — verify line numbers, trace IDs, types, warning messages
- [x] T039 [P] [US3] Write unit test `TestParseExceptionReport_SQL` in `backend/internal/jar/parser_test.go` using real SQL exception report snippet — verify line numbers, trace IDs, messages, SQL statements

### Implementation for User Story 3

- [x] T040 [US3] Update `exceptions.go` handler in `backend/internal/api/handlers/exceptions.go` to return `JARExceptionsResponse` JSON (with api_errors, api_exceptions, sql_exceptions arrays) when source is `"jar_parsed"`. Preserve existing computed response format for old analyses.
- [x] T041 [US3] Update `ExceptionsSection` component in `frontend/src/components/dashboard/exceptions-section.tsx` to render `JARExceptionsResponse`: tabs for "API Errors", "API Exceptions", "SQL Exceptions". API Errors tab: table with Line#, Trace ID, Queue, API, Form, User, Start Time, Error Message (expandable). API Exceptions tab: table with Line#, Trace ID, Type, Message. SQL Exceptions tab: table with Line#, Trace ID, Message, SQL Statement (truncated with expand). Show count badges per tab. Preserve "No errors detected" empty state when all arrays are empty.

**Checkpoint**: Exceptions section shows 3 tabs of error/exception data from JAR output.

---

## Phase 6: User Story 4 — View Complete Filter Complexity Analysis (Priority: P2)

**Goal**: Display all 5 filter sub-sections: longest running, most executed, per transaction, most executed per transaction, and filter levels.

**Independent Test**: Upload `error_logs/log1.log`, run analysis. Filter Complexity section shows 5 sub-tabs with filter data.

### Tests for User Story 4

- [x] T042 [P] [US4] Write unit test `TestParseMostExecutedFilters` in `backend/internal/jar/parser_test.go` using real snippet — verify filter names (including truncated names with backtick-exclamation), pass counts, fail counts
- [x] T043 [P] [US4] Write unit test `TestParseFilterPerTransaction` in `backend/internal/jar/parser_test.go` — verify line numbers, trace IDs, filter counts, operations, forms, request IDs, and FiltersPerSec (including NaN → 0 handling)
- [x] T044 [P] [US4] Write unit test `TestParseFilterExecutedPerTxn` in `backend/internal/jar/parser_test.go` — verify per-transaction filter execution data
- [x] T045 [P] [US4] Write unit test `TestParseFilterLevels` in `backend/internal/jar/parser_test.go` — verify filter nesting levels per transaction

### Implementation for User Story 4

- [x] T046 [US4] Update `filters.go` handler in `backend/internal/api/handlers/filters.go` to return `JARFilterComplexityResponse` JSON (with all 5 sub-section arrays) when source is `"jar_parsed"`
- [x] T047 [US4] Update `FiltersSection` component in `frontend/src/components/dashboard/filters-section.tsx` to render `JARFilterComplexityResponse`: 5 tabs — "Longest Running" (existing TopN, already working), "Most Executed" (filter name, pass count, fail count), "Per Transaction" (line#, traceID, filter count, operation, form, requestID, filters/sec), "Executed Per Txn" (line#, traceID, filter name, pass count, fail count), "Filter Levels" (line#, traceID, filter level, operation, form, requestID). Show total filter time badge.

**Checkpoint**: Filter Complexity section shows 5 tabs of filter data from JAR output.

---

## Phase 7: User Story 5 — Generate Time Series from Parsed Data (Priority: P2)

**Goal**: Display a time-series chart of operations bucketed by minute or second from TopN entry timestamps.

**Independent Test**: Upload `error_logs/log1.log`, run analysis. Time Series chart shows multi-series line chart with operations over time.

### Tests for User Story 5

- [x] T048 [P] [US5] Write unit test `TestGenerateTimeSeries_MinuteBuckets` in `backend/internal/worker/enhanced_test.go` — create TopN entries spanning >1 minute, verify bucketing produces correct minute-level TimeSeriesPoint array with per-type counts
- [x] T049 [P] [US5] Write unit test `TestGenerateTimeSeries_SecondBuckets` in `backend/internal/worker/enhanced_test.go` — create TopN entries spanning <1 minute, verify second-level bucketing

### Implementation for User Story 5

- [x] T050 [US5] Add `generateTimeSeries()` function in `backend/internal/worker/enhanced.go` that collects all TopN entry timestamps from `DashboardData` (TopAPICalls, TopSQL, TopFilters, TopEscalations — up to 200 entries), determines log duration from `GeneralStats`, buckets by minute (if duration >1 min) or second (if <=1 min), counts per type per bucket, returns `[]domain.TimeSeriesPoint`
- [x] T051 [US5] Call `generateTimeSeries()` from `ProcessJob()` in `backend/internal/worker/ingestion.go` and set result on `DashboardData.TimeSeries` before caching to Redis
- [x] T052 [US5] Verify `TimeSeriesChart` component in `frontend/src/components/dashboard/time-series-chart.tsx` renders correctly with sparse TopN-bucketed data (may need minor adjustments for low data-point counts — ensure Brush component threshold handles <10 points)

**Checkpoint**: Time Series chart shows operations bucketed over the analysis time window.

---

## Phase 8: User Story 6 — Generate Distribution Charts from Parsed Data (Priority: P2)

**Goal**: Display distribution charts with breakdowns by type, queue, form, and table derived from aggregate data.

**Independent Test**: Upload `error_logs/log1.log`, run analysis. Distribution charts show correct proportional breakdowns.

### Tests for User Story 6

- [x] T053 [P] [US6] Write unit test `TestGenerateDistribution` in `backend/internal/worker/enhanced_test.go` — provide mock `JARAggregatesResponse` with known totals, verify distribution maps are correctly computed for by_type, by_form, by_table, by_queue dimensions

### Implementation for User Story 6

- [x] T054 [US6] Add `generateDistribution()` function in `backend/internal/worker/enhanced.go` that builds `map[string]map[string]int` from: (1) by_type: API/SQL/Filter/Escalation from GeneralStats counts, (2) by_form: sum Total per form from `JARAggregates.APIByForm`, (3) by_table: sum Total per table from `JARAggregates.SQLByTable`, (4) by_queue: sum Count per queue from `JARThreadStats.APIThreads` + `SQLThreads`, (5) by_user: from existing `Distribution["users"]`
- [x] T055 [US6] Call `generateDistribution()` from `ProcessJob()` in `backend/internal/worker/ingestion.go` and merge result into `DashboardData.Distribution` before caching
- [x] T056 [US6] Verify `DistributionChart` component in `frontend/src/components/dashboard/distribution-chart.tsx` renders correctly with aggregate-derived breakdowns — ensure by_form and by_table dimensions display full entity names from aggregate data

**Checkpoint**: Distribution charts show correct breakdowns derived from JAR aggregate data.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Edge cases, backward compatibility, validation

- [x] T057 Add backward-compatibility handling in `frontend/src/app/(dashboard)/analysis/[id]/page.tsx` — when any section response has `source === "computed"` and data is empty/sparse, show a "Re-analyze for full data" banner above the section with a button linking to re-run analysis
- [x] T058 [P] Handle edge case: absent JAR sections (e.g., "No Queued API's", missing filter section when filter logging disabled) — verify parser returns nil gracefully and frontend shows appropriate empty state messages in all 5 section components
- [x] T059 [P] Handle edge case: large aggregate tables (30+ forms, 60+ tables) — add client-side pagination or "Show more" toggle to `AggregatesSection` when group count exceeds 20
- [x] T060 [P] Handle edge case: log files with only one activity type (e.g., only escalations) — verify all section components hide gracefully when their data array is empty/nil
- [x] T061 Write integration test `TestFullPipeline_ParseAndCache` in `backend/internal/jar/integration_test.go` that loads `backend/testdata/jar_output_log1.txt`, runs `ParseOutput()`, verifies all JAR-native ParseResult fields are populated (non-nil), and checks key counts: API aggregates >0 groups, gaps >0 entries, threads >0 entries, errors >=1, filters >0 entries
- [x] T062 Run full backend test suite (`go test ./...` in `backend/`) — verify zero regressions (SC-009), all new tests pass
- [x] T063 Run full frontend test suite (`npm test` in `frontend/`) — verify zero regressions (4 pre-existing failures in uploadFile/websocket tests, unrelated to dashboard changes; all 441 dashboard-related tests pass)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup (T001) — BLOCKS all user stories
- **US1 Aggregates (Phase 3)**: Depends on Foundational completion (T004-T022)
- **US2 Gaps & Threads (Phase 4)**: Depends on Foundational completion — can run in PARALLEL with US1
- **US3 Exceptions (Phase 5)**: Depends on Foundational completion — can run in PARALLEL with US1, US2
- **US4 Filters (Phase 6)**: Depends on Foundational completion — can run in PARALLEL with US1-US3
- **US5 Time Series (Phase 7)**: Depends on Foundational completion — can run in PARALLEL with US1-US4
- **US6 Distribution (Phase 8)**: Depends on US1 completion (needs aggregate data for distribution generation)
- **Polish (Phase 9)**: Depends on all user stories being complete

### User Story Dependencies

```text
Setup (Phase 1)
  └── Foundational (Phase 2)
        ├── US1: Aggregates (Phase 3) ──┐
        ├── US2: Gaps & Threads (Phase 4) │ (all can run in parallel)
        ├── US3: Exceptions (Phase 5)     │
        ├── US4: Filters (Phase 6)        │
        ├── US5: Time Series (Phase 7)    │
        │                                  │
        └── US6: Distribution (Phase 8) ──┘ (depends on US1 for aggregate data)
              └── Polish (Phase 9)
```

### Within Each User Story

1. Tests FIRST — write and verify they fail before implementation
2. Backend handler update
3. Frontend component update
4. Verify story independently

### Parallel Opportunities

**Within Phase 2 (Foundational)**:
- T004-T009 (domain types): All [P] — different type groups, same file but independent sections
- T011-T017 (parser functions): All [P] — independent functions in parser.go
- T022 (TS interfaces): [P] with all backend tasks

**Across User Stories**:
- US1, US2, US3, US4, US5 can ALL start simultaneously after Phase 2
- Each story's tests (marked [P]) can run in parallel within the story

---

## Parallel Example: User Story 1 (Aggregates)

```bash
# Launch all tests for US1 together (parallel):
Task: "T023 — TestParseAggregateTable_APIByForm in parser_test.go"
Task: "T024 — TestParseAggregateTable_SQLByTable in parser_test.go"
Task: "T025 — TestParseAggregateTable_EscByPool in parser_test.go"
Task: "T026 — TestFidelity_Aggregates_FullOutput in fidelity_test.go"

# Then sequential implementation:
Task: "T027 — Update aggregates handler"
Task: "T028 — Update AggregatesSection frontend component"
```

## Parallel Example: All P1 Stories (after Foundational)

```bash
# Launch all P1 stories simultaneously:
Story US1: T023-T028 (Aggregates)
Story US2: T029-T036 (Gaps & Threads)
Story US3: T037-T041 (Exceptions)
```

---

## Implementation Strategy

### MVP First (P1 Stories: US1 + US2 + US3)

1. Complete Phase 1: Setup (T001-T003)
2. Complete Phase 2: Foundational (T004-T022) — **CRITICAL GATE**
3. Complete Phase 3: US1 Aggregates (T023-T028)
4. Complete Phase 4: US2 Gaps & Threads (T029-T036)
5. Complete Phase 5: US3 Exceptions (T037-T041)
6. **STOP and VALIDATE**: All P1 acceptance scenarios pass. Dashboard shows aggregates, gaps, threads, and exceptions from real JAR data.

### Incremental Delivery

1. Setup + Foundational → Parser infrastructure ready
2. Add US1 (Aggregates) → Test → Aggregates section populated
3. Add US2 (Gaps & Threads) → Test → Gap analysis and thread stats populated
4. Add US3 (Exceptions) → Test → Errors and exceptions populated
5. Add US4 (Filters) → Test → All 5 filter sub-tabs populated
6. Add US5 (Time Series) → Test → Chart shows operations over time
7. Add US6 (Distribution) → Test → Charts show workload breakdown
8. Polish → Edge cases, backward compat, full test suite green

### Suggested MVP Scope

US1 + US2 + US3 (all P1) deliver the most impactful dashboard improvements: aggregates answer "what's slowest?", gaps/threads answer "what's stuck?", and exceptions answer "what's broken?". These 3 stories cover 5 of the 7 empty dashboard sections.

---

## Notes

- [P] tasks = different files or independent sections, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story is independently testable after its phase completes
- All parser tests use real JAR output snippets from `backend/testdata/jar_output_log1.txt`
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Total: 63 tasks across 9 phases

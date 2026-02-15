# Tasks: Complete Log Explorer

**Input**: Design documents from `/specs/007-complete-log-explorer/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/openapi.yaml

**Tests**: Contract tests added for new API endpoints per Constitution III. Existing test files will be updated as part of implementation tasks where needed.

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Backend**: `backend/internal/` (Go)
- **Frontend**: `frontend/src/` (TypeScript/React)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Database migrations and interface extensions needed by multiple user stories

- [x] T001 Apply PostgreSQL migration: ALTER saved_searches ADD COLUMN time_range JSONB DEFAULT NULL in `backend/migrations/002_search_features.up.sql`
- [x] T002 Apply PostgreSQL migration: CREATE TABLE search_history with tenant_id, user_id, job_id, kql_query, result_count, created_at, RLS policy, and index per `specs/007-complete-log-explorer/data-model.md` in `backend/migrations/002_search_features.up.sql`
- [x] T003 Extend ClickHouseStore interface in `backend/internal/storage/interfaces.go` with new methods: GetHistogramData(ctx, tenantID, jobID string, timeFrom, timeTo time.Time) (*HistogramResponse, error), GetEntryContext(ctx, tenantID, jobID, entryID string, window int) (*ContextResponse, error), GetAutocompleteValues(ctx, tenantID, jobID, field, prefix string, limit int) ([]AutocompleteValue, error)
- [x] T004 [P] Extend PostgresStore interface in `backend/internal/storage/interfaces.go` with new methods: RecordSearchHistory, GetSearchHistory (CreateSavedSearch, ListSavedSearches, DeleteSavedSearch already existed)
- [x] T005 [P] Add HistogramBucket, ContextResult, AutocompleteValue domain types in `backend/internal/domain/explorer.go`
- [x] T006 Update mock implementations in `backend/internal/testutil/mocks.go` to satisfy all new interface methods with stub returns
- [x] T006a [P] Add contract tests for new/modified API endpoints in `backend/internal/api/handlers/explorer_contract_test.go`. Validate: job-scoped search (GET /analysis/{job_id}/search) returns 200 with valid KQL and 400 with invalid syntax; entry fetch (GET /analysis/{job_id}/entries/{entry_id}) returns 200 for existing and 404 for missing; context endpoint returns ContextResponse shape; autocomplete returns suggestions; export returns CSV/JSON content types; saved search CRUD returns correct status codes; search history returns list. Use mock stores from T006.

**Checkpoint**: Interfaces extended, migrations ready, mocks updated, contract tests scaffolded — story implementation can begin

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Refactor search handler from global to job-scoped — MUST complete before any user story

**CRITICAL**: No user story work can begin until this phase is complete

- [x] T007 Refactor SearchHandler in `backend/internal/api/handlers/search.go` to extract job_id from mux path variable (gorilla/mux.Vars), pass it to Bleve search as a mandatory term query on "job_id" field, and pass to ClickHouse SearchEntries. Remove support for the old global `/api/v1/search` GET endpoint. Add sort/order query param parsing (timestamp, duration_ms, line_number, user; asc/desc).
- [x] T008 Register the refactored SearchHandler as SearchLogsHandler in RouterConfig in `backend/cmd/api/main.go` — wire it with ClickHouseClient and BleveManager dependencies so `/api/v1/analysis/{job_id}/search` returns real results instead of 501.
- [x] T009 Update the `useSearch` hook in `frontend/src/hooks/use-search.ts` to accept a required jobId parameter, change API URL from `/api/v1/search` to `/api/v1/analysis/${jobId}/search`, and pass jobId in all search calls.
- [x] T010 Update explorer page route: move from `frontend/src/app/(dashboard)/explorer/page.tsx` to `frontend/src/app/(dashboard)/analysis/[id]/explorer/page.tsx` as a nested route under the analysis detail. The page reads job_id from the `[id]` URL segment and passes it to useSearch. Show "Select an analysis job" placeholder if no job_id is present. Keep the old route as a redirect or remove it.
- [x] T011 Update navigation sidebar in the dashboard layout to link to the explorer with job context. Add "Explore Logs" button to the analysis detail page at `frontend/src/app/(dashboard)/analysis/[id]/page.tsx` that navigates to the explorer scoped to that job.

**Checkpoint**: Search is job-scoped end-to-end. Explorer opens from job context. All existing functionality preserved.

---

## Phase 3: User Story 1 — Job-Scoped Search with Time Range (Priority: P1) MVP

**Goal**: Users can open the Log Explorer scoped to a specific job and narrow results by relative or absolute time range.

**Independent Test**: Navigate to a job, open explorer, select "Last 1 hour" relative time range, confirm results are filtered. Switch to custom absolute range and verify results update.

### Implementation for User Story 1

- [x] T012 [US1] Add time_from and time_to ISO 8601 query parameter parsing to the search handler in `backend/internal/api/handlers/search.go`. Pass parsed time.Time values to both Bleve (DateRangeQuery on timestamp field) and ClickHouse SearchEntries (which already has TimeFrom/TimeTo in SearchQuery struct).
- [x] T013 [US1] Create TimeRangePicker component in `frontend/src/components/explorer/time-range-picker.tsx` using shadcn/ui Popover+Button. Includes preset relative ranges (Last 15 min, 1h, 6h, 24h, 7d, All time) and a "Custom range" option with date/time inputs. Date picker min/max should be bounded by the job's log_start/log_end timestamps (passed as props). Emits {type: 'relative'|'absolute', value?: string, start?: Date, end?: Date}.
- [x] T014 [US1] Update the `useSearch` hook in `frontend/src/hooks/use-search.ts` to accept timeFrom/timeTo parameters and include them as `time_from`/`time_to` query params in the API request.
- [x] T015 [US1] Integrate TimeRangePicker into the explorer page in `frontend/src/app/(dashboard)/analysis/[id]/explorer/page.tsx` (or equivalent). Place it next to the search bar. Wire time range state to useSearch. Compute relative time ranges based on the job's log data time span (not current wall clock time). Show the job's data time span in the empty state.
- [x] T016 [US1] Handle empty time range results: when search returns 0 results with a time range active, show "No results in selected time range" message with the actual data time span (query job metadata for log_start/log_end from analysis_jobs table).

**Checkpoint**: Job-scoped search with time range filtering works end-to-end. This is the MVP.

---

## Phase 4: User Story 2 — Log Timeline Histogram (Priority: P1)

**Goal**: A visual timeline histogram above search results shows log volume over time, color-coded by log type, with click-to-zoom.

**Independent Test**: Open explorer for a job, verify stacked bar chart appears showing log distribution. Click-drag to zoom into a spike.

### Implementation for User Story 2

- [x] T017 [US2] Implement GetHistogramData method on ClickHouseClient in `backend/internal/storage/clickhouse.go`. Query log_entries_aggregates materialized view with dynamic bucket sizing per data-model.md (1min for <=1h, 5min for <=6h, 15min for <=24h, 1h for <=7d, 6h for >7d). Return []HistogramBucket{Timestamp, Counts{API, SQL, FLTR, ESCL, Total}}.
- [x] T018 [US2] Add histogram support to the search handler in `backend/internal/api/handlers/search.go`: parse `include_histogram=true` query param. When true, call GetHistogramData with the same tenant_id, job_id, time_from, time_to and include the histogram array in the SearchResponse.
- [x] T019 [US2] Create TimelineHistogram component in `frontend/src/components/explorer/timeline-histogram.tsx` using Recharts StackedBarChart. Props: data (HistogramBucket[]), onRangeSelect(start: Date, end: Date). Color-code: API=blue (#3b82f6), SQL=green (#22c55e), FLTR=orange (#f97316), ESCL=purple (#a855f7). Fixed height ~120px.
- [x] T020 [US2] Implement click-and-drag range selection on the TimelineHistogram using Recharts ReferenceArea. On mouse down, record start X; on drag, show shaded selection area; on mouse up, compute time range from selected bars and call onRangeSelect callback.
- [x] T021 [US2] Update useSearch hook in `frontend/src/hooks/use-search.ts` to pass `include_histogram=true` and return histogram data in the results. Add histogram field to SearchResponse type.
- [x] T022 [US2] Integrate TimelineHistogram into the explorer page in `frontend/src/app/(dashboard)/analysis/[id]/explorer/page.tsx`. Place above the results table. Wire onRangeSelect to update the TimeRangePicker and trigger re-search. Clamp brush-selected timestamps to the job's actual data time span (log_start/log_end from job metadata) to prevent out-of-bounds queries. When no search has been performed, show histogram for all entries in the job (default search with `*` or empty query).

**Checkpoint**: Timeline histogram renders with color-coded bars, click-drag selects time range.

---

## Phase 5: User Story 3 — Search Autocomplete (Priority: P1)

**Goal**: Field name and value autocomplete suggestions appear as the user types in the search bar.

**Independent Test**: Type "ty" — see "type" suggestion. Select it, type "A" — see "API" suggestion with count.

### Implementation for User Story 3

- [x] T023 [US3] Implement GetAutocompleteValues method on ClickHouseClient in `backend/internal/storage/clickhouse.go`. Execute `SELECT {field} AS value, count() AS count FROM log_entries WHERE tenant_id=? AND job_id=? AND {field} LIKE ? AND {field}!='' GROUP BY value ORDER BY count DESC LIMIT 10`. Validate field name against KnownFields whitelist (log_type, user, queue, thread_id, trace_id, rpc_id, api_code, form, operation, request_id, sql_table, filter_name, esc_name, esc_pool, duration_ms, success, error_encountered) to prevent SQL injection.
- [x] T024 [US3] Create AutocompleteHandler in `backend/internal/api/handlers/autocomplete.go`. Parse `prefix` and `job_id` query params. Field name suggestions are job-independent (static KnownFields list); value suggestions require job_id for scoped data. If prefix has no colon: return static field name suggestions from KQL KnownFields (filter by prefix match), each with description text. KnownFields list: log_type, user, queue, thread_id, trace_id, rpc_id, api_code, form, operation, request_id, sql_table, filter_name, esc_name, esc_pool, duration_ms, success, error_encountered. If prefix has colon (e.g., "type:A"): split on first colon, validate field name against KnownFields whitelist, call GetAutocompleteValues for value suggestions. Cache results in Redis with 30s TTL using key `cache:{tenant_id}:autocomplete:{job_id}:{field}:{prefix}`.
- [x] T025 [US3] Register AutocompleteHandler in router config in `backend/cmd/api/main.go` and wire it to `GET /api/v1/search/autocomplete` in `backend/internal/api/router.go`.
- [x] T026 [US3] Add autocomplete dropdown to SearchBar component in `frontend/src/components/explorer/search-bar.tsx`. Detect cursor position in query text. Debounce (150ms) and call `/api/v1/search/autocomplete?prefix={textBeforeCursor}&job_id={jobId}`. Show dropdown below input with field name suggestions (icon + name + description) or value suggestions (value + count badge). Arrow keys navigate, Enter selects, Escape dismisses. When selecting a field, auto-append ":". When selecting a value, insert at cursor and close dropdown.

**Checkpoint**: Autocomplete works for both field names and values with keyboard and mouse interaction.

---

## Phase 6: User Story 4 — Entry Detail Fetch and Related Entries (Priority: P1)

**Goal**: Clicking a log entry fetches full details via dedicated endpoint. Trace/RPC IDs are clickable to find related entries.

**Independent Test**: Click entry in results, detail panel loads full data. Click trace_id link, results filter to related entries.

### Implementation for User Story 4

- [x] T027 [US4] Create EntryHandler in `backend/internal/api/handlers/entry.go`. Implement `GET /analysis/{job_id}/entries/{entry_id}` handler that calls the existing ClickHouseClient.GetLogEntry(ctx, tenantID, jobID, entryID) and returns the full LogEntry as JSON. Return 404 if not found.
- [x] T028 [US4] Register EntryHandler as GetLogEntryHandler in RouterConfig in `backend/cmd/api/main.go` so the `/api/v1/analysis/{job_id}/entries/{entry_id}` route returns real data instead of 501.
- [x] T029 [US4] Update DetailPanel component in `frontend/src/components/explorer/detail-panel.tsx`: on mount/entry change, fetch full entry from `GET /api/v1/analysis/{jobId}/entries/{entryId}` instead of using search hit data. Show loading spinner while fetching. Display all fields from the full LogEntry response.
- [x] T030 [US4] Make trace_id and rpc_id clickable in DetailPanel in `frontend/src/components/explorer/detail-panel.tsx`. When clicked, update the search query to `trace_id:{value}` or `rpc_id:{value}` respectively. Show a "Related entries" badge with count. Clicking navigates the search and shows results in chronological order.

**Checkpoint**: Detail panel fetches full entry data. Trace/RPC ID links navigate to related entries.

---

## Phase 7: User Story 5 — Context View and Dashboard Links (Priority: P2)

**Goal**: "Show Context" displays surrounding log entries. Dashboard top-N tables link to explorer.

**Independent Test**: Click "Show Context" in detail panel, see 10 lines before/after. Click "View in Explorer" in dashboard top-N table.

### Implementation for User Story 5

- [x] T031 [US5] Implement GetEntryContext method on ClickHouseClient in `backend/internal/storage/clickhouse.go`. First fetch the target entry to get its line_number, then query `SELECT * FROM log_entries WHERE tenant_id=? AND job_id=? AND line_number BETWEEN ? AND ? ORDER BY line_number ASC`. Split results into before/target/after arrays for the ContextResponse.
- [x] T032 [US5] Create context endpoint handler in `backend/internal/api/handlers/entry.go` (add ServeHTTPContext method or separate handler). Implement `GET /analysis/{job_id}/entries/{entry_id}/context?window=10`. Parse window param (default 10, max 50). Return ContextResponse{target, before, after, window_size}.
- [x] T033 [US5] Register context handler in router: add route for `/api/v1/analysis/{job_id}/entries/{entry_id}/context` in `backend/internal/api/router.go` and wire in `backend/cmd/api/main.go`.
- [x] T034 [US5] Create ContextView component in `frontend/src/components/explorer/context-view.tsx`. Renders a list of surrounding log entries with the target entry highlighted (distinct background color). Includes a window size selector (5, 10, 25). Fetches from the context endpoint on mount and when window size changes.
- [x] T035 [US5] Add "Show Context" button to DetailPanel in `frontend/src/components/explorer/detail-panel.tsx`. When clicked, opens the ContextView component (inline or as a modal/drawer). Pass job_id and entry_id.
- [x] T036 [US5] Add "View in Explorer" links to dashboard top-N tables. Modify the top-N table component(s) in `frontend/src/components/dashboard/` (find the component rendering top API/SQL/Filter/Escalation tables). Each row gets a link icon that navigates to `/analysis/{jobId}/explorer?line={lineNumber}`. The explorer page reads the `line` query param and auto-searches for `line_number:{value}`, opening the detail panel for that entry.

**Checkpoint**: Context view works. Dashboard links navigate to explorer with entry pre-selected.

---

## Phase 8: User Story 6 — Column Sorting and Syntax Highlighting (Priority: P2)

**Goal**: Clickable column headers sort results. KQL syntax is color-coded in the search bar.

**Independent Test**: Click Duration header — results sort by duration. Type KQL — see colored tokens.

### Implementation for User Story 6

- [x] T037 [US6] Add sort/order state to useSearch hook in `frontend/src/hooks/use-search.ts`. Add `sortBy` and `sortOrder` params to the API request URL. Expose `setSort(field, order)` function from the hook.
- [x] T038 [US6] Update LogTable component in `frontend/src/components/explorer/log-table.tsx` to add sortable column headers for timestamp, duration, type, user. Each header shows a sort indicator (arrow up/down/neutral). Clicking a header calls setSort from the hook, toggling between desc→asc→default. Re-renders with new data from the server-side sort.
- [x] T039 [P] [US6] Create KQL tokenizer in `frontend/src/lib/kql-tokenizer.ts`. Port the tokenizer logic from Go's `backend/internal/search/kql.go` to TypeScript. Produce an array of {text, type} tokens where type is: 'field', 'operator', 'value-string', 'value-number', 'keyword' (AND/OR/NOT), 'error', 'plain'. Handle colons, quoted strings, comparison operators, wildcards, and parentheses.
- [x] T040 [US6] Add syntax highlighting overlay to SearchBar in `frontend/src/components/explorer/search-bar.tsx`. Render the KQL tokenizer output as a styled overlay on top of the input field (transparent input with a positioned div behind/in front showing colored spans). Colors: fields=blue (#3b82f6), operators=orange (#f97316), string values=green (#22c55e), numbers=purple (#a855f7), keywords (AND/OR/NOT)=bold orange, errors=red underline with tooltip.

**Checkpoint**: Column sorting triggers server-side re-query. Syntax highlighting colors KQL tokens in real-time.

---

## Phase 9: User Story 7 — Saved Searches, Query History, and Export (Priority: P3)

**Goal**: Save/load named searches, view query history, export results to CSV/JSON.

**Independent Test**: Save a search, reload page, restore it. Export results as CSV.

### Implementation for User Story 7

- [x] T041 [P] [US7] Implement saved search CRUD methods on PostgresClient in `backend/internal/storage/postgres.go`: CreateSavedSearch(ctx, tenantID, userID, name, kqlQuery, filters, timeRange), ListSavedSearches(ctx, tenantID, userID), DeleteSavedSearch(ctx, tenantID, userID, searchID). Use the existing saved_searches table with the new time_range JSONB column.
- [x] T042 [P] [US7] Implement search history methods on PostgresClient in `backend/internal/storage/postgres.go`: RecordSearchHistory(ctx, tenantID, userID, jobID, kqlQuery, resultCount) — insert row and delete oldest if count > 20 per user. GetSearchHistory(ctx, tenantID, userID, limit) — return recent searches.
- [x] T043 [US7] Create SavedSearchHandler in `backend/internal/api/handlers/saved_search.go`. Implement GET /search/saved (list), POST /search/saved (create), DELETE /search/saved/{search_id} (delete). Extract user_id from auth context.
- [x] T044 [US7] Create SearchHistoryHandler in `backend/internal/api/handlers/search_history.go`. Implement GET /search/history?limit=20. Also update the search handler in `backend/internal/api/handlers/search.go` to call RecordSearchHistory after each successful search using a fire-and-forget goroutine (`go store.RecordSearchHistory(...)`) so history recording does not add latency to search responses.
- [x] T045 [US7] Register SavedSearchHandler and SearchHistoryHandler routes in `backend/internal/api/router.go` and wire in `backend/cmd/api/main.go`. Routes: GET/POST /search/saved, DELETE /search/saved/{search_id}, GET /search/history.
- [x] T046 [P] [US7] Create ExportHandler in `backend/internal/api/handlers/export.go`. Implement `GET /analysis/{job_id}/search/export?q=...&format=csv|json&time_from=...&time_to=...&limit=10000`. Uses streaming HTTP response (not background job) — the browser shows its native download progress bar. For CSV: set Content-Type text/csv and Content-Disposition attachment, write header row then stream rows using ClickHouse SearchEntries. For JSON: set Content-Type application/json and Content-Disposition attachment, stream JSON array. Cap at 10,000 rows.
- [x] T047 [US7] Register ExportHandler route at `/api/v1/analysis/{job_id}/search/export` in `backend/internal/api/router.go` and wire in `backend/cmd/api/main.go`.
- [x] T048 [US7] Create SavedSearches panel component in `frontend/src/components/explorer/saved-searches.tsx`. Shows list of saved searches with name, query preview, and delete button. "Save current search" form with name input. Fetches from GET /search/saved. On click, restores query+filters+timeRange to the search state.
- [x] T049 [US7] Add query history dropdown to SearchBar in `frontend/src/components/explorer/search-bar.tsx`. Clock icon button opens dropdown showing last 20 searches (fetched from GET /search/history). Each entry shows query text and timestamp. Clicking re-runs the search.
- [x] T050 [US7] Create ExportButton component in `frontend/src/components/explorer/export-button.tsx`. Dropdown with "Export CSV" and "Export JSON" options. On click, triggers a download by navigating to the export endpoint URL with current query params. Shows progress indicator for large exports.
- [x] T051 [US7] Integrate SavedSearches panel, query history, and ExportButton into the explorer page in `frontend/src/app/(dashboard)/analysis/[id]/explorer/page.tsx`. SavedSearches panel accessible via a toolbar button. ExportButton in the results header area.

**Checkpoint**: Saved searches persist and restore. History dropdown shows recent queries. CSV/JSON export downloads.

---

## Phase 10: User Story 8 — Keyboard Navigation (Priority: P3)

**Goal**: Full keyboard navigation for power users.

**Independent Test**: Press "/" to focus search, arrows to navigate rows, Enter to open detail, Escape to close.

### Implementation for User Story 8

- [x] T052 [US8] Add global keyboard event listener to the explorer page in `frontend/src/app/(dashboard)/analysis/[id]/explorer/page.tsx`. Handle: "/" or Ctrl+K → focus search bar (prevent default), Escape → close detail panel if open.
- [x] T053 [US8] Add keyboard row navigation to LogTable in `frontend/src/components/explorer/log-table.tsx`. Track focusedIndex state. Arrow up/down moves focus (scroll into view if needed with react-window's scrollToItem). Enter on focused row selects it (triggers onSelect callback to open detail panel). Apply visual focus ring to the focused row.
- [x] T054 [US8] Ensure focus management: when detail panel closes via Escape, return focus to the last-focused row in LogTable. When search bar is focused and user presses down arrow, move focus to the first result row.

**Checkpoint**: Full keyboard-only workflow works: focus search → type → arrow navigate → Enter to open detail → Escape to close.

---

## Phase 11: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [x] T055 Handle responsive layout edge cases in `frontend/src/app/(dashboard)/analysis/[id]/explorer/page.tsx`: at <768px breakpoint, collapse filter panel to a toggle button, hide the timeline histogram, and render the detail panel as a full-screen overlay (using shadcn/ui Sheet or Dialog). Use Tailwind responsive prefixes (md:) for breakpoint handling.
- [x] T056 Add loading and error states across all new components: skeleton loaders for histogram and autocomplete, error boundaries for failed API calls, empty state illustrations.
- [x] T057 Add Redis caching for search results in the search handler `backend/internal/api/handlers/search.go` using key `cache:{tenant_id}:search:{query_hash}` with 2-minute TTL per the existing Redis key schema.
- [x] T058 Run full quickstart.md validation: verify all verification checklist items pass end-to-end per `specs/007-complete-log-explorer/quickstart.md`.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 completion — BLOCKS all user stories
- **User Stories (Phase 3-10)**: All depend on Phase 2 completion
  - US1 (P1), US2 (P1), US3 (P1), US4 (P1) can proceed in parallel after Phase 2
  - US5 (P2) depends on US4 (needs detail panel entry fetch)
  - US6 (P2) can proceed independently after Phase 2
  - US7 (P3) can proceed independently after Phase 2
  - US8 (P3) depends on US1 (needs search + results working)
- **Polish (Phase 11)**: Depends on all desired user stories being complete

### User Story Dependencies

- **US1 (P1)**: Phase 2 only — no other story dependencies
- **US2 (P1)**: Phase 2 only — independent (uses histogram endpoint)
- **US3 (P1)**: Phase 2 only — independent (uses autocomplete endpoint)
- **US4 (P1)**: Phase 2 only — independent (uses entry/trace endpoints)
- **US5 (P2)**: Depends on US4 (extends detail panel with context button)
- **US6 (P2)**: Phase 2 only — independent (sort + highlighting are additive)
- **US7 (P3)**: Phase 2 only — independent (saved searches + export are additive)
- **US8 (P3)**: Depends on US1 (keyboard nav requires working search + results)

### Within Each User Story

- Backend storage/query methods first
- Backend handlers second
- Router wiring third
- Frontend components and hooks last
- Integration into explorer page as final step

### Parallel Opportunities

- Phase 1: T003, T004, T005 can run in parallel (different files); T006a depends on T006 (mocks)
- Phase 2: T007-T011 are sequential (refactoring the same search flow)
- After Phase 2: US1, US2, US3, US4, US6, US7 can all start in parallel
- Within US7: T041, T042, T046 can run in parallel (different files)
- Within US6: T039 (tokenizer) can run parallel with T037-T038 (sort)

---

## Parallel Example: After Phase 2 Completion

```bash
# Launch P1 stories in parallel:
# Developer A: US1 (T012-T016) — Job-scoped time range
# Developer B: US2 (T017-T022) — Timeline histogram
# Developer C: US3 (T023-T026) — Autocomplete
# Developer D: US4 (T027-T030) — Entry detail + related entries

# Or sequentially (solo developer):
# US1 → US2 → US3 → US4 → US5 → US6 → US7 → US8
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T006)
2. Complete Phase 2: Foundational (T007-T011) — job-scoped search working
3. Complete Phase 3: User Story 1 (T012-T016) — time range filtering
4. **STOP and VALIDATE**: Search is job-scoped with time range. This is functional MVP.
5. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → Search works job-scoped
2. Add US1 (time range) → Deploy — **MVP!**
3. Add US2 (histogram) + US3 (autocomplete) + US4 (entry detail) → Deploy — **Full P1**
4. Add US5 (context + dashboard links) + US6 (sort + highlighting) → Deploy — **Full P2**
5. Add US7 (saved/export) + US8 (keyboard) → Deploy — **Full P3**
6. Polish → Final deployment

### Parallel Team Strategy

With 4 developers after Phase 2:
- Developer A: US1 → US5 (time range, then context/links)
- Developer B: US2 → US6 (histogram, then sort/highlighting)
- Developer C: US3 → US7 (autocomplete, then saved/export)
- Developer D: US4 → US8 (entry detail, then keyboard nav)

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks
- [Story] label maps task to specific user story for traceability
- Existing backend methods (GetLogEntry, GetTraceEntries, SearchEntries) are reused — no duplication
- KQL parser is NOT modified — only wired to job-scoped endpoint
- All ClickHouse queries use tenant_id scoping (multi-tenant by default)
- Redis caching follows existing key schema patterns
- Frontend extends existing components rather than replacing them

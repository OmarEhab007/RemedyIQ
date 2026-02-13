# Tasks: Comprehensive Test Coverage

**Input**: Design documents from `/specs/005-test-coverage/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the testutil package directory, install frontend test dependencies, and configure tooling.

- [X] T001 Create backend test utilities package directory at `backend/internal/testutil/`
- [X] T002 Install frontend test dependencies (vitest, @testing-library/react, @testing-library/jest-dom, @testing-library/user-event, @vitest/coverage-v8, jsdom, @vitejs/plugin-react) in `frontend/package.json`
- [X] T003 [P] Create Vitest configuration with tiered coverage thresholds in `frontend/vitest.config.ts` — configure jsdom environment, v8 coverage provider, per-glob thresholds (90% for components/hooks/lib, 80% for app), and path aliases per `specs/005-test-coverage/contracts/vitest-config.md`
- [X] T004 [P] Create global test setup with browser API mocks (IntersectionObserver, ResizeObserver, matchMedia) in `frontend/src/test-setup.ts`
- [X] T005 [P] Create Recharts mock module that renders div containers exposing data props in `frontend/src/__mocks__/recharts.tsx`
- [X] T006 [P] Create react-window mock module that renders all items without virtualization in `frontend/src/__mocks__/react-window.tsx`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Extract interfaces from concrete types, create mock implementations, fixture loaders, test helpers, and refactor handler constructors to accept interfaces. ALL user story work depends on this phase.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### Interface Extraction

- [X] T007 [P] Extract storage interfaces (PostgresStore, ClickHouseStore, RedisCache, S3Storage) from concrete client types into `backend/internal/storage/interfaces.go` — interfaces must match method signatures in data-model.md exactly; existing concrete types must implicitly satisfy the interfaces
- [X] T008 [P] Extract AI client interface (AIQuerier) from concrete Client type into `backend/internal/ai/interfaces.go` — Query() and IsAvailable() methods per data-model.md
- [X] T009 [P] Extract NATS streaming interface (NATSStreamer) from concrete NATSClient type into `backend/internal/streaming/interfaces.go` — EnsureStreams(), SubscribeJobSubmit(), PublishJobProgress(), Close() methods per data-model.md
- [X] T010 [P] Extract search indexer interface (SearchIndexer) from BleveManager into `backend/internal/search/interfaces.go` — Index(), Search(), Delete(), Close() methods

### Mock Implementations

- [X] T011 Create testify/mock implementations for all 6 interfaces (MockPostgresStore, MockClickHouseStore, MockRedisCache, MockS3Storage, MockAIClient, MockNATSStreamer) in `backend/internal/testutil/mocks.go` — each mock must embed mock.Mock and implement every interface method with mock.Called() delegation

### Test Fixtures & Helpers

- [X] T012 [P] Create test fixture loader in `backend/internal/testutil/fixtures.go` — LoadFixture(name string) helper that resolves paths relative to repo root for both `error_logs/` and `backend/testdata/` directories, with clear error messages for missing fixtures; also include MustLoadFixture(t, name) variant that calls t.Fatal on error
- [X] T013 [P] Create HTTP test helpers in `backend/internal/testutil/helpers.go` — NewTestRequest(method, path, body) for creating httptest requests, NewAuthenticatedRequest(method, path, body, tenantID, userID) for injecting tenant/user context, AssertJSONResponse(t, recorder, expectedStatus, target) for validating responses, plus common test tenant/user UUID constants

### Handler Refactoring

- [X] T014 Refactor all handler constructors in `backend/internal/api/handlers/*.go` to accept interfaces instead of concrete storage types — update NewDashboardHandler, NewAnalysisHandler, NewUploadHandler, NewAIHandler, NewSearchHandler, NewAggregatesHandler, NewExceptionsHandler, NewFiltersHandler, NewGapsHandler, NewThreadsHandler, NewTraceHandler, NewReportHandler to accept PostgresStore/ClickHouseStore/RedisCache/S3Storage/AIQuerier interfaces; verify application still compiles with concrete types passed in `cmd/api/main.go`

### Makefile Updates

- [X] T015 Update `Makefile` with new test targets: `test` (unit only, no build tags), `test-integration` (go test -tags=integration), `test-all` (unit + integration), `test-frontend` (cd frontend && npx vitest run --coverage), `test-full` (test + test-frontend), `test-coverage-detail` (per-package breakdown) per `specs/005-test-coverage/contracts/makefile-targets.md`

**Checkpoint**: Foundation ready — all interfaces extracted, mocks created, helpers available. User story implementation can now begin in parallel.

---

## Phase 3: User Story 1 — Backend Core Business Logic Tests (Priority: P1) 🎯 MVP

**Goal**: Rewrite all handler, storage, and parser tests with unified patterns. Achieve 90%+ coverage on handlers and storage packages.

**Independent Test**: Run `make test` and verify handler/storage/parser packages show 90%+ coverage.

### Handler Tests (14 files — critical, target 90%)

- [X] T016 [P] [US1] Rewrite health handler tests in `backend/internal/api/handlers/health_test.go` — table-driven tests for all-healthy, partial-degraded, all-unhealthy, individual service failures (postgres, clickhouse, nats, redis), and timeout scenarios using mock ping functions
- [X] T017 [P] [US1] Create dashboard handler tests in `backend/internal/api/handlers/dashboard_test.go` — test GET /api/v1/analysis/{job_id}/dashboard with: valid job (cache miss → ClickHouse query → cache set), cache hit, missing tenant context (401), job not found (404), invalid job ID (400), ClickHouse error (500), health score computation using MockPostgresStore, MockClickHouseStore, MockRedisCache
- [X] T018 [P] [US1] Create WebSocket stream handler tests in `backend/internal/api/handlers/stream_test.go` — test GET /api/v1/ws WebSocket upgrade with: successful connection, missing tenant context, failed upgrade, client registration/deregistration using httptest.Server with gorilla/websocket client per research.md R-007
- [X] T019 [P] [US1] Rewrite analysis handler tests in `backend/internal/api/handlers/analysis_test.go` — test POST create analysis (valid, invalid JSON, missing tenant, invalid flags), GET list analyses (empty, populated, tenant isolation), GET single analysis (found, not found, wrong tenant) with MockPostgresStore
- [X] T020 [P] [US1] Rewrite upload handler tests in `backend/internal/api/handlers/upload_test.go` — test POST file upload (valid file, empty file, oversized file, invalid content type, S3 upload failure, missing tenant) with MockS3Storage and MockPostgresStore
- [X] T021 [P] [US1] Rewrite AI handler tests in `backend/internal/api/handlers/ai_test.go` — test POST AI query (valid query with skill selection, invalid skill, AI service unavailable, token tracking, streaming response) with MockAIClient and MockPostgresStore
- [X] T022 [P] [US1] Rewrite aggregates handler tests in `backend/internal/api/handlers/aggregates_test.go` — test GET performance aggregates (valid response, empty data, tenant validation, query parameter parsing) with MockClickHouseStore
- [X] T023 [P] [US1] Rewrite exceptions handler tests in `backend/internal/api/handlers/exceptions_test.go` — test GET exceptions (valid response with stack traces, empty exceptions, filtering by severity, pagination) with MockClickHouseStore
- [X] T024 [P] [US1] Rewrite filters handler tests in `backend/internal/api/handlers/filters_test.go` — test GET filter analysis (valid response, no filters found, filter duration sorting, tenant isolation) with MockClickHouseStore
- [X] T025 [P] [US1] Rewrite gaps handler tests in `backend/internal/api/handlers/gaps_test.go` — test GET line gaps (valid response with gap durations, no gaps detected, threshold filtering, tenant validation) with MockClickHouseStore
- [X] T026 [P] [US1] Rewrite threads handler tests in `backend/internal/api/handlers/threads_test.go` — test GET thread stats (valid response with thread distribution, empty threads, sorting by count, tenant isolation) with MockClickHouseStore
- [X] T027 [P] [US1] Rewrite search handler tests in `backend/internal/api/handlers/search_test.go` — test GET search (valid query with results, empty results, pagination, KQL syntax, invalid query, missing tenant) with MockClickHouseStore
- [X] T028 [P] [US1] Rewrite trace handler tests in `backend/internal/api/handlers/trace_test.go` — test GET trace (valid trace with spans, trace not found, tenant validation) with MockClickHouseStore
- [X] T029 [P] [US1] Rewrite report handler tests in `backend/internal/api/handlers/report_test.go` — test POST generate report (valid report generation, invalid parameters, report not ready, tenant validation) with MockPostgresStore and MockClickHouseStore

### Storage Unit Tests (4 files — critical, target 90%)

- [X] T030 [P] [US1] Rewrite PostgreSQL unit tests in `backend/internal/storage/postgres_unit_test.go` — test input validation for all CRUD methods (nil context, empty tenant ID, invalid UUID, SQL injection prevention via UUID format validation), test SetTenantContext behavior, test Close() idempotency; no build tag (unit test)
- [X] T031 [P] [US1] Create ClickHouse unit tests in `backend/internal/storage/clickhouse_unit_test.go` — test SearchQuery validation (empty query, invalid pagination, missing tenant), test BatchInsertEntries with empty slice, test GetDashboardData parameter validation, test ComputeHealthScore boundary values; no build tag
- [X] T032 [P] [US1] Create Redis unit tests in `backend/internal/storage/redis_unit_test.go` — test TenantKey generation (various tenant/category/id combinations), test CheckRateLimit parameter validation (zero limit, negative window), test Get/Set/Delete with nil context; no build tag
- [X] T033 [P] [US1] Create S3 unit tests in `backend/internal/storage/s3_unit_test.go` — test Upload parameter validation (empty key, nil reader, negative size), test Download with empty key; no build tag

### JAR Parser Tests (4 files — target 80%)

- [X] T034 [P] [US1] Rewrite parser tests using real log fixtures in `backend/internal/jar/parser_test.go` — table-driven tests for ParseOutput() with real data from `error_logs/arerror.log`, `error_logs/arexception.log`, `backend/testdata/arapi_sample.log`, `backend/testdata/arsql_sample.log`, `backend/testdata/arfilter_sample.log`, `backend/testdata/aresc_sample.log`, `backend/testdata/combined_sample.log`; test splitKeyValue(), section detection, GeneralStats extraction, TopN parsing, ThreadDistribution parsing, ErrorDistribution parsing; minimum 10 test cases using real fixture data per FR-003/SC-009
- [X] T035 [P] [US1] Rewrite JAR runner tests in `backend/internal/jar/runner_test.go` — test Run() with: valid JAR path, missing JAR file, JAR execution timeout, invalid heap size, output capture, process cleanup on context cancellation
- [X] T036 [P] [US1] Rewrite fidelity tests in `backend/internal/jar/fidelity_test.go` — test native parser output matches JAR output for each log type (API, SQL, Filter, Escalation) using real fixtures from `backend/testdata/`
- [X] T037 [P] [US1] Create config tests in `backend/internal/jar/config_test.go` — test JAR config loading (default values, custom heap size, custom timeout, invalid config)

### API Utility Tests (2 files — critical, target 90%)

- [X] T038 [P] [US1] Create response helper tests in `backend/internal/api/response_test.go` — test JSON response formatting (success response, error response, validation error response, nil data handling, HTTP status code mapping)
- [X] T039 [P] [US1] Create router tests in `backend/internal/api/router_test.go` — test route registration (all endpoints registered, correct HTTP methods, middleware chain order, 404 for unregistered routes)

**Checkpoint**: Backend core business logic fully tested. Run `go test -v -race -cover ./backend/internal/api/handlers/... ./backend/internal/storage/... ./backend/internal/jar/... ./backend/internal/api/` and verify 90%+ on handlers/storage, 80%+ on jar.

---

## Phase 4: User Story 2 — Backend Middleware & Infrastructure Tests (Priority: P2)

**Goal**: Complete middleware coverage and infrastructure client unit tests. Achieve 90%+ on middleware package.

**Independent Test**: Run `go test -v -cover ./backend/internal/api/middleware/...` and verify 90%+ coverage.

### Middleware Tests (7 files — critical, target 90%)

- [X] T040 [P] [US2] Rewrite auth middleware tests in `backend/internal/api/middleware/auth_test.go` — table-driven tests for: valid JWT token, expired token, malformed token, missing Authorization header, invalid signing method, dev mode bypass (X-Dev-User-ID/X-Dev-Tenant-ID headers), dev mode disabled in production, clock skew tolerance, context propagation (UserIDKey, TenantIDKey, OrgIDKey)
- [X] T041 [P] [US2] Rewrite tenant middleware tests in `backend/internal/api/middleware/tenant_test.go` — test: tenant context present (pass through), missing tenant context (401), empty tenant ID, middleware ordering (must follow auth)
- [X] T042 [P] [US2] Create CORS middleware tests in `backend/internal/api/middleware/cors_test.go` — test: preflight OPTIONS request (correct headers), allowed origins, disallowed origins, allowed methods, allowed headers
- [X] T043 [P] [US2] Create logging middleware tests in `backend/internal/api/middleware/logging_test.go` — test: request logging (method, path, status code captured), response time measurement, log output format, context propagation
- [X] T044 [P] [US2] Create recovery middleware tests in `backend/internal/api/middleware/recovery_test.go` — test: handler panics with string, handler panics with error, handler panics with nil, normal request (no panic), response status 500 on panic, structured error response body
- [X] T045 [P] [US2] Create body limit middleware tests in `backend/internal/api/middleware/bodylimit_test.go` — test: request within limit (pass through), request exceeding limit (413), exact boundary size, GET request (no body check), empty body
- [X] T046 [P] [US2] Create error response middleware tests in `backend/internal/api/middleware/errors_test.go` — test: standard error formatting, validation error formatting, not found error, internal server error, error code mapping

### Search Tests (2 files — target 80%)

- [X] T047 [P] [US2] Rewrite Bleve search tests in `backend/internal/search/bleve_test.go` — test: index creation, document indexing, simple text search, search with pagination, search with no results, index close and reopen, concurrent indexing, delete from index
- [X] T048 [P] [US2] Rewrite KQL parser tests in `backend/internal/search/kql_test.go` — table-driven tests for KQL syntax: simple term, quoted phrase, field:value, AND/OR operators, NOT operator, parenthesized groups, wildcard, invalid syntax, empty query, complex nested expressions

### Streaming Unit Tests (2 files — target 80%)

- [X] T049 [P] [US2] Create NATS unit tests in `backend/internal/streaming/nats_unit_test.go` — test: EnsureStreams with mock connection, PublishJobProgress message serialization, SubscribeJobSubmit callback invocation, Close() idempotency, error handling for publish failures; no build tag
- [X] T050 [P] [US2] Create WebSocket hub tests in `backend/internal/streaming/websocket_test.go` — test: client registration, client deregistration, broadcast to multiple clients, message routing, hub shutdown, client cleanup on disconnect

### Config Tests (1 file — target 80%)

- [X] T051 [P] [US2] Create config tests in `backend/internal/config/config_test.go` — test: loading from environment variables (all fields), missing required env vars, default values for optional fields, validation of connection strings, test with t.Setenv() for isolation

**Checkpoint**: All middleware and infrastructure tests pass. Run `go test -v -cover ./backend/internal/api/middleware/...` for 90%+, `./backend/internal/search/... ./backend/internal/streaming/... ./backend/internal/config/...` for 80%+.

---

## Phase 5: User Story 3 — Backend AI & Worker Tests (Priority: P3)

**Goal**: Test all AI skills with mocked client and worker pipeline. Achieve 80%+ on ai and worker packages.

**Independent Test**: Run `go test -v -cover ./backend/internal/ai/... ./backend/internal/worker/...` and verify 80%+ coverage.

### AI Client & Registry Tests (2 files)

- [X] T052 [P] [US3] Rewrite AI client tests in `backend/internal/ai/client_test.go` — test: Query() with mocked HTTP responses (success, timeout, rate limit 429, server error 500, malformed JSON response), IsAvailable() check, token counting in response, latency tracking, context cancellation
- [X] T053 [P] [US3] Rewrite AI registry tests in `backend/internal/ai/registry_test.go` — test: Register skill, Get skill by name, Get non-existent skill, List all skills, Duplicate registration handling, Registry initialization

### AI Skill Tests (7 files — test prompt construction and response parsing)

- [X] T054 [P] [US3] Rewrite summarizer skill tests in `backend/internal/ai/skills/summarizer_test.go` — test: Execute() with MockAIClient returning structured summary, prompt contains log data excerpts, response parsing extracts key findings, error handling when AI client fails, input validation (empty log data)
- [X] T055 [P] [US3] Create error explainer skill tests in `backend/internal/ai/skills/error_explainer_test.go` — test: Execute() with real error log excerpts from `error_logs/arexception.log` loaded via testutil.MustLoadFixture(), prompt construction includes stack traces, response parsing extracts root cause and remediation, MockAIClient error scenarios
- [X] T056 [P] [US3] Create anomaly detection skill tests in `backend/internal/ai/skills/anomaly_test.go` — test: Execute() with time-series data, prompt includes baseline metrics, response parsing extracts anomaly descriptions and severity, empty data handling, MockAIClient timeout
- [X] T057 [P] [US3] Create performance analysis skill tests in `backend/internal/ai/skills/performance_test.go` — test: Execute() with performance metrics, prompt includes latency/throughput data, response parsing extracts bottleneck analysis, MockAIClient rate limit error
- [X] T058 [P] [US3] Create NL query skill tests in `backend/internal/ai/skills/nl_query_test.go` — test: Execute() with natural language question, prompt construction with schema context, response parsing extracts structured query, invalid question handling, MockAIClient unavailable
- [X] T059 [P] [US3] Create root cause analysis skill tests in `backend/internal/ai/skills/root_cause_test.go` — test: Execute() with error chain data from `error_logs/arerror.log` via fixtures, prompt includes timeline of events, response parsing extracts causal chain, MockAIClient malformed response
- [X] T060 [P] [US3] Create skill helpers tests in `backend/internal/ai/skills/helpers_test.go` — test: utility functions used across skills (log excerpt formatting, token estimation, response validation)

### Worker Tests (4 files — target 80%)

- [X] T061 [P] [US3] Create processor tests in `backend/internal/worker/processor_test.go` — test: Start() subscribes to NATS job queue via MockNATSStreamer, job processing updates status via MockPostgresStore (queued→parsing→analyzing→storing→complete), job failure updates status to failed with error message, context cancellation triggers graceful shutdown, timeout enforcement
- [X] T062 [P] [US3] Rewrite ingestion tests in `backend/internal/worker/ingestion_test.go` — test: Ingest() downloads file from MockS3Storage, parses via JAR runner (mock subprocess), stores entries via MockClickHouseStore BatchInsertEntries, updates job progress via MockPostgresStore, error handling at each pipeline stage
- [X] T063 [P] [US3] Create indexer tests in `backend/internal/worker/indexer_test.go` — test: IndexEntries() with nil BleveManager (no-op), IndexEntries() with mock search indexer, batch indexing with multiple entries, error handling during indexing, empty entries slice
- [X] T064 [P] [US3] Rewrite worker anomaly tests in `backend/internal/worker/anomaly_test.go` — test: DetectAnomalies() with normal data (no anomalies), data with clear outliers, empty data, threshold configuration

**Checkpoint**: AI skills and worker pipeline fully tested. Run `go test -v -cover ./backend/internal/ai/... ./backend/internal/worker/...` and verify 80%+.

---

## Phase 6: User Story 5 — Frontend Hooks & Utility Tests (Priority: P5)

**Goal**: Test all custom hooks and utility libraries. Achieve 90%+ on hooks and lib directories.

**Independent Test**: Run `cd frontend && npx vitest run src/hooks/ src/lib/` and verify all tests pass.

> **Note**: US5 is implemented before US4 because hooks/utilities are foundational to component tests.

### Lib/Utility Tests (3 files — critical, target 90%)

- [X] T065 [P] [US5] Create API client tests in `frontend/src/lib/api.test.ts` — test each API method with mocked fetch: successful responses (parse JSON, correct headers with auth token), error responses (401, 404, 500 with error messages), network timeout, request body serialization for POST methods, getApiHeaders() includes correct auth headers
- [X] T066 [P] [US5] Create utils tests in `frontend/src/lib/utils.test.ts` — test all utility functions: cn() classname merging, date formatting, number formatting, any other exported helpers
- [X] T067 [P] [US5] Create WebSocket client tests in `frontend/src/lib/websocket.test.ts` — test with mocked global WebSocket class: connection establishment, message receipt and parsing, disconnection handling, reconnection attempts, send message, connection state tracking, error events

### Hook Tests (4 files — critical, target 90%)

- [X] T068 [P] [US5] Create useAI hook tests in `frontend/src/hooks/use-ai.test.ts` — test with renderHook(): initial state (empty messages, no loading), fetchSkills() populates skills list, sendMessage() adds user message and AI response, loading state during API call, error state on API failure, clearMessages() resets state, cleanup on unmount
- [X] T069 [P] [US5] Create useAnalysis hook tests in `frontend/src/hooks/use-analysis.test.ts` — test with renderHook(): initial loading state, successful data fetch, error handling, refetch trigger, data transformation
- [X] T070 [P] [US5] Create useSearch hook tests in `frontend/src/hooks/use-search.test.ts` — test with renderHook(): initial state, executeSearch() with mocked fetch (results returned, empty results, error), search() debouncing behavior, setPage() pagination, filter changes trigger new search, URL parameter sync
- [X] T071 [P] [US5] Create useLazySection hook tests in `frontend/src/hooks/use-lazy-section.test.ts` — test with renderHook(): initial invisible state, IntersectionObserver callback triggers visible state, ref attachment, cleanup on unmount (observer disconnect)

**Checkpoint**: All hooks and utilities tested. Run `cd frontend && npx vitest run src/hooks/ src/lib/ --coverage` and verify 90%+.

---

## Phase 7: User Story 4 — Frontend Component Tests (Priority: P4)

**Goal**: Test all React components. Achieve 90%+ on components directory.

**Independent Test**: Run `cd frontend && npx vitest run src/components/` and verify all tests pass.

### Dashboard Component Tests (12 files — critical, target 90%)

- [ ] T072 [P] [US4] Create stats-cards tests in `frontend/src/components/dashboard/stats-cards.test.tsx` — test: renders with mock GeneralStats data (API/SQL/Filter/Escalation counts displayed), renders loading state, renders with zero values, renders with null/undefined data gracefully
- [ ] T073 [P] [US4] Create time-series-chart tests in `frontend/src/components/dashboard/time-series-chart.test.tsx` — test: renders with mock TimeSeriesPoint[] data, passes correct data props to mocked Recharts components, renders empty state when no data, renders with single data point
- [ ] T074 [P] [US4] Create distribution-chart tests in `frontend/src/components/dashboard/distribution-chart.test.tsx` — test: renders with mock distribution data, passes correct data to mocked Recharts, renders empty state, renders with single category
- [ ] T075 [P] [US4] Create aggregates-section tests in `frontend/src/components/dashboard/aggregates-section.test.tsx` — test: renders with mock AggregateSection[] data (groups displayed with metrics), renders loading/empty states, renders error state, API call triggered on mount
- [ ] T076 [P] [US4] Create anomaly-alerts tests in `frontend/src/components/dashboard/anomaly-alerts.test.tsx` — test: renders with mock anomaly data (alerts displayed with severity), renders no-anomalies state, renders with multiple severity levels
- [ ] T077 [P] [US4] Create exceptions-section tests in `frontend/src/components/dashboard/exceptions-section.test.tsx` — test: renders with mock exception data (exception list, stack traces), renders empty state, pagination controls
- [ ] T078 [P] [US4] Create filters-section tests in `frontend/src/components/dashboard/filters-section.test.tsx` — test: renders with mock filter data (filter names, execution counts, durations), renders empty state, sorting behavior
- [ ] T079 [P] [US4] Create gaps-section tests in `frontend/src/components/dashboard/gaps-section.test.tsx` — test: renders with mock gap data (line numbers, gap durations), renders empty state, threshold highlighting
- [ ] T080 [P] [US4] Create health-score-card tests in `frontend/src/components/dashboard/health-score-card.test.tsx` — test: renders with mock HealthScore data (score value, color coding), renders loading state, renders with edge scores (0, 100)
- [ ] T081 [P] [US4] Create threads-section tests in `frontend/src/components/dashboard/threads-section.test.tsx` — test: renders with mock thread stats (thread names, counts), renders empty state, sorting
- [ ] T082 [P] [US4] Create top-n-table tests in `frontend/src/components/dashboard/top-n-table.test.tsx` — test: renders with mock TopNEntry[] data (ranked rows), renders empty table, renders with pagination, column sorting
- [ ] T083 [P] [US4] Create report-button tests in `frontend/src/components/dashboard/report-button.test.tsx` — test: renders button, click triggers report generation callback, loading state during generation, error state on failure, disabled state when no data

### Explorer Component Tests (4 files — critical, target 90%)

- [ ] T084 [P] [US4] Create log-table tests in `frontend/src/components/explorer/log-table.test.tsx` — test: renders with mock log entries via mocked react-window FixedSizeList, row renderer displays correct fields (timestamp, level, message), empty table state, row click triggers detail callback, column header rendering
- [ ] T085 [P] [US4] Create search-bar tests in `frontend/src/components/explorer/search-bar.test.tsx` — test with userEvent: typing in search field updates value, submit triggers onSearch callback with query, clear button resets field, enter key submits
- [ ] T086 [P] [US4] Create filter-panel tests in `frontend/src/components/explorer/filter-panel.test.tsx` — test with userEvent: log level filter selection, date range selection, thread filter, apply filters triggers callback with filter values, reset filters
- [ ] T087 [P] [US4] Create detail-panel tests in `frontend/src/components/explorer/detail-panel.test.tsx` — test: renders with mock log entry (all fields displayed), renders closed state, close button triggers callback, renders with minimal data

### Other Component Tests (5 files)

- [ ] T088 [P] [US4] Create trace timeline tests in `frontend/src/components/trace/timeline.test.tsx` — test: renders with mock trace spans, renders empty trace, span click triggers detail callback, timeline visualization renders span durations
- [ ] T089 [P] [US4] Create chat-panel tests in `frontend/src/components/ai/chat-panel.test.tsx` — test with userEvent: renders empty chat, typing message and submitting, message list displays user and AI messages, loading indicator during AI response, error message display
- [ ] T090 [P] [US4] Create skill-selector tests in `frontend/src/components/ai/skill-selector.test.tsx` — test with userEvent: renders skill options, selecting a skill triggers callback, selected skill highlighted, renders loading state while fetching skills
- [ ] T091 [P] [US4] Create dropzone tests in `frontend/src/components/upload/dropzone.test.tsx` — test with userEvent: renders drop area, file input change triggers onUpload callback, validates accepted file types, displays selected file name, multiple file selection
- [ ] T092 [P] [US4] Create progress-tracker tests in `frontend/src/components/upload/progress-tracker.test.tsx` — test: renders with 0% progress, renders with 50% progress (bar width), renders complete state (100%), renders error state, renders with file name

### Page Tests (7 files — target 80%)

- [ ] T093 [P] [US4] Create landing page test in `frontend/src/app/page.test.tsx` — test: renders without errors, displays key landing page elements
- [ ] T094 [P] [US4] Create dashboard page test in `frontend/src/app/(dashboard)/page.test.tsx` — test: renders with mocked API responses (dashboard sections load), renders loading state, renders error state
- [ ] T095 [P] [US4] Create upload page test in `frontend/src/app/(dashboard)/upload/page.test.tsx` — test: renders dropzone and progress tracker components, upload flow integration
- [ ] T096 [P] [US4] Create explorer page test in `frontend/src/app/(dashboard)/explorer/page.test.tsx` — test: renders search bar, filter panel, and log table, search triggers data fetch
- [ ] T097 [P] [US4] Create trace page test in `frontend/src/app/(dashboard)/trace/page.test.tsx` — test: renders timeline component, trace data loading
- [ ] T098 [P] [US4] Create analysis page test in `frontend/src/app/(dashboard)/analysis/page.test.tsx` — test: renders analysis list, analysis detail navigation
- [ ] T099 [P] [US4] Create AI page test in `frontend/src/app/(dashboard)/ai/page.test.tsx` — test: renders chat panel and skill selector, sends message flow

**Checkpoint**: All frontend components tested. Run `cd frontend && npx vitest run --coverage` and verify 90%+ on components/hooks/lib, 80%+ on app.

---

## Phase 8: User Story 6 — Integration Tests (Priority: P6)

**Goal**: Docker-based integration tests for all external services, tagged with `//go:build integration`.

**Independent Test**: Run `make docker-up && make test-integration` and verify all integration tests pass.

### Storage Integration Tests (5 files)

- [ ] T100 [P] [US6] Rewrite PostgreSQL integration tests in `backend/internal/storage/postgres_test.go` — `//go:build integration` tag; setupPostgres(t) helper with t.Cleanup(); test: CreateTenant + GetTenant roundtrip, CreateLogFile + ListLogFiles, CreateJob + UpdateJobStatus lifecycle, SetTenantContext + RLS enforcement (tenant A cannot read tenant B data), CreateAIInteraction + UpdateAIInteraction, SavedSearch CRUD, soft delete behavior
- [ ] T101 [P] [US6] Rewrite ClickHouse integration tests in `backend/internal/storage/clickhouse_test.go` — `//go:build integration` tag; setupClickHouse(t) helper; test: BatchInsertEntries + Search roundtrip, GetDashboardData with real aggregation, ComputeHealthScore with varying data quality, Search with pagination, empty result handling, materialized view validation
- [ ] T102 [P] [US6] Create Redis integration tests in `backend/internal/storage/redis_test.go` — `//go:build integration` tag; setupRedis(t) helper; test: Set + Get roundtrip, TTL expiration (with small TTL + sleep), Delete, TenantKey scoping, CheckRateLimit (within limit, exceeding limit, window expiration)
- [ ] T103 [P] [US6] Rewrite S3/MinIO integration tests in `backend/internal/storage/s3_test.go` — `//go:build integration` tag; setupS3(t) helper; test: Upload + Download roundtrip, upload large file, download non-existent key (error), upload to different buckets
- [ ] T104 [P] [US6] Rewrite NATS integration tests in `backend/internal/streaming/nats_test.go` — `//go:build integration` tag; setupNATS(t) helper; test: EnsureStreams creates JOBS and EVENTS streams, PublishJobProgress + SubscribeJobSubmit roundtrip, message acknowledgement, tenant-scoped subjects, connection recovery after brief disconnect

**Checkpoint**: All integration tests pass against Docker services. Run `make docker-up && make check-services && make test-integration`.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Verify coverage thresholds, ensure determinism, clean up.

- [ ] T105 Run backend unit test suite 3 consecutive times and verify zero flaky failures — `for i in 1 2 3; do go test -v -race -count=1 ./backend/...; done`
- [ ] T106 Run frontend test suite 3 consecutive times and verify zero flaky failures — `for i in 1 2 3; do cd frontend && npx vitest run; done`
- [ ] T107 Generate per-package backend coverage report and verify tiered thresholds — run `go test -coverprofile=coverage.out ./backend/...` then `go tool cover -func=coverage.out`; verify handlers/storage/middleware >= 90%, all others >= 80%, aggregate >= 85%
- [ ] T108 Generate frontend coverage report and verify tiered thresholds — run `cd frontend && npx vitest run --coverage`; verify components/hooks/lib >= 90%, app >= 80%, aggregate >= 85%
- [ ] T109 Fix any packages below coverage thresholds by adding additional test cases for uncovered branches
- [ ] T110 Clean up unused mock methods, remove dead test helper code, ensure all test files follow unified conventions (table-driven, require/assert, consistent naming)
- [ ] T111 Run quickstart.md validation — verify all commands in `specs/005-test-coverage/quickstart.md` work correctly (make test, make test-integration, make test-frontend, make test-full)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup (T001, T002) — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Foundational (Phase 2) — can run in parallel with US2-US6
- **US2 (Phase 4)**: Depends on Foundational (Phase 2) — can run in parallel with US1, US3-US6
- **US3 (Phase 5)**: Depends on Foundational (Phase 2) — can run in parallel with US1-US2, US4-US6
- **US5 (Phase 6)**: Depends on Setup (T002-T006 only) — can run in parallel with US1-US3, US6
- **US4 (Phase 7)**: Depends on Setup (T002-T006) — can run in parallel with US1-US3, US5-US6; benefits from US5 completing first
- **US6 (Phase 8)**: Depends on Foundational (T007-T009 interfaces) — can run in parallel with US1-US5
- **Polish (Phase 9)**: Depends on ALL user stories completing

### User Story Dependencies

- **US1 (P1)**: Needs interfaces + mocks + helpers → independent of other stories
- **US2 (P2)**: Needs interfaces + mocks + helpers → independent of other stories
- **US3 (P3)**: Needs interfaces + mocks + fixtures → independent of other stories
- **US5 (P5)**: Needs Vitest config + global mocks only → independent of backend stories
- **US4 (P4)**: Needs Vitest config + global mocks → benefits from US5 hooks being tested first
- **US6 (P6)**: Needs interfaces only → independent, but requires Docker services running

### Within Each User Story

Tasks marked [P] within the same story can run in parallel (different files, no dependencies).

### Parallel Opportunities

**Backend (US1 + US2 + US3)**: All 3 backend user stories can run simultaneously since they test different packages.

**Frontend (US5 → US4)**: US5 (hooks/lib) should ideally complete before US4 (components) but can technically run in parallel.

**Cross-stack**: All backend stories (US1-US3) can run in parallel with all frontend stories (US4-US5) and integration tests (US6).

---

## Parallel Example: User Story 1

```bash
# Launch all handler tests in parallel (14 files, different handlers):
Task: T016 "Rewrite health_test.go"
Task: T017 "Create dashboard_test.go"
Task: T018 "Create stream_test.go"
Task: T019 "Rewrite analysis_test.go"
Task: T020 "Rewrite upload_test.go"
Task: T021 "Rewrite ai_test.go"
Task: T022 "Rewrite aggregates_test.go"
# ... (all 14 handler tasks)

# Launch all storage unit tests in parallel:
Task: T030 "Rewrite postgres_unit_test.go"
Task: T031 "Create clickhouse_unit_test.go"
Task: T032 "Create redis_unit_test.go"
Task: T033 "Create s3_unit_test.go"

# Launch all parser tests in parallel:
Task: T034 "Rewrite parser_test.go"
Task: T035 "Rewrite runner_test.go"
Task: T036 "Rewrite fidelity_test.go"
Task: T037 "Create config_test.go"
```

## Parallel Example: Frontend Stories

```bash
# Launch US5 hooks/lib tests in parallel:
Task: T065 "Create api.test.ts"
Task: T066 "Create utils.test.ts"
Task: T067 "Create websocket.test.ts"
Task: T068 "Create use-ai.test.ts"
Task: T069 "Create use-analysis.test.ts"
Task: T070 "Create use-search.test.ts"
Task: T071 "Create use-lazy-section.test.ts"

# Launch US4 dashboard component tests in parallel:
Task: T072 "Create stats-cards.test.tsx"
Task: T073 "Create time-series-chart.test.tsx"
# ... (all 12 dashboard tasks)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: User Story 1 (backend core tests)
4. **STOP and VALIDATE**: Run `make test` and check handler/storage/parser coverage
5. Delivers: Core backend business logic fully tested with 90%+ coverage on critical packages

### Incremental Delivery

1. Setup + Foundational → Infrastructure ready
2. Add US1 → Backend core tested → Validate (MVP!)
3. Add US2 → Middleware/infra tested → Validate
4. Add US3 → AI/worker tested → Validate backend complete
5. Add US5 → Frontend utilities tested → Validate
6. Add US4 → Frontend components tested → Validate frontend complete
7. Add US6 → Integration tests → Validate end-to-end
8. Polish → Coverage verified, flakiness checked → **DONE**

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: US1 (backend handlers/storage/parser)
   - Developer B: US2 + US3 (backend middleware/AI/worker)
   - Developer C: US5 + US4 (frontend hooks/components)
   - Developer D: US6 (integration tests)
3. All converge on Phase 9 (Polish)

---

## Notes

- [P] tasks = different files, no dependencies — safe to run in parallel
- [Story] label maps task to specific user story for traceability
- All backend tests use testify (require/assert) with table-driven patterns
- All frontend tests use Vitest + React Testing Library with userEvent
- Real log fixtures from `error_logs/` used in minimum 10 test cases (FR-003, SC-009)
- Integration tests require `make docker-up` before execution
- Coverage enforcement: 90% critical, 80% other, 85% aggregate

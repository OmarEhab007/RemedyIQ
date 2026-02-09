# Tasks: AR Server Log Analysis Platform MVP

**Input**: Design documents from `/specs/remedyiq-mvp/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

**Tests**: Test tasks are included per Constitution Article III (Test-First Development).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization, dependency setup, and infrastructure configuration

- [ ] T001 [P] Initialize Go module with dependencies in `backend/go.mod` — gorilla/mux, clickhouse-go/v2, pgx/v5, bleve/v2, nats.go, testify, anthropic-sdk-go, google/uuid, godotenv
- [ ] T002 [P] Initialize Next.js 14 project in `frontend/` with TypeScript, Tailwind CSS, shadcn/ui, Recharts, react-window, @clerk/nextjs
- [ ] T003 [P] Create `docker-compose.yml` at project root with PostgreSQL 16, ClickHouse, NATS (JetStream enabled), Redis 7, MinIO — all with health checks and named volumes
- [ ] T004 [P] Create top-level `Makefile` with targets: dev, api, worker, test, lint, build, migrate-up, ch-init, docker, clean
- [ ] T005 [P] Create `.env.example` with all environment variables documented
- [ ] T006 [P] Create `backend/Dockerfile` (multi-stage Go build) and `frontend/Dockerfile` (Next.js standalone)
- [ ] T007 Create `backend/internal/config/config.go` — environment-based configuration struct with validation for all services (DB URLs, NATS, Redis, S3, JAR path, Clerk keys, Anthropic key)
- [ ] T008 Create PostgreSQL migration `backend/migrations/001_initial.up.sql` with schemas from `data-model.md`: tenants, log_files, analysis_jobs, ai_interactions, saved_searches — all with RLS policies. Create corresponding `001_initial.down.sql`
- [ ] T009 Create ClickHouse initialization script `backend/migrations/clickhouse/001_init.sql` with log_entries table, materialized views from `data-model.md`
- [ ] T010 Create `backend/internal/domain/models.go` — core domain types: Tenant, LogFile, AnalysisJob, LogEntry, AIInteraction, SearchQuery matching data-model.md schemas
- [ ] T011 Copy AR Server sample log files into `backend/testdata/` — arapi_sample.log, arsql_sample.log, arfilter_sample.log, aresc_sample.log, combined_sample.log (create minimal but valid samples)

**Checkpoint**: Project structure ready, infrastructure running via `docker compose up`, databases initialized

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**CRITICAL**: No user story work can begin until this phase is complete

### Tests for Foundational Phase

- [ ] T012 [P] Write integration test for JAR runner in `backend/internal/jar/runner_test.go` — test subprocess execution, output capture, timeout handling, error detection using testdata samples
- [ ] T013 [P] Write integration test for ClickHouse storage in `backend/internal/storage/clickhouse_test.go` — test insert, query, tenant isolation using testcontainers or Docker
- [ ] T014 [P] Write integration test for PostgreSQL storage in `backend/internal/storage/postgres_test.go` — test CRUD for analysis_jobs and log_files with RLS enforcement
- [ ] T015 [P] Write integration test for S3 storage in `backend/internal/storage/s3_test.go` — test upload, download, delete with MinIO
- [ ] T016 [P] Write integration test for NATS messaging in `backend/internal/streaming/nats_test.go` — test publish/subscribe with tenant-scoped subjects

### Implementation for Foundational Phase

- [ ] T017 Implement JAR subprocess runner in `backend/internal/jar/runner.go` — build command with all CLI flags, capture stdout/stderr via pipes, stream output lines to parser, enforce timeout, manage JVM heap based on file size heuristic (depends: T012)
- [ ] T018 Implement JAR output text parser in `backend/internal/jar/parser.go` — parse ARLogAnalyzer plain text output into structured domain types (GeneralStatistics, TopN lists, GroupBy aggregates, ThreadStats, Exceptions) (depends: T017)
- [ ] T019 Implement JAR CLI flag builder in `backend/internal/jar/config.go` — construct command-line arguments from AnalysisJobCreate request, map all supported flags (-n, -g, -u, -b, -e, -s, -l, -ldf, -noapi, -nosql, -noesc, -nofltr, -fts)
- [ ] T020 [P] Implement ClickHouse client in `backend/internal/storage/clickhouse.go` — connection pool, batch insert for log entries, dashboard queries (top-N, aggregates, time-series), tenant-scoped queries (depends: T013)
- [ ] T021 [P] Implement PostgreSQL client in `backend/internal/storage/postgres.go` — connection pool with pgx, CRUD for all metadata tables, RLS tenant context setting, migration runner (depends: T014)
- [ ] T022 [P] Implement S3 client in `backend/internal/storage/s3.go` — multipart upload, download, delete, tenant-prefixed path generation (depends: T015)
- [ ] T023 [P] Implement Redis client in `backend/internal/storage/redis.go` — cache get/set with TTL, tenant-prefixed keys, rate limiter
- [ ] T024 [P] Implement NATS JetStream client in `backend/internal/streaming/nats.go` — publisher and subscriber for job progress, live tail, and AI events with tenant-scoped subjects (depends: T016)
- [ ] T025 Implement API router and middleware in `backend/internal/api/router.go` and `backend/internal/api/middleware/` — Clerk JWT validation (`auth.go`), tenant context extraction (`tenant.go`), CORS (`cors.go`), request logging, error handling middleware
- [ ] T026 Implement health check endpoint in `backend/internal/api/handlers/health.go` — check connectivity to PostgreSQL, ClickHouse, NATS, Redis; return service version
- [ ] T027 Implement API server entrypoint in `backend/cmd/api/main.go` — load config, initialize all clients, setup router, start HTTP server with graceful shutdown
- [ ] T028 Implement Worker entrypoint in `backend/cmd/worker/main.go` — load config, initialize clients, subscribe to job queue, start processing loop with graceful shutdown

**Checkpoint**: Foundation ready — all infrastructure clients tested and working, API server starts and responds to health checks, Worker starts and listens for jobs

---

## Phase 3: User Story 1 — Upload & Dashboard (Priority: P1) MVP

**Goal**: AR Admins can upload log files, run analysis via JAR, and view results in a modern dashboard

**Independent Test**: Upload arapi_sample.log via API, wait for analysis, verify dashboard data matches JAR text output

### Tests for User Story 1

- [ ] T029 [P] [US1] Write contract test for file upload in `backend/internal/api/handlers/upload_test.go` — test multipart upload, size validation (2GB limit), file type detection
- [ ] T030 [P] [US1] Write contract test for analysis endpoints in `backend/internal/api/handlers/analysis_test.go` — test job creation, status polling, dashboard data retrieval
- [ ] T031 [P] [US1] Write integration test for ingestion pipeline in `backend/internal/worker/ingestion_test.go` — test full flow: file download → JAR execution → output parsing → ClickHouse storage
- [ ] T032 [P] [US1] Write fidelity test in `backend/internal/jar/fidelity_test.go` — run JAR on sample logs, parse output, compare with expected structured data (Constitution VII)

### Implementation for User Story 1

- [ ] T033 [US1] Implement file upload handler in `backend/internal/api/handlers/upload.go` — multipart file handling, size limit enforcement, S3 upload, log_files metadata insert, return LogFile response (depends: T029)
- [ ] T034 [US1] Implement analysis job handlers in `backend/internal/api/handlers/analysis.go` — POST /analysis (create job, publish to NATS), GET /analysis (list jobs), GET /analysis/:id (job details) (depends: T030)
- [ ] T035 [US1] Implement ingestion pipeline in `backend/internal/worker/ingestion.go` — subscribe to job queue, download file from S3, run JAR, parse output, store entries in ClickHouse, update job status (depends: T031)
- [ ] T036 [US1] Implement analysis job processor in `backend/internal/worker/analysis.go` — orchestrate the ingestion pipeline with progress updates via NATS, error handling, retry logic
- [ ] T037 [US1] Implement dashboard data handler in `backend/internal/api/handlers/dashboard.go` — query ClickHouse for general stats, top-N API/SQL/Filter/Escalation, time-series, distribution; cache in Redis (depends: T030)
- [ ] T038 [US1] Implement WebSocket handler for job progress in `backend/internal/api/handlers/stream.go` — upgrade HTTP to WebSocket, authenticate, handle subscribe/unsubscribe for job progress updates
- [ ] T039 [P] [US1] Build Next.js root layout in `frontend/src/app/layout.tsx` with Clerk provider, and dashboard layout in `frontend/src/app/(dashboard)/layout.tsx` with sidebar navigation
- [ ] T040 [P] [US1] Build file upload page in `frontend/src/app/(dashboard)/upload/page.tsx` with drag-and-drop dropzone component (`frontend/src/components/upload/dropzone.tsx`) and progress tracker (`frontend/src/components/upload/progress-tracker.tsx`)
- [ ] T041 [P] [US1] Build API client library in `frontend/src/lib/api.ts` — typed fetch wrapper for all REST endpoints, and WebSocket client in `frontend/src/lib/websocket.ts`
- [ ] T042 [US1] Build dashboard page in `frontend/src/app/(dashboard)/analysis/[id]/page.tsx` with components: stats-cards.tsx, top-n-table.tsx, time-series-chart.tsx, distribution-chart.tsx (depends: T041)
- [ ] T043 [US1] Build hooks: `frontend/src/hooks/use-analysis.ts` (job polling/WebSocket progress) and connect to upload flow → analysis → dashboard navigation

**Checkpoint**: User can upload a log file, see analysis progress in real-time, and view a complete dashboard with stats, charts, and top-N tables. All dashboard data matches JAR output.

---

## Phase 4: User Story 2 — Log Explorer & Search (Priority: P1)

**Goal**: AR Admins can search and explore individual log entries with KQL-style filtering

**Independent Test**: After analysis, search for `type:API AND duration:>1000`, verify results are accurate and return in <2s

### Tests for User Story 2

- [ ] T044 [P] [US2] Write unit test for KQL parser in `backend/internal/search/kql_test.go` — test parsing of field:value, AND/OR/NOT, range queries, wildcards, quoted strings
- [ ] T045 [P] [US2] Write contract test for search endpoint in `backend/internal/api/handlers/search_test.go` — test KQL query execution, pagination, sorting, facets
- [ ] T046 [P] [US2] Write integration test for Bleve indexing in `backend/internal/search/bleve_test.go` — test index creation, document insertion, query execution, faceted results

### Implementation for User Story 2

- [ ] T047 [US2] Implement KQL query parser in `backend/internal/search/kql.go` — parse KQL syntax into Bleve/ClickHouse query structures, support: field:value, AND, OR, NOT, range (duration:>1000), wildcard (form:HPD*), quoted strings, time ranges (depends: T044)
- [ ] T048 [US2] Implement Bleve search index in `backend/internal/search/bleve.go` — index creation, document mapping for LogEntry fields, batch indexing during ingestion, tenant-scoped indexes (depends: T046)
- [ ] T049 [US2] Add search indexing step to ingestion pipeline in `backend/internal/worker/indexer.go` — after ClickHouse storage, index entries in Bleve for full-text search (depends: T048)
- [ ] T050 [US2] Implement search handler in `backend/internal/api/handlers/search.go` — parse KQL via parser, execute against Bleve+ClickHouse, return paginated results with facets, log entry detail by ID, autocomplete endpoint (depends: T045)
- [ ] T051 [P] [US2] Build Log Explorer page in `frontend/src/app/(dashboard)/explorer/page.tsx` with virtual-scrolled log table (`frontend/src/components/explorer/log-table.tsx`) using react-window
- [ ] T052 [P] [US2] Build search bar component in `frontend/src/components/explorer/search-bar.tsx` with KQL syntax highlighting and autocomplete dropdown
- [ ] T053 [US2] Build filter panel in `frontend/src/components/explorer/filter-panel.tsx` — checkboxes for log types, time range picker, user dropdown, queue dropdown
- [ ] T054 [US2] Build log detail panel in `frontend/src/components/explorer/detail-panel.tsx` — slide-out panel showing full log entry, parsed fields, raw text, related entries by trace ID
- [ ] T055 [US2] Build search hook in `frontend/src/hooks/use-search.ts` — debounced search with URL state sync, pagination, and result caching

**Checkpoint**: User can search logs with KQL syntax, see autocomplete suggestions, browse results in a virtual-scrolled table, and view detailed log entries. Search returns in <2 seconds.

---

## Phase 5: User Story 3 — AI-Powered Log Q&A (Priority: P2)

**Goal**: AR Admins can ask natural language questions about their logs and get evidence-backed answers

**Independent Test**: Ask "What were the slowest API calls?" and verify response cites specific log lines with correct data

### Tests for User Story 3

- [ ] T056 [P] [US3] Write unit test for AI skill registry in `backend/internal/ai/registry_test.go` — test skill registration, lookup, input validation, fallback behavior
- [ ] T057 [P] [US3] Write contract test for AI endpoint in `backend/internal/api/handlers/ai_test.go` — test query submission, response format, rate limiting, service unavailable fallback
- [ ] T058 [P] [US3] Write integration test for Claude API client in `backend/internal/ai/client_test.go` — test message creation, tool use flow, error handling (use mock server for CI)

### Implementation for User Story 3

- [ ] T059 [US3] Implement Claude API client in `backend/internal/ai/client.go` — message creation with system prompts, tool definitions for log search and data retrieval, streaming responses, rate limit handling, timeout management (depends: T058)
- [ ] T060 [US3] Implement AI skill registry in `backend/internal/ai/registry.go` — register skills with name, description, input/output schemas, prompt templates, evaluation examples, fallback behavior (depends: T056)
- [ ] T061 [US3] Implement NL Query skill in `backend/internal/ai/skills/nl_query.go` — convert natural language to KQL, execute search, format results with log line references, generate follow-up questions
- [ ] T062 [US3] Implement Error Explainer skill in `backend/internal/ai/skills/error_explainer.go` — analyze error log entries, explain error codes, suggest remediation steps with BMC Remedy context
- [ ] T063 [US3] Implement AI handler in `backend/internal/api/handlers/ai.go` — POST /analysis/:id/ai endpoint, skill routing, rate limiting per tenant/user, response formatting (depends: T057)
- [ ] T064 [P] [US3] Build AI chat panel in `frontend/src/components/ai/chat-panel.tsx` — message list with user/AI messages, markdown rendering, clickable log line references, typing indicator
- [ ] T065 [P] [US3] Build skill selector in `frontend/src/components/ai/skill-selector.tsx` — dropdown to choose AI skill, shows skill description and example prompts
- [ ] T066 [US3] Build AI page in `frontend/src/app/(dashboard)/ai/page.tsx` — integrate chat panel, skill selector, and connect to analysis context
- [ ] T067 [US3] Build AI hook in `frontend/src/hooks/use-ai.ts` — submit questions, handle streaming responses, manage conversation history

**Checkpoint**: User can ask natural language questions about their logs, receive AI-powered answers with log line references, and switch between AI skills. Fallback works when Claude API is unavailable.

---

## Phase 6: User Story 4 — Transaction Tracer (Priority: P2)

**Goal**: AR Admins can trace a single transaction across all log types using Trace ID

**Independent Test**: Search by known Trace ID and verify timeline shows complete chain across API→Filter→SQL→Escalation

### Tests for User Story 4

- [ ] T068 [P] [US4] Write contract test for trace endpoint in `backend/internal/api/handlers/search_test.go` — test trace lookup by ID, cross-type correlation, timeline ordering

### Implementation for User Story 4

- [ ] T069 [US4] Add trace endpoint to search handler — GET /analysis/:id/trace/:trace_id, query ClickHouse for all entries matching trace_id, order chronologically, calculate total duration and entry count (depends: T068)
- [ ] T070 [P] [US4] Build transaction timeline component in `frontend/src/components/trace/timeline.tsx` — vertical timeline with nested entries (API→Filter→SQL), duration bars, expand/collapse, clickable entries
- [ ] T071 [US4] Build trace page in `frontend/src/app/(dashboard)/trace/page.tsx` — search by Trace ID or RPC ID, display timeline, handle pre-AR 19.x fallback (RPC ID only with warning)

**Checkpoint**: User can trace transactions across all log types with a visual timeline. Works with both Trace ID (AR 19.x+) and RPC ID (older versions).

---

## Phase 7: User Story 5 — Anomaly Detection (Priority: P3)

**Goal**: System automatically detects performance anomalies and generates alerts

### Tests for User Story 5

- [ ] T072 [P] [US5] Write unit test for anomaly detector in `backend/internal/worker/anomaly_test.go` — test baseline calculation, 3-sigma detection, alert generation with known anomalous data

### Implementation for User Story 5

- [ ] T073 [US5] Implement anomaly detector in `backend/internal/worker/anomaly.go` — calculate baselines (avg API duration per form, SQL time per table, error rate per window), detect 3-sigma deviations, generate alerts, correlate related anomalies (depends: T072)
- [ ] T074 [US5] Add anomaly detection to analysis pipeline — run after ingestion completes, store alerts in PostgreSQL anomaly_alerts table
- [ ] T075 [US5] Implement Root Cause Analyzer AI skill in `backend/internal/ai/skills/root_cause.go` — analyze correlated anomalies, explain probable causes, reference specific log entries
- [ ] T076 [US5] Build anomaly alerts UI — alert banner on dashboard, alert detail view with timeline, AI explanation button

**Checkpoint**: System detects performance anomalies post-analysis and displays alerts with optional AI-powered explanations.

---

## Phase 8: User Story 6 — Executive Summary Reports (Priority: P3)

**Goal**: Generate shareable executive summary reports of log analysis

### Tests for User Story 6

- [ ] T077 [P] [US6] Write contract test for report generation endpoint
- [ ] T078 [P] [US6] Write unit test for Summarizer AI skill in `backend/internal/ai/skills/summarizer_test.go`

### Implementation for User Story 6

- [ ] T079 [US6] Implement Summarizer AI skill in `backend/internal/ai/skills/summarizer.go` — generate executive summary with: health score (0-100), top issues, trends, recommendations (depends: T078)
- [ ] T080 [US6] Implement report generation endpoint — POST /analysis/:id/report, invoke Summarizer skill, format as HTML/PDF, store for download (depends: T077)
- [ ] T081 [US6] Build report generation UI — "Generate Report" button on dashboard, download as HTML/PDF, report preview

**Checkpoint**: User can generate and download executive summary reports with AI-powered insights.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Quality improvements that affect multiple user stories

- [ ] T082 [P] Implement Performance Advisor AI skill in `backend/internal/ai/skills/performance.go` — analyze slow operations, suggest tuning
- [ ] T083 [P] Implement Anomaly Narrator AI skill in `backend/internal/ai/skills/anomaly.go` — describe detected anomalies in natural language
- [ ] T084 [P] Add Clerk authentication pages in `frontend/src/app/(auth)/sign-in/` and `frontend/src/app/(auth)/sign-up/`
- [ ] T085 Create `.gitignore` with comprehensive rules for Go, Node.js, IDE files, .env, and testdata/*.log (large files)
- [ ] T086 Add request logging and structured error responses across all API handlers
- [ ] T087 Run `quickstart.md` validation — verify full flow: docker compose up → migrate → upload → analyze → dashboard
- [ ] T088 Security review: verify tenant isolation at every data layer, validate JWT handling, check for injection vulnerabilities

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 (T001, T003, T007-T011 specifically) — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Foundational phase completion
- **US2 (Phase 4)**: Depends on Foundational + benefits from US1 ingestion pipeline but independently testable
- **US3 (Phase 5)**: Depends on Foundational; uses search from US2 for RAG but can work with ClickHouse directly
- **US4 (Phase 6)**: Depends on Foundational; uses search infrastructure
- **US5 (Phase 7)**: Depends on US1 ingestion pipeline
- **US6 (Phase 8)**: Depends on US3 AI infrastructure
- **Polish (Phase 9)**: After all desired user stories complete

### Within Each Phase

- Tests (marked with story tag) MUST be written and FAIL before implementation
- Models before services, services before handlers
- Backend before frontend for each story
- Core implementation before integration

### Parallel Opportunities

- All Phase 1 tasks are [P] — run all in parallel
- All foundational tests (T012-T016) are [P] — run in parallel
- All foundational implementations with [P] (T020-T024) — run in parallel
- Frontend tasks within a story marked [P] — run in parallel
- After Phase 2, US1 and US2 can proceed in parallel (different files)
- US3 can start backend work while US1/US2 frontend is in progress

---

## Implementation Strategy

### MVP First (US1 Only)

1. Complete Phase 1: Setup (all parallel)
2. Complete Phase 2: Foundational (tests first, then implementations)
3. Complete Phase 3: US1 — Upload & Dashboard
4. **STOP and VALIDATE**: Upload sample log, verify dashboard matches JAR output
5. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → Infrastructure ready
2. US1 → Upload & Dashboard (MVP!)
3. US2 → Log Explorer & Search
4. US3 → AI-Powered Q&A
5. US4 → Transaction Tracer
6. US5-6 → Anomaly Detection + Reports
7. Polish → Security, performance, documentation

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- JAR execution requires Java 11+ and sufficient memory — Worker service handles this

# Feature Specification: AR Server Log Analysis Platform MVP

**Feature Branch**: `remedyiq-mvp`
**Created**: 2026-02-09
**Status**: Draft
**Input**: RemedyIQ — Cloud SaaS log analysis platform for BMC Remedy AR Server

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Upload & Dashboard (Priority: P1)

As an AR Admin, I can upload AR Server log files and see analysis results in a modern dashboard with statistics, charts, and top-N tables.

**Why this priority**: This is the core value proposition — replacing the CLI-only ARLogAnalyzer workflow with a visual, web-based experience. Without upload and analysis, no other feature has value.

**Independent Test**: Upload a 100MB arapi.log file, wait for analysis to complete, and verify the dashboard shows general statistics (total lines, API count, SQL count, duration), top-N slowest API calls, and time-series charts. All data MUST match ARLogAnalyzer.jar text output for the same file.

**Acceptance Scenarios**:

1. **Given** an authenticated AR Admin on the upload page, **When** they drag-and-drop a `.log` file up to 2GB, **Then** the file is uploaded with a progress bar showing percentage and estimated time remaining.
2. **Given** a file has been uploaded, **When** the upload completes, **Then** an analysis job is queued and the user sees a real-time progress indicator (parsing → analyzing → storing → complete).
3. **Given** analysis is complete, **When** the user navigates to the dashboard, **Then** they see: general statistics cards (total lines, API/SQL/Filter/Escalation counts, time range, unique users, unique forms), top-N slowest API calls table, top-N slowest SQL statements table, API call distribution pie chart, and a time-series chart of operations over time.
4. **Given** analysis is complete, **When** the user compares dashboard numbers with ARLogAnalyzer.jar text output, **Then** all counts, durations, and rankings match exactly (Log Format Fidelity).
5. **Given** a user uploads an invalid file (not a recognized AR Server log), **When** analysis begins, **Then** the system detects the format mismatch within 30 seconds and displays a clear error message.

---

### User Story 2 - Log Explorer & Search (Priority: P1)

As an AR Admin, I can search and explore individual log entries with filtering by type, user, time, and severity.

**Why this priority**: After seeing high-level statistics, admins need to drill down into specific log entries to diagnose issues. This is the second most-used workflow after dashboard viewing.

**Independent Test**: After analysis of a log file, navigate to the Log Explorer, apply a filter for `type:API AND user:Demo`, and verify results show only API log entries from user "Demo" with correct line numbers and timestamps. Virtual scrolling handles 100K+ results smoothly.

**Acceptance Scenarios**:

1. **Given** an analyzed log file, **When** the user opens the Log Explorer, **Then** they see a paginated/virtually-scrolled list of all log entries with columns: line number, timestamp, type, queue, user, duration, and status.
2. **Given** the Log Explorer is open, **When** the user types `type:SQL AND duration:>1000` in the search bar, **Then** results filter to show only SQL entries taking more than 1 second, within 2 seconds.
3. **Given** the search bar is focused, **When** the user starts typing a field name, **Then** autocomplete suggests valid fields (type, user, queue, form, table, duration, status) and valid values for enum fields.
4. **Given** search results are displayed, **When** the user clicks a log entry row, **Then** a detail panel slides open showing the full log entry with raw text, parsed fields, and links to related entries (same trace ID/RPC ID).
5. **Given** 10 million log entries in ClickHouse, **When** the user performs a search, **Then** results return in under 2 seconds.

---

### User Story 3 - AI-Powered Log Q&A (Priority: P2)

As an AR Admin, I can ask natural language questions about my logs and get AI-powered answers with specific log line references as evidence.

**Why this priority**: AI differentiation is the key competitive advantage over existing tools. However, it requires US1 and US2 infrastructure (parsed data, search) to function, making it P2.

**Independent Test**: After analyzing a log file, open the AI chat panel and ask "What were the slowest API calls yesterday and what might have caused them?" Verify the response cites specific log lines, provides timing data, and offers actionable recommendations.

**Acceptance Scenarios**:

1. **Given** an analyzed log file and the AI panel open, **When** the user asks "Show me all errors in the last hour", **Then** the AI returns a structured response listing errors with timestamps, line numbers, and error messages, citing specific log entries.
2. **Given** a natural language query, **When** the AI processes it, **Then** the response includes: (a) a direct answer, (b) referenced log lines as clickable evidence, (c) confidence level, and (d) suggested follow-up questions.
3. **Given** the Claude API is unavailable, **When** the user asks a question, **Then** the system falls back to keyword search with a message explaining AI is temporarily unavailable.
4. **Given** a multi-tenant environment, **When** user A asks about logs, **Then** the AI only accesses tenant A's data — never cross-tenant leakage.

---

### User Story 4 - Transaction Tracer (Priority: P2)

As an AR Admin, I can trace a single transaction across all log types (API -> Filter -> SQL -> Escalation) to understand the full execution path.

**Why this priority**: Cross-log correlation is a pain point that ARLogAnalyzer's HTML output partially addresses with hyperlinks. A unified trace view is a significant improvement but requires all 4 log types parsed first.

**Independent Test**: Upload logs containing a transaction with a known Trace ID. Navigate to the Transaction Tracer, search by Trace ID, and verify a timeline view shows the complete chain: API call -> Filter executions -> SQL queries -> Escalation (if applicable), with accurate timing and parent-child relationships.

**Acceptance Scenarios**:

1. **Given** logs with Trace IDs (AR 19.x+), **When** the user searches by Trace ID, **Then** a timeline visualization shows all related operations across log types in chronological order.
2. **Given** a transaction trace, **When** the user views it, **Then** each entry shows: operation type, duration, queue, form/table, success/failure, and clickable links to the raw log entry.
3. **Given** a trace with nested operations, **When** rendered, **Then** the visualization shows parent-child relationships (API call containing filter executions containing SQL queries) with indentation/nesting.
4. **Given** logs without Trace IDs (pre-AR 19.x), **When** the user attempts tracing, **Then** the system falls back to RPC ID correlation with a warning about reduced accuracy.

---

### User Story 5 - Anomaly Detection Alerts (Priority: P3)

As an AR Admin, I receive automated anomaly detection alerts when performance degrades beyond normal baselines.

**Why this priority**: Proactive alerting requires historical baseline data and statistical analysis, which builds on all prior functionality. It's high-value but not required for initial usability.

**Independent Test**: Upload a log file with a known performance spike (e.g., average API duration jumps from 200ms to 5000ms). Verify the system detects the anomaly and generates an alert with the time window, affected operations, and magnitude of deviation.

**Acceptance Scenarios**:

1. **Given** a log file has been analyzed, **When** the system processes the data, **Then** it automatically calculates baselines for: average API duration per form, SQL execution time per table, error rate per time window, and queue depth.
2. **Given** established baselines, **When** a metric deviates by more than 3 standard deviations, **Then** an anomaly alert is generated with: metric name, expected range, actual value, time window, and affected operations.
3. **Given** an anomaly is detected, **When** AI analysis is available, **Then** the alert includes an AI-generated explanation of probable causes and recommended actions.
4. **Given** multiple anomalies in the same time window, **When** displayed, **Then** they are correlated and grouped (e.g., "API slowdown likely caused by SQL performance degradation on table X").

---

### User Story 6 - Executive Summary Reports (Priority: P3)

As an AR Admin, I can generate executive summary reports of log analysis suitable for sharing with management.

**Why this priority**: Report generation is a convenience feature that adds polish but is not essential for core diagnostic workflows.

**Independent Test**: After analysis, click "Generate Report" and verify a PDF/HTML report is produced containing: executive summary, key metrics, top issues, trend charts, and recommendations.

**Acceptance Scenarios**:

1. **Given** a completed analysis, **When** the user clicks "Generate Executive Summary", **Then** an AI-powered report is generated containing: time period overview, system health score (0-100), top 5 issues by impact, performance trends, and actionable recommendations.
2. **Given** a generated report, **When** the user downloads it, **Then** it is available as both HTML and PDF with professional formatting, company branding placeholder, and charts.
3. **Given** report generation, **When** multiple analyses exist, **Then** the user can select a time range to produce a comparative report showing trends across multiple analysis sessions.

---

### Edge Cases

- What happens when a log file exceeds 2GB? System MUST reject with a clear size limit message and suggest splitting the file.
- What happens when a log file contains mixed log types (API + SQL + Filter in one file)? ARLogAnalyzer.jar handles this natively; system MUST support combined logs.
- What happens when the JAR subprocess crashes or times out? System MUST detect the failure within the configured timeout, mark the job as failed, and provide the JAR's stderr output for debugging.
- What happens when ClickHouse storage is full? System MUST check available capacity before ingestion and warn users when approaching limits.
- What happens when two users upload the same file simultaneously? System MUST handle deduplication or allow parallel analysis without corruption.
- What happens with non-English locale timestamps in logs? System MUST support the `-l` locale flag passthrough to the JAR and handle locale-specific date parsing in native parsers.
- What happens when WebSocket connection drops during live tail? Client MUST auto-reconnect and resume from the last received position.
- What happens when the Claude API rate limit is hit? System MUST queue AI requests with exponential backoff and inform the user of expected wait time.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST support file upload for `.log` files up to 2GB via multipart upload with resumable upload support for files over 100MB.
- **FR-002**: System MUST support analysis of all 4 AR Server log types: API (arapi.log), SQL (arsql.log), Filter (arfilter.log), and Escalation (aresc.log), including combined log files.
- **FR-003**: System MUST invoke ARLogAnalyzer.jar as a subprocess for primary analysis with configurable JVM heap size, timeout, and all CLI flags (-n, -g, -u, -b, -e, -s, -l, -ldf, -noapi, -nosql, -noesc, -nofltr).
- **FR-004**: System MUST store parsed log entries in ClickHouse with tenant-scoped partitions, supporting at least 100 million entries per tenant with sub-2-second query performance.
- **FR-005**: System MUST provide KQL-style search with field autocomplete, supporting operators: AND, OR, NOT, range queries (duration:>1000), wildcard matching (form:HPD*), and time range filters.
- **FR-006**: System MUST integrate with Claude API for natural language query processing, error explanation, and report generation, with graceful fallback when the API is unavailable.
- **FR-007**: System MUST support WebSocket-based live log tailing with tenant-scoped NATS JetStream subjects, delivering new log entries to connected clients within 500ms of ingestion.
- **FR-008**: System MUST enforce tenant isolation at every data layer: ClickHouse (partition key), PostgreSQL (RLS), NATS (subject prefix), Redis (key prefix), S3 (path prefix).
- **FR-009**: System MUST provide a REST API for all operations with OpenAPI 3.1 documentation, versioned endpoints (v1/), and JSON responses.
- **FR-010**: System MUST track analysis job progress and expose it via API/WebSocket for real-time UI updates (queued → parsing → analyzing → storing → complete/failed).

### Key Entities

- **Tenant**: Organization-level isolation unit. Maps to Clerk organization. Has quota limits for storage, analysis jobs, and AI queries.
- **AnalysisJob**: Represents a single log analysis run. Has status lifecycle (queued → parsing → analyzing → storing → complete/failed), references input file(s), stores JAR configuration flags, and links to output data.
- **LogFile**: Uploaded log file metadata. Stored in S3, references tenant, original filename, size, detected log type(s), upload timestamp.
- **LogEntry**: Individual parsed log entry stored in ClickHouse. Contains: tenant_id, job_id, line_number, file_number, timestamp, type (API/SQL/FLTR/ESCL), trace_id, rpc_id, queue, user, form/table, duration_ms, success, raw_text, and type-specific fields.
- **AISkill**: Registered AI capability with input/output schema, prompt template, evaluation examples, and usage metrics.
- **SearchQuery**: Saved or recent search query with KQL text, filters, and result count.
- **AnomalyAlert**: Detected performance anomaly with metric, baseline, actual value, deviation magnitude, time window, and optional AI explanation.
- **Report**: Generated executive summary with metadata, content sections, charts data, and export format.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Upload-to-dashboard time MUST be under 5 minutes for a 500MB log file on standard infrastructure (4 CPU, 16GB RAM).
- **SC-002**: Search results MUST return in under 2 seconds for 10 million log entries with any combination of filters.
- **SC-003**: AI answers MUST reference specific log lines as clickable evidence, with at least 80% of references being directly relevant to the question.
- **SC-004**: Dashboard page MUST load in under 3 seconds on a standard broadband connection (10 Mbps).
- **SC-005**: Log Format Fidelity — native parser output MUST match ARLogAnalyzer.jar output with zero numerical deviation for all supported log types.
- **SC-006**: System MUST handle 50 concurrent users per tenant without performance degradation beyond 20% of single-user baseline.
- **SC-007**: Live tail latency MUST be under 500ms from log entry ingestion to client-side display.
- **SC-008**: AI skill response time MUST be under 10 seconds for standard queries (non-report generation).

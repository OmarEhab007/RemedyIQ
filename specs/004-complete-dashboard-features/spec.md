# Feature Specification: Complete Dashboard Features

**Feature Branch**: `004-complete-dashboard-features`
**Created**: 2026-02-11
**Status**: Draft
**Input**: User description: "Complete all missing features in ARLogAnalyzer-25 (RemedyIQ): implement 5 stubbed backend API endpoints (aggregates, exceptions, gaps, threads, filters), create corresponding frontend dashboard sections, finalize AI skills for production, and add comprehensive testing."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Performance Aggregates Dashboard (Priority: P1)

As an AR Server administrator, I want to view aggregated performance statistics grouped by form, user, and table directly on the analysis dashboard so that I can immediately identify which forms are slowest, which users generate the most load, and which database tables are bottlenecks - without manually parsing log files.

**Why this priority**: Aggregates are the single most valuable operational view. They transform raw log data into actionable groupings that answer the top diagnostic questions: "Which form is slowest?", "Which user causes the most load?", "Which database table is the bottleneck?" This view replaces hours of manual cross-referencing.

**Independent Test**: Can be fully tested by completing an analysis on any AR Server log file, navigating to the dashboard, scrolling to the Aggregates section, and verifying that tabbed tables show per-form API performance, per-user API performance, and per-table SQL performance with correct totals matching the underlying data.

**Acceptance Scenarios**:

1. **Given** an analysis is complete, **When** the user scrolls to or clicks the "Aggregates" section on the dashboard, **Then** the system fetches and displays aggregate data with tabs for "API by Form", "API by User", and "SQL by Table"
2. **Given** the aggregate tables are loaded, **When** the user clicks any column header, **Then** the table sorts by that column with ascending/descending toggle
3. **Given** an aggregate table, **When** viewing the table, **Then** each group row shows: Name, Count, OK Count, Fail Count, MIN Time, MAX Time, AVG Time, SUM Time, and a grand total row appears at the bottom
4. **Given** the aggregate section is not yet scrolled into view, **When** the dashboard initially loads, **Then** no aggregate data is fetched (lazy loading)
5. **Given** the aggregate data has been fetched, **When** the user navigates away and returns, **Then** the data is served from cache without re-querying

---

### User Story 2 - Exception and Error Reports (Priority: P1)

As an AR Server administrator, I want to see all exceptions and errors (API exceptions, SQL errors, escalation errors) in a dedicated section of the dashboard so that I can quickly understand what went wrong, how often, and where - enabling faster incident response.

**Why this priority**: Error visibility is critical for troubleshooting production issues. Without surfacing exceptions, administrators must search raw logs manually. Grouping errors by code/type with frequency counts and sample details turns the dashboard into a diagnostic tool.

**Independent Test**: Can be fully tested by analyzing a log file that contains errors, navigating to the dashboard, opening the Exceptions section, and verifying that API exceptions, SQL errors, and escalation errors are listed with correct counts, error rates, and sample details.

**Acceptance Scenarios**:

1. **Given** an analysis with errors, **When** the user opens the "Exceptions & Errors" section, **Then** the system displays a list of exceptions grouped by error code with occurrence count, first/last seen times, and log type
2. **Given** the exceptions list, **When** the user clicks on an exception entry, **Then** they see expanded details including sample line number, trace ID, queue, form, and user context
3. **Given** the exceptions section, **When** it loads, **Then** per-log-type error rates are displayed (errors / total operations as a percentage) for API, SQL, Filter, and Escalation
4. **Given** an analysis with zero errors, **When** the user views the Exceptions section, **Then** a positive confirmation message "No errors detected in this analysis" is shown
5. **Given** the exceptions data, **When** the system calculates error rates, **Then** the top error codes are highlighted in a summary bar above the detailed list

---

### User Story 3 - Gap Analysis (Priority: P2)

As an AR Server administrator, I want to see the longest periods of log silence (line gaps and thread gaps) so that I can identify system hangs, GC pauses, deadlocks, or network timeouts that disrupt service but do not appear in individual operation metrics.

**Why this priority**: Gaps reveal system-level issues that aggregate metrics miss entirely. A 30-second gap in log output often indicates a JVM garbage collection pause, database lock, or network partition. This is a P2 because while critical for root cause analysis, the P1 features (aggregates and exceptions) address the most common diagnostic needs first.

**Independent Test**: Can be fully tested by analyzing a log file, opening the Gap Analysis section, and verifying that line gaps and thread gaps are listed with durations, timestamps, and positions, with a visual timeline overlay.

**Acceptance Scenarios**:

1. **Given** an analysis is complete, **When** the user opens the "Gap Analysis" section, **Then** two tabs appear: "Line Gaps" and "Thread Gaps" with the top 50 gaps each
2. **Given** the line gaps tab, **When** viewing the table, **Then** each entry shows: Rank, Gap Duration, Start Time, End Time, Before Line, After Line, and Log Type
3. **Given** the thread gaps tab, **When** viewing the table, **Then** each entry shows the same fields plus Thread ID
4. **Given** no significant gaps detected, **When** the user views gap analysis, **Then** a message confirms "Log shows continuous activity - no significant gaps detected"
5. **Given** gaps longer than 60 seconds exist, **When** displayed, **Then** they are visually highlighted as critical gaps

---

### User Story 4 - Thread Statistics and Queue Health (Priority: P2)

As an AR Server administrator, I want to see per-thread utilization statistics so that I can identify thread saturation, overloaded queues, and capacity issues that cause AR Server slowness.

**Why this priority**: Thread saturation is the number one cause of AR Server performance degradation. Per-thread statistics answer "Is the server overloaded?" and "Which queue is the bottleneck?" directly. P2 because it builds on the P1 aggregate view to provide deeper infrastructure-level diagnosis.

**Independent Test**: Can be fully tested by analyzing a log file, opening the Thread Statistics section, and verifying that per-thread utilization data is displayed with busy percentages, call counts, and queue groupings.

**Acceptance Scenarios**:

1. **Given** an analysis is complete, **When** the user opens the "Thread Statistics" section, **Then** a table displays per-thread stats including Thread ID, Total Calls, Total Time, Average Time, Max Time, Error Count, and Busy Percentage
2. **Given** the thread table, **When** any thread exceeds 90% busy, **Then** that row is highlighted with a warning indicator
3. **Given** the thread stats section, **When** it loads, **Then** it displays the total thread count as a summary metric
4. **Given** an analysis with idle threads (0% busy), **When** viewing thread stats, **Then** idle threads are shown normally without penalty or warning

---

### User Story 5 - Enhanced Top-N Tables with Type-Specific Details (Priority: P2)

As an AR Server administrator, I want the existing top-N tables (API, SQL, Filters, Escalations) to show all relevant fields for each type so that I can understand the full context of each slow operation without needing to cross-reference the original log.

**Why this priority**: The current top-N tables show generic columns. The log data contains rich type-specific information (SQL statements, filter names and nesting levels, escalation pools and delay metrics, queue wait times) that is not surfaced. Showing this data eliminates the need to manually inspect log files for context.

**Independent Test**: Can be fully tested by analyzing a log file and verifying that each top-N tab shows its type-specific columns, rows are expandable for full details, and entries link to the log explorer.

**Acceptance Scenarios**:

1. **Given** the SQL top-N tab, **When** viewing an entry, **Then** it shows: Rank, Duration, Table Name, SQL Operation Type, Queue, Timestamp, Success/Fail status, and an expandable SQL Statement preview
2. **Given** the Filters top-N tab, **When** viewing an entry, **Then** it shows: Rank, Duration, Filter Name, Filter Level, Filters/Second, Queue, Timestamp
3. **Given** the Escalations top-N tab, **When** viewing an entry, **Then** it shows: Rank, Duration, Escalation Name, Pool, Delay Duration, Error Encountered (boolean), Queue, Timestamp
4. **Given** all top-N tabs, **When** viewing any entry, **Then** it shows the Queue Wait Time alongside the execution duration
5. **Given** any top-N entry, **When** the user clicks "Expand", **Then** a detail row appears showing the full entry context including raw details, trace ID, RPC ID, and all available fields
6. **Given** any top-N entry, **When** the user clicks "View in Explorer", **Then** they navigate to the log explorer filtered to that specific entry

---

### User Story 6 - Enhanced Time-Series and Distribution Charts (Priority: P3)

As an AR Server administrator, I want the time-series chart to show performance metrics (average duration, error count) alongside volume, and the distribution charts to support multiple grouping dimensions, so that I can spot performance degradation patterns and understand load distribution.

**Why this priority**: The current time-series only shows operation counts (4 lines). The data already includes average duration and error count per time bucket, but these are hidden. Distribution charts are locked to a single view. Surfacing these turns the charts from "activity monitors" into "performance diagnostic tools." P3 because the charts already work in basic form; these are enhancements.

**Independent Test**: Can be fully tested by analyzing a log file and verifying that the time-series chart shows toggle-able duration/error overlays and the distribution chart supports switching between dimensions.

**Acceptance Scenarios**:

1. **Given** the time-series chart, **When** the user toggles "Show Duration", **Then** an average duration line appears on a secondary Y-axis
2. **Given** the time-series chart, **When** the user toggles "Show Errors", **Then** an error count area appears as a shaded overlay
3. **Given** the time-series chart, **When** the user selects a time range by clicking and dragging, **Then** the chart zooms to that interval
4. **Given** the distribution chart, **When** the user selects a grouping dimension (by type, by queue, by form, by user, by table), **Then** the chart updates to show that dimension
5. **Given** the distribution chart, **When** the user selects "Show top N", **Then** they can choose between 5, 10, 15, 25, or 50 categories

---

### User Story 7 - Performance Health Score (Priority: P2)

As an AR Server administrator, I want to see an overall system health score at the top of the dashboard so that I can quickly assess whether the AR Server was healthy during the analyzed period without reading every panel.

**Why this priority**: A composite health score provides the "executive summary" of an analysis. Instead of interpreting dozens of metrics, the admin sees a single score with a breakdown. P2 because it appears above the fold and provides immediate value on every dashboard view, but depends on the underlying data from P1 endpoints being available for accurate scoring.

**Independent Test**: Can be fully tested by analyzing a log file and verifying that a health score appears at the top of the dashboard with a color-coded status and score breakdown.

**Acceptance Scenarios**:

1. **Given** an analysis is complete, **When** the user views the dashboard, **Then** a health score (0-100) appears prominently at the top with a color indicator (green >80, yellow 50-80, red <50)
2. **Given** the health score, **When** the user views the breakdown, **Then** they see contributing factors: Error Rate, Average Response Time, Thread Saturation, Gap Frequency
3. **Given** the health score breakdown, **When** any factor is in the "red" zone, **Then** it is highlighted with a brief explanation of why it impacts health
4. **Given** the health score, **When** there are no errors, no thread saturation, and no significant gaps, **Then** the score is above 90

---

### User Story 8 - Filter Complexity Insights (Priority: P3)

As an AR Server administrator, I want to see filter execution complexity metrics (most-executed filters, filter counts per transaction) so that I can identify runaway filter chains and optimize workflow rules that silently degrade performance.

**Why this priority**: Filter complexity is a common but hidden performance issue. This is P3 because it addresses a niche (but important) diagnostic need that typically matters only after the P1/P2 features have been used to narrow down problems.

**Independent Test**: Can be fully tested by analyzing a log file with filter activity, opening the Filter Complexity section, and verifying that most-executed filters and per-transaction filter counts are displayed correctly.

**Acceptance Scenarios**:

1. **Given** an analysis with filter data, **When** the user opens the "Filter Complexity" section, **Then** two views appear: "Most Executed Filters" and "Filters Per Transaction"
2. **Given** the most-executed filters view, **When** viewing the table, **Then** each entry shows: Rank, Filter Name, Execution Count, Total Time (sorted by count descending)
3. **Given** the per-transaction view, **When** viewing the table, **Then** each entry shows: Transaction ID, Filter Name, Execution Count, Total Time, Average Time, Max Time
4. **Given** no filter activity in the analysis, **When** viewing filter complexity, **Then** a message states "No filter activity detected in this analysis"
5. **Given** the filter data, **When** the total filter time is available, **Then** it is displayed as a summary metric at the top of the section

---

### User Story 9 - AI Skills Production Readiness (Priority: P3)

As an AR Server administrator, I want the AI assistant skills (natural language query, summarizer, anomaly detection, error explainer, root cause analysis, performance analysis) to produce reliable and useful output so that I can get AI-powered insights from my analysis data without manually crafting queries.

**Why this priority**: The AI skills framework exists but needs validation against real ClickHouse data and proper error handling. P3 because the core diagnostic features (P1/P2) must work reliably first; AI skills enhance the experience but are not required for primary workflows.

**Independent Test**: Can be fully tested by completing an analysis, opening the AI assistant, executing each skill type, and verifying that each produces relevant, non-error output based on the actual analysis data.

**Acceptance Scenarios**:

1. **Given** a completed analysis, **When** the user asks a natural language question in the AI chat, **Then** the system translates it into a data query and returns a relevant answer
2. **Given** a completed analysis, **When** the user requests a summary, **Then** the summarizer skill produces an executive summary covering key statistics, notable findings, and recommendations
3. **Given** a completed analysis with errors, **When** the user asks the error explainer about a specific error code, **Then** the system provides an explanation of the error, its likely causes, and suggested remediation
4. **Given** an AI skill execution fails, **When** the error occurs, **Then** the user sees a clear error message rather than a raw stack trace or silent failure

---

### Edge Cases

- What happens when the analysis contains zero entries for a specific log type (e.g., no SQL, no escalations)? The corresponding section should display "No [type] activity detected in this analysis" instead of empty tables or errors.
- What happens when aggregate tables have 500+ rows (e.g., many unique forms)? Tables must remain responsive; virtual scrolling should be used for large datasets.
- What happens when all operations succeed (0% error rate)? The exceptions section should show a positive "No errors detected" message rather than empty space.
- What happens when the backend endpoint returns a 500 error? Each lazy-loaded section should show its own error state with a "Retry" button, without crashing the entire dashboard.
- What happens when the user navigates away from the dashboard while a lazy section is still loading? The in-flight request should be cancelled to avoid state updates on unmounted components.
- What happens when the ClickHouse data has been partially ingested (job still storing)? The dashboard should only be accessible for completed jobs; in-progress jobs should show a "still processing" message.
- What happens when gap analysis finds gaps longer than 1 hour? These should be visually marked as "Critical Gaps" with distinct styling.
- What happens when there are zero threads in the analysis? Thread statistics should display "No thread data available" rather than an empty table.
- What happens when the log file covers less than 1 minute? Time-series charts should gracefully handle sub-minute resolution by grouping by second instead of minute.
- What happens when thread statistics show 0% busy (idle server)? The health score should not penalize an idle server; low utilization is not a problem.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST serve performance aggregates grouped by form (API calls), user (API calls), and table (SQL calls) through a dedicated endpoint, returning grouped statistics with count, success/fail breakdown, and timing metrics (MIN, MAX, AVG, SUM)
- **FR-002**: System MUST serve exception/error data through a dedicated endpoint, returning exceptions grouped by error code with occurrence count, first/last seen timestamps, per-log-type error rates, and top error codes
- **FR-003**: System MUST serve gap analysis data through a dedicated endpoint, returning the top 50 line gaps and top 50 thread gaps sorted by duration descending, with start/end times, line numbers, and contextual details
- **FR-004**: System MUST serve per-thread statistics through a dedicated endpoint, returning thread ID, total calls, total time, average time, max time, error count, busy percentage, and active time range
- **FR-005**: System MUST serve filter complexity data through a dedicated endpoint, returning most-executed filters (by count), per-transaction filter metrics, and total filter processing time
- **FR-006**: System MUST cache responses for all five new endpoints using the same caching pattern as the existing dashboard endpoint (tenant-scoped cache key, 5-minute TTL)
- **FR-007**: System MUST enforce tenant isolation on all new endpoints, ensuring users can only access data for their own tenant's analysis jobs
- **FR-008**: System MUST verify that the referenced analysis job exists, belongs to the requesting tenant, and is in "complete" status before returning data from any new endpoint
- **FR-009**: System MUST display each new dashboard section (aggregates, exceptions, gaps, threads, filters) as a lazy-loaded panel that only fetches data when the user scrolls to or interacts with it
- **FR-010**: Each lazy-loaded dashboard section MUST show loading, error, and empty states independently without affecting other sections
- **FR-011**: System MUST display aggregate tables with sortable columns, defaulting to SUM Time descending
- **FR-012**: System MUST highlight thread entries exceeding 90% busy with a visual warning indicator
- **FR-013**: System MUST display per-log-type error rate percentages in the exceptions section
- **FR-014**: System MUST display gap durations with appropriate units (milliseconds, seconds, minutes) based on magnitude
- **FR-015**: The AI natural language query skill MUST translate user questions into data queries against the analysis results and return structured answers
- **FR-016**: The AI summarizer skill MUST produce a multi-paragraph executive summary covering statistics, findings, and recommendations from the analysis
- **FR-017**: All AI skills MUST handle errors gracefully, returning user-friendly error messages when data is unavailable or the AI service is unreachable
- **FR-018**: System MUST include unit tests for all new backend handlers covering success paths, error paths, tenant isolation, and cache behavior
- **FR-019**: System MUST include integration tests verifying that ClickHouse queries return correctly shaped data for each new endpoint
- **FR-020**: Top-N tables MUST display type-specific columns: SQL statement for SQL entries, filter name/level for filter entries, escalation name/pool/delay for escalation entries, and queue wait time for all entries
- **FR-021**: Top-N tables MUST provide expandable detail rows showing full entry context including raw details, trace ID, RPC ID, and all available fields
- **FR-022**: Top-N table entries MUST include a "View in Explorer" link that navigates to the log explorer filtered to that specific entry
- **FR-023**: Time-series chart MUST support toggling an average duration overlay on a secondary Y-axis
- **FR-024**: Time-series chart MUST support toggling an error count shaded overlay
- **FR-025**: Time-series chart MUST support zooming into a time range via click-and-drag
- **FR-026**: Distribution chart MUST support switching grouping dimension (by type, by queue, by form, by user, by table)
- **FR-027**: Distribution chart MUST support configuring the number of categories shown (5, 10, 15, 25, or 50)
- **FR-028**: System MUST display a composite health score (0-100) prominently at the top of the dashboard, color-coded: green (>80), yellow (50-80), red (<50)
- **FR-029**: Health score MUST show a breakdown with contributing factors: Error Rate, Average Response Time, Thread Saturation, Gap Frequency
- **FR-030**: Health score MUST highlight factors in the "red" zone with a brief explanation of their impact
- **FR-031**: The existing dashboard endpoint MUST compute and return the health score as part of the initial dashboard response, so it appears above the fold without a separate lazy-load request

### Key Entities

- **Aggregate Group**: A performance summary for a specific dimension value (form name, user, table). Contains success/fail counts, total count, and timing statistics (MIN, MAX, AVG, SUM). Groups are organized into sections (API, SQL, Filter) with optional grand totals.
- **Exception Entry**: An error occurrence grouped by error code. Contains occurrence count, first/last seen timestamps, log type classification, and sample context (line number, trace ID, queue, form, user).
- **Gap Entry**: A detected period of log silence. Contains start/end timestamps, duration, before/after line numbers, log type, and optional thread ID. Can be a "line gap" (silence across all threads) or "thread gap" (silence within a specific thread).
- **Thread Statistics Entry**: Utilization metrics for a single thread. Contains total calls, total/average/max time, error count, busy percentage, and active time range.
- **Filter Complexity Data**: Aggregated filter execution analysis. Contains most-executed filters ranked by count, per-transaction filter metrics, and total filter processing time.
- **Health Score**: A composite metric (0-100) with contributing factors (error rate, response time, thread saturation, gap frequency). Each factor has a name, individual score, max score, weight, description, and severity level. Already defined in the codebase but needs to be computed and populated by the backend.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All dashboard sections (aggregates, exceptions, gaps, threads, filters, enhanced top-N, enhanced charts, health score) display data from completed analyses, verified by end-to-end testing with real log files
- **SC-002**: Users can identify the slowest form, busiest user, and most problematic database table within 10 seconds of opening the aggregates section
- **SC-003**: Each lazy-loaded section renders its data within 2 seconds of being triggered, for analyses containing up to 1 million log entries
- **SC-004**: The dashboard page loads its initial above-the-fold content (health score, stats cards, time-series chart) without any delay from lazy-loaded sections
- **SC-005**: All numerical values displayed in the dashboard sections match the data stored in ClickHouse (data fidelity verified by automated tests)
- **SC-006**: Aggregate tables with 500+ rows remain scrollable and sortable without visible lag
- **SC-007**: Each AI skill produces a non-error response for at least 90% of valid queries against completed analyses
- **SC-008**: All new backend endpoints return appropriate HTTP error codes (400 for bad input, 401 for missing auth, 404 for missing jobs, 409 for incomplete jobs, 500 for server errors)
- **SC-009**: Backend unit test coverage for the five new handlers is at least 80%
- **SC-010**: All new dashboard sections are usable on mobile viewports (minimum 375px width) with appropriate responsive behavior
- **SC-011**: The health score accurately reflects system health: a log with >10% error rate scores below 50; a log with <1% errors and no thread saturation scores above 80
- **SC-012**: Top-N table entries can be expanded to show full details and linked to the log explorer within one click

## Clarifications

### Session 2026-02-11

- Q: Should this feature include the 3 remaining spec-003 user stories (Enhanced Top-N Tables, Enhanced Time-Series/Distribution Charts, Performance Health Score) to fully complete all missing dashboard features? → A: Yes, include all 3. This ensures the user's request to "complete all missing features" is fully satisfied.
- Q: US5 scenario 3 references "Failed Action Count, Passed Action Count" for escalation entries, but log_entries only has error_encountered (bool) and delay_ms. Use available fields only? → A: Yes, use available fields only (error_encountered, delay_ms, esc_pool). Removed action counts from US5 scenario 3.

## Assumptions

- All domain models (AggregateGroup, AggregateSection, ExceptionEntry, GapEntry, ThreadStatsEntry, FilterComplexityData, HealthScore, and their response wrappers) are already defined in the backend and frontend codebases. No model changes are needed.
- The frontend API client functions (getDashboardAggregates, getDashboardExceptions, getDashboardGaps, getDashboardThreads, getDashboardFilters) are already defined and ready to use. Only the backend endpoints need implementation.
- The ClickHouse `log_entries` table and `log_entries_aggregates` materialized view already contain all the data needed to compute aggregates, exceptions, gaps, thread stats, and filter complexity via SQL queries.
- The existing dashboard handler's pattern (tenant validation, job status check, Redis caching, ClickHouse query, JSON response) should be replicated for all five new endpoints.
- The existing `use-lazy-section` hook in the frontend is suitable for lazy-loading the five new dashboard sections.
- AI skills have existing implementations in the backend; this feature focuses on testing, fixing, and hardening them rather than building from scratch.
- The frontend uses shadcn/ui components, Recharts for charts, and react-window for virtualized lists. All new UI should use these same libraries.
- The health score is computed as part of the existing dashboard endpoint response (not a separate lazy-loaded endpoint) since it must appear above the fold on initial load.
- The time-series data already includes avg_duration_ms and error_count fields per time bucket; the enhanced chart toggles are frontend-only changes requiring no new backend work.

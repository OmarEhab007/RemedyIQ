# Feature Specification: Enhanced Analysis Dashboard

**Feature Branch**: `003-enhanced-analysis-dashboard`
**Created**: 2026-02-10
**Status**: Draft
**Input**: User description: "Enhance the analysis page to surface all insightful data from the ARLogAnalyzer.jar output, making it the definitive dashboard for AR Server log analysis with actionable operational insights."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Performance Aggregates by Form, User, and Table (Priority: P1)

As an AR Server administrator, I want to see aggregated performance statistics grouped by form, user/client, and database table so that I can immediately identify which forms are slowest, which users generate the most load, and which database tables are bottlenecks.

**Why this priority**: This is THE most valuable operational view. The JAR already produces these aggregates (API by Form, API by User, SQL by Table) with success/fail counts and MIN/MAX/AVG/SUM timing breakdowns. Without this, admins must manually scan raw top-N entries to piece together which form or table is problematic. This single view replaces hours of manual analysis.

**Independent Test**: Can be fully tested by running an analysis on any AR Server log file and verifying that the aggregate tables show per-form API performance, per-user API performance, and per-table SQL performance with correct totals matching JAR output.

**Acceptance Scenarios**:

1. **Given** an analysis is complete, **When** the user views the dashboard, **Then** they see an "Aggregates" section with tabs for "API by Form", "API by User", and "SQL by Table"
2. **Given** the aggregate tables are displayed, **When** the user clicks any column header, **Then** the table sorts by that column (ascending/descending toggle)
3. **Given** an aggregate table with grouped data, **When** the user views the table, **Then** each group shows subtotals and the bottom shows a grand total row
4. **Given** the API by Form table, **When** viewing a form row, **Then** it displays: Form Name, API Code, OK Count, Fail Count, Total Count, MIN Time, MAX Time, AVG Time, SUM Time
5. **Given** the SQL by Table table, **When** viewing a table row, **Then** it displays: Table Name, SQL Operation (SELECT/INSERT/UPDATE/DELETE), OK Count, Fail Count, Total Count, MIN Time, MAX Time, AVG Time, SUM Time

---

### User Story 2 - Exception and Error Reports (Priority: P1)

As an AR Server administrator, I want to see all exceptions and errors from the analysis (API exceptions, SQL errors, escalation errors) in dedicated report panels so that I can quickly understand what went wrong, how often, and where.

**Why this priority**: Error visibility is critical for troubleshooting. The JAR produces complete exception reports with stack traces, error messages, failed SQL queries, and escalation failures. Currently none of this is surfaced. Admins need this to diagnose outages and recurring issues.

**Independent Test**: Can be fully tested by analyzing a log file that contains errors, then verifying that the exception panels display API exceptions, SQL errors, and escalation errors with correct counts and details.

**Acceptance Scenarios**:

1. **Given** an analysis with API exceptions, **When** the user views the dashboard, **Then** they see an "Exceptions & Errors" section showing API exception count, SQL error count, and escalation error count
2. **Given** the exceptions panel, **When** viewing API exceptions, **Then** each entry shows: Line Number, Trace ID, API Code, Error Type, Error Message
3. **Given** the exceptions panel, **When** viewing SQL errors, **Then** each entry shows: Line Number, Trace ID, SQL Operation, Table Name, User, Timestamp, Error Message
4. **Given** any error entry, **When** the user clicks on it, **Then** they see the full error details including stack trace or SQL statement
5. **Given** the analysis dashboard, **When** errors exist, **Then** the system displays an error rate calculation (errors / total operations) for each log type as a percentage

---

### User Story 3 - Gap Analysis (Priority: P2)

As an AR Server administrator, I want to see the longest line gaps (periods of log silence) and thread gaps (thread inactivity) so that I can identify system hangs, GC pauses, deadlocks, or network timeouts that disrupt service.

**Why this priority**: Gaps are the primary indicator of system-level issues that don't show up in individual operation metrics. The JAR identifies the top 50 line gaps and top 50 thread gaps. These often reveal the root cause of intermittent performance issues that aggregate metrics miss.

**Independent Test**: Can be fully tested by analyzing a log file and verifying that the gap analysis panel shows the longest gaps with their durations, timestamps, and positions within the log timeline.

**Acceptance Scenarios**:

1. **Given** an analysis is complete, **When** the user views the dashboard, **Then** they see a "Gap Analysis" section with tabs for "Line Gaps" and "Thread Gaps"
2. **Given** the line gaps tab, **When** viewing the table, **Then** each entry shows: Rank, Gap Duration, Line Number, Trace ID, Timestamp, Context Details
3. **Given** the thread gaps tab, **When** viewing the table, **Then** each entry shows: Rank, Gap Duration, Line Number, Thread ID, Timestamp, Context Details
4. **Given** the gap analysis section, **When** gaps exist, **Then** a visual timeline shows where the top gaps occur relative to the overall log timespan (start-to-end)
5. **Given** no significant gaps detected, **When** the user views the gap analysis, **Then** a message confirms the log shows continuous activity

---

### User Story 4 - Thread Statistics and Queue Health (Priority: P2)

As an AR Server administrator, I want to see per-thread utilization statistics grouped by queue so that I can identify thread saturation, overloaded queues, and capacity issues.

**Why this priority**: Thread saturation is the number one cause of AR Server slowness. The JAR produces detailed per-thread statistics including busy percentage, queue time, and operation counts per queue. This view directly answers "Is the server overloaded?" and "Which queue is the bottleneck?"

**Independent Test**: Can be fully tested by analyzing a log file and verifying that the thread statistics panel shows per-queue, per-thread utilization with busy percentages and queue health indicators.

**Acceptance Scenarios**:

1. **Given** an analysis is complete, **When** the user views the dashboard, **Then** they see a "Thread Statistics" section showing per-queue thread utilization
2. **Given** the thread statistics table, **When** viewing a row, **Then** it displays: Queue Name, Thread ID, First Seen Time, Last Seen Time, Operation Count, Queue Count, Queue Time, Total Time, Busy Percentage
3. **Given** the thread statistics section, **When** any thread exceeds 90% busy, **Then** the system highlights that thread/queue with a warning indicator
4. **Given** the thread statistics section, **When** the user views the summary, **Then** they see a visual indicator per queue showing overall queue health (normal/warning/critical based on thread saturation)

---

### User Story 5 - Enhanced Top-N Tables with Type-Specific Details (Priority: P2)

As an AR Server administrator, I want the existing top-N tables (API, SQL, Filters, Escalations) to show all relevant fields for each type so that I can understand the full context of each slow operation without needing to cross-reference the original log.

**Why this priority**: The current top-N tables show generic columns. The JAR output contains rich type-specific data that is being discarded: SQL statements, filter names and nesting levels, escalation pools and delay metrics, queue wait times. Surfacing these eliminates the need to manually inspect log files.

**Independent Test**: Can be fully tested by analyzing a log file and verifying that each top-N tab shows its type-specific columns, rows are expandable for full details, and entries link to the log explorer.

**Acceptance Scenarios**:

1. **Given** the SQL top-N tab, **When** viewing an entry, **Then** it shows: Rank, Duration, Table Name, SQL Operation Type, Queue, Timestamp, Success/Fail status, and an expandable SQL Statement preview
2. **Given** the Filters top-N tab, **When** viewing an entry, **Then** it shows: Rank, Duration, Filter Name, Filter Level, Filters/Second, Queue, Timestamp
3. **Given** the Escalations top-N tab, **When** viewing an entry, **Then** it shows: Rank, Duration, Escalation Name, Pool, Delay Duration, Failed Action Count, Passed Action Count
4. **Given** all top-N tabs, **When** viewing any entry, **Then** it shows the Queue Wait Time alongside the execution duration
5. **Given** any top-N entry, **When** the user clicks "Expand", **Then** a detail row appears showing the full entry context including raw details, trace ID, RPC ID, and all available fields
6. **Given** any top-N entry, **When** the user clicks "View in Explorer", **Then** they navigate to the log explorer filtered to that specific entry

---

### User Story 6 - Filter Complexity Insights (Priority: P3)

As an AR Server administrator, I want to see filter execution complexity metrics (most executed filters, filters per transaction, nesting depth) so that I can identify runaway filter chains and optimize workflow rules.

**Why this priority**: Excessive filter execution is a common but hidden performance issue. The JAR produces unique filter metrics not available elsewhere: top filters by execution count, transactions with the most filter invocations, and maximum nesting depth. These reveal workflow design problems that raw duration metrics miss.

**Independent Test**: Can be fully tested by analyzing a log file with filter activity and verifying that the filter complexity panel shows most-executed filters, per-transaction filter counts, and nesting depth data.

**Acceptance Scenarios**:

1. **Given** an analysis with filter data, **When** the user views the dashboard, **Then** they see a "Filter Complexity" section
2. **Given** the filter complexity section, **When** viewing "Most Executed Filters", **Then** a table shows: Rank, Filter Name, Execution Count (sorted by count descending, not duration)
3. **Given** the filter complexity section, **When** viewing "Filters Per Transaction", **Then** a table shows: Rank, Line Number, Trace ID, Filter Count, Operation, Form, Request ID, Filters/Second
4. **Given** the filter complexity section, **When** viewing "Filter Nesting Depth", **Then** a table shows transactions with the deepest filter nesting levels
5. **Given** high filter counts per transaction (>100), **When** displayed, **Then** the system highlights these as potential performance risks

---

### User Story 7 - Enhanced Time-Series and Distribution Charts (Priority: P3)

As an AR Server administrator, I want the time-series chart to show performance metrics (average duration, error count) alongside volume, and the distribution charts to support multiple grouping dimensions, so that I can spot performance degradation patterns and understand load distribution.

**Why this priority**: The current time-series only shows operation counts (4 lines). The data already includes average duration and error count per time bucket, but these are hidden. Distribution charts are locked to a single view. Surfacing these turns the charts from "activity monitors" into "performance diagnostic tools."

**Independent Test**: Can be fully tested by analyzing a log file and verifying that the time-series chart shows toggle-able duration/error overlays and the distribution chart supports switching between dimensions.

**Acceptance Scenarios**:

1. **Given** the time-series chart, **When** the user toggles "Show Duration", **Then** an average duration line appears on a secondary Y-axis
2. **Given** the time-series chart, **When** the user toggles "Show Errors", **Then** an error count area appears as a shaded overlay
3. **Given** the time-series chart, **When** the user selects a time range by clicking and dragging, **Then** the chart zooms to that interval
4. **Given** the distribution chart, **When** the user selects a grouping dimension (by type, by queue, by form, by user, by table), **Then** the chart updates to show that dimension
5. **Given** the distribution chart, **When** the user selects "Show top N", **Then** they can choose between 5, 10, 15, 25, or 50 categories
6. **Given** the distribution chart, **When** the user clicks a category bar, **Then** the rest of the dashboard filters to show only data for that category

---

### User Story 8 - Performance Health Score (Priority: P3)

As an AR Server administrator, I want to see an overall system health score at the top of the dashboard so that I can quickly assess whether the AR Server was healthy during the analyzed period without reading every panel.

**Why this priority**: A composite health score provides the "executive summary" of an analysis. Instead of interpreting dozens of metrics, the admin sees a single score with a breakdown. This is especially valuable when triaging multiple log files or comparing runs over time.

**Independent Test**: Can be fully tested by analyzing a log file and verifying that a health score appears at the top of the dashboard with a color-coded status and score breakdown.

**Acceptance Scenarios**:

1. **Given** an analysis is complete, **When** the user views the dashboard, **Then** a health score (0-100) appears prominently at the top with a color indicator (green >80, yellow 50-80, red <50)
2. **Given** the health score, **When** the user views the breakdown, **Then** they see contributing factors: Error Rate, Average Response Time, Thread Saturation, Gap Frequency
3. **Given** the health score breakdown, **When** any factor is in the "red" zone, **Then** it is highlighted with a brief explanation of why it impacts health
4. **Given** the health score, **When** there are no errors, no thread saturation, and no significant gaps, **Then** the score is above 90

---

### Edge Cases

- What happens when the analysis contains zero entries for a specific log type (e.g., no SQL, no escalations)? The corresponding panels should display "No [type] activity detected in this log" instead of empty tables.
- What happens when the log file covers less than 1 minute? Time-series charts should gracefully handle sub-minute resolution by grouping by second instead of minute.
- What happens when aggregate tables have 500+ rows (e.g., many unique forms)? Tables must remain responsive with virtual scrolling, not freezing the browser.
- What happens when all operations succeed (0% error rate)? Error panels should show a positive confirmation ("No errors detected") rather than empty space.
- What happens when thread statistics show 0% busy (idle server)? The health score should not penalize an idle server; low utilization is not a problem.
- What happens when gap analysis finds gaps longer than 1 hour? These should be called out prominently as "Critical Gaps" with distinct visual treatment.
- What happens when the dashboard is accessed on a mobile device? All new panels must be accessible and readable on mobile, though detailed tables may require horizontal scrolling.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST display API call aggregates grouped by form, showing OK count, fail count, total count, MIN time, MAX time, AVG time, and SUM time per form-API combination
- **FR-002**: System MUST display API call aggregates grouped by user/client, showing the same statistical breakdown as FR-001
- **FR-003**: System MUST display SQL call aggregates grouped by table, showing per-operation-type (SELECT, INSERT, UPDATE, DELETE) statistical breakdowns
- **FR-004**: System MUST display subtotal rows per group and a grand total row at the bottom of each aggregate table
- **FR-005**: System MUST allow sorting aggregate tables by any column (ascending/descending), with SUM Time descending as the default sort
- **FR-006**: System MUST display API exceptions with line number, trace ID, API code, error type, and full error message
- **FR-007**: System MUST display SQL errors with line number, trace ID, operation, table, user, timestamp, and error message
- **FR-008**: System MUST display escalation errors with relevant escalation context
- **FR-009**: System MUST calculate and display error rate percentages (errors / total) per log type
- **FR-010**: System MUST display the top 50 line gaps with duration, line number, trace ID, timestamp, and details
- **FR-011**: System MUST display the top 50 thread gaps with duration, line number, thread ID, timestamp, and details
- **FR-012**: System MUST display a visual timeline showing gap positions relative to the overall log timespan
- **FR-013**: System MUST display per-thread statistics grouped by queue, including thread ID, first/last time, count, queue count, queue time, total time, and busy percentage
- **FR-014**: System MUST highlight threads exceeding 90% busy with a warning indicator
- **FR-015**: System MUST display queue-level health indicators based on thread saturation
- **FR-016**: System MUST show type-specific columns in top-N tables: SQL statement for SQL entries, filter name/level for filter entries, escalation name/pool/delay for escalation entries
- **FR-017**: System MUST show queue wait time alongside execution duration in all top-N entries
- **FR-018**: System MUST provide expandable detail rows in top-N tables showing full entry context
- **FR-019**: System MUST provide a "View in Explorer" link from any top-N entry to the log explorer filtered to that entry
- **FR-020**: System MUST display most-executed filters ranked by execution count
- **FR-021**: System MUST display filters-per-transaction metrics showing transactions with excessive filter chains
- **FR-022**: System MUST display filter nesting depth per transaction
- **FR-023**: System MUST allow toggling average duration overlay on the time-series chart (secondary Y-axis)
- **FR-024**: System MUST allow toggling error count overlay on the time-series chart
- **FR-025**: System MUST allow zooming into a time range on the time-series chart via click-and-drag
- **FR-026**: System MUST allow switching distribution chart grouping dimension (by type, queue, form, user, table)
- **FR-027**: System MUST allow configuring the number of categories shown in distribution charts (5, 10, 15, 25, 50)
- **FR-028**: System MUST display a composite health score (0-100) at the top of the dashboard
- **FR-029**: System MUST color-code the health score: green (>80), yellow (50-80), red (<50)
- **FR-030**: System MUST show health score breakdown with contributing factors (error rate, avg response time, thread saturation, gap frequency)
- **FR-031**: All new data displayed MUST match the ARLogAnalyzer.jar output exactly (Log Format Fidelity principle)
- **FR-032**: The initial dashboard load MUST return only summary data (general stats, health score, time-series, distribution); heavy sections (aggregates, exceptions, gaps, thread stats, filter complexity) MUST load on demand when the user scrolls to or interacts with them

### Key Entities

- **Aggregate Group**: A performance summary for a specific dimension value (e.g., a form name, a user, a table). Contains success/fail counts, total count, and timing statistics (MIN, MAX, AVG, SUM).
- **Gap Entry**: A detected period of silence in the log. Contains duration, position (line number, timestamp), and contextual details. Can be a "line gap" (silence across all threads) or "thread gap" (silence within a specific thread).
- **Thread Statistics Entry**: Utilization metrics for a single thread within a queue. Contains operation count, queue time, total time, and busy percentage.
- **Exception Entry**: An error or exception recorded during log analysis. Contains the error type, message, location (line number, file number), correlation IDs (trace ID, RPC ID), and context (API code, SQL table, escalation name).
- **Filter Complexity Entry**: Metrics about filter execution patterns within a transaction. Contains filter count, nesting level, execution rate (filters/second), and transaction context.
- **Health Score**: A composite metric (0-100) derived from error rate, response time averages, thread saturation levels, and gap frequency. Includes per-factor scores and color classification.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Dashboard displays 100% of the analytical data produced by the ARLogAnalyzer.jar for each log type (API, SQL, Filter, Escalation), verified by cross-referencing the JAR's plain-text report sections
- **SC-002**: Users can identify the slowest form, busiest user, and most problematic database table within 10 seconds of viewing the dashboard
- **SC-003**: Dashboard fully renders all panels (including new sections) within 3 seconds for analysis results containing up to 1 million log entries
- **SC-004**: Aggregate tables with 500+ rows remain responsive (no visible lag when scrolling or sorting)
- **SC-005**: The above-the-fold view shows: Health Score (with factor breakdown including error rate, thread saturation, gap frequency), Stats Cards, and Time-Series Chart — no scrolling required to assess overall system health
- **SC-006**: 100% of numerical values displayed on the dashboard match the corresponding values in the JAR's plain-text output (Log Format Fidelity)
- **SC-007**: The health score accurately reflects the analyzed system's condition: a log file with >10% error rate scores below 50; a log with <1% errors and no thread saturation scores above 80
- **SC-008**: All new dashboard sections are usable on mobile devices (minimum 375px viewport width) with appropriate responsive behavior

## Clarifications

### Session 2026-02-10

- Q: Should all dashboard data load in a single API call or be lazy-loaded per section? → A: Initial call returns summary data (stats, health score, time-series, distribution); heavy sections (aggregates, exceptions, gaps, threads, filters) lazy-load when the user scrolls to or clicks on them.
- Q: What should appear above the fold to satisfy SC-005? → A: Health Score (with factor breakdown showing error rate, thread saturation, gap frequency) + Stats Cards + Time-Series Chart. All detail panels below.
- Q: What should aggregate tables default sort by? → A: SUM Time descending (surfaces operations consuming the most total server time).

## Assumptions

- The JAR parser (`parser.go`) will be extended to extract all new data sections (aggregates, thread stats, exceptions, gaps, filter complexity) from the JAR's plain-text output. The JAR already produces this data; the parser currently only extracts general stats and top-N entries.
- The dashboard API uses a two-tier loading strategy: an initial call returns lightweight summary data (general stats, health score, time-series, distribution) for instant rendering; heavy sections (aggregates, exceptions, gaps, thread stats, filter complexity) are fetched on demand via separate endpoints when the user scrolls to or interacts with those sections.
- The health score algorithm uses configurable thresholds with sensible defaults (e.g., error rate: green <2%, yellow 2-10%, red >10%). The exact thresholds are a design decision, not a specification concern.
- Existing dashboard functionality (stats cards, current time-series, current distribution, current top-N) is preserved and enhanced, not replaced.
- All data comes from the JAR output; no new log parsing or independent analysis is required.

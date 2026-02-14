# Feature Specification: Fix Dashboard Data Pipeline

**Feature Branch**: `006-fix-dashboard-data`
**Created**: 2026-02-13
**Status**: Draft
**Input**: User description: "Deep analyze ARLogAnalyzer JAR v3 output against all error_logs files, compare what data the JAR actually produces vs what the current analysis dashboard displays. Many dashboard sections show 'No data available'. Enhance the analysis page to properly display all data the JAR can produce."

## Problem Statement

The ARLogAnalyzer JAR v3.2.2 produces ~20 rich data sections in its output, but the Go parser (`parser.go`) only extracts **General Statistics** and **Top-N individual calls** (API, SQL, Filter, Escalation). All other sections are silently ignored, causing 7 of 10 dashboard sections to display "No data available":

| Dashboard Section | Current State | Root Cause |
|---|---|---|
| Stats Cards | Working | General stats parsed correctly |
| Top-N Tables | Working | TopN entries parsed correctly |
| Time Series | "No data available" | No time-series aggregation from parsed data |
| Distribution | "No data available" | No distribution extraction from JAR output |
| Aggregates | "No data available" | JAR produces aggregates by Form/Client/Table but parser ignores them |
| Exceptions | "No errors detected" | JAR produces error reports + exception reports but parser ignores them |
| Gap Analysis | "No significant gaps" | JAR produces line gaps + thread gaps but parser ignores them |
| Thread Statistics | "No thread data" | JAR produces thread stats by queue but parser ignores them |
| Filter Complexity | "No filter activity" | JAR produces 5 filter sub-sections but parser ignores them |

### JAR Output Sections Inventory (from actual v3.2.2 output)

**Currently Parsed:**
1. General Statistics (line counts, API/SQL/ESC/FLTR counts, users, forms, tables, threads, exceptions)
2. Top 50 Individual API Calls
3. Top 50 Individual SQL Calls
4. Top 50 Individual Escalation Calls
5. Top 50 Individual Filter Executions

**NOT Parsed (data exists but ignored):**
6. 50 Longest Line Gaps (line gap, line#, trID, timestamp, details)
7. 50 Longest Thread Gaps (thread gap, line#, trID, timestamp, details)
8. API Call Aggregates grouped by Form (form, API type, OK/Fail/Total, MIN/MAX/AVG/SUM time)
9. API Call Aggregates grouped by Client (client name, API type, stats)
10. API Call Aggregates grouped by Client IP (IP, API type, stats)
11. API Thread Statistics by Queue (queue, thread, first/last time, count, Q count, Q time, total time, busy%)
12. API Calls That Errored Out (line#, trID, queue, API, form, user, start time, error message)
13. API Exception Report (line#, trID, type, message)
14. SQL Call Aggregates grouped by Table (table, SQL type, OK/Fail/Total, MIN/MAX/AVG/SUM time)
15. SQL Thread Statistics by Queue (queue, thread, first/last time, count, total time, busy%)
16. SQL Exception Report (line#, trID, message, SQL statement)
17. Escalation Call Aggregates by Form (form, escalation name, count, stats)
18. Escalation Call Aggregates by Pool (pool, escalation name, count, stats)
19. 50 Most Executed Filters (filter name, pass count, fail count)
20. 50 Most Filters Per Transaction (line#, trID, filter count, operation, form, request ID, filters/sec)
21. 50 Most Executed Filters Per Transaction (line#, trID, filter name, pass count, fail count)
22. 50 Most Filter Levels in Transactions (line#, trID, filter level, operation, form, request ID)
23. 50 Longest Queued API Calls (when queuing occurs)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View Complete Analysis Aggregates (Priority: P1)

As an AR Server administrator, I want to see performance aggregates grouped by form, client, table, and pool so I can identify which forms, users, or database tables are causing the most load on the system.

**Why this priority**: Aggregates are the most actionable data for performance troubleshooting. They answer "which form/table/user is slowest?" -- the #1 question admins ask.

**Independent Test**: Upload any log file, run analysis, navigate to dashboard. The Aggregates section should display tabbed data (by Form, by Client, by Table) with MIN/MAX/AVG/SUM timing, OK/Fail counts per API/SQL type.

**Acceptance Scenarios**:

1. **Given** a completed analysis with API calls, **When** I view the Aggregates section, **Then** I see API aggregates grouped by Form showing each form's API types with OK/Fail/Total counts and MIN/MAX/AVG/SUM durations
2. **Given** a completed analysis with SQL operations, **When** I switch to the "By Table" tab, **Then** I see SQL aggregates grouped by table name with SELECT/INSERT/UPDATE/DELETE breakdowns and timing stats
3. **Given** a completed analysis with escalations, **When** I switch to the "By Pool" tab, **Then** I see escalation aggregates grouped by pool number with counts and timing
4. **Given** a completed analysis with API calls, **When** I switch to the "By Client" tab, **Then** I see aggregates grouped by client name (e.g., "Mid-tier", "Approval Server", "Assignment Engine") with per-API-type breakdowns

---

### User Story 2 - View Gap Analysis and Thread Statistics (Priority: P1)

As an AR Server administrator, I want to see line gaps, thread gaps, and thread utilization statistics so I can identify idle periods, stuck threads, and overloaded queues.

**Why this priority**: Gap analysis and thread stats reveal server health issues that are invisible in aggregate data -- stuck threads, escalation storms, and queue bottlenecks.

**Independent Test**: Upload a log file with mixed API/SQL/Escalation traffic, run analysis. Gap Analysis section shows top 50 line gaps and top 50 thread gaps with timestamps. Thread Statistics section shows per-queue, per-thread stats with busy percentages.

**Acceptance Scenarios**:

1. **Given** a completed analysis, **When** I view the Gap Analysis section, **Then** I see a table of the longest line gaps showing gap duration, line number, trace ID, timestamp, and details
2. **Given** a completed analysis, **When** I switch to the Thread Gaps tab, **Then** I see the longest per-thread idle periods with similar columns
3. **Given** a completed analysis, **When** I view Thread Statistics, **Then** I see API thread stats grouped by queue (AssignEng, Fast, List, Prv:NNNNN, Escalation) with thread IDs, first/last timestamps, call count, total time, and busy percentage
4. **Given** a completed analysis with SQL data, **When** I scroll in Thread Statistics, **Then** I also see SQL thread stats by queue with thread-level busy percentages

---

### User Story 3 - View Errors and Exceptions (Priority: P1)

As an AR Server administrator, I want to see all API errors, SQL exceptions, and API exceptions so I can quickly identify and troubleshoot failed operations.

**Why this priority**: Error visibility is critical for incident response. Currently the dashboard says "No errors detected" even when the JAR output contains explicit error entries.

**Independent Test**: Upload a log that contains at least one failed API call or SQL exception. The Exceptions section should list the specific errors with full detail.

**Acceptance Scenarios**:

1. **Given** a completed analysis containing failed API calls, **When** I view the Exceptions section, **Then** I see each failed API call with line number, trace ID, queue, API type, form, user, start time, and the full error message
2. **Given** a completed analysis with SQL exceptions, **When** I view the Exceptions section, **Then** I see SQL exception entries with line number, trace ID, warning message, and the SQL statement involved
3. **Given** a completed analysis with API exceptions, **When** I view the Exceptions section, **Then** I see API exception entries (e.g., "WARNING: Start of API call has no corresponding end")
4. **Given** an analysis with no errors, **When** I view the Exceptions section, **Then** I see a clear "No errors detected" message (existing behavior preserved)

---

### User Story 4 - View Complete Filter Complexity Analysis (Priority: P2)

As an AR Server administrator, I want to see the full filter analysis -- most executed filters, filters per transaction, most executed per transaction, and filter nesting levels -- so I can optimize slow filter chains and identify over-triggered filters.

**Why this priority**: Filter complexity directly impacts server response time but is harder to diagnose than API/SQL issues. The 5 filter sub-sections the JAR produces are all currently ignored.

**Independent Test**: Upload a log with filter activity, run analysis. The Filter Complexity section should show all 5 sub-tabs of filter data.

**Acceptance Scenarios**:

1. **Given** a completed analysis with filter activity, **When** I view Filter Complexity, **Then** I see the "Longest Running" sub-tab showing top 50 filter executions with run time, line numbers, trace ID, queue, filter name, and start time
2. **Given** the same analysis, **When** I switch to "Most Executed", **Then** I see filter names ranked by execution count with pass/fail breakdowns
3. **Given** the same analysis, **When** I switch to "Per Transaction", **Then** I see transactions ranked by total filter count with operation type, form, request ID, and filters/sec metric
4. **Given** the same analysis, **When** I switch to "Filter Levels", **Then** I see the deepest filter nesting levels per transaction (indicating recursive/cascading filter chains)

---

### User Story 5 - Generate Time Series from Parsed Data (Priority: P2)

As an AR Server administrator, I want to see a time-series chart of operations over the analysis duration so I can visually identify spikes, patterns, and quiet periods.

**Why this priority**: Time series provides the visual overview that makes other data contextual. It's P2 because the data must be derived from parsed entries (aggregating timestamps) rather than directly from a JAR section.

**Independent Test**: Upload a log file, run analysis. The time-series chart should show operations bucketed by second or minute depending on the log duration.

**Acceptance Scenarios**:

1. **Given** a completed analysis spanning more than 1 minute, **When** I view the Time Series chart, **Then** I see the heaviest API, SQL, Filter, and Escalation operations (from TopN entries) bucketed per minute on a multi-series line chart
2. **Given** a completed analysis spanning less than 1 minute, **When** I view the chart, **Then** TopN operations are bucketed per second
3. **Given** a completed analysis, **When** I toggle series visibility, **Then** I can show/hide individual log types on the chart

---

### User Story 6 - Generate Distribution Charts from Parsed Data (Priority: P2)

As an AR Server administrator, I want to see distribution charts showing operations broken down by type, queue, form, and user so I can understand the workload shape.

**Why this priority**: Distribution data gives immediate context to the aggregate numbers -- e.g., knowing 91K SQL ops isn't useful until you see 90% of them are on table T4381.

**Independent Test**: Upload a log file, run analysis. Distribution charts should show breakdowns by multiple dimensions.

**Acceptance Scenarios**:

1. **Given** a completed analysis, **When** I view the Distribution chart with "By Type" selected, **Then** I see a pie/bar chart showing API/SQL/Filter/Escalation proportions
2. **Given** the same analysis, **When** I switch to "By Queue", **Then** I see operations broken down by queue (Fast, List, Escalation, Prv:NNNNN, etc.)
3. **Given** the same analysis, **When** I switch to "By Form", **Then** I see the top forms ranked by operation count

---

### Edge Cases

- What happens when the JAR output has no data for a section (e.g., "No Queued API's")? Display an appropriate empty state message.
- What happens when table names contain commas (e.g., "H373, T373")? Parse multi-table names correctly as a single entity.
- What happens when filter names are truncated with backtick-exclamation (e.g., "CST:UP:Approval:GetApplicationDetail`!")? Preserve the full name including special characters.
- What happens when fields contain dashes in identifiers (e.g., "-SE FAIL -- AR Error(45386)")? Parse the error type and message correctly.
- What happens when thread IDs span the same queue but different log types (API vs SQL)? Display both API and SQL thread stats separately within the same queue group.
- What happens when a log file has only one type of activity (e.g., only escalations, no API/SQL)? Show the available sections and hide empty ones gracefully.
- What happens with very large aggregates tables (30+ forms, 60+ tables)? Support pagination or collapsible groups.
- What happens when viewing a previously analyzed job that was cached before the parser enhancement? Display available data in existing sections and show a "Re-analyze for full data" prompt in newly added sections.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST parse all JAR v3.2.2 output sections listed in the inventory (sections 6-23 above) into structured data. JAR v4.0.0 (v25) support is out of scope for this feature.
- **FR-002**: System MUST extract line gap data including gap duration, line number, trace ID, timestamp, and details text
- **FR-003**: System MUST extract thread gap data with the same fields as line gaps
- **FR-004**: System MUST extract API/SQL/Escalation aggregate tables preserving the grouped structure (entity > operation type > metrics)
- **FR-005**: System MUST extract thread statistics per queue including thread ID, first/last timestamps, call count, queue time, total time, and busy percentage
- **FR-006**: System MUST extract API error entries including line number, trace ID, queue, API type, form, user, start time, and full error message text
- **FR-007**: System MUST extract exception report entries for both API and SQL sections
- **FR-008**: System MUST extract all 5 filter sub-sections: longest running, most executed, most per transaction, most executed per transaction, and filter levels
- **FR-009**: System MUST cache all parsed section data in Redis alongside existing dashboard cache (Redis is the sole storage layer; ClickHouse is not used for this feature)
- **FR-010**: System MUST serve all parsed sections through existing dashboard API endpoints (aggregates, exceptions, gaps, threads, filters), reading from Redis cache only and bypassing ClickHouse queries
- **FR-011**: System MUST generate time-series data by bucketing all TopN entries' timestamps (up to 200 across API/SQL/ESC/FLTR) into appropriate time intervals based on log duration
- **FR-012**: System MUST generate distribution data from aggregate breakdowns
- **FR-013**: System MUST handle absent sections gracefully (e.g., "No Queued API's" or missing filter section)
- **FR-014**: System MUST pass all existing tests after parser enhancement (backward compatible)
- **FR-015**: System MUST include new unit tests covering all newly parsed sections with real JAR output samples

### Key Entities

- **LineGap**: A detected idle period between consecutive log lines (duration, line#, trID, timestamp, details)
- **ThreadGap**: A detected idle period within a single thread (same fields as LineGap)
- **AggregateGroup**: A named entity (form/client/table/pool) with per-operation-type breakdowns containing OK/Fail/Total counts and MIN/MAX/AVG/SUM timing
- **ThreadStat**: Per-thread statistics within a queue (thread ID, first/last time, count, queue count, queue time, total time, busy%)
- **APIError**: A failed API call with full context (line#, trID, queue, API type, form, user, timestamp, error message)
- **ExceptionEntry**: A parser-detected exception/warning (line#, trID, type, message)
- **FilterExecution**: A filter execution record (pass/fail counts, or per-transaction metrics)
- **FilterPerTransaction**: Transaction-level filter statistics (filter count, operation, form, request ID, filters/sec)
- **FilterLevel**: Filter nesting depth per transaction (level, operation, form, request ID)

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All 10 dashboard sections display populated data when analyzing a log file that contains the corresponding activity (verified against log1.log which has all 4 log types)
- **SC-002**: Aggregates section shows data matching JAR output exactly (same form names, same counts, same timing values within 1ms precision)
- **SC-003**: Gap analysis section shows top 50 line gaps and top 50 thread gaps with correct durations and timestamps
- **SC-004**: Thread statistics section shows per-queue thread stats with accurate busy percentages matching JAR output
- **SC-005**: Exceptions section correctly displays all API errors, API exceptions, and SQL exceptions from the log
- **SC-006**: Filter complexity section displays all 5 sub-tabs with correct filter names, counts, and per-transaction metrics
- **SC-007**: Time series chart renders operations bucketed over the analysis time window
- **SC-008**: Distribution charts show correct proportional breakdowns matching aggregate totals
- **SC-009**: All existing backend tests continue to pass (zero regressions)
- **SC-010**: New test suite covers parsing of each newly extracted section with real JAR output samples from error_logs/

## Clarifications

### Session 2026-02-13

- Q: Should the enhanced parser support JAR v3.2.2 only, both v3.2.2 and v4.0.0, or v4.0.0 only? → A: v3.2.2 only (current default, user-specified)
- Q: Where should newly parsed section data be stored and served from? → A: Redis cache only -- store alongside existing dashboard cache, serve directly from cache. ClickHouse is reserved for future native Go parser individual entries.
- Q: What should the time series data source be, given TopN entries are limited to 50 per type? → A: Bucket the TopN entries' timestamps (up to 200 data points across all types) into time intervals. Sparse but honest representation of heaviest operations.
- Q: How should previously analyzed jobs with stale cached data be handled? → A: Gracefully degrade -- old analyses show available data, new sections show "Re-analyze for full data" prompt. No auto-invalidation.

## Assumptions

- JAR v3.2.2 output format uses `###` headers (not `===` as previously assumed in parser code)
- All section headers follow the pattern `###  SECTION: NAME  ###...` for major sections and `### Subsection Title` for subsections
- Fixed-width column tables use a dash separator line (`--------`) to determine column boundaries
- The "No Queued API's" text indicates an empty section (no data to parse)
- Total/summary rows are indicated by `======` separator lines
- Thread statistics appear both in the API section and SQL section with slightly different column sets
- Filter sections only appear when filter logging is enabled in the AR Server
- The `arerror.log` file cannot be parsed by JAR v3 due to timestamp format incompatibility (confirmed: "Unable to properly identify a timestamp")

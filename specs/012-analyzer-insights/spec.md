# Feature Specification: ARLogAnalyzer Insights Enhancement

**Feature Branch**: `012-analyzer-insights`
**Created**: 2026-02-18
**Status**: Draft
**Input**: Surface 8 ARLogAnalyzer JAR output features that RemedyIQ doesn't yet display in the dashboard

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Decode API Abbreviations at a Glance (Priority: P1)

An AR Server admin viewing the analysis dashboard, log explorer, or trace waterfall sees cryptic 2-letter API codes (RE, CE, SE, etc.) and needs to quickly understand what each code means. When hovering over any API code throughout the application, a tooltip displays the full name (e.g., "RE = Retrieve Entry") so the admin can interpret results without consulting external documentation.

**Why this priority**: This is the most impactful UX improvement with the smallest implementation scope. It eliminates a constant friction point for every user on every page. The data already exists in the frontend constants file.

**Independent Test**: Can be tested by navigating to any page showing API codes and verifying tooltips appear on hover with correct full names.

**Acceptance Scenarios**:

1. **Given** the analysis dashboard is open with Top-N API data, **When** the user hovers over an API code (e.g., "RE"), **Then** a tooltip shows "Retrieve Entry - Retrieves an existing record"
2. **Given** the log explorer is displaying log entries, **When** the user hovers over an API code in the operation column, **Then** the same tooltip with the full name appears
3. **Given** the trace waterfall view is open, **When** the user hovers over an API code on a span row, **Then** the tooltip appears without disrupting the waterfall layout
4. **Given** an API code is not recognized in the abbreviation map, **When** the user hovers over it, **Then** the raw code is shown without a tooltip (graceful fallback)

---

### User Story 2 - Assess Thread Utilization (Priority: P1)

An AR Server capacity planner opens the Thread Statistics section and needs to understand how busy each thread is relative to the total log duration. A visual progress bar showing busy percentage per thread lets them quickly identify overloaded threads (near 100%) and underutilized threads (near 0%) to make informed decisions about thread pool sizing.

**Why this priority**: Thread busy percentage is the single most important capacity planning metric for AR Server. The data already flows from the backend but isn't visualized in the frontend.

**Independent Test**: Can be tested by expanding the Thread Statistics section and verifying each thread row shows a colored progress bar with a percentage value.

**Acceptance Scenarios**:

1. **Given** the Thread Statistics section is expanded, **When** thread data loads, **Then** each thread row displays a progress bar showing busy percentage
2. **Given** a thread has busy percentage above 80%, **When** the section renders, **Then** the progress bar is displayed in a warning/danger color
3. **Given** a thread has busy percentage below 50%, **When** the section renders, **Then** the progress bar is displayed in a normal/safe color
4. **Given** busy percentage data is not available for a thread, **When** the section renders, **Then** a dash or "N/A" is shown instead of a progress bar

---

### User Story 3 - View Filter Execution Rate (Priority: P2)

An AR Server admin reviewing the Filter Complexity section wants to see how many filters executed per second for each transaction. A "Filters/sec" column in the per-transaction table helps identify filter storms where an unusually high rate of filter execution can overwhelm the server.

**Why this priority**: Filter storms are a common and severe performance problem. The data is already parsed by the backend but not displayed. Adding a single column is low-effort.

**Independent Test**: Can be tested by expanding the Filter Complexity section and verifying the per-transaction table includes a Filters/sec column with numeric values.

**Acceptance Scenarios**:

1. **Given** the Filter Complexity section is expanded, **When** per-transaction data loads, **Then** a "Filters/sec" column appears in the table
2. **Given** a transaction has a filters-per-second value above 100, **When** the table renders, **Then** the value is highlighted in a warning style to indicate potential filter storm
3. **Given** filters-per-second is zero or not available, **When** the table renders, **Then** the cell shows "0" or a dash

---

### User Story 4 - Identify Queued API Bottlenecks (Priority: P2)

An AR Server admin suspects thread pool saturation and wants to see which API calls spent the most time waiting in the queue before execution. A "Queued" tab in the Top-N table (alongside API, SQL, Filter, Escalation tabs) shows API calls ranked by queue wait time, immediately surfacing thread pool bottlenecks.

**Why this priority**: Queue wait time is the #1 indicator of thread pool saturation in AR Server. The data is already parsed and stored but needs a new API endpoint and frontend tab.

**Independent Test**: Can be tested by clicking the "Queued" tab on the dashboard Top-N table and verifying entries appear sorted by queue wait time.

**Acceptance Scenarios**:

1. **Given** the analysis dashboard is loaded, **When** the user clicks the "Queued" tab in the Top-N section, **Then** a table shows API calls ranked by queue wait time
2. **Given** no queued API call data exists for the analysis, **When** the Queued tab is selected, **Then** an empty state message is displayed
3. **Given** the Queued tab has data, **When** the user views an entry, **Then** queue wait time is displayed in a human-readable format (ms or seconds)

---

### User Story 5 - Understand Filter Nesting Depth (Priority: P2)

An AR Server admin troubleshooting slow transactions wants to see which transactions have deeply nested filter chains. A "Filter Levels" sub-table in the Filter Complexity section shows the maximum nesting depth per transaction with the associated operation and form context.

**Why this priority**: Deeply recursive filter chains are a known AR Server performance anti-pattern. The data is already parsed and rendered in HTML reports but not in the interactive dashboard.

**Independent Test**: Can be tested by expanding the Filter Complexity section and verifying a Filter Levels table appears showing nesting depth per transaction.

**Acceptance Scenarios**:

1. **Given** the Filter Complexity section is expanded, **When** filter level data exists, **Then** a "Filter Levels" sub-table appears showing line number, nesting level, operation, and form
2. **Given** a transaction has filter nesting above 5 levels, **When** the table renders, **Then** the depth value is highlighted as a potential concern
3. **Given** no filter level data exists for the analysis, **When** the section is expanded, **Then** the Filter Levels sub-table is hidden or shows "No data"

---

### User Story 6 - View Logging Duration by Type (Priority: P3)

An AR Server admin wants to confirm which log types (API, SQL, Filter, Escalation) were active during the analysis period and for how long. A "Logging Activity" summary shows the first/last timestamp and total duration per log type, helping admins verify that all expected log types were captured.

**Why this priority**: Understanding log coverage is important for interpreting results — partial logging can lead to misleading conclusions. Requires backend parser work for the JAR output section.

**Independent Test**: Can be tested by viewing the dashboard and verifying a Logging Activity section shows per-type timestamps and durations.

**Acceptance Scenarios**:

1. **Given** the analysis dashboard is loaded, **When** logging activity data exists, **Then** a section shows each log type with first timestamp, last timestamp, and total duration
2. **Given** a log type was not present in the uploaded files, **When** the section renders, **Then** that type is shown with "Not captured" or is omitted
3. **Given** multiple log types have different durations, **When** the section renders, **Then** durations are displayed in human-readable format (e.g., "2h 15m 30s")

---

### User Story 7 - Review Source File Metadata (Priority: P3)

An AR Server admin who uploaded multiple log files wants to see per-file metadata: which time range each file covers, its duration, and its ordinal position in the set. A "Source Files" section in the dashboard shows this breakdown so admins can verify file coverage and identify gaps.

**Why this priority**: Multi-file uploads are common in production diagnostics. Per-file metadata helps admins verify they uploaded the right files. Requires backend parser work for a JAR section not yet parsed.

**Independent Test**: Can be tested by uploading multiple log files and verifying the Source Files section shows per-file time ranges and durations.

**Acceptance Scenarios**:

1. **Given** an analysis was created from multiple log files, **When** the dashboard loads, **Then** a "Source Files" section shows each file with its ordinal number, start time, end time, and duration
2. **Given** an analysis was created from a single log file, **When** the dashboard loads, **Then** the Source Files section shows one entry or is simplified
3. **Given** file metadata is not available (older analyses), **When** the dashboard loads, **Then** the Source Files section is hidden gracefully

---

### User Story 8 - Diagnose Delayed Escalations (Priority: P3)

An AR Server admin investigating escalation pool contention wants to see which escalations ran late, how much delay occurred, and which prior escalation held up the pool. A "Delayed Escalations" section surfaces scheduled vs actual execution times with delay metrics, enabling root-cause analysis of escalation queuing issues.

**Why this priority**: Escalation pool contention is a complex AR Server issue that requires correlating multiple data points. This feature requires a new data query, endpoint, and frontend section — the largest scope item.

**Independent Test**: Can be tested by viewing the dashboard for an analysis with escalation logs and verifying delayed escalation entries appear with delay metrics.

**Acceptance Scenarios**:

1. **Given** the analysis contains escalation logs with delays, **When** the dashboard loads, **Then** a "Delayed Escalations" section shows entries with escalation name, scheduled time, actual time, delay duration, and escalation pool
2. **Given** an escalation had a delay exceeding 60 seconds, **When** the section renders, **Then** the delay value is highlighted as severe
3. **Given** no delayed escalations exist in the analysis, **When** the dashboard loads, **Then** the section is hidden or shows "No delayed escalations found"
4. **Given** the analysis has no escalation logs at all, **When** the dashboard loads, **Then** the Delayed Escalations section does not appear

---

### Edge Cases

- What happens when API abbreviation data from the backend differs from the static frontend map? The backend data takes precedence and is merged with the static map.
- What happens when a thread has exactly 0% or 100% busy percentage? The progress bar renders at the boundary with appropriate styling.
- What happens when filters-per-second is extremely high (e.g., 10,000+)? The value is displayed as-is with warning styling but without special truncation.
- What happens when queued API call data is empty but other Top-N tabs have data? The Queued tab shows an empty state; other tabs remain unaffected.
- What happens when the analysis was performed without JAR (computed-only mode)? Features that depend on JAR-specific data (Filter Levels, Queued Calls, API Abbreviations from JAR) gracefully fall back or hide.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST display human-readable tooltips for API abbreviation codes on all pages where API codes appear (dashboard Top-N, log explorer, trace waterfall)
- **FR-002**: System MUST display thread busy percentage as a visual progress bar with color coding in the Thread Statistics section
- **FR-003**: System MUST display a "Filters/sec" column in the Filter Complexity per-transaction table
- **FR-004**: System MUST provide a "Queued" tab in the Top-N table showing API calls ranked by queue wait time
- **FR-005**: System MUST display filter nesting depth per transaction in the Filter Complexity section
- **FR-006**: System MUST display logging activity duration per log type (first/last timestamp, total duration) on the dashboard
- **FR-007**: System MUST display per-file metadata (file number, start time, end time, duration) when multiple source files were analyzed
- **FR-008**: System MUST display delayed escalation entries with scheduled time, actual time, delay duration, and escalation pool name
- **FR-009**: System MUST gracefully hide or show empty states for sections when their corresponding data is not available
- **FR-010**: System MUST merge backend-provided API abbreviations with the static frontend abbreviation map, with backend data taking precedence

### Key Entities

- **API Abbreviation**: A mapping from a short code (2-3 letters) to a full API name and description
- **Thread Busy Percentage**: The ratio of active processing time to total log duration for a given thread, expressed as 0-100%
- **Filter Level Entry**: A record of filter nesting depth for a specific transaction, including the operation and form context
- **Queued API Call**: An API call entry ranked by its queue wait time rather than execution time
- **Delayed Escalation**: An escalation that ran after its scheduled time, with metrics about the delay and pool assignment
- **Source File Metadata**: Per-file information including ordinal position, time range, and duration
- **Logging Activity**: Per-log-type summary of when logging was active (first/last timestamps, total duration)

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can identify the full name of any API abbreviation within 1 second via tooltip hover, across all pages
- **SC-002**: Users can visually identify overloaded threads (>80% busy) within 3 seconds of expanding the Thread Statistics section
- **SC-003**: Users can identify filter storm transactions (high filters/sec) from the per-transaction table without scrolling to additional views
- **SC-004**: Users can find the longest-queued API calls in under 5 seconds by clicking the Queued tab
- **SC-005**: Users can identify deeply nested filter chains (>5 levels) within the Filter Complexity section
- **SC-006**: All 8 insight features render correctly when data is available and hide gracefully when data is absent
- **SC-007**: No existing dashboard functionality is broken by the addition of these features
- **SC-008**: All new components have unit test coverage

## Assumptions

- The existing Redis-cached dashboard data pipeline will be used for all new data endpoints
- JAR-parsed data is the primary source; computed fallbacks are secondary
- The static API abbreviation map in the frontend is kept as a fallback for when JAR data is unavailable
- Thread busy percentage color thresholds: <50% green, 50-80% amber, >80% red
- Filter storm threshold for visual highlighting: >100 filters/sec
- Delayed escalation severity threshold: >60 seconds delay
- Filter nesting concern threshold: >5 levels deep

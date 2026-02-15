# Feature Specification: Complete Log Explorer

**Feature Branch**: `007-complete-log-explorer`
**Created**: 2026-02-14
**Status**: Draft
**Input**: Complete the Log Explorer page with job-scoped search, time range selection, timeline histogram, autocomplete, entry detail fetch, related entries navigation, context view, saved searches, export, and enhanced UX features.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Job-Scoped Search with Time Range (Priority: P1)

As an AR Admin who has completed a log analysis, I can open the Log Explorer scoped to that specific analysis job and narrow results by time range, so I find relevant entries quickly without sifting through unrelated data.

**Why this priority**: The explorer currently searches globally across the tenant rather than within a specific analysis job. Without job scoping, users cannot correlate search results with a particular analysis session. Time range selection is fundamental to log exploration — every major observability platform treats it as a core control.

**Independent Test**: Navigate to an analysis job's detail page, click "Explore Logs", verify the explorer opens scoped to that job's entries. Select "Last 1 hour" relative time range and confirm only entries within that window appear. Switch to absolute range (e.g., 2024-01-15 10:00 - 2024-01-15 11:00) and verify results update accordingly.

**Acceptance Scenarios**:

1. **Given** a completed analysis job, **When** the user navigates to the Log Explorer from that job, **Then** the explorer is scoped to that job's entries and the URL contains the job ID.
2. **Given** the explorer is open for a job, **When** the user selects a relative time range (e.g., "Last 15 minutes", "Last 1 hour", "Last 24 hours", "Last 7 days"), **Then** search results are filtered to entries within that time window relative to the job's log data timestamps.
3. **Given** the explorer is open, **When** the user selects "Custom range" and picks specific start/end dates and times, **Then** only log entries within that absolute time window are displayed.
4. **Given** a time range is active, **When** the user performs a KQL search, **Then** the time range constraint is combined with the search query (AND logic).
5. **Given** a job with entries spanning 3 days, **When** the user selects "Last 1 hour" but the job has no entries in the last hour of its data, **Then** the explorer shows "No results in selected time range" with the actual data time span displayed.

---

### User Story 2 - Log Timeline Histogram (Priority: P1)

As an AR Admin, I can see a visual timeline histogram above the search results showing log volume over time, color-coded by log type, so I can spot patterns, spikes, and anomalies at a glance and click to zoom into interesting time windows.

**Why this priority**: A timeline histogram is the standard centerpiece of every major log explorer (Datadog, Grafana, Kibana, Splunk). It enables visual pattern recognition — users can instantly see traffic spikes, error bursts, and quiet periods without reading individual entries. This is critical for effective log analysis.

**Independent Test**: Open the explorer for a job with 50,000+ entries spanning 8 hours. Verify a bar/area chart appears above the results showing log volume distribution over time with distinct colors for API (blue), SQL (green), Filter (orange), and Escalation (purple) entries. Click-drag on a spike to zoom into that time window.

**Acceptance Scenarios**:

1. **Given** the explorer is showing search results, **When** results load, **Then** a timeline histogram appears above the results table showing log entry counts bucketed by time intervals.
2. **Given** the timeline is displayed, **When** the user views it, **Then** bars/areas are color-coded by log type: API, SQL, Filter, Escalation — using the same color scheme as the log table type badges.
3. **Given** the timeline shows a visible spike, **When** the user clicks and drags to select a time range on the histogram, **Then** the time range picker updates to that selection and results filter to that window.
4. **Given** the time range changes (via picker or histogram selection), **When** the histogram re-renders, **Then** it adjusts its time bucket granularity to show appropriate detail (e.g., minutes for 1-hour range, hours for 1-day range).
5. **Given** no search has been performed yet, **When** the explorer loads for a job, **Then** the timeline shows the full distribution of all log entries in that job.

---

### User Story 3 - Search Autocomplete (Priority: P1)

As an AR Admin typing a KQL search query, I receive autocomplete suggestions for field names and field values so I can construct queries quickly without memorizing the exact field syntax.

**Why this priority**: Autocomplete is table-stakes UX for any search-based interface. Without it, users must memorize field names (log_type vs type, duration_ms vs duration) and valid values, creating unnecessary friction. The OpenAPI spec already defines this endpoint but it has not been implemented.

**Independent Test**: Focus the search bar and type "ty" — verify "type" appears as a field suggestion. Select "type" and verify a colon is auto-appended. Then type "A" — verify "API" appears as a value suggestion. Accept it and verify the query reads "type:API".

**Acceptance Scenarios**:

1. **Given** the search bar is focused and empty, **When** the user starts typing a field name (e.g., "dur"), **Then** a dropdown shows matching field suggestions (e.g., "duration") with their descriptions.
2. **Given** the user has typed a field name followed by a colon (e.g., "type:"), **When** they start typing a value, **Then** the dropdown shows matching values for that field with occurrence counts from the current job's data.
3. **Given** autocomplete suggestions are visible, **When** the user presses arrow keys and Enter (or clicks a suggestion), **Then** the selected suggestion is inserted into the query at the cursor position.
4. **Given** the user types a free-text query without a field prefix, **When** autocomplete appears, **Then** it suggests relevant field names that might match their intent.
5. **Given** the autocomplete is loading, **When** suggestions take longer than 200ms, **Then** a subtle loading indicator appears in the dropdown without blocking typing.

---

### User Story 4 - Entry Detail Fetch and Related Entries (Priority: P1)

As an AR Admin viewing a log entry in the detail panel, I can see the full entry details fetched independently and navigate to related entries by trace ID or RPC ID, so I can follow the complete execution path of a transaction.

**Why this priority**: The detail panel currently only shows data from the search result hit. A dedicated fetch endpoint ensures complete entry data is always available. Related entries navigation (trace ID/RPC ID) is essential for Remedy troubleshooting — admins need to see the full API-to-SQL-to-Filter chain to diagnose issues.

**Independent Test**: Click a log entry in search results. Verify the detail panel loads full entry data (including fields not in the search result). Click the trace ID link and verify the explorer filters to show all entries sharing that trace ID.

**Acceptance Scenarios**:

1. **Given** the user clicks a log entry in the results table, **When** the detail panel opens, **Then** the system fetches the full entry from the dedicated entry endpoint (not just search result data).
2. **Given** the detail panel shows an entry with a trace_id, **When** the user clicks the trace_id value, **Then** the search query updates to filter by that trace_id, showing all related entries in chronological order.
3. **Given** the detail panel shows an entry with an rpc_id, **When** the user clicks the rpc_id value, **Then** the search filters to show all entries sharing that RPC ID (typically: API call + associated SQL + Filter entries).
4. **Given** the user navigates to related entries via trace_id, **When** results display, **Then** the entries are shown in chronological order with visual indicators showing the relationship chain (e.g., "3 of 7 related entries").

---

### User Story 5 - Context View and Dashboard Links (Priority: P2)

As an AR Admin, I can view surrounding log entries for context when examining a specific entry, and I can navigate directly from dashboard top-N tables to the explorer pre-filtered to specific entries.

**Why this priority**: Context view ("show surrounding logs") is a standard feature in log explorers that helps admins understand what happened before and after an event. Dashboard-to-explorer navigation completes the drill-down workflow from high-level statistics to individual entries.

**Independent Test**: In the detail panel, click "Show Context" and verify 10 entries before and after the selected entry are displayed in chronological order. From the dashboard, click a slow API call in the top-N table and verify the explorer opens filtered to that specific entry.

**Acceptance Scenarios**:

1. **Given** the detail panel is open for an entry, **When** the user clicks "Show Context", **Then** the system displays the selected entry plus N entries before and N entries after it (by line number), with the selected entry highlighted.
2. **Given** context view is showing, **When** the user adjusts the context window size (e.g., 5, 10, 25 lines), **Then** the view updates to show more or fewer surrounding entries.
3. **Given** the dashboard shows a top-N slowest API calls table, **When** the user clicks "View in Explorer" on an entry, **Then** the explorer opens scoped to that job with the search pre-filtered to that specific log entry's line number.
4. **Given** any top-N table on the dashboard (API, SQL, Filter, Escalation), **When** the user clicks a link to the explorer, **Then** the entry is highlighted and the detail panel opens automatically.

---

### User Story 6 - Column Sorting and Syntax Highlighting (Priority: P2)

As an AR Admin, I can sort search results by clicking column headers and see my KQL query with syntax highlighting for visual clarity.

**Why this priority**: Column sorting lets users quickly find the slowest or most recent entries without crafting a new query. Syntax highlighting reduces query errors by making the query structure visually clear — a standard feature in Datadog, Kibana, and Splunk search bars.

**Independent Test**: Click the "Duration" column header and verify results re-sort by duration descending. Click again for ascending. Type a KQL query and verify field names appear in one color, operators in another, and values in a third color.

**Acceptance Scenarios**:

1. **Given** search results are displayed, **When** the user clicks a sortable column header (timestamp, duration, type, user), **Then** results re-sort by that column in descending order, with a visual sort indicator on the header.
2. **Given** a column is sorted descending, **When** the user clicks the same header again, **Then** sort toggles to ascending.
3. **Given** the search bar contains a KQL query, **When** the user views it, **Then** field names are highlighted in blue, operators (AND, OR, NOT, >, <, :) in orange, string values in green, and numbers in purple.
4. **Given** the user types invalid syntax, **When** the parser detects an error, **Then** the problematic portion of the query is underlined in red with a tooltip explaining the issue.

---

### User Story 7 - Saved Searches, Query History, and Export (Priority: P3)

As an AR Admin, I can save frequently used search queries, access my recent search history, and export search results for offline analysis or sharing.

**Why this priority**: These are power-user features that increase efficiency for repeat workflows. The saved_searches table already exists in the PostgreSQL data model. Export is commonly requested for compliance documentation and team collaboration.

**Independent Test**: Perform a search, click "Save Search", name it "Slow API Calls", verify it appears in a saved searches list. Close and reopen the explorer, access the saved search, and verify the query is restored. Export results as CSV and verify the file contains all displayed columns.

**Acceptance Scenarios**:

1. **Given** the user has performed a search, **When** they click "Save Search" and provide a name, **Then** the query (including filters and time range) is saved to their profile.
2. **Given** saved searches exist, **When** the user opens the saved searches panel, **Then** they see a list of their saved searches with name, query text, and creation date. Clicking one restores the full search state.
3. **Given** the user opens the search bar, **When** they click the history dropdown, **Then** they see their last 20 searches with timestamps. Clicking one re-runs the search.
4. **Given** search results are displayed, **When** the user clicks "Export" and selects CSV or JSON format, **Then** the current results (up to 10,000 entries) are downloaded as a file with all displayed columns.
5. **Given** a large export (>1,000 entries), **When** the export starts, **Then** a progress indicator appears and the export completes in the background without blocking the UI.

---

### User Story 8 - Keyboard Navigation (Priority: P3)

As a power-user AR Admin, I can navigate the log explorer entirely via keyboard shortcuts for efficient log investigation.

**Why this priority**: Keyboard shortcuts significantly improve power-user efficiency during extended troubleshooting sessions. This is a polish feature that builds on all prior functionality.

**Independent Test**: Press "/" to focus the search bar, type a query, press Enter to search. Use arrow keys to navigate results, press Enter to open detail panel, press Escape to close it. Verify all actions work without mouse interaction.

**Acceptance Scenarios**:

1. **Given** the explorer is open, **When** the user presses "/" or Ctrl+K, **Then** the search bar receives focus.
2. **Given** search results are displayed, **When** the user presses up/down arrow keys, **Then** the selected row changes and the detail panel updates if open.
3. **Given** a row is selected, **When** the user presses Enter, **Then** the detail panel opens for that entry.
4. **Given** the detail panel is open, **When** the user presses Escape, **Then** the detail panel closes and focus returns to the results table.

---

### Edge Cases

- What happens when the user searches a job with zero entries? System displays "No log entries found for this analysis job" with a link back to the job details.
- What happens when the autocomplete endpoint is slow or unavailable? The search bar remains fully functional for manual typing; autocomplete gracefully degrades to showing no suggestions with no error displayed.
- What happens when the user selects a time range that contains no entries? System shows "No results in selected time range" with the actual data time span so the user can adjust.
- What happens when a trace_id links to 1000+ related entries? System paginates related entries with a count indicator ("Showing 100 of 1,247 related entries") and allows viewing all.
- What happens when the user exports more than 10,000 entries? System caps the export at 10,000 entries with a message explaining the limit and suggesting time range narrowing.
- What happens when the user navigates from dashboard to explorer for a deleted/expired job? System shows "Analysis job not found or has expired" with a link back to the dashboard.
- What happens when multiple users save searches with the same name? Each user's saved searches are independent; duplicate names are allowed per user.
- What happens when the browser window is narrow (mobile)? Filter panel collapses to a toggle button, timeline histogram hides, and the detail panel becomes a full-screen overlay.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST scope all Log Explorer searches to a specific analysis job, identified by job ID in the URL and passed to the search endpoint.
- **FR-002**: System MUST provide time range selection with preset relative ranges (Last 15 minutes, Last 1 hour, Last 6 hours, Last 24 hours, Last 7 days, All time) and custom absolute date/time range selection.
- **FR-003**: System MUST display a timeline histogram above search results showing log entry counts over time, bucketed by appropriate intervals, with bars/areas color-coded by log type.
- **FR-004**: System MUST support click-and-drag on the timeline histogram to select a time range, updating both the time range picker and search results.
- **FR-005**: System MUST provide an autocomplete endpoint that returns field name suggestions (when typing a field prefix) and field value suggestions with counts (when typing after a field:colon).
- **FR-006**: System MUST provide a dedicated endpoint to fetch a single log entry by ID, returning the complete entry with all fields.
- **FR-007**: System MUST make trace_id and rpc_id values clickable in the detail panel, filtering results to all entries sharing that identifier.
- **FR-008**: System MUST provide a context view showing N configurable surrounding log entries (by line number) before and after a selected entry, with the selected entry visually highlighted.
- **FR-009**: System MUST support column sorting by clicking column headers (timestamp, duration, type, user), with toggle between ascending and descending order.
- **FR-010**: System MUST provide KQL syntax highlighting in the search bar with distinct colors for field names, operators, values, and invalid syntax indicators.
- **FR-011**: System MUST support saving named search queries (query text, filters, time range) and retrieving them for re-execution.
- **FR-012**: System MUST maintain a per-user search history (last 20 queries) accessible via a dropdown in the search bar.
- **FR-013**: System MUST support exporting current search results to CSV and JSON formats, with a maximum of 10,000 entries per export.
- **FR-014**: System MUST support keyboard navigation: "/" or Ctrl+K to focus search, arrow keys for row navigation, Enter to open detail, Escape to close panels.
- **FR-015**: Dashboard top-N tables MUST include "View in Explorer" links that navigate to the explorer scoped to the relevant job with the entry pre-selected.
- **FR-016**: The timeline histogram MUST auto-adjust time bucket granularity based on the selected time range (e.g., 1-minute buckets for 1-hour range, 1-hour buckets for 1-day range).

### Key Entities

- **SearchQuery (saved)**: A named, persisted search configuration. Contains: user ID, name, KQL query text, active filters, time range, creation date. Scoped per user.
- **SearchHistory**: An automatically recorded search execution. Contains: user ID, KQL query text, timestamp, result count. Limited to most recent 20 per user.
- **TimeRange**: A time window selection. Can be relative (preset duration from latest entry) or absolute (specific start/end timestamps).
- **ContextWindow**: A view of surrounding log entries. Contains: the target entry, N entries before it, N entries after it (by line number within the same job).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can find a specific log entry within 3 interactions (select job, set time range, run search) for 90% of lookup tasks.
- **SC-002**: Search results, including time range filtering and histogram data, return in under 2 seconds for jobs with up to 10 million log entries.
- **SC-003**: Autocomplete suggestions appear within 200ms of the user pausing typing.
- **SC-004**: Timeline histogram renders within 1 second of search results loading.
- **SC-005**: Navigating from dashboard top-N table to the specific log entry in the explorer completes in under 3 seconds (including page load).
- **SC-006**: Related entries (trace_id/rpc_id) navigation returns results in under 2 seconds.
- **SC-007**: Export of 10,000 entries to CSV completes in under 10 seconds.
- **SC-008**: All documented keyboard shortcuts (/, Ctrl+K, arrow keys, Enter, Escape) function correctly and enable a complete search-to-detail workflow without mouse interaction.

## Assumptions

- The existing KQL parser supports all needed query syntax and only requires wiring to the job-scoped endpoint.
- The ClickHouse log_entries table already has appropriate indexes for time-range queries (timestamp is part of the ORDER BY key).
- The saved_searches table defined in the PostgreSQL data model spec is available or will be created as part of this feature.
- The Bleve index supports job-scoped queries via the job_id field.
- The existing frontend component structure (SearchBar, LogTable, FilterPanel, DetailPanel) will be extended rather than replaced.
- The Recharts library already included in the frontend can render the timeline histogram without additional dependencies.

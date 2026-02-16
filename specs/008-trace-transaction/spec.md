# Feature Specification: Enhanced Trace Transaction Page

**Feature Branch**: `008-trace-transaction`
**Created**: 2026-02-15
**Status**: Draft
**Input**: User description: "Redesign and enhance the Trace Transaction page to provide a world-class transaction tracing experience for BMC Remedy AR Server log analysis, inspired by modern APM tools (Datadog, Jaeger, Honeycomb, Elastic APM)."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Waterfall Transaction View (Priority: P1)

As an AR Admin, I can view the complete execution flow of a single transaction in a horizontal waterfall/Gantt chart, with parent-child nesting showing the full chain: API call, filter executions, SQL queries, and escalations, with accurate timing, duration bars, and color-coded log types.

**Why this priority**: This is the core value proposition. Without a clear, visual representation of how operations nest and flow within a transaction, the trace page is just a flat list. The waterfall is the foundation every other feature builds on.

**Independent Test**: Upload logs containing a known transaction with at least 3 log types. Navigate to the Trace page, enter the Trace ID, and verify the waterfall displays all related entries with correct parent-child nesting, proportional duration bars, color-coded types, and chronological ordering.

**Acceptance Scenarios**:

1. **Given** a loaded trace with API, Filter, and SQL entries, **When** the waterfall renders, **Then** entries are displayed as horizontal bars proportional to their duration, nested by parent-child relationships (API at top, Filters indented below, SQL queries indented under their triggering filter), color-coded by log type (API=blue, SQL=green, Filter=purple, Escalation=orange).
2. **Given** a waterfall with 50+ spans, **When** the user scrolls vertically, **Then** the timestamp ruler remains fixed at the top and the view scrolls smoothly without layout jitter.
3. **Given** a span with `success=false`, **When** the waterfall renders, **Then** that span's bar and row are highlighted in red, with a visible error indicator distinguishable from successful operations.
4. **Given** a trace loaded from AR Server 19.x+ (with Trace IDs), **When** viewing the waterfall, **Then** all related entries across log types are correlated by Trace ID and shown in the correct hierarchy.
5. **Given** a trace from pre-19.x (RPC ID only), **When** viewing the waterfall, **Then** entries are correlated by RPC ID with a visible accuracy warning banner indicating fallback mode.

---

### User Story 2 - Span Detail Sidebar (Priority: P1)

As an AR Admin, I can click any span in the waterfall to open a detail sidebar showing the full context for that operation, including type-specific fields, all correlation IDs, duration breakdown, and direct links to the raw log entry.

**Why this priority**: The waterfall shows the "big picture" but admins need to drill into individual operations for diagnosis. This is essential for the waterfall to be useful beyond just a visual overview.

**Independent Test**: Click on a SQL span in the waterfall and verify the sidebar shows the actual SQL query text, table name, execution time, percentage of total trace duration, all correlation IDs, and a working link to the raw log entry in the Log Explorer.

**Acceptance Scenarios**:

1. **Given** the user clicks an API span, **When** the detail sidebar opens, **Then** it displays: form name, operation type (GET/SET/CREATE/DELETE/MERGE), API code, user, queue, overlay group, duration, and percentage of total trace time.
2. **Given** the user clicks a SQL span, **When** the detail sidebar opens, **Then** it displays: the actual SQL statement with syntax highlighting, table name, execution time, queue time (if available), and success/failure status.
3. **Given** the user clicks a Filter span, **When** the detail sidebar opens, **Then** it displays: filter name, execution phase (1/2/3), pass/fail status, operation that triggered it, and the form context.
4. **Given** the user clicks an Escalation span, **When** the detail sidebar opens, **Then** it displays: escalation name, pool, scheduled time versus actual execution time, delay, and whether errors were encountered.
5. **Given** the detail sidebar is open for any span, **When** the user clicks "View in Log Explorer", **Then** the Log Explorer opens filtered to that specific entry (by entry_id or line_number).

---

### User Story 3 - Transaction Search & Discovery (Priority: P2)

As an AR Admin, I can search for transactions by Trace ID, RPC ID, Thread ID, or User, and browse recently viewed traces, so I can quickly find the transaction I need to investigate.

**Why this priority**: The current page only supports Trace ID search. Admins often start from a username, a thread, or a recently investigated trace. Enhanced search makes the feature accessible for real-world troubleshooting workflows.

**Independent Test**: Search by a known username and verify a list of matching transactions appears with their Trace IDs, durations, and span counts. Select one to load the waterfall.

**Acceptance Scenarios**:

1. **Given** the user enters a Trace ID in the search box, **When** they press Enter or click Search, **Then** the system loads all entries matching that Trace ID and renders the waterfall.
2. **Given** the user enters a username in the search box, **When** results load, **Then** a list of transactions for that user appears showing: Trace ID (or RPC ID), timestamp, total duration, span count, and primary operation/form.
3. **Given** the user has previously viewed traces in this session, **When** they focus the search box, **Then** recent traces are shown as a dropdown with Trace ID, user, timestamp, and duration.
4. **Given** the user enters a Thread ID, **When** results load, **Then** all transactions that executed on that thread are listed chronologically.
5. **Given** a transaction search returns multiple results, **When** the user clicks one, **Then** the waterfall loads for that specific transaction.

---

### User Story 4 - Trace Summary Header (Priority: P2)

As an AR Admin, I can see a summary header above the waterfall that shows the transaction's key metrics at a glance: Trace ID, user, total duration, entry count by log type, error count, and a mini-timeline.

**Why this priority**: Before diving into the waterfall detail, admins need a quick overview to understand the transaction's scope, severity, and composition. This is especially valuable when comparing multiple traces.

**Independent Test**: Load a trace and verify the header shows correct total duration, accurate entry counts per log type, correct error count, and a mini-timeline that proportionally represents the span distribution.

**Acceptance Scenarios**:

1. **Given** a trace is loaded, **When** the summary header renders, **Then** it displays: Trace ID (copyable), primary user, total duration, total span count, and queue.
2. **Given** a trace with entries across all 4 log types, **When** the header renders, **Then** an operation breakdown shows counts for each type (e.g., "12 API, 45 SQL, 23 Filter, 2 Escalation").
3. **Given** a trace with 3 failed entries, **When** the header renders, **Then** an error count badge shows "3 errors" with a red severity indicator.
4. **Given** a trace is loaded, **When** the header renders, **Then** a mini-timeline bar shows the proportional distribution of spans with error positions marked in red.

---

### User Story 5 - In-Trace Filtering (Priority: P3)

As an AR Admin, I can filter and search within a loaded trace to focus on specific operations, log types, errors, or slow spans without reloading the data.

**Why this priority**: Large transactions can have hundreds of spans. Filtering helps admins focus on what matters (e.g., just SQL queries, just errors, just slow operations) without losing the overall context.

**Independent Test**: Load a trace with 100+ entries, filter to show only SQL entries, and verify only SQL spans appear in the waterfall while a "filtered" indicator shows the active filter count.

**Acceptance Scenarios**:

1. **Given** a loaded trace, **When** the user types a search term (e.g., a filter name or form name), **Then** matching spans are highlighted in the waterfall and non-matching spans are visually dimmed.
2. **Given** a loaded trace, **When** the user toggles log type checkboxes (API/SQL/Filter/Escalation), **Then** only spans of the selected types are shown in the waterfall.
3. **Given** a loaded trace, **When** the user enables "Errors only" toggle, **Then** only failed spans and their parent chain are shown.
4. **Given** a loaded trace, **When** the user sets a duration threshold (e.g., "> 100ms"), **Then** only spans exceeding that threshold are shown.
5. **Given** active filters are applied, **When** the user clicks "Clear filters", **Then** all filters are removed and the full trace is restored.

---

### User Story 6 - Alternative Views (Priority: P3)

As an AR Admin, I can switch between Waterfall, Flame Graph, and Span List views to analyze the trace from different perspectives suited to different diagnostic needs.

**Why this priority**: The waterfall excels at showing timing and flow, but deeply nested filter executions are better visualized as a flame graph, and a tabular span list is better for searching and sorting by specific attributes.

**Independent Test**: Load a trace and switch from Waterfall to Flame Graph view. Verify the same data is displayed in a hierarchical flame graph format. Switch to Span List and verify all entries appear in a sortable, filterable table.

**Acceptance Scenarios**:

1. **Given** a loaded trace in Waterfall view, **When** the user switches to Flame Graph, **Then** the same spans are displayed as stacked horizontal rectangles showing the call hierarchy with widths proportional to duration.
2. **Given** a loaded trace in any view, **When** the user switches to Span List, **Then** all entries appear in a table with sortable columns: timestamp, log type, operation, duration, user, form, and status.
3. **Given** the user is in any view, **When** they click a span, **Then** the same detail sidebar opens regardless of the active view.
4. **Given** the user has applied filters, **When** they switch views, **Then** the same filters remain active in the new view.

---

### User Story 7 - Critical Path Analysis (Priority: P4)

As an AR Admin, I can see the critical path highlighted in the waterfall, showing which operations contributed to the total transaction latency versus which were concurrent or idle, so I can identify the true bottlenecks.

**Why this priority**: Total duration alone is misleading when operations run in parallel. Critical path analysis shows what actually caused the transaction to take as long as it did, enabling targeted optimization.

**Independent Test**: Load a trace where an API call triggers parallel filter executions. Verify the critical path is highlighted on the longest chain and non-critical parallel operations are visually distinguished.

**Acceptance Scenarios**:

1. **Given** a loaded trace, **When** the user enables "Show Critical Path", **Then** spans on the critical path (longest sequential chain contributing to total duration) are visually highlighted with a bold outline or distinct color.
2. **Given** a span on the critical path, **When** viewing its details, **Then** the sidebar shows the span's "contribution to total latency" as a percentage.
3. **Given** parallel operations within a trace, **When** critical path is shown, **Then** concurrent non-critical spans are visually dimmed to distinguish them from the bottleneck chain.

---

### User Story 8 - Trace Comparison (Priority: P4)

As an AR Admin, I can compare two traces side-by-side to identify why one transaction was slow compared to a similar normal transaction, seeing duration differences and anomalous spans highlighted.

**Why this priority**: Single-trace analysis is limited without a baseline. Comparing a slow trace to a normal one reveals exactly where the performance degraded.

**Independent Test**: Load two traces of the same operation type (e.g., both CreateEntry on the same form). Verify the comparison view shows both waterfalls aligned, with duration differences for each operation type highlighted and anomalous spans flagged.

**Acceptance Scenarios**:

1. **Given** a loaded trace, **When** the user clicks "Compare" and selects a second trace, **Then** both traces are displayed in a split-view with aligned operation types.
2. **Given** two traces in comparison view, **When** a span in trace B takes significantly longer than the equivalent span in trace A, **Then** the difference is highlighted with a color gradient and duration delta label.
3. **Given** two traces in comparison view, **When** the user clicks a span in either trace, **Then** the detail sidebar shows that span alongside its counterpart from the other trace (if one exists).

---

### User Story 9 - AI-Powered Trace Insights (Priority: P5)

As an AR Admin, I can request an AI analysis of the current trace that provides a natural-language explanation of what happened, identifies bottlenecks, and suggests optimizations.

**Why this priority**: AI analysis adds significant value for admins who may not be deeply familiar with AR Server internals, and can surface patterns that are difficult to spot manually. Prioritized last because it depends on all other features being solid.

**Independent Test**: Load a trace with a known performance issue (e.g., excessive filter executions). Click "Analyze with AI" and verify the response explains the issue in plain language, identifies the bottleneck, and suggests actionable remediation.

**Acceptance Scenarios**:

1. **Given** a loaded trace, **When** the user clicks "Analyze with AI", **Then** the trace data is sent for analysis and a natural-language summary appears explaining the transaction flow, key operations, and overall health.
2. **Given** a trace with a clear bottleneck (e.g., one SQL query taking 80% of total time), **When** the AI analysis completes, **Then** the response identifies the bottleneck and suggests possible causes and optimizations.
3. **Given** the AI analysis is loading, **When** the user waits, **Then** a streaming response appears progressively so the user can begin reading before analysis completes.
4. **Given** the AI service is unavailable, **When** the user clicks "Analyze with AI", **Then** a graceful error message appears with a suggestion to try again later, and the trace page remains fully functional.

---

### Edge Cases

- **Empty trace**: Trace ID exists but has 0 matching entries across all log types - show a clear "no entries found" message with suggestions (check job, check log types uploaded).
- **Very large trace**: Transaction with 1000+ spans - the waterfall must virtualize rendering to maintain smooth scrolling and not freeze the browser.
- **Missing correlation**: Entries that share a Thread ID but lack Trace/RPC IDs - show these as "possibly related" with lower confidence.
- **Mixed version logs**: Same analysis job contains logs from both pre-19.x (RPC ID) and 19.x+ (Trace ID) servers - handle gracefully with clear version indicators.
- **Concurrent transactions on same thread**: Thread ID reuse means multiple transactions may share a thread - ensure correlation uses Trace ID or RPC ID as primary, with Thread ID as supplementary.
- **Clock skew**: Entries from different log files may have slightly different timestamps for the same operation - the waterfall should handle minor ordering inconsistencies gracefully.
- **Single log type**: Trace where only one log type (e.g., only SQL) was uploaded - show available data with a notice that other log types were not included in the analysis.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST render a horizontal waterfall/Gantt chart showing all trace entries as time-proportional bars with parent-child nesting based on operation relationships.
- **FR-002**: System MUST color-code spans by log type using distinct, accessible colors for API, SQL, Filter, and Escalation entries.
- **FR-003**: System MUST visually highlight error spans (success=false) with a distinct color and icon distinguishable from successful spans.
- **FR-004**: System MUST display a fixed timestamp ruler at the top of the waterfall with millisecond precision.
- **FR-005**: System MUST support expand/collapse of nested span groups in the waterfall.
- **FR-006**: System MUST provide a detail sidebar that opens when any span is clicked, showing all type-specific fields.
- **FR-007**: System MUST display SQL query text with syntax highlighting in the detail sidebar for SQL spans.
- **FR-008**: System MUST support search by Trace ID, RPC ID, Thread ID, and User for transaction discovery.
- **FR-009**: System MUST maintain a list of recently viewed traces within the current session for quick re-access.
- **FR-010**: System MUST display a summary header with: Trace ID (copyable), user, total duration, span count by log type, and error count.
- **FR-011**: System MUST support filtering within a loaded trace by log type, error status, duration threshold, and text search.
- **FR-012**: System MUST provide a Flame Graph alternative view showing the same trace data in a hierarchical stacked visualization.
- **FR-013**: System MUST provide a Span List alternative view as a sortable, filterable table of all entries.
- **FR-014**: System MUST virtualize rendering for traces with 200+ spans to maintain smooth scrolling performance.
- **FR-015**: System MUST display a fallback warning banner when correlating entries by RPC ID instead of Trace ID (pre-AR 19.x).
- **FR-016**: System MUST provide a "View in Log Explorer" link from the detail sidebar that navigates to the specific entry.
- **FR-017**: System MUST support critical path highlighting showing which spans contributed to total transaction latency.
- **FR-018**: System MUST support side-by-side comparison of two traces with aligned operations and duration difference highlighting.
- **FR-019**: System MUST provide AI-powered trace analysis that returns a natural-language explanation of the transaction with bottleneck identification.
- **FR-020**: System MUST generate shareable permalink URLs for specific traces.
- **FR-021**: System MUST support export of trace data in JSON and CSV formats.
- **FR-022**: System MUST display breadcrumb navigation showing: Dashboard > Job > Trace.
- **FR-023**: System MUST preserve active filters when switching between Waterfall, Flame Graph, and Span List views.

### Key Entities

- **Trace**: A logical grouping of log entries that belong to the same user transaction, identified by a shared Trace ID (or RPC ID as fallback). Contains a collection of spans across one or more log types.
- **Span**: An individual log entry within a trace, representing a single operation (API call, SQL query, filter execution, or escalation). Has a type, timestamp, duration, parent relationship, and type-specific attributes.
- **Span Hierarchy**: The parent-child relationship between spans within a trace (e.g., an API call spawns filter executions, which in turn trigger SQL queries). Derived from correlation IDs and temporal ordering.
- **Critical Path**: The longest sequential chain of spans that determines the total trace duration. Spans not on the critical path could be removed or slowed without affecting total duration.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can identify the root cause of a slow transaction within 60 seconds of loading the trace, compared to manually scanning log files.
- **SC-002**: The waterfall visualization renders and becomes interactive within 2 seconds for traces containing up to 500 spans.
- **SC-003**: Users can switch between all three visualization modes (Waterfall, Flame Graph, Span List) within 1 second each.
- **SC-004**: 90% of AR admins can successfully find and load a transaction trace using the enhanced search within 3 attempts.
- **SC-005**: Users can filter a loaded trace down to relevant spans in under 5 seconds using in-trace filtering controls.
- **SC-006**: The trace page maintains smooth scrolling (no visible frame drops) for traces with up to 1000 spans.
- **SC-007**: AI-powered analysis provides actionable bottleneck identification for 80% of traces with clear performance issues.
- **SC-008**: Users report the trace comparison feature as "useful" or "very useful" for diagnosing performance regressions in 75% of cases.

## Assumptions

- The existing ClickHouse schema already contains `trace_id`, `rpc_id`, and `thread_id` fields indexed for fast lookup - no schema migration is needed for basic functionality.
- Parent-child relationships between spans are inferred using a **Temporal + Thread** strategy: spans sharing the same thread ID are nested based on temporal containment (a span whose start/end time fully contains another span's start/end time is its parent). The standard AR Server execution flow (API call triggers filters, filters trigger SQL queries) is used as a secondary signal when timestamps overlap. AR Server logs do not contain explicit parent span IDs.
- The existing `GET /analysis/{job_id}/trace/{trace_id}` endpoint returns all entries for a trace in chronological order, providing the raw data needed for waterfall construction.
- Filter phases (1/2/3) are available as fields in the parsed filter log entries and can be used to determine nesting depth.
- The platform already has an AI analysis endpoint pattern that can be extended for trace-specific analysis.
- Session-based "recent traces" storage is sufficient; cross-session persistence of recently viewed traces is not required for the initial release.
- Trace comparison will be limited to traces within the same analysis job (same log set) for the initial release.

## Dependencies

- **Log Explorer**: The "View in Log Explorer" navigation requires the Log Explorer to support deep-linking to specific entries by entry ID.
- **AI Analysis**: The AI-powered insights feature depends on the Claude API integration being available and configured.
- **Existing Trace Endpoint**: The backend already provides `GET /analysis/{job_id}/trace/{trace_id}` which returns all entries for a given trace. Additional endpoints may be needed for search-by-user and search-by-thread.

# Feature Specification: Complete Frontend Redesign

**Feature Branch**: `011-frontend-redesign`
**Created**: 2026-02-17
**Status**: Draft
**Input**: User description: "Complete Frontend Redesign for RemedyIQ - Replace the current frontend with a new, modern, production-grade UI built from scratch. New design informed by competitor research across 8 leading observability platforms."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Upload and Analyze Log Files (Priority: P1)

As a Remedy administrator, I want to upload AR Server log files and track the analysis progress in real time, so I can quickly begin investigating system behavior.

**Why this priority**: This is the entry point for all platform functionality. Without uploading and analyzing logs, no other feature has data to work with. This is the critical first-use experience that determines user retention.

**Independent Test**: Can be fully tested by uploading a sample log file, watching the progress tracker update in real time, and navigating to the completed analysis. Delivers value as a standalone upload-and-wait workflow.

**Acceptance Scenarios**:

1. **Given** I am on the upload page, **When** I drag and drop an AR Server log file onto the upload zone, **Then** the file is accepted, a progress indicator shows upload percentage, and the analysis begins automatically.
2. **Given** an analysis is in progress, **When** I view the job list, **Then** I see real-time progress updates (percentage, lines processed, current phase) without refreshing the page.
3. **Given** the analysis completes, **When** I return to the job list, **Then** the job shows as "Complete" with summary counts (API, SQL, Filter, Escalation entries) and I can navigate directly to the dashboard.
4. **Given** an analysis fails, **When** I view the job, **Then** I see a clear error message explaining the failure and an option to retry.
5. **Given** I am on a mobile device, **When** I access the upload page, **Then** I can select a file using the device file picker and the upload works correctly.

---

### User Story 2 - Explore Analysis Dashboard (Priority: P1)

As a Remedy administrator, I want to see a comprehensive dashboard of my log analysis results, so I can quickly understand system health, identify problem areas, and decide where to investigate further.

**Why this priority**: The dashboard is the primary landing page after analysis. It provides the "30-second overview" that determines whether the user needs to drill down further. This is the core value proposition of the product.

**Independent Test**: Can be tested by loading a completed analysis and verifying all dashboard sections render correctly with real data. Delivers value as a standalone health overview.

**Acceptance Scenarios**:

1. **Given** I navigate to a completed analysis, **When** the dashboard loads, **Then** I see a health score, summary statistics (total entries, error rate, average response time), and key charts within 2 seconds.
2. **Given** the dashboard is displayed, **When** I look at the stats cards, **Then** I see counts broken down by log type (API, SQL, Filter, Escalation) with trend indicators.
3. **Given** the dashboard shows collapsible sections (aggregates, exceptions, gaps, threads, filters), **When** I expand a section, **Then** it loads its detailed data on demand without slowing the initial page load.
4. **Given** I want to investigate a specific metric, **When** I click on a chart element or table row, **Then** I am navigated to the relevant log explorer or trace view pre-filtered to that context.
5. **Given** I am viewing the dashboard, **When** I click "Generate Report", **Then** a downloadable report is produced summarizing the analysis.
6. **Given** I switch between light and dark mode, **When** the dashboard re-renders, **Then** all charts, cards, and data visualizations are legible and properly themed.

---

### User Story 3 - Search and Explore Log Entries (Priority: P1)

As a Remedy administrator, I want to search, filter, and browse through individual log entries, so I can find specific events, trace errors, and understand system behavior at a granular level.

**Why this priority**: Log exploration is the core investigative workflow. Every observability platform centers on this. Users spend the majority of their time here when troubleshooting issues.

**Independent Test**: Can be tested by running a search query against an analyzed job and verifying results appear, filters work, and individual entries can be inspected. Delivers value as a standalone search-and-investigate tool.

**Acceptance Scenarios**:

1. **Given** I open the log explorer for a job, **When** I type a search query (e.g., "duration_ms:>1000 AND log_type:API"), **Then** matching results appear in the table within 1 second with matching terms highlighted.
2. **Given** search results are displayed, **When** I scroll through the virtualized table, **Then** scrolling remains smooth (60 FPS) even with 10,000+ results.
3. **Given** I am searching, **When** I begin typing a field name in the search bar, **Then** I see autocomplete suggestions for available fields and their top values.
4. **Given** results are displayed, **When** I click on a log entry row, **Then** a detail panel opens showing the full entry with all fields, raw text, and contextual entries (before/after).
5. **Given** I have applied multiple filters, **When** I look at the active filters area, **Then** I see each filter as a removable badge, and I can clear all filters with one action.
6. **Given** I want to save a useful search, **When** I click "Save Search", **Then** I can name it and find it later in my saved searches list.
7. **Given** I want the data externally, **When** I click "Export", **Then** I can download results as CSV or JSON.
8. **Given** a timeline histogram is displayed above the table, **When** I look at it, **Then** I see the distribution of log entries over time, color-coded by severity or log type.

---

### User Story 4 - Visualize Transaction Traces (Priority: P2)

As a Remedy administrator, I want to see the execution flow of a single transaction as a waterfall diagram, so I can identify bottlenecks, errors, and understand the call hierarchy across API, SQL, Filter, and Escalation layers.

**Why this priority**: Trace visualization is essential for performance troubleshooting but requires log exploration to be functional first. It provides the "why is this slow?" answer that the dashboard flags.

**Independent Test**: Can be tested by searching for a trace ID, loading the waterfall view, and verifying spans are displayed hierarchically with correct timing. Delivers value as a standalone transaction inspector.

**Acceptance Scenarios**:

1. **Given** I search for or select a trace, **When** the waterfall loads, **Then** I see a hierarchical view of spans with indentation showing parent-child relationships, duration bars showing relative timing, and color-coding by log type.
2. **Given** the waterfall is displayed, **When** I click on a span, **Then** a detail sidebar opens showing all span metadata (user, form, operation, duration, errors, raw fields).
3. **Given** a trace has a critical path, **When** I toggle "Show Critical Path", **Then** the longest execution path is visually highlighted across the waterfall.
4. **Given** I want a different perspective, **When** I switch between Waterfall, Flame Graph, and Span List views, **Then** each view renders the same trace data in the corresponding format.
5. **Given** I want to find specific spans, **When** I use the trace filters (log type, minimum duration, errors only, text search), **Then** non-matching spans are dimmed or hidden.
6. **Given** I want to compare two traces, **When** I select traces for comparison, **Then** they are displayed side-by-side with differences highlighted.

---

### User Story 5 - Interact with AI Assistant (Priority: P2)

As a Remedy administrator, I want to ask natural language questions about my log analysis and receive intelligent, streamed answers, so I can get insights without manually querying or navigating the data.

**Why this priority**: AI assistance differentiates RemedyIQ from competitors and reduces the expertise required to interpret AR Server logs. However, it depends on having analysis data available first.

**Independent Test**: Can be tested by opening the AI assistant, typing a question about a completed analysis, and verifying a streamed response appears with relevant insights. Delivers value as a standalone conversational analysis tool.

**Acceptance Scenarios**:

1. **Given** I open the AI assistant for a completed analysis, **When** I type a question like "What are the slowest API calls?", **Then** a response streams token-by-token with relevant analysis and formatted markdown.
2. **Given** a response has been delivered, **When** I look below the response, **Then** I see follow-up question suggestions that I can click to continue the conversation.
3. **Given** I want to focus on a specific type of analysis, **When** I select a skill (Performance, Root Cause, Error Explainer, Anomaly Narrator, Summarizer), **Then** the AI routes my next question through that specialized skill.
4. **Given** I have an ongoing conversation, **When** I leave and return later, **Then** my conversation history is preserved and I can continue from where I left off.
5. **Given** I want to start fresh, **When** I click "New Conversation", **Then** a new conversation is created while previous ones remain accessible in the sidebar.
6. **Given** the AI is generating a response, **When** I click "Stop", **Then** the streaming stops immediately and the partial response is displayed.

---

### User Story 6 - Navigate with Persistent Sidebar (Priority: P1)

As a user, I want a consistent navigation experience with a persistent sidebar, breadcrumbs, and keyboard shortcuts, so I can move between features quickly and always know where I am in the application.

**Why this priority**: Navigation is the skeleton of the entire application. Every other feature depends on users being able to find and reach it. Poor navigation makes even great features undiscoverable.

**Independent Test**: Can be tested by navigating between all pages via sidebar links, verifying breadcrumbs update correctly, and testing keyboard shortcuts. Delivers value as the foundational interaction model.

**Acceptance Scenarios**:

1. **Given** I am on any page, **When** I look at the left sidebar, **Then** I see navigation links for all major features (Upload, Dashboard/Analyses, Log Explorer, Traces, AI Assistant) with the current page highlighted.
2. **Given** I am on a desktop screen, **When** I view the layout, **Then** the sidebar is always visible alongside the main content area.
3. **Given** I am on a mobile device, **When** I tap the menu button, **Then** the sidebar slides in as an overlay and closes when I select a page or tap outside.
4. **Given** I am anywhere in the app, **When** I press the command palette shortcut, **Then** a search dialog opens where I can type to quickly navigate to any page or feature.
5. **Given** I am deep in a workflow (e.g., viewing a trace within an analysis), **When** I look at the breadcrumbs, **Then** I see my full navigation path and can click any ancestor to jump back.
6. **Given** I prefer dark mode, **When** I toggle the theme, **Then** the entire application switches smoothly with no flicker or unstyled content flash.

---

### User Story 7 - Manage Analysis Jobs (Priority: P2)

As a Remedy administrator, I want to view, manage, and revisit all my past analysis jobs, so I can compare results over time and re-investigate previously analyzed logs.

**Why this priority**: Job management supports repeat usage and long-term value. Users need to return to previous analyses without re-uploading files.

**Independent Test**: Can be tested by viewing the job list, filtering by status, and navigating to a past analysis. Delivers value as a standalone job history browser.

**Acceptance Scenarios**:

1. **Given** I navigate to the analyses page, **When** it loads, **Then** I see a list of all my analysis jobs sorted by most recent, showing status, file name, creation date, and entry counts.
2. **Given** the job list is displayed, **When** I filter by status (completed, in progress, failed), **Then** only matching jobs are shown.
3. **Given** I click on a completed job, **When** the page loads, **Then** I am taken to the analysis dashboard for that job with all data available.

---

### Edge Cases

- What happens when a user uploads a file that is not a valid AR Server log? The system must reject it with a clear message explaining supported formats.
- What happens when the backend is unreachable? All pages must show a user-friendly error state with retry functionality, not blank screens or raw error messages.
- What happens when a search returns zero results? The log explorer must show an empty state with suggestions (broaden filters, check time range, try different query).
- What happens when WebSocket connection drops during job progress tracking? The UI must detect disconnection, show a reconnecting indicator, and automatically resume progress updates.
- What happens when the user's session expires? The application must redirect to sign-in with a message, preserving the intended destination for after re-authentication.
- What happens when the browser window is resized from desktop to mobile? The layout must reflow smoothly without breaking functionality or losing user state (search queries, scroll position, expanded panels).
- What happens when a user has no completed analyses? Each page that requires an analysis must show an appropriate empty state guiding the user to upload first.

## Clarifications

### Session 2026-02-17

- Q: What features are explicitly out of scope for V1? → A: Explicitly excluded from V1: real-time log tailing (live tail), email/push notifications, multi-language internationalization (i18n), offline mode, user role management/RBAC admin UI, custom dashboard builder (drag-and-drop widget placement), and collaborative annotations/comments on log entries.
- Q: What is the frontend error monitoring and observability strategy? → A: V1 uses React error boundaries to catch and display component-level errors with user-friendly fallback UI, plus Sonner toast notifications for transient errors (network failures, API timeouts). No external error tracking service (e.g., Sentry) in V1; console errors are captured in automated tests via SC-014. External error tracking is deferred to post-V1.
- Q: What is the frontend security posture beyond Clerk authentication? → A: Clerk handles all authentication and session management. The frontend stores no sensitive data in localStorage/sessionStorage beyond Clerk's own session tokens. All API calls include Clerk auth tokens via middleware. Content Security Policy (CSP) headers are configured to prevent XSS. The frontend never handles raw credentials — Clerk's hosted sign-in/sign-up UI is used exclusively.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide a persistent sidebar navigation on desktop and a collapsible drawer on mobile, with links to all major features.
- **FR-002**: The system MUST support dark and light themes with smooth transitions, defaulting to the user's system preference and persisting the choice.
- **FR-003**: Users MUST be able to upload log files via drag-and-drop or file picker, with visual progress feedback during upload.
- **FR-004**: The system MUST display real-time analysis progress (percentage, phase, lines processed) using WebSocket updates without page refresh.
- **FR-005**: The system MUST render an analysis dashboard with health score, summary statistics, time series charts, distribution charts, and top-N tables.
- **FR-006**: Dashboard sections (aggregates, exceptions, gaps, threads, filters) MUST load lazily on demand when expanded.
- **FR-007**: The system MUST provide a log explorer with a search bar supporting structured query syntax with field autocomplete.
- **FR-008**: The log table MUST support virtualized scrolling for datasets of 10,000+ entries while maintaining smooth scroll performance.
- **FR-009**: Users MUST be able to filter log entries by log type, user, form, queue, time range, error status, and duration threshold.
- **FR-010**: The system MUST display a detail panel showing full entry information including all fields, raw text, and contextual entries.
- **FR-011**: Users MUST be able to save, name, and reload search queries for reuse.
- **FR-012**: Users MUST be able to export search results and trace data as CSV or JSON.
- **FR-013**: The system MUST render a trace waterfall diagram showing hierarchical span relationships with duration bars and log-type color coding.
- **FR-014**: The trace viewer MUST support switching between waterfall, flame graph, and span list views.
- **FR-015**: The system MUST highlight the critical path through a trace when enabled.
- **FR-016**: Users MUST be able to search for traces by trace ID, RPC ID, user, or thread ID.
- **FR-017**: The system MUST provide an AI chat interface that streams responses token-by-token using server-sent events.
- **FR-018**: The AI assistant MUST support skill selection (Performance, Root Cause, Error Explainer, Anomaly Narrator, Summarizer) with auto-routing based on query content.
- **FR-019**: The system MUST persist AI conversation history per analysis job, allowing users to revisit past conversations.
- **FR-020**: The system MUST provide a command palette (keyboard shortcut activated) for quick navigation to any feature or page.
- **FR-021**: All pages MUST display breadcrumb navigation showing the user's current location in the hierarchy.
- **FR-022**: The system MUST be fully functional on screens from 375px width (mobile) through 2560px (ultra-wide desktop).
- **FR-023**: All interactive elements MUST be keyboard accessible with visible focus indicators.
- **FR-024**: The system MUST meet WCAG 2.1 Level AA accessibility standards including 4.5:1 color contrast ratios.
- **FR-025**: The system MUST display appropriate loading states (skeleton screens), empty states (guidance messages), and error states (retry actions) for all data-driven views.
- **FR-026**: The system MUST authenticate users via the existing authentication provider, with a dev mode that bypasses auth for local development.
- **FR-027**: The system MUST render a timeline histogram in the log explorer showing entry distribution over time.
- **FR-028**: The system MUST support trace comparison displaying two traces side-by-side.
- **FR-029**: The system MUST display follow-up question suggestions after AI responses that users can click to continue the conversation.
- **FR-030**: The system MUST provide a downloadable analysis report from the dashboard.
- **FR-031**: The system MUST use React error boundaries to catch component-level errors and display user-friendly fallback UI instead of white screens.
- **FR-032**: The system MUST display transient errors (network failures, API timeouts) as dismissible toast notifications without disrupting the current workflow.
- **FR-033**: The system MUST enforce Content Security Policy (CSP) headers to prevent cross-site scripting attacks.
- **FR-034**: The system MUST NOT store sensitive data in browser storage beyond the authentication provider's own session tokens.

### Key Entities

- **Analysis Job**: Represents a single log file analysis. Has a lifecycle (queued, parsing, analyzing, storing, complete, failed), associated log file, progress metrics, and result counts per log type.
- **Log Entry**: A single parsed line from an AR Server log. Belongs to a job. Has type (API, SQL, Filter, Escalation), timestamp, duration, user, form, trace ID, and type-specific fields.
- **Trace/Transaction**: A correlated group of log entries sharing a trace ID or RPC ID. Has a hierarchical span structure, total duration, span count, and error count.
- **Conversation**: An AI chat session tied to a specific analysis job. Contains an ordered sequence of messages between user and assistant.
- **Message**: A single exchange in a conversation. Has role (user or assistant), content, optional skill name, follow-up suggestions, and metadata (tokens used, latency).
- **Saved Search**: A named, reusable search query with associated filters, tied to a user.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can upload a log file and see analysis begin within 5 seconds of the upload completing.
- **SC-002**: The analysis dashboard renders all above-the-fold content (health score, stats cards, primary chart) within 2 seconds of navigation.
- **SC-003**: Log explorer search queries return paginated results within 1 second for datasets up to 1 million entries.
- **SC-004**: Users can scroll through 10,000+ log entries without perceptible lag or frame drops.
- **SC-005**: The trace waterfall renders hierarchically correct span trees for traces with up to 500 spans within 1 second.
- **SC-006**: AI assistant responses begin streaming (first token visible) within 2 seconds of submitting a question.
- **SC-007**: Navigation between any two pages completes within 500 milliseconds.
- **SC-008**: The application achieves a Lighthouse performance score of 90 or higher.
- **SC-009**: All pages are fully usable on a 375px-wide screen without horizontal scrolling or overlapping elements.
- **SC-010**: 100% of interactive elements are reachable and operable via keyboard alone.
- **SC-011**: The application passes WCAG 2.1 Level AA automated audit with zero violations.
- **SC-012**: Theme switching (dark/light) completes without visible flicker or unstyled content flash.
- **SC-013**: Automated test coverage reaches 80% or higher across all frontend source files.
- **SC-014**: Zero unhandled errors appear in the browser console during normal usage flows.

### Out of Scope (V1)

- Real-time log tailing (live tail streaming)
- Email or push notifications
- Multi-language internationalization (i18n)
- Offline mode or service worker caching
- User role management / RBAC administration UI
- Custom dashboard builder (drag-and-drop widget placement)
- Collaborative annotations or comments on log entries
- External error tracking service integration (e.g., Sentry)

### Assumptions

- The existing Go backend API is stable and will not require breaking changes during frontend development.
- The backend already provides all endpoints needed for the features described (upload, jobs, dashboard, search, traces, AI streaming, conversations).
- Clerk authentication is pre-configured and available for the frontend to consume.
- The development team has access to the Docker-based local dev environment with all services (PostgreSQL, ClickHouse, NATS, Redis, MinIO) running.
- The WebSocket and SSE protocols are implemented and tested on the backend.
- The existing API response formats and data models documented in the OpenAPI spec and backend code are the contract the new frontend will consume.

### Dependencies

- Go backend API server running at localhost:8080
- Docker infrastructure (PostgreSQL, ClickHouse, Redis, NATS, MinIO)
- Clerk authentication service (optional in dev mode)
- Google Gemini API key for AI assistant functionality

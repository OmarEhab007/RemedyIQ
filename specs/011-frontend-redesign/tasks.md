# Tasks: Complete Frontend Redesign

**Input**: Design documents from `/specs/011-frontend-redesign/`
**Prerequisites**: plan.md (required), spec.md (required for user stories)

**Tests**: Tests are REQUIRED — spec mandates 80% coverage (SC-013).

**Organization**: Tasks grouped by user story priority. Phase 1 (Setup) and Phase 2 (Foundation) must complete before any user story work begins.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US7)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization, dependency installation, configuration

- [X] T001 Clear existing `frontend/src/` directory contents and reset to clean state. Keep `package.json`, `tsconfig.json`, `next.config.ts`, `vitest.config.ts`, `components.json` for updating in place.
- [X] T002 Update `frontend/package.json` — add missing dependencies: `@tanstack/react-query`, `zustand`, `sonner`, `cmdk` (command palette). Verify all existing deps are current. Run `npm install`.
- [X] T003 [P] Update `frontend/tsconfig.json` — ensure `strict: true`, path aliases `@/*` → `./src/*`, and all required type packages.
- [X] T004 [P] Update `frontend/next.config.ts` — configure image optimization, CSP headers via `headers()`, and any required experimental flags.
- [X] T005 [P] Update `frontend/vitest.config.ts` — configure coverage thresholds (80% branches/lines/functions/statements), setup files, test environment.
- [X] T006 [P] Update `frontend/components.json` — shadcn/ui New York style, custom color scheme referencing CSS variables.

---

## Phase 2: Foundation (Blocking Prerequisites)

**Purpose**: Design system, shared components, API layer, providers — BLOCKS all user story work

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Design System

- [X] T007 Create `frontend/src/app/globals.css` — define all CSS custom properties (color tokens for light and dark modes per plan.md design system), Tailwind CSS 4 imports, font stacks (system + monospace), base styles. Reference `docs/frontend-design-components.md` for exact color hex values.
- [X] T008 [P] Create `frontend/src/app/layout.tsx` — root layout with `<html>` dark class toggling, Clerk provider (`<ClerkProvider>`), QueryProvider, ThemeProvider, Sonner `<Toaster>`, viewport meta for mobile.
- [X] T009 [P] Create `frontend/src/providers/theme-provider.tsx` — theme context that reads `localStorage` preference, falls back to `prefers-color-scheme`, toggles `.dark` class on `<html>`. Include inline `<script>` to prevent FOUC.
- [X] T010 [P] Create `frontend/src/providers/query-provider.tsx` — TanStack `QueryClientProvider` with sensible defaults (staleTime, gcTime, retry config).
- [X] T011 [P] Create `frontend/src/stores/theme-store.ts` — Zustand store: `theme: 'light' | 'dark' | 'system'`, `setTheme()`, `resolvedTheme` computed.

### Shared UI Components (shadcn/ui)

- [X] T012 Install/update shadcn/ui components — run `npx shadcn@latest add button card input label dialog dropdown-menu badge tabs sheet table select popover command tooltip separator scroll-area skeleton switch avatar`. Verify all land in `frontend/src/components/ui/`.
- [X] T013 [P] Create `frontend/src/components/ui/page-state.tsx` — unified component for loading (skeleton), empty (icon + message + CTA), and error (message + retry button) states. Used by all pages.
- [X] T014 [P] Create `frontend/src/components/shared/error-boundary.tsx` — React error boundary class component. Catches component-level errors, displays fallback UI with error message and "Try Again" button. Logs to console (FR-031).

### API Layer

- [X] T015 Create `frontend/src/lib/api-types.ts` — extract all TypeScript interfaces from current `api.ts` into dedicated types file. Add missing types: `Conversation`, `Message`, `AIStreamEvent`, `SavedSearch`, `SearchHistoryEntry`, `Pagination`, `HealthScore`, `HealthScoreFactor`. Mirror Go `domain/models.go` exactly.
- [X] T016 Create `frontend/src/lib/api.ts` — API client with `apiFetch()` base function, auth token injection (Clerk `getToken()` in prod, dev mode headers), `ApiError` class, all 35 endpoint functions from plan.md API contract table.
- [X] T017 [P] Create `frontend/src/lib/websocket.ts` — WebSocket client class: connect to `/api/v1/ws`, auto-reconnect with exponential backoff (1s→2s→4s→...→30s max), typed message envelopes (`ClientMessage`, `ServerMessage`), subscription methods for `subscribe_job_progress` / `unsubscribe_job_progress`.
- [X] T018 [P] Create `frontend/src/lib/sse.ts` — SSE client for AI streaming: POST to `/api/v1/ai/stream`, parse `data:` lines, emit typed events (`token`, `done`, `error`, `follow_ups`), abort controller for cancel.
- [X] T019 [P] Create `frontend/src/lib/utils.ts` — utility functions: `cn()` (clsx + tailwind-merge), `formatDate()`, `formatDuration()`, `formatBytes()`, `formatNumber()`, `truncate()`.
- [X] T020 [P] Create `frontend/src/lib/constants.ts` — route paths (e.g., `ROUTES.UPLOAD`, `ROUTES.ANALYSIS`), log type colors map, keyboard shortcuts map, WebSocket message types.

### Hooks

- [X] T021 Create `frontend/src/hooks/use-api.ts` — TanStack Query hooks wrapping all API functions: `useAnalyses()`, `useAnalysis(id)`, `useDashboard(jobId)`, `useSearchLogs(jobId, params)`, `useWaterfall(jobId, traceId)`, `useConversations(jobId)`, `useAISkills()`, `useSavedSearches()`, etc. Include mutation hooks for `useCreateAnalysis()`, `useUploadFile()`, `useSaveSearch()`, `useDeleteSearch()`, `useCreateConversation()`.
- [X] T022 [P] Create `frontend/src/hooks/use-websocket.ts` — hook that manages WebSocket connection lifecycle, provides `subscribeToJob(jobId)`, `unsubscribeFromJob(jobId)`, `onJobProgress(callback)`, `onJobComplete(callback)`, `connectionStatus` state.
- [X] T023 [P] Create `frontend/src/hooks/use-theme.ts` — hook wrapping Zustand theme store: `theme`, `setTheme()`, `resolvedTheme`, `toggleTheme()`.
- [X] T024 [P] Create `frontend/src/hooks/use-keyboard.ts` — keyboard shortcut registration hook. Supports single keys and combos (Cmd+K, Escape). Uses `useEffect` cleanup for listeners.
- [X] T025 [P] Create `frontend/src/hooks/use-debounce.ts` — generic debounce hook for search inputs (300ms default).

### Foundation Tests

- [X] T026 [P] Test `frontend/src/lib/api.ts` — unit tests for `apiFetch`, `ApiError`, auth header injection, dev mode headers. Mock fetch.
- [X] T027 [P] Test `frontend/src/lib/websocket.ts` — unit tests for connect, reconnect, subscribe/unsubscribe, message parsing. Mock WebSocket.
- [X] T028 [P] Test `frontend/src/components/shared/error-boundary.tsx` — test error catching, fallback rendering, retry behavior.
- [X] T029 [P] Test `frontend/src/providers/theme-provider.tsx` — test theme toggle, localStorage persistence, system preference fallback.

**Checkpoint**: Foundation ready — API client, WebSocket, SSE, design tokens, shared components all in place. User story implementation can now begin.

---

## Phase 3: User Story 6 — Navigate with Persistent Sidebar (Priority: P1) 🎯 MVP

**Goal**: Sidebar navigation, breadcrumbs, command palette, responsive layout — skeleton for all pages

**Independent Test**: Navigate between all pages via sidebar, verify breadcrumbs, test keyboard shortcuts, verify theme toggle

### Implementation

- [X] T030 Create `frontend/src/components/layout/sidebar.tsx` — persistent sidebar (w-64) with: logo, nav groups (Core: Upload, Analyses, Explorer, Traces, AI), bottom section (Settings, Help). Active page highlighting. Collapsible on mobile via Sheet component. Keyboard-navigable with arrow keys.
- [X] T031 [P] Create `frontend/src/components/layout/mobile-sidebar.tsx` — mobile drawer sidebar using shadcn Sheet. Opens via hamburger menu button, closes on nav selection or outside tap.
- [X] T032 Create `frontend/src/components/layout/breadcrumb.tsx` — dynamic breadcrumb component. Reads route segments, maps to labels. Renders clickable ancestors + non-linked current page. Collapses on mobile if too long.
- [X] T033 [P] Create `frontend/src/components/layout/page-header.tsx` — page title, description, and action buttons area. Responsive (stacks on mobile).
- [X] T034 Create `frontend/src/components/layout/command-palette.tsx` — Cmd+K dialog using `cmdk` library. Searches pages (Upload, Analyses, Explorer, Traces, AI), recent analyses, and actions (toggle theme, new upload). Opens/closes with Cmd+K keyboard shortcut.
- [X] T035 Create `frontend/src/components/layout/theme-toggle.tsx` — button in sidebar footer that toggles dark/light mode. Uses `useTheme()` hook. Smooth transition (200ms), no FOUC.
- [X] T036 Create `frontend/src/app/(dashboard)/layout.tsx` — dashboard layout: sidebar + main content area. Desktop: sidebar always visible + scrollable main. Mobile: hamburger button + overlay sidebar. Wraps children with ErrorBoundary. Includes breadcrumb bar above content.
- [X] T037 Create `frontend/src/app/(dashboard)/page.tsx` — root dashboard page. Redirects to `/analysis` (job list) if analyses exist, or `/upload` if none.
- [X] T038 Create `frontend/src/app/not-found.tsx` — 404 page with illustration, message, and "Go Home" button.

### Tests

- [X] T039 [P] [US6] Test `sidebar.tsx` — render, nav links present, active state highlighting, keyboard navigation.
- [X] T040 [P] [US6] Test `breadcrumb.tsx` — correct path segments, clickable ancestors, current page non-clickable.
- [X] T041 [P] [US6] Test `command-palette.tsx` — opens on Cmd+K, search filters results, selection navigates.
- [X] T042 [P] [US6] Test `layout.tsx` (dashboard) — sidebar visible on desktop, hidden on mobile, responsive breakpoints.

**Checkpoint**: Navigation skeleton complete. All subsequent pages render within this layout.

---

## Phase 4: User Story 1 — Upload and Analyze Log Files (Priority: P1) 🎯 MVP

**Goal**: Drag-drop upload, real-time job progress via WebSocket, job queue display

**Independent Test**: Upload a log file, watch progress update in real time, see job complete with summary counts

### Implementation

- [X] T043 Create `frontend/src/components/upload/drop-zone.tsx` — drag-and-drop file upload area. Accepts AR Server log files. Visual feedback on drag enter/over/leave. Also supports click-to-browse via file picker. Shows file name + size after selection. Upload progress bar during transfer (XHR with onprogress).
- [X] T044 Create `frontend/src/components/upload/upload-progress.tsx` — progress indicator for active upload: upload percentage bar, then analysis phase indicator (queued → parsing → analyzing → storing → complete/failed). Uses WebSocket subscription for real-time updates.
- [X] T045 Create `frontend/src/components/upload/job-queue.tsx` — list of all jobs (recent first). Each row: file name, status badge (color-coded), progress %, creation date, entry counts (API/SQL/FLTR/ESCL). Click navigates to dashboard. Failed jobs show error message + retry button.
- [X] T046 Create `frontend/src/app/(dashboard)/upload/page.tsx` — upload page combining DropZone + JobQueue. Two-section layout: upload area at top, job list below. Auto-refreshes job list on new upload or job status change.
- [X] T047 Create `frontend/src/stores/upload-store.ts` — Zustand store for upload state: `activeUploads` (map of fileId → progress), `addUpload()`, `updateProgress()`, `removeUpload()`.

### Tests

- [X] T048 [P] [US1] Test `drop-zone.tsx` — drag enter/leave styling, file selection, upload trigger, progress callback.
- [X] T049 [P] [US1] Test `upload-progress.tsx` — renders correct phase for each JobStatus, progress bar width, error display.
- [X] T050 [P] [US1] Test `job-queue.tsx` — renders job list, status badges, click navigation, empty state.
- [X] T051 [P] [US1] Test `upload/page.tsx` — full page render, upload flow integration, WebSocket subscription.

**Checkpoint**: Users can upload files and monitor analysis progress in real time.

---

## Phase 5: User Story 2 — Explore Analysis Dashboard (Priority: P1) 🎯 MVP

**Goal**: Full dashboard with health score, stats, charts, collapsible sections, report generation

**Independent Test**: Navigate to a completed analysis, verify all sections render with correct data

### Implementation

- [X] T052 Create `frontend/src/components/dashboard/health-score-card.tsx` — large card showing overall health score (0-100), status text (Healthy/Degraded/Critical), factor breakdown list. Color-coded (green/amber/red).
- [X] T053 [P] Create `frontend/src/components/dashboard/stats-cards.tsx` — row of 4-6 stat cards: total entries, API count, SQL count, Filter count, Escalation count, error rate. Each card shows count + log type color indicator.
- [X] T054 [P] Create `frontend/src/components/dashboard/time-series-chart.tsx` — Recharts ResponsiveContainer with line/area chart. X-axis: timestamps, Y-axis: counts. Series per log type (color-coded). Tooltip on hover. Themed for dark/light mode.
- [X] T055 [P] Create `frontend/src/components/dashboard/distribution-chart.tsx` — bar chart showing log type distribution. Interactive (click bar → drill down to explorer).
- [X] T056 [P] Create `frontend/src/components/dashboard/top-n-table.tsx` — sortable table for top API calls / SQL / Filters / Escalations. Columns: rank, identifier, duration, user, form, trace link. Click row → navigate to trace or explorer.
- [X] T057 Create `frontend/src/components/dashboard/collapsible-section.tsx` — expandable/collapsible section wrapper. Lazy-loads data on first expand. Shows loading skeleton while fetching. Sections: Aggregates, Exceptions, Gaps, Threads, Filters.
- [X] T058 Create `frontend/src/components/dashboard/aggregates-section.tsx` — renders AggregatesResponse data. Tables grouped by API/SQL/Filter with operation breakdowns.
- [X] T059 [P] Create `frontend/src/components/dashboard/exceptions-section.tsx` — renders ExceptionsResponse. Error table with code, message, count, first/last seen. Click → explorer filtered to that error.
- [X] T060 [P] Create `frontend/src/components/dashboard/gaps-section.tsx` — renders GapsResponse. Gap list with duration, surrounding line numbers, queue health table.
- [X] T061 [P] Create `frontend/src/components/dashboard/threads-section.tsx` — renders ThreadStatsResponse. Thread table with busy%, call counts, active time range.
- [X] T062 [P] Create `frontend/src/components/dashboard/filters-section.tsx` — renders FilterComplexityResponse. Most executed filters, per-transaction filter counts.
- [X] T063 Create `frontend/src/components/dashboard/report-button.tsx` — "Generate Report" button. Calls `POST /analysis/{id}/report`, shows loading state, then triggers download of HTML report content.
- [X] T064 Create `frontend/src/app/(dashboard)/analysis/[id]/page.tsx` — dashboard page. Fetches dashboard data via `useDashboard(jobId)`. Responsive grid layout: health score + stats (top row), time series (full width), distribution + top-N (2-col), collapsible sections below. Breadcrumb: Analyses > {job filename}.

### Tests

- [X] T065 [P] [US2] Test `health-score-card.tsx` — renders score, correct color for status, factor list.
- [X] T066 [P] [US2] Test `stats-cards.tsx` — renders all stat values, correct formatting.
- [X] T067 [P] [US2] Test `time-series-chart.tsx` — renders chart, responds to theme changes.
- [X] T068 [P] [US2] Test `collapsible-section.tsx` — expand/collapse, lazy data loading, loading state.
- [X] T069 [P] [US2] Test `analysis/[id]/page.tsx` — full page render with mock data, section layout.

**Checkpoint**: Dashboard displays comprehensive analysis results with drill-down navigation.

---

## Phase 6: User Story 7 — Manage Analysis Jobs (Priority: P2)

**Goal**: Job list with status filtering, navigation to dashboards

**Independent Test**: View job list, filter by status, navigate to a past analysis

### Implementation

- [X] T070 Create `frontend/src/app/(dashboard)/analysis/page.tsx` — analysis list page. Table of all jobs: filename, status badge, created date, entry counts (API/SQL/FLTR/ESCL), duration. Sort by most recent. Status filter buttons (All, Completed, In Progress, Failed). Click row → navigate to `/analysis/{id}`.
- [X] T071 [P] Create `frontend/src/components/dashboard/job-status-badge.tsx` — reusable status badge component. Maps JobStatus → color + label (queued=gray, parsing=blue, analyzing=blue, storing=blue, complete=green, failed=red).

### Tests

- [X] T072 [P] [US7] Test `analysis/page.tsx` — renders job list, status filter works, navigation on click.
- [X] T073 [P] [US7] Test `job-status-badge.tsx` — correct color/label for each status.

**Checkpoint**: Users can browse and manage all analysis jobs.

---

## Phase 7: User Story 3 — Search and Explore Log Entries (Priority: P1) 🎯 MVP

**Goal**: KQL search, filters, virtualized table, timeline, detail panel, saved searches, export

**Independent Test**: Search logs, apply filters, scroll 10K+ rows, inspect detail panel, save a search

### Implementation

- [X] T074 Create `frontend/src/stores/explorer-store.ts` — Zustand store: `query` (string), `filters` (active filter badges), `selectedEntry` (LogEntry | null), `timeRange`, `setQuery()`, `addFilter()`, `removeFilter()`, `clearFilters()`, `selectEntry()`.
- [X] T075 Create `frontend/src/components/explorer/search-bar.tsx` — search input with KQL syntax support. Autocomplete dropdown (from `/search/autocomplete`). Shows field names and top values as suggestions. Debounced (300ms). Submit on Enter.
- [X] T076 Create `frontend/src/components/explorer/filter-panel.tsx` — faceted filter UI. Filter by: log type (API/SQL/FLTR/ESCL checkboxes), user (text input), form (text input), queue (dropdown), time range (date pickers), error status (toggle), duration threshold (min/max inputs). Active filters shown as removable badges. "Clear All" button.
- [X] T077 Create `frontend/src/components/explorer/log-table.tsx` — virtualized table using `react-window` `FixedSizeList`. Row height: 44px. Columns: timestamp (monospace), log type (color badge), identifier/message (monospace, truncated), user, duration, status (success/error icon). Sortable column headers. Click row → select entry → open detail panel. Highlight matching search terms.
- [X] T078 Create `frontend/src/components/explorer/timeline-histogram.tsx` — bar chart above log table. Shows distribution of entries over time buckets. Color-coded by log type or severity. Clickable bars to zoom into time range.
- [X] T079 Create `frontend/src/components/explorer/detail-panel.tsx` — right-side panel (60/40 split on desktop, modal on mobile). Shows selected log entry: all fields in key-value pairs, raw text (monospace, scrollable), contextual entries (before/after via `/entries/{id}/context`). Copy button, close button, navigate to trace link.
- [X] T080 Create `frontend/src/components/explorer/saved-searches.tsx` — dropdown/panel showing saved searches list. "Save Current Search" button opens name input dialog. Load saved search → restores query + filters. Delete saved search. Uses `useSavedSearches()` and `useSaveSearch()` hooks.
- [X] T081 Create `frontend/src/components/explorer/export-button.tsx` — export dropdown: CSV or JSON format. Calls `/search/export` endpoint. Shows loading toast during export, success/error toast on completion.
- [X] T082 Create `frontend/src/app/(dashboard)/analysis/[id]/explorer/page.tsx` — job-scoped log explorer page. Composes: SearchBar + FilterPanel + Timeline + LogTable + DetailPanel. Passes `jobId` from route params to all API hooks. Breadcrumb: Analyses > {filename} > Explorer.
- [X] T083 [P] Create `frontend/src/app/(dashboard)/explorer/page.tsx` — global explorer page (cross-job search). Similar layout but without job scoping — requires job selector or shows all accessible logs.

### Tests

- [X] T084 [P] [US3] Test `search-bar.tsx` — input, autocomplete suggestions, submit on Enter, debounce.
- [X] T085 [P] [US3] Test `filter-panel.tsx` — add/remove filters, badge display, clear all.
- [X] T086 [P] [US3] Test `log-table.tsx` — renders rows, virtualized (only visible rows in DOM), row click selects entry, sort by column.
- [X] T087 [P] [US3] Test `detail-panel.tsx` — displays all fields, raw text, context entries, close/copy buttons.
- [X] T088 [P] [US3] Test `timeline-histogram.tsx` — renders bars, color-coded, click interaction.
- [X] T089 [P] [US3] Test `explorer/page.tsx` — full page integration, search → results → detail flow.

**Checkpoint**: Full log exploration workflow functional with search, filters, virtualized scrolling, and detail inspection.

---

## Phase 8: User Story 4 — Visualize Transaction Traces (Priority: P2)

**Goal**: Waterfall diagram, flame graph, span list, trace search, comparison, critical path

**Independent Test**: Search for a trace, view waterfall, click span for details, switch views

### Implementation

- [X] T090 Create `frontend/src/components/trace/waterfall.tsx` — hierarchical waterfall diagram. Renders `SpanNode[]` tree with indentation by depth. Duration bars proportional to total trace time, colored by log type. Clickable spans → detail sidebar. Virtual scrolling for traces with 500+ spans. Supports zoom/pan.
- [X] T091 Create `frontend/src/components/trace/span-detail.tsx` — right sidebar showing selected span metadata: log type, operation, duration, user, form, queue, thread ID, trace ID, RPC ID, error message, raw fields (key-value pairs). Close button.
- [X] T092 [P] Create `frontend/src/components/trace/flame-graph.tsx` — flame graph visualization of the same span data. Stacked rectangles width = duration. Color by log type. Click to zoom in on a subtree.
- [X] T093 [P] Create `frontend/src/components/trace/span-list.tsx` — flat table view of all spans. Sortable by duration, start time, log type. Click row → select span.
- [X] T094 Create `frontend/src/components/trace/view-switcher.tsx` — tab bar switching between Waterfall, Flame Graph, and Span List views. Preserves selected span across view switches.
- [X] T095 Create `frontend/src/components/trace/trace-filters.tsx` — filter controls: log type checkboxes, min duration slider, errors-only toggle, text search within span fields. Non-matching spans dimmed (not hidden) in waterfall.
- [X] T096 Create `frontend/src/components/trace/trace-search.tsx` — search form for finding traces. Fields: trace ID, RPC ID, user, thread ID. Results list showing `TransactionSummary` rows. Click result → load waterfall.
- [X] T097 Create `frontend/src/components/trace/trace-comparison.tsx` — side-by-side dual waterfall. Two trace selectors at top. Aligned timelines. Visual diff highlighting (spans present in one but not other, duration differences).
- [X] T098 Create `frontend/src/components/trace/critical-path.tsx` — overlay/decoration on waterfall. Highlights spans on critical path (`on_critical_path: true` from API). Toggle button "Show Critical Path".
- [X] T099 Create `frontend/src/app/(dashboard)/analysis/[id]/trace/[traceId]/page.tsx` — trace detail page. Fetches waterfall data via `useWaterfall(jobId, traceId)`. Layout: trace summary header (total duration, span count, error count, type breakdown) + ViewSwitcher + TraceFilters + active view + SpanDetail sidebar. Breadcrumb: Analyses > {filename} > Trace > {traceId}.
- [X] T100 Create `frontend/src/app/(dashboard)/trace/page.tsx` — trace search/discovery page. TraceSearch component + recent traces list (via `useRecentTraces()`). Breadcrumb: Traces.

### Tests

- [X] T101 [P] [US4] Test `waterfall.tsx` — renders hierarchical spans, depth indentation, duration bars, click selection.
- [X] T102 [P] [US4] Test `span-detail.tsx` — renders all metadata fields, close button.
- [X] T103 [P] [US4] Test `view-switcher.tsx` — switches between views, preserves selection.
- [X] T104 [P] [US4] Test `trace-search.tsx` — search form submission, results rendering, navigation.
- [X] T105 [P] [US4] Test `trace-filters.tsx` — filter application, dimming behavior.

**Checkpoint**: Full trace visualization with waterfall, flame graph, span list, and comparison.

---

## Phase 9: User Story 5 — Interact with AI Assistant (Priority: P2)

**Goal**: Chat interface with streaming, skill selection, conversation history, follow-up suggestions

**Independent Test**: Open AI assistant, ask a question, see streamed response, select a skill, view conversation history

### Implementation

- [X] T106 Create `frontend/src/stores/ai-store.ts` — Zustand store: `activeConversationId`, `isStreaming`, `streamContent` (accumulated tokens), `selectedSkill`, `setConversation()`, `startStreaming()`, `appendToken()`, `stopStreaming()`, `setSkill()`.
- [X] T107 Create `frontend/src/components/ai/chat-panel.tsx` — main AI chat area. Message list (scrollable, auto-scroll on new message), input area at bottom, streaming indicator. Uses `streamdown` for markdown rendering of assistant messages.
- [X] T108 Create `frontend/src/components/ai/message-view.tsx` — single message component. User messages: right-aligned, primary bg. Assistant messages: left-aligned, secondary bg, rendered markdown, copy button. Shows skill badge if skill was used. Displays token count + latency metadata.
- [X] T109 Create `frontend/src/components/ai/chat-input.tsx` — text input with submit button. Disabled during streaming. "Stop" button appears during streaming (calls abort on SSE). Shift+Enter for newline, Enter to submit.
- [X] T110 Create `frontend/src/components/ai/skill-selector.tsx` — 5 skill buttons/chips: Performance, Root Cause, Error Explainer, Anomaly Narrator, Summarizer. Shows "Auto" as default (AI routes based on query content). Selected skill highlighted. Tooltip description for each.
- [X] T111 Create `frontend/src/components/ai/conversation-list.tsx` — sidebar list of conversations for the current analysis job. Shows title, message count, last message date. "New Conversation" button at top. Click loads conversation messages. Delete conversation (with confirmation).
- [X] T112 Create `frontend/src/components/ai/follow-up-suggestions.tsx` — clickable suggestion chips below assistant response. Rendered from `follow_ups` array on Message. Click sends follow-up as new user message.
- [X] T113 Create `frontend/src/app/(dashboard)/ai/page.tsx` — AI assistant page. Layout: conversation list sidebar (left) + chat panel (center/right). Requires a job to be selected (show job picker or use most recent). Breadcrumb: AI Assistant.

### Tests

- [X] T114 [P] [US5] Test `chat-panel.tsx` — renders messages, auto-scroll, streaming state display.
- [X] T115 [P] [US5] Test `message-view.tsx` — user vs assistant styling, markdown rendering, copy button.
- [X] T116 [P] [US5] Test `skill-selector.tsx` — renders all 5 skills + auto, selection state, tooltip.
- [X] T117 [P] [US5] Test `conversation-list.tsx` — renders conversations, new conversation, delete.
- [X] T118 [P] [US5] Test `chat-input.tsx` — submit on Enter, stop button during streaming, disabled state.
- [X] T119 [P] [US5] Test `follow-up-suggestions.tsx` — renders chips, click triggers message send.

**Checkpoint**: AI assistant fully functional with streaming, skills, conversations, and follow-ups.

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Accessibility, performance, security, test coverage completion

### Accessibility (WCAG 2.1 AA)

- [X] T120 Audit and fix keyboard navigation across all pages — every interactive element reachable via Tab, Escape closes modals/panels, Enter activates buttons/links. Add visible focus indicators (outline or ring) to all focusable elements.
- [X] T121 [P] Add ARIA labels and roles — all icon-only buttons need `aria-label`, tables need proper `role`s, live regions for dynamic content (job progress, streaming), `aria-expanded` for collapsible sections.
- [X] T122 [P] Verify color contrast — run axe-core audit on every page in both light and dark mode. Fix any violations below 4.5:1 for normal text, 3:1 for large text and UI components.

### Responsive Design

- [X] T123 Mobile audit (375px) — test all pages at 375px width. Fix: sidebar becomes drawer, detail panels become modals, tables get horizontal scroll or column hiding, touch targets >= 44px, no horizontal overflow.
- [X] T124 [P] Tablet audit (768px) — test all pages. Fix: sidebar collapsible, grid layouts adjust (3-col → 2-col), charts resize properly.
- [X] T125 [P] Ultra-wide audit (2560px) — max-width containers, content doesn't stretch too wide, reasonable whitespace.

### Performance

- [X] T126 Code splitting — ensure all pages are lazy-loaded via Next.js dynamic imports. Heavy components (charts, waterfall, flame graph) loaded dynamically. Measure initial bundle size.
- [X] T127 [P] Run Lighthouse audit — target >= 90 for Performance, Accessibility, Best Practices, SEO. Fix identified issues. Verify FCP < 1.5s, LCP < 2.5s.

### Security

- [X] T128 Configure CSP headers in `next.config.ts` — `default-src 'self'`, `script-src 'self' 'unsafe-eval'` (for Next.js dev), `connect-src` allowing API server and WebSocket, `style-src 'self' 'unsafe-inline'` (for Tailwind). Verify in both dev and production modes.
- [X] T129 [P] Verify no sensitive data in browser storage — audit localStorage/sessionStorage usage. Only theme preference and Clerk's own tokens should be stored. No API keys, no user data.

### Error Handling

- [X] T130 Wrap every page and feature section in ErrorBoundary — `layout.tsx` wraps main content, each collapsible section wraps its content. Verify fallback UI displays correctly. Toast notifications for transient API errors (FR-032).
- [X] T131 [P] Empty states — verify every data-driven page shows appropriate empty state: Upload (no jobs → prompt to upload), Dashboard (no data → "Analysis not ready"), Explorer (no results → search suggestions), Traces (no traces → guidance), AI (no conversations → "Ask a question").

### Test Coverage

- [X] T132 Run coverage report (`vitest --coverage`) — identify files below 80% threshold. Write additional tests for uncovered branches and edge cases until 80% overall coverage reached.
- [X] T133 [P] Console error audit — run through all normal usage flows (upload, dashboard, explorer, traces, AI) and verify zero unhandled errors in browser console (SC-014).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundation)**: Depends on Phase 1 completion — BLOCKS all user stories
- **Phase 3 (US6 Navigation)**: Depends on Phase 2 — BLOCKS all page implementations (provides layout)
- **Phase 4 (US1 Upload)**: Depends on Phase 3 (needs sidebar layout)
- **Phase 5 (US2 Dashboard)**: Depends on Phase 3 (needs sidebar layout)
- **Phase 6 (US7 Job Management)**: Depends on Phase 3 (needs sidebar layout)
- **Phase 7 (US3 Log Explorer)**: Depends on Phase 3 (needs sidebar layout)
- **Phase 8 (US4 Traces)**: Depends on Phase 3 (needs sidebar layout)
- **Phase 9 (US5 AI Assistant)**: Depends on Phase 3 (needs sidebar layout)
- **Phase 10 (Polish)**: Depends on all desired user story phases being complete

### Parallel Opportunities After Phase 3

Once Phase 3 (Navigation) is complete, all user stories (Phases 4-9) can proceed **in parallel** since they operate on different files and routes:

```
Phase 3 (Navigation) ─┬─> Phase 4 (Upload)      ─┐
                       ├─> Phase 5 (Dashboard)    ─┤
                       ├─> Phase 6 (Job Mgmt)     ─┤
                       ├─> Phase 7 (Explorer)      ├─> Phase 10 (Polish)
                       ├─> Phase 8 (Traces)        ─┤
                       └─> Phase 9 (AI Assistant)  ─┘
```

### Recommended Sequential Order (single developer)

1. Phase 1 → Phase 2 → Phase 3 (Navigation)
2. Phase 4 (Upload) — entry point, needed to create test data
3. Phase 5 (Dashboard) — core value proposition
4. Phase 7 (Explorer) — core investigative workflow
5. Phase 6 (Job Management) — simple, quick win
6. Phase 8 (Traces) — advanced feature
7. Phase 9 (AI Assistant) — advanced feature
8. Phase 10 (Polish) — final pass

---

## Summary

| Phase | Tasks | Parallel | Priority |
|-------|-------|----------|----------|
| 1. Setup | T001–T006 | 4 of 6 | P0 |
| 2. Foundation | T007–T029 | 19 of 23 | P0 |
| 3. US6 Navigation | T030–T042 | 8 of 13 | P1 |
| 4. US1 Upload | T043–T051 | 4 of 9 | P1 |
| 5. US2 Dashboard | T052–T069 | 12 of 18 | P1 |
| 6. US7 Job Management | T070–T073 | 2 of 4 | P2 |
| 7. US3 Explorer | T074–T089 | 10 of 16 | P1 |
| 8. US4 Traces | T090–T105 | 10 of 16 | P2 |
| 9. US5 AI Assistant | T106–T119 | 6 of 14 | P2 |
| 10. Polish | T120–T133 | 8 of 14 | P1 |
| **Total** | **133 tasks** | | |

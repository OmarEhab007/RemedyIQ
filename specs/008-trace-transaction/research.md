# Research: Enhanced Trace Transaction Page

**Date**: 2026-02-15
**Feature**: 008-trace-transaction

## R1: Waterfall Visualization Library

**Decision**: Build a custom waterfall component using Canvas + react-window for virtualization, with D3 scales for the timestamp ruler.

**Rationale**: Evaluated SVAR React Gantt (MIT, React 19 compatible, full Gantt features) but it's designed for project management Gantt charts, not APM-style waterfall timelines. APM waterfalls have unique requirements: span nesting by temporal containment (not task dependencies), fixed microsecond-precision rulers, and span-type color coding. Recharts (already in stack) lacks native waterfall/timeline support. A custom Canvas-based renderer with react-window virtualization gives us full control over the APM-specific UX while handling 1000+ spans at 60fps.

**Alternatives considered**:
- SVAR React Gantt — MIT licensed, React 19 compatible, virtualized. Rejected because Gantt chart semantics (tasks, milestones, dependencies) don't map well to APM trace spans. Would require extensive customization.
- Recharts stacked bar chart — already in stack but no native waterfall/timeline component. Workaround possible but poor UX for nested hierarchical spans.
- @nivo/bar — 343KB bundle, no timeline or hierarchy support.
- gantt-task-react — last updated 4 years ago, no React 19 support.

## R2: Flame Graph Visualization

**Decision**: Build a custom flame graph component using D3 + SVG with React wrapper. Use the icicle chart pattern (top-down, root at top) rather than traditional bottom-up flame graph, since we're showing a call hierarchy, not CPU profiles.

**Rationale**: Existing React flame graph libraries are outdated: react-flame-graph (6 years old, React 19 incompatible), d3-flame-graph (4 years old). Speedscope is a standalone Preact app, not embeddable as a component. The flame graph visualization is structurally simple (nested rectangles with width proportional to duration) and can be built with D3 scales + SVG rectangles in ~200 lines. This avoids adding an unmaintained dependency.

**Alternatives considered**:
- react-flame-graph — 6 years old, likely incompatible with React 19. Rejected.
- d3-flame-graph — 4 years old, requires manual React integration. Rejected.
- Speedscope (iframe embed) — excellent viewer but introduces iframe complexity, can't share state with React components. Rejected.
- flame.cat — Rust/WASM based, too experimental. Rejected.

## R3: SQL Syntax Highlighting

**Decision**: Use prism-react-renderer v2 with SQL language support via dynamic import.

**Rationale**: Lightweight (~2KB core + 0.3-0.5KB per language), actively maintained, React 19 compatible, powers Docusaurus. The v2 API removed defaultProps dependency for React 19 compatibility. SQL language grammar is imported dynamically to avoid bundle bloat. We only need read-only code display (no editing), so a full editor (CodeMirror/Monaco) is overkill.

**Alternatives considered**:
- react-syntax-highlighter — 17KB-910KB depending on build. Heavier than needed for a single language.
- Shiki — ~250KB + WASM. Superior quality but heavy for client-side rendering. Better suited for SSR.
- sql-highlight — SQL-only, minimal, but no React integration or theming.

## R4: Span Hierarchy Inference Algorithm

**Decision**: Implement a **Temporal + Thread Containment** algorithm in the Go backend that builds a span tree from flat log entries, using thread_id grouping, timestamp containment, filter_level for nesting depth, and the AR Server execution model as heuristics.

**Rationale**: AR Server logs do not contain explicit parent span IDs. The correlation fields (trace_id, rpc_id, thread_id) plus timestamps and filter_level provide sufficient signal to infer hierarchy:
1. Group entries by trace_id (or rpc_id fallback)
2. Within each group, sub-group by thread_id
3. Apply temporal containment: if span A fully contains span B in time on the same thread, B is a child of A
4. Use filter_level (1/2/3) as a direct indicator of filter nesting depth
5. SQL queries are children of the immediately preceding filter or API on the same thread
6. API calls are always root-level spans

Computing hierarchy server-side (in Go) avoids sending complex inference logic to the browser and enables Redis caching of the computed tree.

**Alternatives considered**:
- Client-side hierarchy inference — rejected because it pushes complex logic to the browser and requires sending raw flat data.
- Log-type-only hierarchy (always API>Filter>SQL) — too simplistic; doesn't handle concurrent filters or mixed-depth nesting.
- Flat chronological only (no nesting) — rejected because the waterfall's core value is showing parent-child relationships.

## R5: Transaction Search Backend Strategy

**Decision**: Add a new `GET /api/v1/analysis/{job_id}/transactions` endpoint that queries ClickHouse for distinct trace_ids with aggregated metrics (span count, total duration, error count, primary user/form). Support filtering by user, thread_id, and time range.

**Rationale**: The existing `GET /analysis/{job_id}/trace/{trace_id}` endpoint requires knowing the trace_id upfront. For discovery-by-user or discovery-by-thread, we need an aggregation query that groups log_entries by trace_id and returns summary metrics. ClickHouse's columnar storage handles this efficiently with the existing ORDER BY key (tenant_id, job_id, log_type, timestamp, line_number) plus the trace_id index.

**Alternatives considered**:
- Reuse the existing search endpoint with trace-specific KQL — partially viable but doesn't provide aggregated per-transaction metrics (span count, duration).
- Bleve-based transaction search — Bleve doesn't support GROUP BY aggregations needed for transaction summaries.

## R6: Critical Path Computation

**Decision**: Compute the critical path server-side using a longest-path algorithm on the span tree. For each span, track whether it's on the critical path (the sequential chain of spans that determines total trace duration). Return critical path span IDs in the API response.

**Rationale**: The critical path is the sequence of spans where removing any one would reduce total trace duration. In the context of AR Server transactions, this typically follows: API call → longest filter chain → longest SQL query. Computing this server-side avoids sending the algorithm to the browser and enables caching.

**Alternatives considered**:
- Client-side computation — rejected for consistency with server-side hierarchy inference.
- Skip critical path — rejected because it's a P4 feature the user explicitly requested.

## R7: Trace Comparison Approach

**Decision**: Implement comparison as a frontend-driven feature that loads two traces independently and aligns them by operation type + form. The backend returns standard trace data for each; the frontend handles alignment and diff visualization.

**Rationale**: Alignment logic is presentation-specific (how to visually align two waterfalls) and varies by user preference. Keeping comparison client-side avoids a complex server endpoint and leverages the existing trace endpoint. The frontend fetches both traces via the standard waterfall endpoint and computes duration deltas per operation type.

**Alternatives considered**:
- Server-side comparison endpoint — over-engineering; the traces are already available individually.
- Statistical comparison against historical averages — useful for P10 (Performance Context) but separate from side-by-side comparison.

## R8: AI Trace Analysis Integration

**Decision**: Extend the existing AI analysis pattern (backend/internal/api/handlers/ai.go) with a new "trace-analyzer" skill. The skill receives the span hierarchy JSON and returns a streaming natural-language analysis. Use the existing Claude API integration (anthropic-sdk-go).

**Rationale**: The codebase already has an AI handler at `/api/v1/analysis/{job_id}/ai` with streaming support. Adding a trace-specific skill follows the "AI as a Skill" constitution principle. The trace hierarchy JSON is sent as context, and the skill prompt instructs Claude to identify bottlenecks, explain the execution flow, and suggest optimizations specific to AR Server operations.

**Alternatives considered**:
- Client-side AI call — rejected because it exposes the API key to the browser.
- Non-streaming response — rejected because trace analysis may take several seconds; streaming provides better UX.

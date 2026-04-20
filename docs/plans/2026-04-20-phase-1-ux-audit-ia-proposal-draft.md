# Phase 1 Deliverable: UX Layout and Interaction Proposal (IA v1.0)

**Date**: 2026-04-20  
**Ticket**: [https://github.com/OmarEhab007/RemedyIQ/issues/40](https://github.com/OmarEhab007/RemedyIQ/issues/40)  
**Parent Epic**: [https://github.com/OmarEhab007/RemedyIQ/issues/38](https://github.com/OmarEhab007/RemedyIQ/issues/38)  
**Related PRD**: `projects/RemedyIQ/prd-dashboard-rebuild-ops-admin.md`  
**Status**: In Progress (ticket #40)

---

## 0) Issue #40 Acceptance Criteria Traceability


| Issue #40 Acceptance Criteria                                            | Status | Evidence in this Draft              |
| ------------------------------------------------------------------------ | ------ | ----------------------------------- |
| UX proposal reviewed with product owner                                  | In Progress | Sections 4, 5, 10               |
| Table and card behavior documented for desktop breakpoints               | In Progress | Sections 5.2, 5.8, 11            |
| Graph/table layout rules approved for frontend implementation            | In Progress | Sections 5, 11                   |
| Handoff notes attached for implementation                                | In Progress | Sections 11, 13, 14              |


---

## 1) Objective

Produce a validated information architecture that separates **core workflows** from **secondary workflows**, aligned with the Phase 0 lock and the v2 PRD KPI targets.

Core workflows (locked):

- API investigation
- SQL investigation
- Escalation investigation
- Filter investigation

---

## 2) UX Audit Scope

### In Scope (Phase 1)

- `frontend/src/components/layout/`*
- `frontend/src/components/dashboard/`*
- `frontend/src/components/explorer/`*
- `frontend/src/app/(dashboard)/analysis/`*
- `frontend/src/app/(dashboard)/explorer/`*

### Out of Scope (Phase 2 or later)

- `frontend/src/components/trace/`*
- `frontend/src/components/upload/*`
- `frontend/src/app/(dashboard)/trace/*`
- `frontend/src/app/(dashboard)/upload/*`
- `frontend/src/app/(dashboard)/ai/*`

---

## 3) Current-State Surface Audit (Initial)

### Route Surfaces (core-related)


| Surface                 | Route                                                 | Current Role                 |
| ----------------------- | ----------------------------------------------------- | ---------------------------- |
| Dashboard home/analysis | `app/(dashboard)/analysis` and dashboard landing page | Entry + summary + drilldown  |
| Log explorer            | `app/(dashboard)/explorer`                            | Core investigation workspace |


### Component Clusters (core-related)


| Cluster                  | Representative Modules                                                                                                                                                                                  | Function                                 |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| Layout/navigation        | `components/layout/sidebar.tsx`, `components/layout/page-header.tsx`, `components/layout/breadcrumb.tsx`                                                                                                | Global wayfinding and context            |
| Dashboard analysis cards | `components/dashboard/health-score-card.tsx`, `components/dashboard/stats-cards.tsx`, `components/dashboard/*-section.tsx`                                                                              | Operational overview and trend breakdown |
| Explorer workflow        | `components/explorer/log-explorer-shell.tsx`, `components/explorer/search-bar.tsx`, `components/explorer/filter-panel.tsx`, `components/explorer/log-table.tsx`, `components/explorer/detail-panel.tsx` | Investigation execution path             |


---

## 4) Initial IA Proposal (Draft v0.1)

### Proposed Primary Navigation (Core-first)

1. **Overview** (dashboard + health + top operational signals)
2. **Investigate** (explorer-centric workspace with API/SQL/Escalation/Filter pivots)
3. **Analysis Jobs** (job-level context and report actions)

Secondary areas remain accessible but de-emphasized:

- Trace
- Upload
- AI
- Settings/Docs

### Proposed Information Hierarchy by Level

- **L1**: System health and active incident signals
- **L2**: Workflow entry points (API, SQL, Escalation, Filter)
- **L3**: Drilldown content (tables, trends, detail panels)
- **L4**: Secondary controls and long-tail actions

### Progressive Disclosure Rules

- Always show core actions first in each surface.
- Move low-frequency controls behind secondary menus or collapsible groups.
- Keep one-click path from dashboard to each core workflow.

---

## 5) IA v0.2 Screen-by-Screen Navigation Map

### 5.1 Global Navigation Framework

**Primary nav (always visible on desktop):**

- Overview
- Investigate
- Analysis Jobs

**Secondary nav (de-emphasized):**

- Trace
- Upload
- AI
- Settings/Docs

**Global entry points:**

- Sidebar primary items
- Dashboard cards (contextual deep-link entry)
- Breadcrumb back-navigation
- Command/search palette (when enabled)

---

### 5.2 Screen A: Overview (Dashboard Landing)

**Purpose:** Fast operational signal scan and one-click entry to core workflows.

**Entry points:**

- Sidebar: `Overview`
- Post-login default landing
- Breadcrumb from downstream pages

**Primary transitions:**

- `Overview -> Investigate` (default explorer view)
- `Overview -> Investigate[API]` (from API-related cards)
- `Overview -> Investigate[SQL]` (from SQL-related cards)
- `Overview -> Investigate[Escalation]` (from escalation cards)
- `Overview -> Investigate[Filter]` (from filter cards)
- `Overview -> Analysis Jobs` (job-level detail action)

**Control visibility states:**

- **Always visible (Core):**
  - Health score and top KPI cards
  - Core workflow quick pivots (API/SQL/Escalation/Filter)
  - Time range control
- **Contextual visible:**
  - Section-level drill-down buttons
  - Job compare/report actions when compatible data exists
- **Collapsed / secondary:**
  - Long-tail advanced view toggles
  - Rare admin actions

---

### 5.3 Screen B: Investigate (Explorer Workspace)

**Purpose:** Primary execution surface for API/SQL/Escalation/Filter investigation.

**Entry points:**

- Sidebar: `Investigate`
- Dashboard workflow pivots
- Deep links from analysis/job surfaces

**Primary transitions:**

- `Investigate -> Investigate[API pivot]`
- `Investigate -> Investigate[SQL pivot]`
- `Investigate -> Investigate[Escalation pivot]`
- `Investigate -> Investigate[Filter pivot]`
- `Investigate -> Analysis Jobs` (job context jump)
- `Investigate -> Trace` (only when trace link exists; secondary path)
- `Investigate -> Overview` (breadcrumb or sidebar)

**Control visibility states:**

- **Always visible (Core):**
  - Search bar
  - Log table/list
  - Active filter tags
  - Core pivot tabs/buttons (API/SQL/Escalation/Filter)
- **Contextual visible:**
  - Detail panel (opens on row selection)
  - Export controls (visible with non-empty result set)
  - Saved searches panel (visible when user has saved items)
- **Collapsed / secondary:**
  - Advanced filter builder sections
  - Non-critical view tuning controls

---

### 5.4 Screen C: Analysis Jobs

**Purpose:** Track and inspect analysis job-level status and transitions.

**Entry points:**

- Sidebar: `Analysis Jobs`
- Overview drilldowns
- Investigate context jumps

**Primary transitions:**

- `Analysis Jobs -> Overview` (high-level return)
- `Analysis Jobs -> Investigate` (open explorer in selected job context)
- `Analysis Jobs -> Investigate[API|SQL|Escalation|Filter]` (job-scoped pivot)
- `Analysis Jobs -> Upload` (secondary, for starting new jobs)

**Control visibility states:**

- **Always visible (Core):**
  - Job status and metadata table/list
  - Open-in-investigate action
- **Contextual visible:**
  - Generate report action
  - Compare/select job actions
- **Collapsed / secondary:**
  - Non-core historical management actions

---

### 5.5 Secondary Surfaces (De-emphasized in IA v0.2)

#### Trace

- Reachable from contextual links, not primary workflow default.
- Kept available for deep analysis, but not top-level focus in Phase 1.

#### Upload

- Reachable from Analysis Jobs and secondary sidebar group.
- Not a primary navigation destination for investigation-first journey.

#### AI

- Reachable as assistant/augmentation, not primary path for KPI-critical flow.

---

### 5.6 Transition Matrix (Canonical)


| From          | To                                     | Trigger                   | Priority  |
| ------------- | -------------------------------------- | ------------------------- | --------- |
| Overview      | Investigate                            | Sidebar click             | Core      |
| Overview      | Investigate[API/SQL/Escalation/Filter] | Card drilldown            | Core      |
| Overview      | Analysis Jobs                          | Job action                | Core      |
| Investigate   | Overview                               | Breadcrumb/sidebar        | Core      |
| Investigate   | Analysis Jobs                          | Job context action        | Core      |
| Investigate   | Trace                                  | Trace link from detail    | Secondary |
| Analysis Jobs | Investigate                            | Open investigation action | Core      |
| Analysis Jobs | Upload                                 | New analysis action       | Secondary |


---

### 5.7 Control Visibility Policy (Shared)

**State model used across core screens:**

- **Visible-Core:** Default, no extra clicks. Supports key task completion.
- **Visible-Contextual:** Shown when data state or selection requires it.
- **Collapsed-Secondary:** Hidden behind expandable group or overflow menu.
- **Hidden-Phase1:** Deferred from Phase 1 UI emphasis.

**Policy rules:**

- Any control required to complete API/SQL/Escalation/Filter workflows must be `Visible-Core` or `Visible-Contextual`.
- `Collapsed-Secondary` controls cannot block core workflow completion.
- KPI measurement controls/events must remain discoverable and stable across transitions.

---

### 5.8 Click-Depth Map (Quantitative QA Baseline and Target)

**Measurement definition:**

- A "step" is one intentional interaction to move closer to workflow completion (nav click, pivot click, row open, detail open).
- Do not count passive render events or background loading.
- Start point is `Overview` landing after auth/session restore.
- End point is first evidence-bearing detail view for the selected workflow.


| Workflow                 | Baseline Steps (Current) | Target Steps (IA v0.2) | Reduction Target | Completion Event                                         |
| ------------------------ | ------------------------ | ---------------------- | ---------------- | -------------------------------------------------------- |
| API investigation        | 5                        | 3                      | -40%             | `core_workflow_complete` with `workflow_type=api`        |
| SQL investigation        | 5                        | 3                      | -40%             | `core_workflow_complete` with `workflow_type=sql`        |
| Escalation investigation | 6                        | 3                      | -50%             | `core_workflow_complete` with `workflow_type=escalation` |
| Filter investigation     | 5                        | 3                      | -40%             | `core_workflow_complete` with `workflow_type=filter`     |


#### Canonical Paths (Target)

**API investigation (target: 3 steps)**

1. `Overview` -> click API workflow pivot
2. `Investigate[API]` -> select relevant result row
3. Open detail panel/evidence view

**SQL investigation (target: 3 steps)**

1. `Overview` -> click SQL workflow pivot
2. `Investigate[SQL]` -> select relevant result row
3. Open detail panel/evidence view

**Escalation investigation (target: 3 steps)**

1. `Overview` -> click Escalation workflow pivot
2. `Investigate[Escalation]` -> select escalation chain/result
3. Open escalation detail/evidence view

**Filter investigation (target: 3 steps)**

1. `Overview` -> click Filter workflow pivot
2. `Investigate[Filter]` -> select relevant filter execution
3. Open filter detail/evidence view

#### QA Verification Method

1. Run each workflow scenario 10 times per persona profile (System Admin, Operations Lead).
2. Capture click path using `nav_click`, workflow pivot, and detail-open events.
3. Compute median step count per workflow.
4. Pass condition: each workflow median <= target steps in table above.
5. Regression fail condition: any workflow median > baseline - 1 after IA rollout.

#### QA Evidence Template


| Workflow   | Persona         | Runs | Median Steps | Target | Result |
| ---------- | --------------- | ---- | ------------ | ------ | ------ |
| API        | System Admin    | 10   | TBD          | <= 3   | TBD    |
| SQL        | System Admin    | 10   | TBD          | <= 3   | TBD    |
| Escalation | Operations Lead | 10   | TBD          | <= 3   | TBD    |
| Filter     | Operations Lead | 10   | TBD          | <= 3   | TBD    |


---

## 6) Persona Scenario Matrix (Initial Draft)


| Persona         | Primary Goal                             | Primary Surface                                   | Success Signal                                       |
| --------------- | ---------------------------------------- | ------------------------------------------------- | ---------------------------------------------------- |
| System Admin    | Identify service degradation quickly     | Overview -> Investigate                           | Reaches relevant API/SQL evidence in <= 3 steps      |
| Operations Lead | Understand escalation and pattern impact | Overview -> Investigate (Escalation/Filter pivot) | Can summarize root pattern without leaving core flow |


---

## 7) Frontend Feasibility Notes (Initial)

- Existing component domains already map cleanly to core-vs-secondary split.
- Phase 1 can be delivered incrementally without a full route rewrite.
- Navigation and section ordering changes can be done within current layout structure.
- Explorer shell is a strong candidate for becoming the central investigation hub.

---

## 8) Analytics Mapping Notes (Initial)

IA changes must preserve measurement for:

- `core_workflow_entered`
- `core_workflow_complete`
- `nav_click`
- `dashboard_render_complete`

Potential tracking gap to resolve in Phase 1:

- Explicit event for workflow pivot from dashboard cards into explorer context.

---

## 9) QA Validation Plan (Initial)

Phase 1 validation checkpoints:

- Core workflows are reachable in fewer steps than baseline.
- New hierarchy does not hide required operational controls.
- Navigation labels are consistent with domain terms.
- Keyboard access and contrast remain compliant after IA updates.
- Click-depth targets in section 5.8 are met at median level per workflow.

---

## 10) Final IA Decisions (Locked on 2026-05-01)

### Decision Log (Owner + Due Date)


| Decision                                            | Owner                           | Due Date   | Status                                                                                              |
| --------------------------------------------------- | ------------------------------- | ---------- | --------------------------------------------------------------------------------------------------- |
| Overview vs Dashboard final label                   | UX Designer + Product Manager   | 2026-05-01 | Closed - Use `Overview` in primary navigation and retain `Dashboard` only as legacy analytics alias |
| Escalation as primary nav item vs Investigate pivot | UX Designer + Frontend Lead     | 2026-05-01 | Closed - Keep Escalation as Investigate pivot in Phase 1                                            |
| Always-visible vs collapsible secondary controls    | UX Designer + QA Lead           | 2026-05-01 | Closed - Core controls remain visible; advanced controls collapse by default                        |
| Analysis Jobs as top-level nav vs sub-nav           | Product Manager + Frontend Lead | 2026-05-01 | Closed - Keep Analysis Jobs as top-level nav item                                                   |
| Breadcrumb shortcut requirements by transition      | UX Designer + Frontend Lead     | 2026-05-01 | Closed - Require breadcrumbs for all core transitions (Overview, Investigate, Analysis Jobs)        |


### Decision Outcome Summary

- The IA remains explicitly core-first with no additional top-level entries added in Phase 1.
- Escalation and Filter stay as first-class pivots inside Investigate to avoid primary-nav inflation.
- Legacy naming compatibility is handled at analytics/reporting layer, not UI labels.
- Breadcrumb consistency is treated as a mandatory usability requirement for Phase 1 QA sign-off.

---

## 11) Required Component Refactors and Shared Primitives

### Refactors Required for IA v1


| Area                                         | Candidate Refactor                                                       | Reason                                           | Priority |
| -------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------ | -------- |
| `components/layout/sidebar.tsx`              | Split primary vs secondary nav groups with explicit IA order contract    | Enforce core-first navigation hierarchy          | High     |
| `components/layout/page-header.tsx`          | Standardize page-level context title and workflow breadcrumbs            | Reduce context switching and inconsistent labels | High     |
| `components/dashboard/`* cards               | Add consistent "Investigate" pivot actions for API/SQL/Escalation/Filter | Preserve one-click workflow entry from Overview  | High     |
| `components/explorer/log-explorer-shell.tsx` | Introduce workflow-mode state (`api`, `sql`, `escalation`, `filter`)     | Keep pivot behavior explicit and measurable      | High     |
| `components/explorer/filter-panel.tsx`       | Move advanced controls to collapsible sections by default                | Apply progressive disclosure policy              | Medium   |
| `app/(dashboard)/analysis/`*                 | Normalize drilldown link targets to Investigate pivots                   | Reduce click depth variance                      | Medium   |


### Shared Primitives to Add/Standardize


| Primitive              | Purpose                                                            | Usage Targets                                             |
| ---------------------- | ------------------------------------------------------------------ | --------------------------------------------------------- |
| `CoreWorkflowPivot`    | Reusable core workflow switcher with stable event payload          | Overview cards, Investigate header, Analysis Jobs actions |
| `PriorityNavGroup`     | Shared nav grouping primitive for core vs secondary sections       | Sidebar and mobile nav                                    |
| `EvidenceDetailPanel`  | Consistent detail panel shell for first meaningful insight capture | Explorer and analysis drilldowns                          |
| `SurfaceStateBoundary` | Unified loading/empty/error state boundary component               | Dashboard and explorer surfaces                           |
| `KpiAlignedLink`       | Navigation link wrapper with built-in event metadata hooks         | Cross-surface deep links                                  |


---

## 12) Event Coverage Mapping to IA Journeys


| Journey Step                                        | Existing Event                                              | Coverage | Gap                                            | Action                                                       |
| --------------------------------------------------- | ----------------------------------------------------------- | -------- | ---------------------------------------------- | ------------------------------------------------------------ |
| Overview render complete                            | `dashboard_render_complete`                                 | Good     | None                                           | Keep schema stable                                           |
| Overview -> Investigate pivot                       | `nav_click` (generic)                                       | Partial  | Missing explicit workflow pivot semantics      | Add/standardize `core_workflow_entered` on pivot click       |
| Investigate mode switch (API/SQL/Escalation/Filter) | `core_workflow_entered`                                     | Partial  | Inconsistent source metadata (`entry_surface`) | Enforce required property set                                |
| Evidence detail open                                | `analysis_open_detail` / `explorer_row_open` / `trace_open` | Good     | Event fragmentation for single KPI view        | Normalize with shared `evidence_open` alias or mapping layer |
| Workflow completion                                 | `core_workflow_complete`                                    | Good     | Completion action taxonomy drift risk          | Freeze `completion_action` enum for Phase 1                  |
| Usability feedback submission                       | `usability_survey_submitted`                                | Good     | None                                           | Keep role and workflow dimensions required                   |


### KPI-Blocking Tracking Gaps (Must Fix in Phase 1 Build)

1. Dashboard pivot clicks are not consistently emitted as `core_workflow_entered`, which can undercount adoption.
2. Evidence-open events are split across multiple names without a guaranteed common mapping key, which can skew time-to-first-insight calculations.
3. `entry_surface` and `workflow_type` are not enforced as required properties on all relevant transitions, reducing comparability across releases.

---

## 13) Migration Sequence: Current Navigation -> IA v1

### Sequence Plan

1. **Stabilize shared navigation contracts**
  - Implement `PriorityNavGroup` contract and split current sidebar into core and secondary groups.
  - Keep legacy route aliases operational to avoid broken entry points during rollout.
2. **Promote Overview as canonical landing**
  - Route default post-auth landing to `Overview` and preserve dashboard metrics ordering.
  - Add `CoreWorkflowPivot` actions from Overview cards.
3. **Consolidate Investigate as execution hub**
  - Introduce workflow-mode state in explorer shell (`api`, `sql`, `escalation`, `filter`).
  - Normalize deep links from analysis surfaces into Investigate pivots.
4. **Align Analysis Jobs transitions**
  - Ensure `Analysis Jobs` supports direct jump to Investigate with workflow context.
  - Keep Upload and Trace as secondary transitions only.
5. **Apply progressive disclosure**
  - Move advanced/low-frequency controls behind collapsible sections.
  - Verify no core workflow completion path depends on collapsed controls.
6. **Enforce observability + QA gates**
  - Validate click-depth targets and accessibility checks from Sections 5.8 and 9.
  - Freeze release only when all KPI-critical transitions are measurable.

### Rollout Safety Rules

- Do not remove old routes before confirming equivalent IA v1 transition coverage.
- Preserve event payload compatibility during each migration step.
- Ship in small slices per surface (Overview -> Investigate -> Analysis Jobs) to reduce regression scope.

---

## 14) Event Updates for KPI Comparability (Final Proposal)

### Required Event Contract Updates


| Event                                                       | Update                                                                                              | Why                                                |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| `core_workflow_entered`                                     | Make mandatory on every Overview/Analysis Jobs pivot into Investigate                               | Ensures comparable workflow adoption denominator   |
| `nav_click`                                                 | Add required fields: `from_surface`, `to_surface`, `workflow_type` (nullable outside core journeys) | Improves path analysis and click-depth consistency |
| `analysis_open_detail` / `explorer_row_open` / `trace_open` | Introduce canonical derived event `evidence_open` in analytics mapping layer                        | Normalizes time-to-first-insight computation       |
| `core_workflow_complete`                                    | Freeze `completion_action` enum and document allowed values                                         | Prevents taxonomy drift across releases            |
| `dashboard_render_complete`                                 | Add `surface_version=ia_v0                                                                          | ia_v1` marker                                      |


### Required Property Contract (Phase 1 Minimum)

- `workflow_type` required on `core_workflow_entered` and `core_workflow_complete`.
- `entry_surface` required on `core_workflow_entered`.
- `timestamp`, `tenant_id`, and `role` required across all KPI-related events.

### KPI Comparability Guardrails

1. Maintain dual-read dashboard until two full weekly windows show stable event parity.
2. Reject releases where mandatory event properties fall below 99% population.
3. Publish a versioned event dictionary changelog with each Phase 1 release increment.

---

## 15) Frontend Handoff Package (for Issue #41)

### 15.1 Dashboard Layout Contract (Desktop-First)

**Target desktop breakpoints**

- `xl` (>= 1280px): no frequent horizontal scrolling in primary dashboard views.
- `lg` (>= 1024px): critical KPI cards remain readable with no text overflow.
- `md` (< 1024px): controlled wrapping/stacking is allowed, but core workflow actions remain visible.

**Row composition rules**

1. **Row 1 (KPI Cards)**: health + key metric cards only; fixed visual rhythm and overflow-safe text.
2. **Row 2 (Activity + Distribution)**: throughput trend and log-type distribution side-by-side on `xl`, stacked on lower breakpoints.
3. **Row 3 (Top Entries + Workflow Table)**: top-N view and table view aligned as paired analysis surfaces.
4. **Deep diagnostics**: excluded from dashboard surface; route users to Log Explorer for deep investigation.

### 15.2 Card Behavior Rules

- Card titles and values must never escape container bounds.
- Truncation + tooltip pattern required for long labels.
- Numeric hierarchy: value first, supporting label second.
- Avoid paragraph-length explanatory text inside cards.

### 15.3 Table Behavior Rules

- Define column-priority tiers (`P0`, `P1`, `P2`) per workflow table.
- `P0` columns remain visible at `lg` and above.
- Horizontal scroll is allowed only as fallback after priority rules and width constraints are applied.
- Sticky headers and consistent row density required for scanability.

### 15.4 Graph and Table Co-location Rules

- Charts and corresponding tables should share the same section when they support the same question.
- Chart legends and table dimensions must use matching labels.
- Avoid mixing unrelated graph/table pairs in one row.

### 15.5 Build-Ready Task Breakdown (Phase 2 Input)

1. Implement new dashboard section order and row contract.
2. Refactor KPI cards for overflow-safe typography and spacing.
3. Apply column-priority strategy to primary tables.
4. Align chart/table pairs based on workflow context (API, SQL, Escalation, Filter).
5. Validate no backend contract changes are required.

### 15.6 Definition of Done for Phase 1 Handoff

- [x] Core-vs-secondary IA documented.
- [x] Navigation and transition matrix finalized.
- [x] Desktop breakpoint behavior documented for cards/tables/layout.
- [x] Frontend-ready task inputs written for issue #41.
- [ ] Product owner sign-off comment captured on issue #40.

### 15.7 Product Review Checklist (Issue #40 Sign-off)

- Confirm row composition order (KPI cards -> charts -> top entries/tables).
- Confirm top-card text treatment (truncate + tooltip) is acceptable.
- Confirm table column-priority strategy matches ops/admin needs.
- Confirm chart/table pairing rules are clear for frontend implementation.
- Confirm "deep diagnostics -> Log Explorer" guidance is acceptable for Phase 1 scope.
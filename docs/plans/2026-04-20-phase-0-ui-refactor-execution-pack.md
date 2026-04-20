# Phase 0 Execution Pack: UI Refactor Alignment and Scope Lock

**Date**: 2026-04-20  
**Ticket**: [https://github.com/OmarEhab007/RemedyIQ/issues/29](https://github.com/OmarEhab007/RemedyIQ/issues/29)  
**Epic**: [https://github.com/OmarEhab007/RemedyIQ/issues/28](https://github.com/OmarEhab007/RemedyIQ/issues/28)  
**Status**: In Progress

---

## 0) Issue #29 Acceptance Criteria Traceability


| Issue #29 Acceptance Criteria                                                                                      | Status | Evidence in this Pack |
| ------------------------------------------------------------------------------------------------------------------ | ------ | --------------------- |
| Core workflows are confirmed: API, SQL, Escalation, Filter                                                         | Done   | Section 1             |
| Readability standards baseline is documented for operational dashboard surfaces                                    | Done   | Section 2             |
| UI surface inventory is complete and component ownership is mapped                                                 | Done   | Section 5             |
| Code paths are tagged for Phase 1 vs Phase 2 migration boundaries                                                  | Done   | Section 6             |
| KPI baseline extraction method is documented                                                                       | Done   | Section 3             |
| Event dictionary draft exists for core_workflow_complete, time_to_first_insight_seconds, dashboard_usability_score | Done   | Sections 3 and 4      |
| Baseline usability/regression charter is documented                                                                | Done   | Section 7             |
| Phase-gate pass/fail criteria are defined                                                                          | Done   | Section 7             |


Notes:

- `time_to_first_insight_seconds` is represented by KPI C ("Time to first meaningful insight") and computed as a median duration from render to first drilldown.
- Ticket-ready evidence is intentionally centralized in this document to simplify QA + product sign-off.

---

## 1) Core Workflow Definitions (Locked)

The Phase 0 core workflows are locked as:

1. **API Investigation Workflow**
  System admin investigates API call behavior, errors, and latency trends.
2. **SQL Investigation Workflow**
  Operations lead reviews heavy/slow query patterns and SQL error spikes.
3. **Escalation Investigation Workflow**
  Team traces escalation chains and delayed escalation behavior.
4. **Filter Investigation Workflow**
  Team analyzes filter execution patterns and complexity hotspots.

These workflows are the source of truth for Phase 1 dashboard and navigation priorities.

---

## 2) Readability Standards Baseline (Operational Surfaces)

The baseline standard for dashboard/explorer readability is:

- **Hierarchy**: page title -> section title -> metric labels -> detail rows.
- **Critical signal placement**: health and errors first, supporting details later.
- **Text clarity**: avoid mixed semantic language; use domain terms consistently.
- **Density control**: keep default state scannable before drill-down.
- **Color semantics**: fixed severity mapping (error/warn/info/success/escalation).
- **Contrast**: WCAG 2.1 AA minimum for textual and interactive elements.
- **State handling**: every primary card/view has loading, empty, and error states.

### Baseline Scoring Rubric (1-5)


| Dimension                             | Baseline (2026-04-20) | Notes                                         |
| ------------------------------------- | --------------------- | --------------------------------------------- |
| Information hierarchy clarity         | 2.8                   | Signal ordering needs stronger prioritization |
| Visual noise / clutter control        | 2.6                   | Secondary elements compete with core tasks    |
| Navigation clarity to core workflows  | 2.7                   | Flow requires too many context switches       |
| Readability of dashboard cards/charts | 3.1                   | Usable but inconsistent emphasis              |


Average baseline aligns with PRD KPI baseline (`2.8/5.0`).

---

## 3) KPI Baseline Extraction Method

This method is used weekly to track the Phase 0 -> Phase 2 outcome trend.

### KPI A: Dashboard usability score

- Source: in-app post-task survey (system admins + operations leads).
- Query grain: weekly rolling average.
- Formula: `avg(score)` where score range is `1-5`.

### KPI B: Core workflow adoption rate

- Source: analytics event stream (`core_workflow_complete`).
- Query grain: weekly.
- Formula:  
`active_users_with_core_workflow / active_admin_ops_users`.

### KPI C: Time to first meaningful insight

- Source events:
  - `dashboard_render_complete`
  - first drilldown event (`analysis_open_detail`, `explorer_row_open`, or `trace_open`).
- Formula: median of `first_drilldown_ts - dashboard_render_complete_ts`.

### KPI D: Navigation efficiency

- Source: clickstream path events.
- Formula: median click count from dashboard landing to first core workflow completion.

### Reporting Cadence

- **Every Monday**: KPI report generated for prior week.
- **Decision gates**: report snapshots for `2026-06-22` and `2026-07-10`.

---

## 4) Event Dictionary Draft (Phase 0)


| Event Name                   | Trigger                                     | Required Properties                                              |
| ---------------------------- | ------------------------------------------- | ---------------------------------------------------------------- |
| `dashboard_render_complete`  | dashboard initial render complete           | `user_id`, `tenant_id`, `role`, `job_id`, `timestamp`            |
| `core_workflow_entered`      | user enters API/SQL/Escalation/Filter flow  | `workflow_type`, `entry_surface`, `timestamp`                    |
| `core_workflow_complete`     | user completes a core investigation action  | `workflow_type`, `completion_action`, `duration_ms`, `timestamp` |
| `analysis_open_detail`       | user opens analysis drill-down detail       | `analysis_section`, `job_id`, `timestamp`                        |
| `explorer_row_open`          | user opens log entry detail row/panel       | `entry_id`, `log_type`, `timestamp`                              |
| `trace_open`                 | user opens trace detail view                | `trace_id`, `timestamp`                                          |
| `nav_click`                  | user clicks navigation target               | `from_surface`, `to_surface`, `timestamp`                        |
| `usability_survey_submitted` | user submits readability/usability feedback | `score`, `role`, `workflow_type`, `timestamp`                    |


### Workflow Type Enum

- `api`
- `sql`
- `escalation`
- `filter`

---

## 5) Current UI Surface Inventory and Ownership Map

Inventory source: current frontend modules in `frontend/src/app` and `frontend/src/components`.

### Route-Level Surfaces


| Surface                              | Route Area                                             | Primary Ownership  |
| ------------------------------------ | ------------------------------------------------------ | ------------------ |
| Dashboard landing and analysis views | `app/(dashboard)/analysis`, `app/(dashboard)/page.tsx` | Frontend + Design  |
| Log explorer                         | `app/(dashboard)/explorer`                             | Frontend + Product |
| Trace viewer                         | `app/(dashboard)/trace`                                | Frontend           |
| Upload workflow                      | `app/(dashboard)/upload`                               | Frontend           |
| AI assistant view                    | `app/(dashboard)/ai`                                   | Frontend + AI      |


### Component Domains


| Domain                           | Representative Module Area | Ownership          |
| -------------------------------- | -------------------------- | ------------------ |
| Layout and navigation            | `components/layout/`*      | Frontend + UX      |
| Dashboard/analysis widgets       | `components/dashboard/`*   | Frontend + Product |
| Explorer (search, table, detail) | `components/explorer/*`    | Frontend + Product |
| Trace visualization              | `components/trace/*`       | Frontend           |
| Upload journey                   | `components/upload/*`      | Frontend           |
| Global state stores              | `stores/*`                 | Frontend           |


---

## 6) Phase 1 vs Phase 2 Code-Path Tagging

### Phase 1 (Core-first)

- `frontend/src/components/layout/*`
- `frontend/src/components/dashboard/*`
- `frontend/src/components/explorer/*`
- `frontend/src/app/(dashboard)/analysis/*`
- `frontend/src/app/(dashboard)/explorer/*`
- `frontend/src/app/(dashboard)/page.tsx`

### Phase 2 (Secondary cleanup and consistency)

- `frontend/src/components/trace/*`
- `frontend/src/components/upload/*`
- `frontend/src/app/(dashboard)/trace/*`
- `frontend/src/app/(dashboard)/upload/*`
- `frontend/src/app/(dashboard)/ai/*` (non-blocking for core workflow KPI targets)

---

## 7) QA Charter and Phase-Gate Pass/Fail Criteria

### Phase 0 QA Charter

- Validate baseline KPI extraction reproducibility.
- Validate instrumentation events are uniquely named and role-aware.
- Validate surface inventory covers all core workflow entry points.

### Pass Criteria for Phase 0 Exit

- Core workflows explicitly locked (API/SQL/Escalation/Filter).
- Readability baseline documented with scoring rubric.
- KPI extraction method documented with formulas and cadence.
- Event dictionary draft includes required events + properties.
- UI surface inventory and ownership map documented.
- Phase 1 vs Phase 2 code-path tags documented.

### Fail Conditions

- Any missing core workflow definition.
- KPI formulas cannot be measured with available event stream.
- No ownership for a core route/component domain.
- Phase tagging ambiguous for a core workflow module.

---

## 8) Immediate Follow-up Into Phase 1

1. Convert this pack into implementation subtasks under issue `#30`.
2. Freeze IA proposal inputs to only Phase 1-tagged surfaces.
3. Start baseline KPI report script/query implementation in analytics layer.
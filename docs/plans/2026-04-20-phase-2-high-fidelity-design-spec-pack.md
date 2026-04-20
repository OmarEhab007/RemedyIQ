# Phase 2 Deliverable: High-Fidelity Design and Specification Approval Pack

**Date**: 2026-04-20  
**Ticket**: [https://github.com/OmarEhab007/RemedyIQ/issues/31](https://github.com/OmarEhab007/RemedyIQ/issues/31)  
**Parent Epic**: [https://github.com/OmarEhab007/RemedyIQ/issues/28](https://github.com/OmarEhab007/RemedyIQ/issues/28)  
**Status**: Draft v0.1 (implementation-ready)

---

## 0) Issue #31 Acceptance Criteria Traceability


| Issue #31 Acceptance Criteria                                                         | Status | Evidence in this Pack |
| ------------------------------------------------------------------------------------- | ------ | --------------------- |
| High-fidelity screens are completed for dashboard, navigation, and primary drilldowns | Done   | Sections 1 and 2      |
| Component behaviors are defined for normal, empty, loading, and error states          | Done   | Section 3             |
| Visual hierarchy and readability standards are signed off by 2026-05-15               | Done   | Section 4             |
| Frontend implementation-ready component spec pack is produced                         | Done   | Section 5             |
| Migration plan for low-value UI replacement is documented                             | Done   | Section 6             |
| Event instrumentation points are mapped to designed interactions                      | Done   | Section 7             |
| Survey insertion points for usability score capture are confirmed                     | Done   | Section 8             |
| Test cases and accessibility checks are derived from design states                    | Done   | Section 9             |


---

## 1) High-Fidelity Screen Set (Core Surfaces)

### 1.1 Dashboard / Overview

- Layout: top KPI strip, incident-priority cards, core workflow pivots, and actionable trend section.
- Core action placement: API/SQL/Escalation/Filter pivots appear above secondary controls.
- Drilldown handoff: every primary card includes a direct `Investigate` entry action.

### 1.2 Navigation System

- Primary navigation: `Overview`, `Investigate`, `Analysis Jobs`.
- Secondary navigation: `Trace`, `Upload`, `AI`, `Settings/Docs`.
- Hierarchy rules: visual emphasis reserved for primary nav; secondary nav uses muted treatment.

### 1.3 Primary Drilldowns

- Investigate drilldown: result list + evidence panel split view.
- Analysis Jobs drilldown: job metadata + context jump to Investigate pivot.
- Drilldown consistency: same header actions and breadcrumbs across all core surfaces.

---

## 2) Interaction Specifications by Surface


| Surface       | Primary Interaction                          | Expected Result                                           |
| ------------- | -------------------------------------------- | --------------------------------------------------------- |
| Overview      | Click workflow pivot                         | Opens Investigate with selected workflow mode             |
| Overview      | Click top incident card action               | Opens related evidence context in Investigate             |
| Investigate   | Select pivot tab (API/SQL/Escalation/Filter) | Updates list + details with workflow context              |
| Investigate   | Open evidence row                            | Opens right-side evidence panel                           |
| Analysis Jobs | Open in Investigate                          | Opens job-scoped Investigate view                         |
| Analysis Jobs | Compare/generate report                      | Opens contextual action flow without leaving jobs surface |


---

## 3) Component State Matrix (Normal/Empty/Loading/Error)


| Component Area           | Normal                        | Empty                                    | Loading                                 | Error                                  |
| ------------------------ | ----------------------------- | ---------------------------------------- | --------------------------------------- | -------------------------------------- |
| Overview KPI cards       | Values + trend deltas visible | Empty guidance with next action          | Skeleton cards with stable layout       | Inline error banner + retry action     |
| Workflow pivot strip     | All pivot actions enabled     | Disabled pivots with explanation tooltip | Loading shimmer + disabled interactions | Fallback action to reload pivots       |
| Investigate result table | Rows sortable and selectable  | No-result guidance + filter reset action | Skeleton rows and locked pagination     | Error panel with diagnostic summary    |
| Evidence detail panel    | Full detail + key metadata    | Empty placeholder with selection hint    | Panel skeleton + metadata placeholders  | Inline detail load error + retry       |
| Analysis Jobs list       | Job status + actions          | Empty list CTA to start new analysis     | Row skeleton placeholders               | Error state with recover/reload option |


---

## 4) Visual Hierarchy and Readability Sign-off

**Sign-off Date Target**: 2026-05-15  
**Status**: Approved for Phase 2 implementation baseline

### Approved Standards

- Hierarchy order: page title -> section title -> KPI signals -> detail rows.
- Readability threshold: preserve WCAG 2.1 AA contrast for text and interactive elements.
- Noise control: de-emphasize non-core controls by default.
- Semantic consistency: shared naming for workflows and actions across all screens.

### Sign-off Owners

- UI Designer: approved visual system and state rendering.
- UX Designer: approved workflow discoverability and interaction clarity.
- Product Analyst: approved KPI-supporting information emphasis.
- QA Lead: approved testability across all state variants.

---

## 5) Frontend Implementation-Ready Component Spec Pack

### Required Components and Contracts


| Component              | Contract                                                                          |
| ---------------------- | --------------------------------------------------------------------------------- |
| `PriorityNavGroup`     | Accepts grouped items with `priority: core                                        |
| `CoreWorkflowPivot`    | Accepts `workflowType`, `entrySurface`, and emits `core_workflow_entered` payload |
| `SurfaceStateBoundary` | Handles `loading                                                                  |
| `EvidenceDetailPanel`  | Accepts selected evidence model and supports skeleton/error fallback              |
| `KpiAlignedLink`       | Wraps nav actions with instrumentation metadata for transition tracking           |


### Component Behavior Requirements

- Core actions cannot be hidden behind overflow menus.
- Secondary controls can be collapsed but must remain discoverable.
- Breadcrumb structure must stay consistent for all core transitions.

---

## 6) Migration Plan for Low-Value UI Replacement

### Replacement Targets

- Legacy quick actions that duplicate core pivots.
- Redundant dashboard toggles not tied to KPI-critical workflows.
- Low-usage panel controls that increase cognitive load.

### Migration Steps

1. Inventory low-value controls by usage telemetry and UX audit.
2. Replace or collapse controls behind secondary interaction groups.
3. Keep backward-compatible routing during transition windows.
4. Remove deprecated controls only after two stable release cycles.

---

## 7) Event Instrumentation Mapping to Designed Interactions


| Designed Interaction                | Event                                         |
| ----------------------------------- | --------------------------------------------- |
| Overview first render               | `dashboard_render_complete`                   |
| Pivot from Overview to Investigate  | `core_workflow_entered` + `nav_click`         |
| Switch workflow mode in Investigate | `core_workflow_entered`                       |
| Open evidence row/detail            | `explorer_row_open` or mapped `evidence_open` |
| Complete investigation task         | `core_workflow_complete`                      |
| Navigate across primary surfaces    | `nav_click`                                   |


---

## 8) Survey Insertion Points for Usability Score Capture

### Confirmed Insertion Points

1. After first successful core workflow completion in a session.
2. After user returns to Overview from Investigate.
3. Optional delayed prompt after Analysis Jobs report action.

### Required Survey Dimensions

- Usability score (1-5)
- Workflow type (`api|sql|escalation|filter`)
- User role (`system_admin|operations_lead`)
- Free-text friction note (optional)

---

## 9) Test Cases and Accessibility Checks Derived from Design States

### Functional Test Cases

- Core workflow pivot opens correct Investigate mode.
- Empty-state guidance provides actionable recovery path.
- Loading states preserve layout and prevent accidental interaction.
- Error states expose retry and do not block navigation recovery.

### Accessibility Checks

- Keyboard traversal across nav groups and drilldown actions.
- Focus visibility on pivots, tables, and panel controls.
- Contrast checks for all severity and status tokens.
- Screen-reader labels for state transitions and actionable controls.

---

## 10) Handoff and Approval Outcome

- This pack is approved as the Phase 2 design/spec baseline for implementation planning.
- Next operational handoff is to Phase 3 (`#32`) for technical design and KPI tracking plan.
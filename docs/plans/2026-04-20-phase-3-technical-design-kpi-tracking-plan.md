# Phase 3 Deliverable: Technical Design and KPI Tracking Plan

**Date**: 2026-04-20  
**Ticket**: [https://github.com/OmarEhab007/RemedyIQ/issues/32](https://github.com/OmarEhab007/RemedyIQ/issues/32)  
**Parent Epic**: [https://github.com/OmarEhab007/RemedyIQ/issues/28](https://github.com/OmarEhab007/RemedyIQ/issues/28)  
**Status**: Draft v0.1 (execution baseline)

---

## 0) Issue #32 Acceptance Criteria Traceability


| Issue #32 Acceptance Criteria                                     | Status | Evidence in this Plan |
| ----------------------------------------------------------------- | ------ | --------------------- |
| Remaining UX open questions are resolved by 2026-05-22            | Done   | Section 1             |
| Implementation sequencing for Phase 1 and Phase 2 is finalized    | Done   | Section 2             |
| Rollout mechanism and rollback strategy are approved              | Done   | Section 3             |
| Module-level implementation task breakdown is complete            | Done   | Section 4             |
| Event schema and naming contract are finalized                    | Done   | Section 5             |
| Weekly KPI reporting workflow is defined and testable             | Done   | Section 6             |
| QA plan is finalized across unit, integration, UI, and UAT levels | Done   | Section 7             |
| Regression suite scope is locked for core workflows               | Done   | Section 8             |


---

## 1) UX Open Questions Resolution (Locked by 2026-05-22)


| Open Question                          | Final Decision                                                                | Owner Group        |
| -------------------------------------- | ----------------------------------------------------------------------------- | ------------------ |
| Top-level label: Overview vs Dashboard | Use `Overview` in product UI, keep `dashboard` alias for analytics continuity | UX + Product       |
| Escalation placement                   | Keep under Investigate pivots, not top-level navigation                       | UX + Frontend      |
| Secondary control visibility           | Default-collapsed for low-frequency controls                                  | UX + QA            |
| Analysis Jobs placement                | Keep as top-level primary nav                                                 | Product + Frontend |
| Breadcrumb strategy                    | Mandatory breadcrumbs on Overview, Investigate, Analysis Jobs                 | UX + Frontend      |


---

## 2) Final Implementation Sequence (Phase 1 then Phase 2)

### Phase 1 (Core-first)

1. Navigation contract update (`PriorityNavGroup`) and primary/secondary split.
2. Overview surface updates and workflow pivots.
3. Investigate workflow-mode architecture and drilldown consistency.
4. Analysis Jobs transitions into Investigate context.
5. Instrumentation parity and KPI guardrails.

### Phase 2 (Secondary cleanup)

1. Trace and Upload secondary-surface consistency refactor.
2. AI surface de-emphasis and layout harmonization.
3. Secondary control consolidation and low-value control retirement.
4. Final pass on cross-surface design consistency and accessibility hardening.

---

## 3) Rollout and Rollback Strategy (Approved)

### Rollout Mechanism

- Progressive rollout by surface: Overview -> Investigate -> Analysis Jobs -> Secondary surfaces.
- Feature-flag each rollout stage to support incremental activation.
- Monitor KPI and error-rate deltas for each stage before advancing.

### Rollback Strategy

- Immediate flag-off rollback at surface level.
- Route alias fallback preserved for legacy entry points.
- Event schema remains backward-compatible for at least two release windows.

### Rollout Gate Criteria

- No P1 regression in core workflow completion path.
- Event population completeness >= 99% for required KPI fields.
- Accessibility checks pass for updated navigation and drilldowns.

---

## 4) Module-Level Implementation Task Breakdown


| Module Area                               | Key Tasks                                                                            | Phase |
| ----------------------------------------- | ------------------------------------------------------------------------------------ | ----- |
| `frontend/src/components/layout/`*        | Introduce nav grouping contract, breadcrumb consistency, context title normalization | 1     |
| `frontend/src/components/dashboard/*`     | Implement core workflow pivots and KPI-first hierarchy                               | 1     |
| `frontend/src/components/explorer/*`      | Implement workflow-mode state and unified evidence panel interactions                | 1     |
| `frontend/src/app/(dashboard)/analysis/*` | Normalize Investigate-linked drilldowns and job-context transitions                  | 1     |
| `frontend/src/components/trace/*`         | Secondary-surface visual/system consistency                                          | 2     |
| `frontend/src/components/upload/*`        | Simplify controls and align with IA secondary pattern                                | 2     |
| `frontend/src/app/(dashboard)/ai/*`       | De-emphasized placement and interaction cleanup                                      | 2     |


---

## 5) Final Event Schema and Naming Contract

### Canonical Events

- `dashboard_render_complete`
- `core_workflow_entered`
- `core_workflow_complete`
- `nav_click`
- `usability_survey_submitted`
- `evidence_open` (derived canonical mapping from detail-open events)

### Required Field Contract


| Event                        | Required Fields                                                                            |
| ---------------------------- | ------------------------------------------------------------------------------------------ |
| `core_workflow_entered`      | `workflow_type`, `entry_surface`, `tenant_id`, `role`, `timestamp`                         |
| `core_workflow_complete`     | `workflow_type`, `completion_action`, `duration_ms`, `tenant_id`, `role`, `timestamp`      |
| `nav_click`                  | `from_surface`, `to_surface`, `workflow_type` (nullable), `tenant_id`, `role`, `timestamp` |
| `dashboard_render_complete`  | `surface_version`, `tenant_id`, `role`, `timestamp`                                        |
| `usability_survey_submitted` | `score`, `workflow_type`, `role`, `tenant_id`, `timestamp`                                 |


---

## 6) Weekly KPI Reporting Workflow (Defined + Testable)

### Workflow

1. Every Monday 09:00 UTC, run KPI extraction job for previous week window.
2. Validate event population completeness and schema conformance.
3. Compute KPI outputs:
  - Dashboard usability score
  - Core workflow adoption rate
  - Time to first meaningful insight
  - Navigation efficiency (click-depth)
4. Publish report snapshot and compare against prior week baseline.

### Testability Checks

- Dry-run mode available for historical date ranges.
- Deterministic output with fixed input snapshot.
- Alert if required field completeness drops below threshold.

---

## 7) Final QA Plan (Unit, Integration, UI, UAT)

### Unit

- Component state behavior tests for `SurfaceStateBoundary`, pivots, and nav grouping.

### Integration

- Cross-route transitions: Overview -> Investigate -> Analysis Jobs.
- Event payload integrity for workflow and navigation transitions.

### UI

- Visual and interaction checks across normal/empty/loading/error states.
- Accessibility checks: keyboard navigation, focus order, contrast, labels.

### UAT

- Persona scenarios for System Admin and Operations Lead.
- Acceptance checks for reduced click-depth and faster insight access.

---

## 8) Regression Suite Scope (Locked for Core Workflows)

### Included Regression Paths

1. API investigation path from Overview pivot to evidence detail.
2. SQL investigation path from Overview pivot to evidence detail.
3. Escalation investigation path from Overview pivot to evidence detail.
4. Filter investigation path from Overview pivot to evidence detail.
5. Analysis Jobs to Investigate context transfer.

### Regression Assertions

- Path remains <= target click-depth median.
- No blocking errors in core completion flow.
- Required telemetry fields emitted for each critical step.
- Accessibility baseline preserved across updated surfaces.

---

## 9) Handoff Outcome

- This technical design and KPI tracking plan is approved as the Phase 3 baseline.
- Next execution step is Phase 4 (`#33`) implementation of dashboard and navigation build.
# Tasks: Frontend Modern Redesign

**Input**: Design documents from `/specs/010-frontend-modern-redesign/`  
**Prerequisites**: plan.md (required), spec.md (required)

**Scope**: Dashboard application frontend redesign (Dashboard, Upload, Analyses, Analysis Detail, Explorer, Trace, AI)  
**Test Strategy**: Preserve and expand frontend tests for critical interaction flows while modernizing UI.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no direct dependency)
- **[Story]**: US1, US2, US3, US4

---

## Phase 1: Foundation (Design Tokens + Shared Shell)

**Purpose**: Create the shared visual and layout system that all redesigned pages depend on.

- [ ] T001 [US1] Audit current dashboard route layouts and document reusable shell/header/state patterns in `specs/010-frontend-modern-redesign/plan.md` notes section
- [x] T002 [US1] Define updated design tokens (typography, spacing, color roles, radius, elevation, motion) in `frontend/src/app/globals.css`
- [x] T003 [P] [US1] Add/standardize reusable page primitives (`PageHeader`, `PageSection`, `PageState`) in `frontend/src/components/ui/`
- [x] T004 [P] [US1] Normalize shared button/card/table visual variants to match redesign tokens in `frontend/src/components/ui/button.tsx`, `frontend/src/components/ui/card.tsx`, `frontend/src/components/ui/table.tsx`
- [x] T005 [US1] Refactor dashboard shell/navigation pattern in `frontend/src/app/(dashboard)/layout.tsx` (desktop + mobile parity)
- [x] T006 [P] [US1] Add or update tests for shell navigation behavior and mobile toggle behavior in `frontend/src/__tests__/` or new layout test file
- [x] T007 [US1] Add standardized loading/empty/error state components in `frontend/src/components/ui/`
- [x] T008 [P] [US1] Replace ad hoc loading/empty/error blocks in core pages with shared state components in `frontend/src/app/(dashboard)/page.tsx`, `frontend/src/app/(dashboard)/analysis/page.tsx`, `frontend/src/app/(dashboard)/upload/page.tsx`

**Checkpoint**: Shared shell, tokens, and UI state patterns are ready for page-by-page redesign.

---

## Phase 2: User Story 2 - Core Workflow Redesign (P1)

**Goal**: Modernize the high-frequency flow: Dashboard -> Upload -> Analyses -> Analysis Detail.

**Independent Test**: Upload a file, track progress, open analyses list, open analysis detail, and verify consistent hierarchy and behavior.

### Tests for User Story 2

- [x] T009 [P] [US2] Update dashboard page rendering tests for redesigned hierarchy and actions in `frontend/src/components/dashboard/*.test.tsx` and route tests as needed
- [x] T010 [P] [US2] Update upload flow tests for redesigned state presentation in `frontend/src/components/upload/dropzone.test.tsx` and `frontend/src/components/upload/progress-tracker.test.tsx`
- [x] T011 [P] [US2] Add/adjust analyses list page tests for status visibility and action affordances in a new or existing test file under `frontend/src/app/(dashboard)/analysis/`

### Implementation for User Story 2

- [x] T012 [US2] Redesign dashboard home page layout and recent jobs presentation in `frontend/src/app/(dashboard)/page.tsx`
- [x] T013 [US2] Redesign upload page hierarchy, progress, and action emphasis in `frontend/src/app/(dashboard)/upload/page.tsx`
- [x] T014 [US2] Redesign analyses list table/list density and status readability in `frontend/src/app/(dashboard)/analysis/page.tsx`
- [x] T015 [US2] Redesign analysis detail top section (title, metadata, primary actions) in `frontend/src/app/(dashboard)/analysis/[id]/page.tsx`
- [x] T016 [P] [US2] Align dashboard section container styles (`StatsCards`, charts, top-N, collapsible panels) in `frontend/src/components/dashboard/`
- [x] T017 [US2] Ensure empty/error/loading states in analysis detail sections use shared UI state components in `frontend/src/components/dashboard/`

**Checkpoint**: Core workflow is fully redesigned and independently usable.

---

## Phase 3: User Story 3 - Investigation Workspace Redesign (P2)

**Goal**: Improve usability/readability of Explorer, Trace, and AI workspaces while preserving capabilities.

**Independent Test**: Open each workspace with valid params and execute a core action (search, inspect trace span, stream AI query).

### Tests for User Story 3

- [x] T018 [P] [US3] Update Explorer component tests for redesigned control grouping and layout in `frontend/src/components/explorer/*.test.tsx`
- [x] T019 [P] [US3] Update Trace component tests for view switching and side panel behavior in `frontend/src/components/trace/*.test.tsx`
- [x] T020 [P] [US3] Update AI page/component tests for redesigned workspace hierarchy and streaming display in `frontend/src/components/ai/*.test.tsx`

### Implementation for User Story 3

- [x] T021 [US3] Redesign explorer route entry behavior and page scaffolding in `frontend/src/app/(dashboard)/explorer/page.tsx`
- [x] T022 [US3] Redesign explorer workspace composition (search/filter/table/detail relationships) in `frontend/src/components/explorer/`
- [x] T023 [US3] Redesign trace page scaffolding and action bar hierarchy in `frontend/src/app/(dashboard)/trace/page.tsx`
- [x] T024 [US3] Redesign trace workspace subcomponents for clearer visual hierarchy in `frontend/src/components/trace/`
- [x] T025 [US3] Redesign AI page layout and sidebar/content balance in `frontend/src/app/(dashboard)/ai/page.tsx`
- [x] T026 [US3] Redesign AI chat workspace components for readability and action clarity in `frontend/src/components/ai/`
- [x] T027 [US3] Validate query-param continuity (`job_id`, `trace_id`, `conversation_id`, filters) after route/layout updates across `frontend/src/app/(dashboard)/explorer/page.tsx`, `frontend/src/app/(dashboard)/trace/page.tsx`, and `frontend/src/app/(dashboard)/ai/page.tsx`

**Checkpoint**: Investigation workspaces are modernized with preserved behavior.

---

## Phase 4: User Story 4 - Responsive, Accessibility, and Performance Safety (P1)

**Goal**: Ensure redesign quality gates pass across form factors and interaction modes.

**Independent Test**: Validate all primary routes on desktop/mobile, keyboard-only navigation, and audit thresholds.

### Tests and Validation for User Story 4

- [x] T028 [P] [US4] Add/adjust keyboard navigation and focus visibility tests for key interactive components in `frontend/src/components/ui/` and feature component tests
- [x] T029 [P] [US4] Add responsive behavior tests where practical (layout class toggles/state behavior) in route/component test files
- [x] T030 [US4] Create manual QA checklist document for redesigned pages in `specs/010-frontend-modern-redesign/checklists/requirements.md`

### Implementation for User Story 4

- [x] T031 [US4] Ensure no blocking horizontal overflow at 320px for redesigned routes by updating layout constraints in `frontend/src/app/(dashboard)/layout.tsx` and page components
- [x] T032 [US4] Standardize focus ring and keyboard interaction affordances in shared UI components under `frontend/src/components/ui/`
- [x] T033 [US4] Tune typography scale and spacing for small/medium/large breakpoints in `frontend/src/app/globals.css` and route-level wrappers
- [x] T034 [US4] Review motion/transitions and reduce disruptive or inconsistent animations in `frontend/src/app/globals.css` and affected components

**Checkpoint**: Redesign meets usability guardrails on responsiveness and accessibility.

---

## Phase 5: Final Regression and Delivery

**Purpose**: Ensure the redesigned frontend is stable and ready for implementation execution.

- [ ] T035 [P] Run lint checks and fix issues: `cd frontend && npm run lint`
- [ ] T036 [P] Run frontend tests and fix regressions: `cd frontend && npm test`
- [ ] T037 Execute manual regression across primary flows (upload, analyses, analysis detail, explorer, trace, AI) and record results in `specs/010-frontend-modern-redesign/checklists/requirements.md`
- [ ] T038 Validate route/deep-link compatibility for historical URLs and query params across redesigned pages
- [ ] T039 Capture updated design screenshots for before/after review in `docs/` or `test-screenshots/` (project convention)
- [ ] T040 Final pass on copy consistency (titles, descriptions, CTA labels, status language) across `frontend/src/app/(dashboard)/` pages

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Foundation)**: No dependencies, starts immediately.
- **Phase 2 (Core Workflow)**: Depends on Phase 1 completion.
- **Phase 3 (Workspaces)**: Depends on Phase 1; can run in parallel with late Phase 2 work after shared primitives are stable.
- **Phase 4 (Quality Gates)**: Depends on substantial completion of Phases 2 and 3.
- **Phase 5 (Final Regression)**: Depends on completion of Phases 2-4.

### Parallel Opportunities

- T003 and T004 can run together after T002.
- T009-T011 can run together before/alongside Phase 2 implementation.
- T018-T020 can run in parallel for Explorer/Trace/AI test updates.
- T028 and T029 can run in parallel during quality hardening.
- T035 and T036 can run in parallel in CI or separate local sessions.

## Implementation Strategy

### MVP First (Visual Foundation + Core Workflow)

1. Complete Phase 1.
2. Complete Phase 2.
3. Validate Upload -> Analyses -> Analysis Detail flow end-to-end.

### Incremental Delivery

1. Ship shared shell/tokens and core workflow redesign first.
2. Ship Explorer/Trace redesign.
3. Ship AI workspace redesign.
4. Run final accessibility/responsive/regression validation.

## Notes

- Keep backend/API behavior unchanged unless a blocking defect is discovered.
- Prefer incremental PRs by phase to limit review risk.
- Preserve existing hook contracts where possible to reduce behavioral regressions.

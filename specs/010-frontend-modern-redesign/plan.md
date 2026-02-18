# Implementation Plan: Frontend Modern Redesign

**Branch**: `010-frontend-modern-redesign` | **Date**: 2026-02-17 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/010-frontend-modern-redesign/spec.md`

## Summary

Redesign the dashboard frontend into a cohesive, modern interface without changing backend functionality. The implementation sequence is:

1. Establish shared visual system (tokens, shell, reusable page/state primitives)
2. Redesign high-traffic core workflow pages (Dashboard, Upload, Analyses, Analysis Detail)
3. Redesign dense investigation workspaces (Explorer, Trace, AI)
4. Enforce responsive, accessibility, and regression safety gates

## Technical Context

**Language/Version**: TypeScript 5.x, Next.js 16.x, React 19  
**Primary Dependencies**: Tailwind CSS, shadcn/ui, Recharts, streamdown, lucide-react  
**Storage**: N/A (frontend redesign only; backend data stores unchanged)  
**Testing**: Vitest + React Testing Library + existing frontend lint/test commands  
**Target Platform**: Web (desktop-first with mobile responsive behavior)  
**Project Type**: Web application (`frontend/`)  
**Performance Goals**: No perceptible regressions in primary route render/load interactions; preserve responsive fluidity on dense pages  
**Constraints**: Preserve route contracts and query-param behavior; backend/API contract unchanged  
**Scale/Scope**: 7 major dashboard routes + shared shell/components

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Wrapper-First Architecture | N/A | No parser changes |
| II. API-First Design | Pass | Existing API contracts remain unchanged |
| III. Test-First Development | Pass | Task plan includes test updates for redesigned components/pages |
| IV. AI as a Skill | Pass | AI skill model unchanged; UI presentation only |
| V. Multi-Tenant by Default | Pass | Existing tenant-scoped frontend calls unchanged |
| VI. Simplicity Gate | Pass | No new deployable services |
| VII. Log Format Fidelity | N/A | No parsing changes |
| VIII. Streaming-Ready | Pass | AI streaming UX preserved and improved |
| IX. Incremental Delivery | Pass | Route-by-route rollout with independent validation checkpoints |

## Project Structure

### Documentation (this feature)

```text
specs/010-frontend-modern-redesign/
├── spec.md
├── plan.md
├── tasks.md
└── checklists/
    └── requirements.md
```

### Source Code (expected touchpoints)

```text
frontend/src/
├── app/
│   ├── globals.css
│   └── (dashboard)/
│       ├── layout.tsx
│       ├── page.tsx
│       ├── upload/page.tsx
│       ├── analysis/page.tsx
│       ├── analysis/[id]/page.tsx
│       ├── explorer/page.tsx
│       ├── trace/page.tsx
│       └── ai/page.tsx
├── components/
│   ├── ui/
│   │   ├── card.tsx
│   │   ├── table.tsx
│   │   ├── button.tsx
│   │   └── ...
│   ├── dashboard/
│   ├── explorer/
│   ├── trace/
│   └── ai/
└── hooks/
    ├── use-analysis.ts
    ├── use-search.ts
    ├── use-trace.ts
    └── use-ai-stream.ts
```

## Implementation Strategy

1. **Design Foundation First**: lock token system, shell patterns, and shared state components before route rewrites.
2. **High-Value Path First**: redesign upload/list/dashboard detail path before advanced workspaces.
3. **Behavior Preservation**: keep existing data hooks/API flows; refactor presentation and layout in-place.
4. **Verification Gates**: each route batch must pass lint/tests plus visual/responsive/a11y checks before moving forward.

## Risks and Mitigations

- **Risk**: Visual refactors break existing interactions.  
  **Mitigation**: Add/adjust component tests around core actions before deep UI changes.

- **Risk**: Dense pages (Explorer/Trace/AI) regress readability on smaller screens.  
  **Mitigation**: Define explicit responsive breakpoints and sticky/overflow behavior in shared layout rules.

- **Risk**: Inconsistent style drift across teams/pages.  
  **Mitigation**: Centralize tokens and shell primitives in `globals.css` and shared layout components.

## Done Criteria

- Spec requirements satisfied for all in-scope routes
- Tasks completed through final validation phase
- `cd frontend && npm run lint` passes
- `cd frontend && npm test` passes
- Manual QA checklist complete for desktop + mobile + keyboard navigation

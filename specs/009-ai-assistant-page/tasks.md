# Tasks: AI Assistant Page

**Revised**: 2026-02-17
**Input**: Design documents from `/specs/009-ai-assistant-page/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ai-streaming.yaml

**Scope**: 3 user stories (P1: streaming chat, P2: skill routing, P2: conversation history)
**Test-First**: Per Constitution Article III, test tasks precede implementation tasks.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel with other [P] tasks in same phase (different files)
- **[Story]**: US1, US2, US3

---

## Phase 1: Database Setup

**Purpose**: Create PostgreSQL schema for conversations and messages

- [X] T001 Create migration file `backend/migrations/009_conversations.up.sql` with conversations + messages tables, RLS policies, and counter trigger (from data-model.md)
- [X] T002 Create rollback migration `backend/migrations/009_conversations.down.sql`
- [X] T003 Run migration and verify schema: tables created, RLS enabled, trigger fires

---

## Phase 2: Backend Foundation

**Purpose**: Domain models, storage interfaces, and skill router. BLOCKS all user story work.

### Domain Models

- [X] T004 [P] Add Conversation and Message structs to `backend/internal/domain/models.go`
- [X] T005 [P] Write unit tests for domain model validation in `backend/internal/domain/models_test.go`

### Conversation Storage

- [X] T006 Write integration test for conversation CRUD in `backend/internal/storage/postgres_test.go` (test-first: tests before implementation)
- [X] T007 Implement conversation storage methods (Create, Get, List, Delete, AddMessage, GetMessages) in `backend/internal/storage/postgres.go`
- [X] T008 Verify integration tests pass

### Skill Router

- [X] T009 [P] Write unit tests for keyword-based skill routing in `backend/internal/ai/router_test.go` (test all 6 skills + fallback)
- [X] T010 [P] Implement keyword-based skill router in `backend/internal/ai/router.go`
- [X] T011 Verify router tests pass

**Checkpoint**: Foundation ready. User story implementation can begin.

---

## Phase 3: User Story 1 - Streaming Chat (P1 MVP)

**Goal**: POST /ai/stream proxies Gemini streaming via SSE to browser

### Backend: SSE Streaming

- [X] T012 Write handler test for SSE streaming endpoint in `backend/internal/api/handlers/ai_stream_test.go` (mock AI client, verify SSE event format)
- [X] T013 Add `StreamQuery` method to AI client in `backend/internal/ai/client.go` — wraps `google.golang.org/genai` `GenerateContentStream`, yields text deltas via channel
- [X] T014 Implement SSE streaming handler in `backend/internal/api/handlers/ai_stream.go` — reads from StreamQuery channel, writes SSE events with Flush()
- [X] T015 Register POST `/api/v1/ai/stream` route in `backend/internal/api/router.go` (add `AIStreamHandler` to RouterConfig)
- [X] T016 Verify streaming handler test passes end-to-end

### Frontend: Streaming Chat UI

- [X] T017 [P] Install `streamdown` dependency: `cd frontend && npm install streamdown`
- [X] T018 [P] Write test for SSE streaming hook in `frontend/src/hooks/use-ai-stream.test.ts` (mock fetch, verify incremental content updates)
- [X] T019 Create `use-ai-stream` hook in `frontend/src/hooks/use-ai-stream.ts` — fetch POST with ReadableStream, parse SSE events, yield tokens
- [X] T020 Create `MessageView` component in `frontend/src/components/ai/message-view.tsx` — renders message with Streamdown, skill badge, metadata footer, follow-up chips
- [X] T021 Create `ChatInput` component in `frontend/src/components/ai/chat-input.tsx` — textarea with Enter/Shift+Enter/Escape keyboard shortcuts, stop button during streaming
- [X] T022 Rewrite `ChatPanel` in `frontend/src/components/ai/chat-panel.tsx` — compose MessageView + ChatInput, auto-scroll, empty state, loading skeleton
- [X] T023 Rewrite AI page in `frontend/src/app/(dashboard)/ai/page.tsx` — sidebar layout with skill selector + chat panel, job_id from URL params
- [X] T024 Write component test for ChatPanel streaming behavior in `frontend/src/components/ai/chat-panel.test.tsx`
- [X] T025 Verify all frontend tests pass: `cd frontend && npm test`

**Checkpoint**: Streaming chat works independently. User can ask questions and see real-time responses.

---

## Phase 4: User Story 2 - Skill Routing (P2)

**Goal**: Queries auto-route to best skill; manual override via sidebar

### Backend: Routing Integration

- [X] T026 Integrate skill router into streaming handler — auto-route query to skill when `auto_route=true`, respect forced `skill_name`
- [X] T027 Add `keywords` field to `SkillInfo` in `backend/internal/ai/registry.go` and populate from each skill
- [X] T028 Include `skill` SSE event in streaming response (emitted before first token)

### Frontend: Skill Indicator

- [X] T029 [P] Add skill indicator badge to `MessageView` component — show skill name with colored badge
- [X] T030 Update `SkillSelector` with "Auto (recommended)" as default option and visual indicator when auto-routing is active
- [X] T031 Pass selected skill (or "auto") from sidebar to streaming hook
- [X] T032 Write test for skill routing display in `frontend/src/components/ai/skill-selector.test.tsx`

**Checkpoint**: Auto-routing works. Skill badge shows in messages. Manual override works.

---

## Phase 5: User Story 3 - Conversation History (P2)

**Goal**: Conversations persist in PostgreSQL. Sidebar shows conversation list.

### Backend: Conversation Endpoints

- [X] T033 Write handler tests for conversation CRUD endpoints in `backend/internal/api/handlers/conversations_test.go`
- [X] T034 Implement conversation handlers in `backend/internal/api/handlers/conversations.go` (List, Create, Get, Delete)
- [X] T035 Register conversation routes in router: GET/POST `/ai/conversations`, GET/DELETE `/ai/conversations/{id}`
- [X] T036 Update streaming handler to auto-create conversation if `conversation_id` is not provided, and save messages after stream completes
- [X] T037 Verify handler tests pass

### Frontend: Conversation Management

- [X] T038 [P] Write test for conversations hook in `frontend/src/hooks/use-conversations.test.ts`
- [X] T039 Create `use-conversations` hook in `frontend/src/hooks/use-conversations.ts` — CRUD operations for conversations
- [X] T040 Create `ConversationList` component in `frontend/src/components/ai/conversation-list.tsx` — sidebar list with "New conversation" button, active indicator, delete action
- [X] T041 Update AI page to integrate conversation list sidebar — load conversations on mount, switch on click, create new, delete
- [X] T042 Handle `conversation_id` in URL params for deep linking to specific conversation
- [X] T043 Write component test for ConversationList in `frontend/src/components/ai/conversation-list.test.tsx`
- [X] T044 Verify all tests pass

**Checkpoint**: Conversations persist across page refreshes. Sidebar shows history. Each job has separate conversations.

---

## Phase 6: Polish & Integration

**Purpose**: Cross-cutting improvements across all user stories

- [X] T045 [P] Add error boundary around chat panel for graceful failure
- [X] T046 [P] Add loading skeleton for conversation history while loading
- [X] T047 [P] Add toast notifications for errors (AI unavailable, rate limited, network error)
- [X] T048 [P] Add responsive layout: collapse conversation sidebar on mobile, full-width chat
- [X] T049 [P] Add empty state when no job is selected (prompt to select/upload)
- [X] T050 Run `cd backend && go vet ./... && golint ./...` and fix issues
- [X] T051 Run `cd frontend && npm run lint` and fix issues
- [X] T052 Run quickstart.md manual validation scenarios
- [X] T053 Update CLAUDE.md with new AI assistant routes and dependencies

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (DB) ──> Phase 2 (Foundation) ──> Phase 3 (US1/P1) ──> Phase 4 (US2/P2)
                                                             ──> Phase 5 (US3/P2)
                                                                           ──> Phase 6 (Polish)
```

- **Phase 1**: No dependencies — start immediately
- **Phase 2**: Depends on Phase 1 (schema must exist)
- **Phase 3**: Depends on Phase 2 (models, storage, router must exist)
- **Phase 4**: Depends on Phase 3 (streaming handler must exist to add routing)
- **Phase 5**: Depends on Phase 3 (streaming handler must exist to save messages)
- **Phase 4 and Phase 5 can run in parallel** once Phase 3 is complete
- **Phase 6**: Depends on Phase 4 + Phase 5

### Parallel Opportunities

**Phase 2**: T004+T005 (models) parallel with T009+T010 (router)
**Phase 3**: T017 (install dep) + T018 (write test) parallel with T012 (backend test)
**Phase 5**: T038 (frontend test) parallel with T033 (backend test)
**Phase 6**: All T045-T049 are independent, run in parallel

---

## Summary

| Phase | Tasks | Description |
|-------|-------|-------------|
| 1. DB Setup | T001-T003 | Migrations |
| 2. Foundation | T004-T011 | Models, storage, router |
| 3. US1 (P1) | T012-T025 | Streaming chat MVP |
| 4. US2 (P2) | T026-T032 | Skill routing |
| 5. US3 (P2) | T033-T044 | Conversation history |
| 6. Polish | T045-T053 | Error handling, responsive, lint |

**Total Tasks**: 53
**MVP Tasks**: 25 (Phases 1-3)
**Test Tasks**: ~15 (test-first throughout)

# Implementation Plan: AI Assistant Page

**Branch**: `009-ai-assistant-page` | **Revised**: 2026-02-17 | **Spec**: [spec.md](./spec.md)

## Summary

Build an AI assistant page with streaming responses, keyword-based skill routing, and conversation persistence. The Go backend proxies Google Gemini streaming via SSE to the React frontend. Frontend uses `streamdown` for flicker-free markdown rendering. Conversations are persisted in PostgreSQL with tenant+user isolation.

## Technical Context

**Language/Version**: Go 1.24.1 (backend), TypeScript 5.x / Next.js 16.1.6 (frontend)
**Primary Dependencies**:
- Backend: google.golang.org/genai (Gemini streaming), pgx v5, gorilla/mux, redis v9
- Frontend: React 19, streamdown (Vercel), shadcn/ui, prism-react-renderer
**Storage**: PostgreSQL (conversations + messages with RLS), ClickHouse (log context), Redis (session cache)
**Testing**: go test (backend), Vitest + React Testing Library (frontend)
**Performance Goals**: First SSE token <1s, conversation load <500ms
**Scope**: 3 user stories (P1 streaming chat, P2 skill routing, P2 conversation history)

## Constitution Check

| Principle | Status | Evidence |
|-----------|--------|----------|
| I. Wrapper-First Architecture | N/A | Feature does not involve log parsing |
| II. API-First Design | Pass | SSE streaming + conversation REST APIs defined in OpenAPI before UI |
| III. Test-First Development | Pass | Test tasks precede implementation tasks in every phase |
| IV. AI as a Skill | Pass | Uses existing skill registry; adds streaming + routing layer |
| V. Multi-Tenant by Default | Pass | Conversations scoped by tenant_id + user_id; RLS enforced |
| VI. Simplicity Gate | Pass | No new services; extends API Server + Frontend only |
| VII. Log Format Fidelity | N/A | Feature does not involve log parsing |
| VIII. Streaming-Ready | Pass | SSE streaming is the core feature |
| IX. Incremental Delivery | Pass | P1 (streaming chat) is independently usable |

## Project Structure

### Documentation

```text
specs/009-ai-assistant-page/
├── plan.md              # This file
├── spec.md              # Feature specification (3 user stories)
├── research.md          # Technology decisions + competitor analysis
├── data-model.md        # Conversation, Message entities + migrations
├── quickstart.md        # Test scenarios
├── contracts/
│   └── ai-streaming.yaml  # OpenAPI for SSE + conversation endpoints
└── checklists/
    └── requirements.md
```

### Source Code Changes

```text
backend/
├── internal/
│   ├── api/
│   │   └── handlers/
│   │       ├── ai_stream.go         # NEW: SSE streaming handler (POST /ai/stream)
│   │       ├── ai_stream_test.go    # NEW: Streaming handler tests
│   │       ├── conversations.go     # NEW: CRUD handlers for conversations
│   │       └── conversations_test.go # NEW: Conversation handler tests
│   ├── ai/
│   │   ├── client.go               # EXTEND: Add StreamQuery method (Gemini GenerateContentStream)
│   │   ├── router.go               # NEW: Keyword-based skill routing
│   │   └── router_test.go          # NEW: Router tests
│   ├── domain/
│   │   └── models.go               # EXTEND: Add Conversation, Message structs
│   └── storage/
│       └── postgres.go             # EXTEND: Add conversation CRUD methods
└── migrations/
    ├── 009_conversations.up.sql    # NEW: conversations + messages tables
    └── 009_conversations.down.sql  # NEW: rollback migration

frontend/
├── src/
│   ├── app/(dashboard)/
│   │   └── ai/
│   │       └── page.tsx            # REWRITE: Full AI assistant layout
│   ├── components/
│   │   └── ai/
│   │       ├── chat-panel.tsx      # REWRITE: Streaming chat with Streamdown
│   │       ├── message-view.tsx    # NEW: Rich message rendering with metadata
│   │       ├── skill-selector.tsx  # EXTEND: Add auto-routing indicator
│   │       ├── conversation-list.tsx # NEW: Sidebar conversation list
│   │       └── chat-input.tsx      # NEW: Input with keyboard shortcuts
│   ├── hooks/
│   │   ├── use-ai-stream.ts       # NEW: Fetch + ReadableStream SSE hook
│   │   └── use-conversations.ts   # NEW: Conversation CRUD hook
│   └── lib/
│       └── api.ts                  # EXTEND: Add conversation + stream types
```

**New dependencies**:
- Frontend: `streamdown` (streaming markdown renderer)
- Backend: `google.golang.org/genai` (Google Gemini Go SDK)

## Complexity Tracking

No constitution violations. Feature stays within existing 3-service architecture.

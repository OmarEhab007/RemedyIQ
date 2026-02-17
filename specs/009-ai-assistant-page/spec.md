# Feature Specification: AI Assistant Page

**Feature Branch**: `009-ai-assistant-page`
**Created**: 2026-02-16
**Revised**: 2026-02-17
**Status**: Draft
**Input**: AI-powered conversational log analysis page with streaming responses, skill orchestration, and conversation persistence

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Conversational Log Analysis with Streaming (Priority: P1)

As an AR System administrator, I want to have a natural conversation with an AI assistant about my log files, receiving real-time streaming responses so I can quickly understand issues without waiting for complete analysis.

**Why this priority**: This is the core MVP. The conversational interface with streaming is the foundation all other features build upon.

**Independent Test**: Navigate to /ai page, select an analysis job, type a question about logs, and verify streaming text appears incrementally with proper markdown formatting.

**Acceptance Scenarios**:

1. **Given** I am on the AI assistant page with a job selected, **When** I type "What were the slowest API calls?" and submit, **Then** I see the response stream in real-time with markdown formatting (bold, code blocks, lists, tables)
2. **Given** the AI is streaming a response, **When** I click the stop button, **Then** the streaming stops immediately and the partial response is preserved
3. **Given** the AI response includes a code block, **When** the content renders, **Then** it displays with syntax highlighting and a copy-to-clipboard button
4. **Given** I receive a response with follow-up suggestions, **When** I click a suggestion chip, **Then** it sends that question and the AI responds in the same conversation
5. **Given** the response is complete, **When** I view the message footer, **Then** I see the skill used, response latency, and token count

---

### User Story 2 - Skill-Aware AI Routing (Priority: P2)

As an AR System administrator, I want the AI to automatically select the best analysis skill for my question, or let me manually choose one, so I get the most relevant analysis.

**Why this priority**: Skill routing improves response quality by sending questions to specialized analysis. Builds on P1 streaming infrastructure.

**Independent Test**: Ask different question types and verify the skill indicator changes. Manually select a skill and verify it overrides auto-routing.

**Acceptance Scenarios**:

1. **Given** I ask "Why is my system slow?", **When** the AI processes my question, **Then** it routes to the performance skill and displays a skill indicator badge
2. **Given** I ask "What caused the error spike at 3pm?", **When** the AI processes my question, **Then** it routes to root_cause skill
3. **Given** I want to use a specific analysis type, **When** I select a skill from the sidebar, **Then** subsequent queries use that skill until I change it or re-enable "Auto"
4. **Given** auto-routing is enabled (default), **When** I send a question, **Then** the system classifies intent using keyword matching and selects the appropriate skill

---

### User Story 3 - Conversation History and Sessions (Priority: P2)

As an AR System administrator, I want my conversation history saved and restored across sessions so I can continue previous investigations.

**Why this priority**: Essential for productivity during multi-session investigations. Requires P1 chat infrastructure.

**Independent Test**: Have a conversation, refresh the page, verify history persists. Switch jobs, verify separate history.

**Acceptance Scenarios**:

1. **Given** I have had a conversation, **When** I refresh the page or return later, **Then** my conversation history is restored with all messages and timestamps
2. **Given** I want to start fresh, **When** I click "New conversation", **Then** a new empty conversation starts and the previous one is saved in the sidebar list
3. **Given** I have multiple analysis jobs, **When** I switch between jobs, **Then** each job has its own separate conversation history
4. **Given** I have past conversations listed in the sidebar, **When** I click one, **Then** it loads that conversation with full message history
5. **Given** I want to remove a conversation, **When** I delete it from the sidebar, **Then** it is permanently removed

---

### Edge Cases

- **AI service unavailable or rate-limited**: System displays a graceful error with "Try again" button and falls back to suggesting manual search
- **Very long conversations (50+ messages)**: Older messages are paginated. Context sent to AI is summarized to stay within token limits
- **User asks about data not in current job**: AI explains what data is available and suggests alternative questions
- **Concurrent streaming requests**: Previous in-flight request is cancelled when new request is submitted
- **Log context exceeds token limits**: System summarizes or truncates context data before sending to AI, prioritizing most recent and most relevant entries
- **Network disconnect during streaming**: Partial response is preserved. User sees "Connection lost" with retry option
- **Empty job (no log data)**: AI page shows an empty state directing user to upload logs first

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a conversational chat interface for natural language queries about log data
- **FR-002**: System MUST stream AI responses in real-time using SSE, proxying Google Gemini streaming through the Go backend
- **FR-003**: System MUST render AI responses with full GitHub-Flavored Markdown including code blocks, bold, lists, and tables
- **FR-004**: System MUST display which AI skill is being used for each response via a badge indicator
- **FR-005**: System MUST allow manual skill selection from a sidebar list with an "Auto" default option
- **FR-006**: System MUST provide 2-3 follow-up question suggestions after each AI response
- **FR-007**: System MUST persist conversation history per analysis job in PostgreSQL, scoped by tenant and user
- **FR-008**: System MUST support creating new conversations, switching between them, and deleting them
- **FR-009**: System MUST support syntax highlighting for code blocks with copy-to-clipboard
- **FR-010**: System MUST display response metadata (skill name, latency, tokens used) in the message footer
- **FR-011**: System MUST allow cancelling in-progress streaming responses
- **FR-012**: System MUST handle AI service unavailability gracefully with fallback messaging and retry
- **FR-013**: System MUST support keyboard shortcuts: Enter to send, Shift+Enter for new line, Escape to cancel streaming
- **FR-014**: System MUST auto-route queries to the appropriate skill using keyword-based classification

### Key Entities

- **Conversation**: A chat session scoped to a tenant, user, and analysis job. Contains ordered messages and metadata.
- **Message**: A single turn (user or assistant) with content, skill used, follow-up suggestions, and performance metrics.
- **Skill**: An AI analysis capability with name, description, example prompts, and routing keywords.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: First streaming token appears within 1 second of submitting a query
- **SC-002**: Streaming text renders incrementally without flicker or layout shift
- **SC-003**: Conversation history loads within 500ms when switching conversations
- **SC-004**: Users can complete a log analysis query and receive a useful answer without guidance (validated via manual testing)
- **SC-005**: AI gracefully handles service unavailability with user-friendly error in 100% of failure cases
- **SC-006**: System handles 10 concurrent AI conversations per tenant without degradation
- **SC-007**: All conversations are correctly isolated by tenant and user (verified via integration test)

## Assumptions

- Google Gemini API is the AI provider, using `google.golang.org/genai` Go SDK
- The `genai` SDK's `GenerateContentStream` range iterator is used for streaming (Go 1.23+)
- Log data is already indexed and searchable in ClickHouse (existing infrastructure)
- User authentication and tenant isolation are already implemented via Clerk
- Analysis job data structure exists and supports linking conversations to jobs
- The existing 6 AI skills (nl_query, performance, root_cause, error_explainer, anomaly, summarizer) remain the skill set

## Future Enhancements (Post-MVP)

These are explicitly deferred and NOT part of this feature scope:

- **Rich Log References**: Expandable, clickable references to specific log entries in AI responses
- **Proactive AI Insights**: System-generated investigation suggestions based on detected anomalies
- **Analysis Report Generation**: Export conversations as PDF/Markdown reports
- **@ Context Mentions**: Allow users to reference specific logs, traces, or metrics in their questions
- **Voice Input**: Speech-to-text for hands-free querying during incidents

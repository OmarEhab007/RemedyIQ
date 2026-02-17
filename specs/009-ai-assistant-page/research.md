# Research: AI Assistant Page

**Revised**: 2026-02-17

## Technology Decisions

### 1. Streaming: SSE via Go Backend Proxy

**Decision**: Server-Sent Events (SSE) with `fetch` + `ReadableStream` on the frontend

**Rationale**:
- Go backend proxies Google Gemini streaming via `google.golang.org/genai` `GenerateContentStream()` range iterator
- SSE is unidirectional (server-to-client) — perfect for AI response streaming
- `fetch` + `ReadableStream` supports POST requests (EventSource only supports GET)
- No third-party dependency needed on frontend (native Fetch API)
- HTTP/2 compatible for concurrent streams (unlike EventSource's ~6 connection limit on HTTP/1.1)
- Automatic backpressure handling via ReadableStream

**Alternatives Rejected**:
- **EventSource API**: Cannot send POST payloads (query + job_id + conversation context)
- **WebSocket**: Overkill for unidirectional streaming; adds connection management complexity
- **fetch-event-source (npm)**: Unnecessary dependency when native Fetch + ReadableStream works
- **Vercel AI SDK**: Adds abstraction layer; our Go backend is the streaming proxy, not Next.js

**Implementation Pattern**:

```
Client (fetch POST)          Go Backend               Gemini API
    |                           |                          |
    |--- POST /ai/stream ------>|                          |
    |                           |--- GenerateContentStream -->|
    |                           |<-- GenerateContentResponse--|
    |<-- SSE: token event ------|                          |
    |<-- SSE: token event ------|<-- GenerateContentResponse--|
    |                           |   (final: UsageMetadata) |
    |<-- SSE: metadata event ---|                          |
    |<-- SSE: done event -------|<-- (range exhausted) ----|
```

### 2. Google Gemini Go SDK Streaming API

**SDK Module**: `google.golang.org/genai` (Go 1.23+ required for range-over-func)

**Key API**:

```go
client, err := genai.NewClient(ctx, &genai.ClientConfig{
    APIKey:  os.Getenv("GOOGLE_API_KEY"),
    Backend: genai.BackendGeminiAPI,
})

config := &genai.GenerateContentConfig{
    SystemInstruction: &genai.Content{
        Parts: []*genai.Part{{Text: systemPrompt}},
    },
}

var fullText strings.Builder
var finalResponse *genai.GenerateContentResponse

for response, err := range client.Models.GenerateContentStream(
    ctx,
    "gemini-2.5-flash",
    genai.Text(userQuery),
    config,
) {
    if err != nil {
        // Handle error (including context.Canceled for cancellation)
        break
    }
    text := response.Candidates[0].Content.Parts[0].Text
    fullText.WriteString(text)
    finalResponse = response
    // Send text as SSE event to client
}

// After stream completes, access usage metadata
if finalResponse != nil && finalResponse.UsageMetadata != nil {
    promptTokens := finalResponse.UsageMetadata.PromptTokenCount
    outputTokens := finalResponse.UsageMetadata.CandidatesTokenCount
}
```

**Stream iteration**: Each iteration yields a `GenerateContentResponse` containing the next text chunk in `Candidates[0].Content.Parts[0].Text`. The final response includes `UsageMetadata` with token counts.

**Key details**:
- Uses Go 1.23 range-over-func pattern (`for response, err := range ...`)
- Token counts in `UsageMetadata` available on the final response (`PromptTokenCount`, `CandidatesTokenCount`)
- Context cancellation stops the stream immediately (`context.WithCancel`)
- No accumulator needed — concatenate text chunks manually
- Multi-turn chat available via `client.Chats.Create()` + `chat.SendMessageStream()`

### 3. Markdown Rendering: Streamdown

**Decision**: `streamdown` (by Vercel) for streaming markdown rendering

**Rationale**:
- Purpose-built for streaming AI responses — handles unterminated markdown blocks gracefully
- Drop-in replacement for react-markdown with streaming-aware rendering
- GitHub Flavored Markdown (tables, task lists, strikethrough)
- Built-in syntax highlighting via Shiki
- Copy buttons on code blocks out of the box
- No flicker or parse errors from incomplete markdown tokens

**Alternatives Rejected**:
- **react-markdown + remark-gfm**: Breaks on unterminated blocks during streaming (e.g., incomplete `**bold` or `` ``` `` blocks). Requires complex memoization workarounds.
- **@mdx-js/react**: Overkill for display-only content
- **marked**: Not React-native, requires manual sanitization

**Installation**: `npm install streamdown`

**Usage**:
```tsx
import { Streamdown } from 'streamdown';

<Streamdown>{streamingContent}</Streamdown>
```

### 4. Conversation Persistence: PostgreSQL with JSONB

**Decision**: PostgreSQL with denormalized `tenant_id` on all tables

**Rationale**:
- Existing PostgreSQL infrastructure with RLS
- JSONB for flexible follow_ups and metadata fields
- Denormalized `tenant_id` on messages table avoids slow subquery RLS
- `user_id` on conversations enables per-user history within a tenant
- Efficient querying by (tenant_id, job_id, user_id) composite index

**Alternatives Rejected**:
- Redis-only: No durable history across restarts
- ClickHouse: Not optimized for transactional inserts/updates

### 5. Skill Routing: Keyword-Based Classification

**Decision**: Keyword matching with hardcoded rules per skill

**Rationale**:
- Zero additional latency (no LLM call for classification)
- Deterministic and predictable routing
- Easy to test and debug
- Existing skills already have clear keyword domains (performance, error, root cause, etc.)
- "Auto" default with manual override covers all use cases

**Routing rules** (in priority order):

| Skill | Keywords / Patterns |
|-------|-------------------|
| performance | slow, latency, duration, timeout, bottleneck, optimize, tuning |
| root_cause | root cause, correlat, why.*fail, cascading, spike |
| error_explainer | error, ARERR, exception, failed, stack trace |
| anomaly | anomal, unusual, unexpected, deviation, outlier |
| summarizer | summar, overview, executive, brief, report |
| nl_query | (default fallback) |

**Alternatives Rejected**:
- **LLM-based classification**: Adds 100-300ms latency per request, costs tokens, unpredictable
- **Embedding similarity**: Requires training data and vector store, over-engineered for 6 skills

## Competitor Analysis

### Grafana AI Assistant (Most Relevant)

**Architecture**: Sidebar chat panel accessible via sparkle icon, stays open during navigation.

**Key Features**:
- `@` key or "Add Context" button to reference dashboards, panels, metrics
- Context-aware: knows which dashboard/panel you're viewing
- Agentic: calls Grafana APIs directly (not just chat)
- Thumbs up/down feedback on responses
- Multi-step investigations in single continuous conversation

**Insights for RemedyIQ**:
- Sidebar conversation list + main chat area is the standard layout
- Context addition via explicit mechanisms (we'll add `@` mentions post-MVP)
- Feedback mechanisms are valuable but post-MVP
- Our skill routing is analogous to Grafana's tool selection

### Datadog Bits AI

**Key Features**:
- Accessible from anywhere in Datadog UI (modal overlay)
- Cross-silo correlation (logs, metrics, traces, security)
- Natural language to DQL query conversion
- 2026: Evolved to SRE agent with hypothesis testing

**Insights for RemedyIQ**:
- Show which data sources were consulted
- Our skill badge serves a similar purpose to their "data sources consulted" indicator

### Dynatrace Davis CoPilot

**Key Features**:
- Sidebar + Ctrl/Cmd+I keyboard shortcut
- Predefined conversation starters per context
- Multilingual support

**Insights for RemedyIQ**:
- Keyboard shortcut for quick access is valuable (post-MVP)
- Conversation starters can guide users — we use follow-up suggestions instead

### New Relic AI

**Key Features**:
- "Ask AI" button on top-right of most pages
- "Explain this error" inline buttons
- Natural language to NRQL

**Insights for RemedyIQ**:
- Inline AI buttons on dashboard/explorer pages (post-MVP integration point)

## Performance Considerations

### Latency Targets

| Operation | Target | Strategy |
|-----------|--------|----------|
| First SSE token | <1s | Stream immediately from Go proxy, no buffering |
| Full response (short) | <5s | Efficient context assembly from ClickHouse |
| Full response (long) | <15s | Chunked context, progressive rendering |
| Conversation list load | <500ms | Indexed queries, lightweight summaries |
| Conversation switch | <500ms | Paginated message loading |

### Cost Optimization

| Concern | Strategy |
|---------|----------|
| Token usage | Summarize old messages before including in Gemini context window |
| Context size | Include only top-N log entries, not full log data |
| Redundant requests | Cancel previous streaming request on new submission |

## Security Considerations

### Input Validation
- Sanitize user queries before sending to AI (strip control characters)
- Limit query length to 2000 characters
- Validate job_id and tenant_id ownership before executing

### Output Handling
- Streamdown handles XSS prevention via React's built-in escaping
- Rate limit: 20 queries per minute per user
- Validate that referenced job belongs to user's tenant

### Data Privacy
- Conversations isolated by tenant_id AND user_id
- No cross-tenant data in AI context (enforced by ClickHouse queries and PostgreSQL RLS)
- Configurable retention period (default: 90 days)

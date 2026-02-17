# Quickstart: AI Assistant Page

## Prerequisites

1. Docker and Docker Compose installed
2. Go 1.24+ installed
3. Node.js 18+ and npm installed
4. `GOOGLE_API_KEY` environment variable set (get one at https://aistudio.google.com/apikey)
5. Local infrastructure running (PostgreSQL, ClickHouse, Redis, NATS, MinIO)

## Setup

```bash
# 1. Start infrastructure (if not already running)
docker compose up -d

# 2. Set your API key (add to backend/.env or export)
export GOOGLE_API_KEY="<YOUR_GOOGLE_API_KEY>"

# 3. Run database migrations (includes new conversations + messages tables)
cd backend && go run cmd/migrate/main.go up

# 4. Start backend
cd backend && go run cmd/api/main.go

# 5. In another terminal, install frontend deps and start
cd frontend && npm install && npm run dev
```

## Test Scenarios

### Scenario 1: Basic Streaming Chat (US1 - P1)

**Goal**: Verify streaming chat works with real-time token delivery

**Steps**:
1. Upload a log file via the Upload page (or use an existing job)
2. Navigate to `http://localhost:3000/ai?job_id={your_job_id}`
3. Type "What were the slowest API calls?" and press Enter
4. Observe the response streaming in real-time
5. Verify markdown renders correctly (bold, code blocks, lists)

**Expected Results**:
- Response starts streaming within ~1 second
- Text appears incrementally (not all at once)
- Markdown is rendered (not raw `**bold**` text)
- Stop button appears during streaming
- After completion: skill badge, latency, and token count visible in footer
- Follow-up suggestion chips appear below the response

**Verify backend SSE**:
```bash
# Direct curl test — should see SSE events streaming
curl -N -X POST http://localhost:8080/api/v1/ai/stream \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: default" \
  -H "X-User-ID: dev-user" \
  -d '{"query": "What are the slowest API calls?", "job_id": "YOUR_JOB_ID"}'
```

**Run tests**:
```bash
cd backend && go test -v -run TestAIStream ./internal/api/handlers/
cd frontend && npx vitest run --grep "use-ai-stream"
```

### Scenario 2: Skill Auto-Routing (US2 - P2)

**Goal**: Verify queries route to the correct skill automatically

**Steps**:
1. On the AI page, ensure "Auto" is selected in the skill sidebar (default)
2. Ask "Why is my system slow?" — verify skill badge shows "performance"
3. Ask "What caused the errors?" — verify skill badge shows "root_cause" or "error_explainer"
4. Ask "Summarize this log analysis" — verify skill badge shows "summarizer"
5. Manually select "performance" from sidebar
6. Ask any question — verify skill badge stays "performance"
7. Switch back to "Auto" — verify auto-routing resumes

**Expected Results**:
- Skill badge updates per message
- Manual selection overrides auto-routing
- "Auto" re-enables keyword-based routing

**Run tests**:
```bash
cd backend && go test -v -run TestSkillRouter ./internal/ai/
```

### Scenario 3: Conversation Persistence (US3 - P2)

**Goal**: Verify conversations persist and can be managed

**Steps**:
1. Start a conversation with 3-4 messages
2. Note the conversation appears in the sidebar
3. Refresh the page (F5)
4. Verify conversation history is restored
5. Click "New conversation" in sidebar
6. Verify a new empty chat starts; previous conversation is in sidebar
7. Click the previous conversation in sidebar
8. Verify it loads with full message history
9. Navigate to a different job's AI page
10. Verify separate conversation list
11. Delete a conversation from sidebar
12. Verify it's removed permanently

**Expected Results**:
- History persists after page refresh
- Each job has independent conversations
- New conversation button works
- Switching between conversations loads correct history
- Delete permanently removes conversation and messages

**Verify persistence**:
```bash
# Check database directly
psql -d remedyiq -c "SELECT id, title, message_count, created_at FROM conversations ORDER BY created_at DESC LIMIT 5;"
psql -d remedyiq -c "SELECT id, role, LEFT(content, 80), skill_name FROM messages WHERE conversation_id = 'YOUR_CONV_ID' ORDER BY created_at;"
```

**Run tests**:
```bash
cd backend && go test -v -run TestConversation ./internal/storage/
cd backend && go test -v -run TestConversation ./internal/api/handlers/
cd frontend && npx vitest run --grep "use-conversations"
```

### Scenario 4: Stop Streaming

**Goal**: Verify user can cancel an in-progress response

**Steps**:
1. Ask a question that generates a long response (e.g., "Give me a detailed analysis of all log types")
2. While streaming, click the Stop button (or press Escape)
3. Verify streaming stops immediately
4. Verify the partial response is preserved and readable
5. Verify you can send a new message

**Expected Results**:
- Streaming stops within 200ms of clicking Stop/pressing Escape
- Partial response is preserved (not cleared)
- Chat input re-enables for next message

### Scenario 5: Error Handling

**Goal**: Verify graceful handling of AI service failures

**Steps**:
1. Set `GOOGLE_API_KEY` to an invalid value and restart backend
2. Ask a question
3. Verify a user-friendly error message appears (not a stack trace)
4. Verify "Try again" option is available
5. Restore valid API key and restart
6. Verify chat works again

**Expected Results**:
- Error message is human-readable
- No technical details leak to the user
- System recovers once API is available again

## Troubleshooting

### Streaming Not Working

1. Check backend logs for SSE handler errors
2. Verify `GOOGLE_API_KEY` is set and valid
3. Check browser DevTools Network tab — response should show `text/event-stream` content type
4. Ensure no reverse proxy is buffering SSE (check `X-Accel-Buffering: no` header)

### Conversations Not Persisting

1. Verify migration ran: `psql -d remedyiq -c "\dt conversations"`
2. Check that `app.current_tenant` is set in database session (RLS)
3. Check backend logs for PostgreSQL connection errors

### Skill Routing Incorrect

1. Check backend logs for router decisions: `grep "skill router" backend.log`
2. Test router directly: `go test -v -run TestSkillRouter ./internal/ai/`
3. Force a skill via request body: `"skill_name": "performance"`

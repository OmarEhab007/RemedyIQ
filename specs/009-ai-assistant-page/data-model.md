# Data Model: AI Assistant Page

**Revised**: 2026-02-17

## Entity Definitions

### Conversation

A chat session scoped to a tenant, user, and analysis job.

```
Conversation {
  id: UUID (PK)
  tenant_id: UUID (FK -> tenants.id, indexed)
  user_id: String (Clerk user ID, indexed)
  job_id: UUID (FK -> analysis_jobs.id, indexed)
  title: String (nullable, auto-generated from first message)
  created_at: Timestamp
  updated_at: Timestamp
  message_count: Integer (denormalized counter)
  last_message_at: Timestamp
  metadata: JSONB (nullable, stores preferred_skill, settings)
}
```

**Relationships**:
- Belongs to one Tenant
- Belongs to one User (within Tenant)
- Belongs to one AnalysisJob
- Has many Messages

**Indexes**:
- `idx_conversations_tenant_user_job` on (tenant_id, user_id, job_id)
- `idx_conversations_updated` on (tenant_id, updated_at DESC)

### Message

A single turn in a conversation, either from user or AI assistant.

```
Message {
  id: UUID (PK)
  conversation_id: UUID (FK -> conversations.id, indexed)
  tenant_id: UUID (denormalized for RLS, indexed)
  role: Enum [user, assistant]
  content: Text
  skill_name: String (nullable, which skill generated this response)
  follow_ups: JSONB (nullable, array of suggested follow-up strings)
  tokens_used: Integer (nullable, input + output tokens)
  latency_ms: Integer (nullable, time to complete response)
  status: Enum [pending, streaming, complete, error]
  error_message: Text (nullable)
  created_at: Timestamp
}
```

**Key design decisions**:
- `tenant_id` is **denormalized** on messages to enable direct RLS without subqueries
- `role` is limited to `user` and `assistant` (no `system` — system prompts are internal)
- `follow_ups` is JSONB array, not a separate table, for simplicity
- No `references` column (reserved word in PostgreSQL) — log references are a post-MVP feature

**Indexes**:
- `idx_messages_conversation` on (conversation_id, created_at)
- `idx_messages_tenant` on (tenant_id) — for RLS

## State Transitions

### Message Status Flow

```
pending -> streaming -> complete
    |          |
    |          +---> error (stream fails mid-response)
    |
    +-------------> error (request fails before streaming starts)
```

## JSONB Schemas

### Message.follow_ups

```json
[
  "What caused the slow GET_ENTRY operation?",
  "Show me all operations taking more than 2 seconds",
  "Which users were affected by slow responses?"
]
```

### Conversation.metadata

```json
{
  "preferred_skill": "performance",
  "auto_route": true
}
```

## Database Migrations

### Migration: 009_conversations.up.sql

```sql
-- Conversations table
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id VARCHAR(255) NOT NULL,
    job_id UUID NOT NULL REFERENCES analysis_jobs(id) ON DELETE CASCADE,
    title VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    message_count INTEGER DEFAULT 0,
    last_message_at TIMESTAMPTZ,
    metadata JSONB
);

CREATE INDEX idx_conversations_tenant_user_job ON conversations(tenant_id, user_id, job_id);
CREATE INDEX idx_conversations_updated ON conversations(tenant_id, updated_at DESC);

-- RLS
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY conversations_tenant_isolation ON conversations
    USING (tenant_id = current_setting('app.current_tenant')::UUID);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    skill_name VARCHAR(100),
    follow_ups JSONB,
    tokens_used INTEGER,
    latency_ms INTEGER,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'streaming', 'complete', 'error')),
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at);
CREATE INDEX idx_messages_tenant ON messages(tenant_id);

-- RLS (direct tenant_id check, no subquery)
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY messages_tenant_isolation ON messages
    USING (tenant_id = current_setting('app.current_tenant')::UUID);

-- Trigger to update conversation counters
CREATE OR REPLACE FUNCTION update_conversation_counters()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE conversations
        SET message_count = message_count + 1,
            last_message_at = NEW.created_at,
            updated_at = NOW()
        WHERE id = NEW.conversation_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE conversations
        SET message_count = GREATEST(message_count - 1, 0),
            updated_at = NOW()
        WHERE id = OLD.conversation_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_message_counter
    AFTER INSERT OR DELETE ON messages
    FOR EACH ROW
    EXECUTE FUNCTION update_conversation_counters();
```

### Migration: 009_conversations.down.sql

```sql
DROP TRIGGER IF EXISTS trg_message_counter ON messages;
DROP FUNCTION IF EXISTS update_conversation_counters();
DROP TABLE IF EXISTS messages;
DROP TABLE IF EXISTS conversations;
```

## Entity Relationship Diagram

```
┌─────────────┐     ┌───────────────┐
│   Tenant    │     │ AnalysisJob   │
└──────┬──────┘     └──────┬────────┘
       │                   │
       │                   │
       ▼                   ▼
┌──────────────────────────────────┐
│         Conversation             │
│  (tenant_id, user_id, job_id)   │
└──────────────┬───────────────────┘
               │
               │ 1:N
               ▼
┌──────────────────────────────────┐
│           Message                │
│  (tenant_id denormalized)        │
│  role: user | assistant          │
│  skill_name, follow_ups (JSONB)  │
│  tokens_used, latency_ms         │
└──────────────────────────────────┘
```

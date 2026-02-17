-- RemedyIQ PostgreSQL Schema
-- Version: 003_conversations
-- Adds conversations and messages tables for AI assistant history

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

CREATE INDEX IF NOT EXISTS idx_conversations_tenant_user_job ON conversations(tenant_id, user_id, job_id);
CREATE INDEX IF NOT EXISTS idx_conversations_updated ON conversations(tenant_id, updated_at DESC);

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tenant_isolation' AND tablename = 'conversations') THEN
        CREATE POLICY tenant_isolation ON conversations
            USING (tenant_id::TEXT = current_setting('app.tenant_id', true))
            WITH CHECK (tenant_id::TEXT = current_setting('app.tenant_id', true));
    END IF;
END $$;

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

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_tenant ON messages(tenant_id);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tenant_isolation' AND tablename = 'messages') THEN
        CREATE POLICY tenant_isolation ON messages
            USING (tenant_id::TEXT = current_setting('app.tenant_id', true))
            WITH CHECK (tenant_id::TEXT = current_setting('app.tenant_id', true));
    END IF;
END $$;

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

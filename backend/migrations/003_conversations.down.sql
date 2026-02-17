-- RemedyIQ PostgreSQL Schema
-- Version: 003_conversations (rollback)
-- Drops conversations and messages tables

DROP TRIGGER IF EXISTS trg_message_counter ON messages;
DROP FUNCTION IF EXISTS update_conversation_counters();
DROP TABLE IF EXISTS messages;
DROP TABLE IF EXISTS conversations;

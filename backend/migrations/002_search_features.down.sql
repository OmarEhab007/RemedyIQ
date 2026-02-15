-- RemedyIQ PostgreSQL Schema
-- Version: 002_search_features (rollback)

DROP TABLE IF EXISTS search_history;

ALTER TABLE saved_searches DROP COLUMN IF EXISTS time_range;

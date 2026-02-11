# Data Model: Local Development Setup

**Feature**: 002-local-dev-setup
**Date**: 2026-02-10

## Overview

This feature does not introduce any new data models. All existing schemas (PostgreSQL and ClickHouse) remain unchanged. The only data-related change is making PostgreSQL migrations idempotent by adding `IF NOT EXISTS` guards.

## Existing Schemas (Reference)

### PostgreSQL (Metadata)

| Table | Purpose | Changes in This Feature |
|-------|---------|------------------------|
| `tenants` | Organization/tenant records | Migration made idempotent |
| `log_files` | Uploaded file metadata | Migration made idempotent |
| `analysis_jobs` | Analysis job tracking | Migration made idempotent |
| `ai_interactions` | AI skill invocations | Migration made idempotent |
| `saved_searches` | User-saved search queries | Migration made idempotent |

### ClickHouse (Analytics)

| Table/View | Purpose | Changes in This Feature |
|------------|---------|------------------------|
| `remedyiq.log_entries` | Parsed log events | None (already idempotent) |
| `remedyiq.log_entries_aggregates` | Pre-aggregated stats | None (already idempotent) |

## Migration Idempotency Changes

All `CREATE TABLE` statements get `IF NOT EXISTS`.
All `CREATE INDEX` statements get `IF NOT EXISTS`.
All `CREATE EXTENSION` statements already use `IF NOT EXISTS`.
All `CREATE POLICY` statements wrapped in conditional PL/pgSQL blocks.
`ALTER TABLE ... ENABLE ROW LEVEL SECURITY` is inherently idempotent.

# Data Models

This section documents the database schemas and entity relationships used in RemedyIQ.

## Overview

RemedyIQ uses a polyglot persistence strategy:

| Database | Purpose | Data Type |
|----------|---------|-----------|
| PostgreSQL | Metadata, tenants, jobs | Relational |
| ClickHouse | Log entries, analytics | Time-series |
| Redis | Dashboard cache, sessions | Key-value |

## Documentation

- [Entity Relationship Diagram](../diagrams/erd.md) - Visual ERD
- [PostgreSQL Schema](./postgres-schema.md) - Detailed PostgreSQL schema
- [ClickHouse Schema](./clickhouse-schema.md) - Detailed ClickHouse schema

## Quick Reference

### PostgreSQL Tables

| Table | Purpose |
|-------|---------|
| tenants | Organization accounts |
| log_files | Uploaded file metadata |
| analysis_jobs | Job status and progress |
| ai_interactions | AI query history |
| conversations | AI chat threads |
| messages | AI chat messages |
| saved_searches | Saved KQL queries |

### ClickHouse Tables

| Table | Purpose |
|-------|---------|
| log_entries | Parsed log entries |
| log_entries_aggregates | Pre-computed metrics |

### Redis Keys

| Pattern | Purpose | TTL |
|----------|---------|-----|
| `{tenant}:dashboard:{job_id}` | Full dashboard data | 24h |
| `{tenant}:dashboard:{job_id}:agg` | Aggregates section | 24h |
| `{tenant}:dashboard:{job_id}:exc` | Exceptions section | 24h |
| `{tenant}:dashboard:{job_id}:gaps` | Gaps section | 24h |
| `{tenant}:dashboard:{job_id}:threads` | Threads section | 24h |
| `{tenant}:dashboard:{job_id}:filters` | Filters section | 24h |

## Domain Models

Key domain models are defined in `backend/internal/domain/models.go`:

- `Tenant` - Organization entity
- `LogFile` - Uploaded file metadata
- `AnalysisJob` - Job lifecycle
- `LogEntry` - Parsed log entry
- `Conversation` - AI chat thread
- `Message` - AI chat message
- `DashboardData` - Analysis results
- `WaterfallResponse` - Trace visualization

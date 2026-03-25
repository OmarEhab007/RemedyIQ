# Infrastructure Documentation

This section documents the infrastructure components used by RemedyIQ.

## Overview

RemedyIQ uses the following infrastructure:

| Component | Purpose | Port |
|-----------|---------|------|
| PostgreSQL | Metadata storage | 5432 |
| ClickHouse | Log entries | 9000 |
| Redis | Caching | 6379 |
| MinIO | Object storage | 9002 |
| NATS | Message queue | 4222 |

## Documentation

- [Databases](./databases.md) - PostgreSQL, ClickHouse, Redis
- [Message Queue](./message-queue.md) - NATS JetStream
- [Storage](./storage.md) - MinIO/S3

## Local Development

Start all services with Docker Compose:

```bash
make docker-up
```

This starts:
- PostgreSQL 16
- ClickHouse 24
- Redis 7
- MinIO (latest)
- NATS JetStream 2.x

## Connection Strings

| Service | Local URL |
|---------|-----------|
| PostgreSQL | `postgres://remedyiq:remedyiq@localhost:5432/remedyiq?sslmode=disable` |
| ClickHouse | `http://localhost:9000` |
| Redis | `redis://localhost:6379` |
| MinIO | `http://localhost:9002` |
| NATS | `nats://localhost:4222` |

## Console Access

| Service | URL |
|---------|-----|
| MinIO Console | http://localhost:9001 |
| ClickHouse | `clickhouse-client --host localhost` |
| PostgreSQL | `psql -h localhost -U remedyiq` |
| Redis | `redis-cli` |

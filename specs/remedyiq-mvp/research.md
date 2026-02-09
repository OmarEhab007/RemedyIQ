# Research: Technology Decisions for RemedyIQ MVP

**Date**: 2026-02-09
**Context**: Decisions made for the AR Server Log Analysis Platform

## R1: Log Storage — ClickHouse vs Alternatives

### Options Evaluated

| Criteria | ClickHouse | TimescaleDB | Elasticsearch |
|----------|-----------|-------------|---------------|
| Compression | 12-19x | 90-95% | Standard |
| Aggregation Speed | 5x faster | Comparable | Slower for analytics |
| Cost at Scale | Lowest | Low | Highest (memory-hungry) |
| SaaS License | Apache 2.0 | PostgreSQL | SSPL (restrictive) |
| Full-text Search | Good (tokenBF) | Limited | Excellent |
| Multi-tenant | Partition by tenant | Schema-per-tenant | Index-per-tenant |

### Decision: **ClickHouse**

**Rationale**: Log analysis is primarily analytical queries (aggregations, top-N, time-series) where ClickHouse excels. The 12-19x compression ratio is critical for cost at scale — 1TB of logs becomes ~60GB stored. Apache 2.0 license is SaaS-safe. Full-text search gap is filled by Bleve.

**Risk**: ClickHouse has no native ACID transactions. Mitigated by using PostgreSQL for all metadata that requires transactional consistency.

## R2: Full-Text Search — Bleve vs Elasticsearch vs Meilisearch

### Options Evaluated

| Criteria | Bleve | Elasticsearch | Meilisearch |
|----------|-------|---------------|-------------|
| Language | Go (embedded) | Java (external) | Rust (external) |
| Operational Cost | Zero (in-process) | High (JVM cluster) | Low (single binary) |
| License | Apache 2.0 | SSPL | MIT |
| Query Language | Built-in | KQL/Lucene | Custom |
| Performance | Fast for moderate scale | Best at massive scale | Fastest for typo-tolerant |

### Decision: **Bleve**

**Rationale**: Embedded in the Go binary eliminates an external dependency (Simplicity Gate). Apache 2.0 license. Sufficient for our scale (100M entries per tenant) when combined with ClickHouse for heavy analytics. KQL-style query parser built on top.

**Risk**: At extreme scale (1B+ entries), may need to shard or migrate to dedicated search. Mitigated by keeping search index as a secondary index that can be rebuilt from ClickHouse.

## R3: Message Queue — NATS JetStream vs Kafka vs Redis Streams

### Options Evaluated

| Criteria | NATS JetStream | Kafka | Redis Streams |
|----------|---------------|-------|---------------|
| Latency | Microseconds | Milliseconds | Sub-millisecond |
| Throughput | 500K+ msg/s | Millions msg/s | 100K+ msg/s |
| Memory | 10-50MB base | 1GB+ | In-memory only |
| Persistence | Built-in | Built-in | Optional |
| Operational | Simple | Complex (Zookeeper) | Via Redis Cluster |
| Go Client | Native | Sarama/confluent | go-redis |

### Decision: **NATS JetStream**

**Rationale**: Lightweight (20MB binary), low latency for real-time log tailing, persistent streams for job queues, subject-based routing enables clean tenant isolation (`logs.{tenant_id}.{type}`). Go-native performance. Far simpler to operate than Kafka.

**Risk**: Lower throughput ceiling than Kafka. Mitigated by our scale expectations (not processing millions of events/second).

## R4: Authentication — Clerk vs Auth0 vs Custom

### Decision: **Clerk**

**Rationale**: First-class Next.js integration with `@clerk/nextjs`. Organization-based multi-tenancy maps directly to our tenant model. Go backend validates JWTs with standard JWKS. Handles sign-up, sign-in, MFA, and organization management out of the box.

## R5: AI Integration — Claude API

### Decision: **Claude API via official Go SDK**

**Rationale**: Claude's extended context window (200K tokens) is ideal for log analysis where providing large context chunks leads to better answers. Tool use enables structured interaction (the AI can "call" search and query functions). The skill pattern maps naturally to tool definitions.

**Implementation Pattern**: Each AI skill registers as a tool definition. The skill registry manages prompt templates, input/output schemas, and fallback behavior. Requests are queued to respect rate limits.

## R6: Frontend Framework — Next.js 14

### Decision: **Next.js 14 with App Router**

**Rationale**: Server-side rendering for fast initial load (SC-004: <3s dashboard). App Router for layout-based architecture. shadcn/ui for consistent, accessible component library. Recharts for interactive charts. react-window for virtual scrolling over large log entry lists.

## R7: JAR Subprocess Strategy

### Decision: **os/exec with managed lifecycle**

**Rationale**: Go's `os/exec` package provides clean subprocess management. The JAR runner will:
1. Build the command with all configured flags
2. Capture stdout and stderr separately via pipes
3. Stream stdout lines to a parser goroutine for progress tracking
4. Enforce configurable timeout (default: 30 minutes)
5. Set JVM memory flags based on file size heuristic (4x file size, min 2GB, max 20GB)
6. Kill subprocess cleanly on timeout or cancellation

**Risk**: JAR requires significant memory (3.5-4x log size). Mitigated by running JAR in the Worker service which has dedicated memory allocation, not in the API server.

## R8: Object Storage — S3-Compatible

### Decision: **S3-compatible (AWS S3, MinIO for local dev)**

**Rationale**: Uploaded log files can be multi-GB. S3 provides durable, cost-effective storage with resumable multipart uploads. MinIO in Docker Compose for local development provides API compatibility. Files are organized as `{tenant_id}/{job_id}/{filename}`.

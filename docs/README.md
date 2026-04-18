# RemedyIQ Technical Documentation

Welcome to the RemedyIQ technical documentation. This documentation covers the architecture, APIs, data models, and infrastructure of the RemedyIQ platform.

## Overview

RemedyIQ is an **Enterprise Log Intelligence Platform** for BMC Remedy AR Server logs. It provides:

- **Structured Analysis** - Automated parsing and analysis of AR log files
- **Interactive Dashboards** - Real-time visualization with health scoring
- **KQL Search** - Full-text search with Kibana Query Language syntax
- **Transaction Tracing** - Waterfall visualization of correlated log entries
- **AI Assistant** - Natural language queries with streaming responses

## Documentation Index

### Architecture

| Document | Description |
|----------|-------------|
| [System Overview](./architecture/system-overview.md) | High-level architecture and components |
| [Components](./architecture/components.md) | Detailed component breakdown |
| [Data Flow](./architecture/data-flow.md) | Sequence diagrams for all major flows |
| [Multi-Tenancy](./architecture/multi-tenancy.md) | Tenant isolation with RLS |
| [Deployment](./architecture/deployment.md) | Kubernetes/Helm deployment |

### Data Models

| Document | Description |
|----------|-------------|
| [ERD Diagram](./diagrams/erd.md) | Entity relationship diagram |
| [PostgreSQL Schema](./data-models/postgres-schema.md) | Metadata tables with RLS |
| [ClickHouse Schema](./data-models/clickhouse-schema.md) | Log entries and aggregates |

### API Reference

| Document | Description |
|----------|-------------|
| [REST API](./api/rest-api.md) | Complete endpoint reference |
| [OpenAPI Spec](./api/openapi.yaml) | Machine-readable API specification |
| [AI Endpoints](./api/ai-endpoints.md) | SSE streaming and AI skills |
| [WebSocket Protocol](./api/websocket.md) | Real-time updates |

### Services

| Document | Description |
|----------|-------------|
| [API Server](./services/api-server.md) | HTTP server internals |
| [Worker Service](./services/worker-service.md) | Job processing pipeline |
| [AI Service](./services/ai-service.md) | Skill routing and Gemini integration |
| [Search Service](./services/search-service.md) | KQL parsing and Bleve indexing |

### Infrastructure

| Document | Description |
|----------|-------------|
| [Databases](./infrastructure/databases.md) | PostgreSQL, ClickHouse, Redis |
| [Message Queue](./infrastructure/message-queue.md) | NATS JetStream |
| [Storage](./infrastructure/storage.md) | MinIO/S3 |

### Diagrams

| Diagram | Description |
|---------|-------------|
| [Architecture](./diagrams/architecture.md) | System and deployment diagrams |
| [ERD](./diagrams/erd.md) | Entity relationships |
| [Worker Pipeline](./diagrams/worker-pipeline.md) | Job processing flowchart |
| [AI Skill Router](./diagrams/ai-skill-router.md) | Skill selection flowchart |

### Operations

| Document | Description |
|----------|-------------|
| [Cluster Setup](./ops/cluster-setup-runbook.md) | EKS cluster setup |
| [Secrets Management](./ops/secrets-management-runbook.md) | AWS Secrets Manager |
| [GitHub Environments](./ops/github-environments-setup.md) | CI/CD environments |

## Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| **Frontend** | Next.js | 16.x |
| **UI** | React | 19.x |
| **Styling** | Tailwind CSS | 4.x |
| **Backend** | Go | 1.24 |
| **Router** | Gorilla Mux | 1.8 |
| **Database** | PostgreSQL | 16 |
| **Analytics** | ClickHouse | 24 |
| **Cache** | Redis | 7 |
| **Queue** | NATS JetStream | 2.x |
| **Storage** | MinIO | Latest |
| **AI** | Google Gemini | gemini-2.5-flash |
| **Auth** | Clerk (prod) · dev headers (local) | 6.x |
| **Search** | Bleve | 2.5 |

## Quick Links

### For Developers

1. [System Overview](./architecture/system-overview.md) - Start here
2. [Data Flow](./architecture/data-flow.md) - Understand the flows
3. [REST API](./api/rest-api.md) - API reference

### For DevOps

1. [Deployment](./architecture/deployment.md) - Kubernetes setup
2. [Cluster Setup](./ops/cluster-setup-runbook.md) - EKS runbook
3. [Infrastructure](./infrastructure/README.md) - All services

### For Integration

1. [OpenAPI Spec](./api/openapi.yaml) - API specification
2. [WebSocket Protocol](./api/websocket.md) - Real-time updates
3. [AI Endpoints](./api/ai-endpoints.md) - AI integration

## Architecture Highlights

### Multi-Tenancy

- Clerk JWT authentication in deployed environments; optional **header-auth** local mode without Clerk (see root `README.md` and `AGENTS.md`)
- PostgreSQL Row-Level Security (RLS)
- S3 tenant-prefixed storage
- NATS tenant-specific subjects

### Performance

- ClickHouse for high-volume log storage
- Redis caching for dashboard data
- Bleve for full-text search
- SSE for streaming AI responses

### Scalability

- Horizontal API scaling with HPA
- NATS JetStream for async processing
- Single worker (Bleve constraint)
- Managed services (RDS, ElastiCache)

## Contributing

When updating documentation:

1. Update diagrams in `docs/diagrams/`
2. Update corresponding markdown files
3. Keep OpenAPI spec in sync with handlers
4. Run `npm run lint` in frontend for code examples

## Version

- Documentation Version: 1.0.0
- Last Updated: 2026-04-18
- RemedyIQ Version: 1.0.0

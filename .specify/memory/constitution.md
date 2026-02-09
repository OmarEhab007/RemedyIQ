<!--
  Sync Impact Report
  Version change: 0.0.0 → 1.0.0
  Modified principles: N/A (initial creation)
  Added sections: 9 Core Principles, Technology Constraints, Development Workflow, Governance
  Removed sections: None
  Templates requiring updates: ✅ plan-template.md (compatible), ✅ spec-template.md (compatible), ✅ tasks-template.md (compatible)
  Follow-up TODOs: None
-->

# RemedyIQ Constitution

## Core Principles

### I. Wrapper-First Architecture

ARLogAnalyzer.jar is the canonical parsing engine for all BMC Remedy AR Server log types. All initial log parsing MUST invoke the JAR as a subprocess. Native Go parsers supplement JAR output for specific use cases (real-time tailing, incremental parsing) but MUST NOT replace JAR-based parsing as the primary analysis path until they pass the Log Format Fidelity gate (see Article VII). The JAR subprocess manager MUST handle process lifecycle, timeout enforcement, memory allocation, and output capture reliably.

### II. API-First Design

Every capability MUST be exposed through a versioned REST or WebSocket API before any UI is built. The frontend is a consumer of the API, never a direct accessor of backend internals. API contracts MUST be defined in OpenAPI 3.1 format and committed to `specs/` before implementation begins. Breaking changes require a new API version. Internal service communication uses the same contract discipline.

### III. Test-First Development

Integration tests against real AR Server log samples MUST exist before implementation code is written. The Red-Green-Refactor cycle is enforced: write a failing test, implement the minimum code to pass, then refactor. Sample log files for each of the 4 log types (API, SQL, Filter, Escalation) MUST be maintained in a `testdata/` directory. Contract tests validate API endpoints against OpenAPI specs. Unit tests cover business logic; integration tests cover end-to-end flows.

### IV. AI as a Skill

Every AI capability is a discrete, independently testable skill with defined inputs, outputs, and evaluation criteria. AI skills MUST NOT be embedded in business logic — they are invoked through a skill registry with typed request/response contracts. Each skill MUST have: (1) a clear natural language description, (2) input schema, (3) output schema, (4) at least 3 evaluation examples, (5) fallback behavior when the AI service is unavailable. Skills include but are not limited to: NL Query, Error Explainer, Root Cause Analyzer, Performance Advisor, Anomaly Narrator, and Executive Summarizer.

### V. Multi-Tenant by Default

All data paths MUST include tenant isolation from day one. Every database query, message queue subject, storage path, and cache key MUST be scoped to a tenant identifier. Row-Level Security (RLS) in PostgreSQL and tenant-prefixed partitions in ClickHouse enforce isolation at the storage layer. No shared state may exist between tenants. Authentication via Clerk provides organization-level tenant mapping.

### VI. Simplicity Gate

The system MUST start with a maximum of 3 deployable services: (1) API Server (Go), (2) Worker (Go, handles ingestion + analysis + AI), (3) Frontend (Next.js). Additional services require explicit justification documenting why the existing services cannot absorb the responsibility. Every new dependency, abstraction, or service MUST pass a simplicity review: "Can this be done with what we already have?" Premature optimization and speculative architecture are rejected.

### VII. Log Format Fidelity

Native Go parsers MUST produce output identical to ARLogAnalyzer.jar for the same input. Fidelity is validated by a comparison test suite that runs both the JAR and the native parser against the same sample logs and diffs the structured output. Acceptable deviation is zero for numerical values (durations, counts, line numbers) and normalized whitespace for string fields. Until a native parser passes the fidelity suite for a log type, the JAR remains the authoritative parser for that type.

### VIII. Streaming-Ready

The architecture MUST support real-time log tailing from the initial design. WebSocket connections deliver live log events to connected clients. NATS JetStream provides the internal message bus with tenant-scoped subjects. All data ingestion paths MUST support both batch (file upload) and streaming (live tail) modes. Backpressure handling MUST be implemented to prevent client disconnection from blocking the pipeline.

### IX. Incremental Delivery

Each development phase MUST deliver a usable product, not just components. Phase 1 delivers file upload and JAR-based analysis with a results dashboard. Phase 2 adds search and exploration. Phase 3 adds AI-powered analysis. No phase may depend on a future phase for basic usability. Each phase is independently deployable and demonstrable to end users.

## Technology Constraints

**Backend**: Go 1.22+ with gorilla/mux, clickhouse-go, pgx, bleve, nats.go
**Frontend**: Next.js 14+ with React 18, shadcn/ui, Recharts, react-window
**Log Storage**: ClickHouse (partitioned by tenant and month)
**Metadata Storage**: PostgreSQL 16+ with Row-Level Security
**Message Bus**: NATS JetStream (persistent, tenant-scoped subjects)
**Cache**: Redis 7+ (tenant-prefixed keys)
**AI**: Claude API (Anthropic) via official Go SDK
**Auth**: Clerk (organization-based multi-tenancy)
**File Storage**: S3-compatible object storage for uploaded logs
**Containerization**: Docker with Docker Compose for local dev, Kubernetes for production

All dependencies MUST be Apache 2.0, MIT, or BSD licensed. SSPL and similar restrictive licenses are prohibited for SaaS deployment.

## Development Workflow

**Branch Strategy**: Feature branches from `main`, squash-merged via PR.
**Commit Discipline**: Each commit represents a complete, passing state. No broken commits on `main`.
**Code Review**: All changes require at least one review. Constitution compliance is a review checklist item.
**CI Pipeline**: Lint, unit tests, integration tests, contract tests, and fidelity tests run on every PR.
**Local Development**: `docker compose up` MUST bring up all dependencies. A `Makefile` provides standard targets: `make dev`, `make test`, `make lint`, `make build`.
**Documentation**: API contracts in OpenAPI, architecture decisions in ADRs (specs/adr/), user-facing docs auto-generated from code.

## Governance

This constitution supersedes all other development practices and architectural guidelines for the RemedyIQ project. Any deviation MUST be documented with explicit justification and approved via PR review.

**Amendment Process**: Amendments require a PR modifying this file with:
1. Clear description of what changes and why
2. Impact analysis on existing code and architecture
3. At least one reviewer approval
4. Version bump following semantic versioning (MAJOR for principle removal/redefinition, MINOR for additions, PATCH for clarifications)

**Compliance Review**: Every PR MUST include a constitution compliance check. Reviewers verify that changes align with all 9 principles. The CI pipeline enforces automated checks where possible (test existence, API contract presence, tenant scoping).

**Version**: 1.0.0 | **Ratified**: 2026-02-09 | **Last Amended**: 2026-02-09

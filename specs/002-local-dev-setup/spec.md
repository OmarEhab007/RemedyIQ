# Feature Specification: Local Development Setup

**Feature Branch**: `002-local-dev-setup`
**Created**: 2026-02-10
**Status**: Draft
**Input**: User description: "Local Development Setup - Make the RemedyIQ project run end-to-end on a local macOS (Apple Silicon) machine"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - One-Command Infrastructure Bootstrap (Priority: P1)

A developer clones the RemedyIQ repository and wants to get all infrastructure services (PostgreSQL, ClickHouse, NATS, Redis, MinIO) running with a single command. The system verifies prerequisites are installed, creates the environment configuration from a template, starts all Docker containers, waits for health checks to pass, runs database migrations, and reports a clear success/failure summary.

**Why this priority**: Without running infrastructure, nothing else works. This is the foundation for all development.

**Independent Test**: Can be tested by running the bootstrap command on a fresh clone and verifying all 5 Docker services report healthy status and databases contain the expected schemas.

**Acceptance Scenarios**:

1. **Given** a freshly cloned repository with Docker installed, **When** the developer runs the setup command, **Then** all 5 infrastructure services start, health checks pass, and database schemas are created within 5 minutes.
2. **Given** a machine missing a required tool (e.g., Docker not running), **When** the developer runs the setup command, **Then** the system reports which prerequisites are missing with installation guidance before attempting to start services.
3. **Given** infrastructure services are already running from a previous session, **When** the developer runs the setup command again, **Then** the system detects running services, skips what's already healthy, and reports current status without errors.

---

### User Story 2 - Backend Services Running Locally (Priority: P1)

A developer starts the Go API server and Worker process on their local machine. Both services connect to the Docker-hosted infrastructure, load configuration from a local `.env` file with sensible defaults, and become ready to accept requests. The developer sees clear startup logs confirming all connections are established.

**Why this priority**: The backend is the core of the application. Developers need it running to test any feature.

**Independent Test**: Can be tested by starting the backend, hitting the health endpoint, and confirming a successful response with all dependency checks passing.

**Acceptance Scenarios**:

1. **Given** all infrastructure services are healthy, **When** the developer starts the API server, **Then** the health endpoint returns a successful response confirming PostgreSQL, ClickHouse, NATS, and Redis connections.
2. **Given** the `.env` file has no Clerk secret key and the environment is set to development, **When** the developer starts the API server, **Then** the server starts successfully with auth bypass mode enabled, allowing development headers (`X-Dev-User-ID`, `X-Dev-Tenant-ID`) for authentication.
3. **Given** the `.env` file has no Anthropic API key, **When** the developer starts the API server, **Then** the server starts successfully and AI endpoints return a clear "AI not configured" message instead of crashing.

---

### User Story 3 - Frontend Running and Connecting to Backend (Priority: P2)

A developer starts the Next.js frontend development server and can access the application in their browser. The frontend connects to the local API server and renders the dashboard interface. When Clerk authentication keys are not configured, the frontend gracefully handles the absence and allows development access.

**Why this priority**: The frontend is essential for visual development and end-to-end testing, but the backend can be tested independently via API calls.

**Independent Test**: Can be tested by starting the frontend, navigating to localhost:3000, and seeing the application render without console errors related to missing backend or configuration.

**Acceptance Scenarios**:

1. **Given** the backend API server is running on port 8080, **When** the developer starts the frontend dev server, **Then** the application loads at `http://localhost:3000` and can communicate with the backend API.
2. **Given** Clerk authentication keys are not configured, **When** the developer navigates to the frontend, **Then** the application displays a development mode indicator and allows access to the dashboard without sign-in.
3. **Given** both frontend and backend are running, **When** the developer navigates between pages (Dashboard, Upload, Explorer, AI Chat), **Then** all pages render without JavaScript errors.

---

### User Story 4 - End-to-End Log Analysis Pipeline (Priority: P2)

A developer uploads a sample AR Server log file through the API (or frontend), the system processes it through the ARLogAnalyzer.jar, stores parsed entries in ClickHouse, and the developer can view the analysis results on the dashboard. This validates the complete data flow from upload to visualization.

**Why this priority**: Validates the core business value proposition end-to-end. Depends on both infrastructure and backend being operational.

**Independent Test**: Can be tested by uploading a sample log file via curl, waiting for analysis completion, and retrieving dashboard data via the API.

**Acceptance Scenarios**:

1. **Given** all services are running and sample log files exist in `backend/testdata/`, **When** the developer uploads `arapi_sample.log` via the upload API, **Then** the system accepts the file, stores it in MinIO, and creates an analysis job.
2. **Given** an analysis job has been created, **When** the Worker processes the job, **Then** the system invokes ARLogAnalyzer.jar (if Java is available) or the native Go parser, stores parsed log entries in ClickHouse, and marks the job as complete.
3. **Given** an analysis job is complete, **When** the developer queries the dashboard endpoint, **Then** the response contains aggregated metrics (log count, error distribution, time-series data) for the analyzed file.
4. **Given** Java is not installed on the developer's machine, **When** the Worker processes an analysis job, **Then** the system falls back to the native Go parser with a warning log, and produces analysis results.

---

### User Story 5 - Service Health Verification (Priority: P3)

A developer wants to quickly check that all services in their local environment are healthy and properly connected. A single command reports the status of each infrastructure service, the API server, and the Worker, making it easy to diagnose connectivity issues.

**Why this priority**: Essential for debugging but not required for initial setup. Developers need this when things go wrong.

**Independent Test**: Can be tested by running the health check command with all services up (expecting all green) and with one service down (expecting that service reported as failing).

**Acceptance Scenarios**:

1. **Given** all services are running, **When** the developer runs the health check command, **Then** the output lists each service with a pass/fail indicator and response time.
2. **Given** one infrastructure service is stopped (e.g., Redis), **When** the developer runs the health check command, **Then** the output clearly identifies which service is down and suggests how to restart it.

---

### Edge Cases

- What happens when Docker ports are already in use by other applications (e.g., port 5432 used by a local PostgreSQL)?
- How does the system handle insufficient disk space for Docker volumes?
- What happens when the developer's machine has low memory and ClickHouse cannot allocate its default buffer?
- How does the system behave when running the backend before infrastructure is started?
- What happens if database migrations are run twice (idempotency)?
- How does the frontend behave when the backend API is unreachable?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST verify that prerequisite tools (Docker, Go, Node.js, make) are installed and meet minimum version requirements before attempting setup.
- **FR-002**: System MUST provide a single command that starts all 5 infrastructure services (PostgreSQL, ClickHouse, NATS, Redis, MinIO) via Docker Compose and waits until all health checks pass.
- **FR-003**: System MUST generate a valid environment configuration file from the provided template with all defaults pre-configured for local development.
- **FR-004**: System MUST run database schema migrations (tables, security policies, indexes) and analytics schema initialization (tables, materialized views) as part of setup.
- **FR-005**: System MUST allow the backend API server to start and serve the health endpoint without requiring third-party authentication or AI service keys.
- **FR-006**: System MUST enable an authentication bypass in development mode so developers can test authenticated endpoints using development headers.
- **FR-007**: System MUST allow the frontend to start and render pages without third-party authentication keys configured, providing a development-mode access path.
- **FR-008**: System MUST support the complete log analysis pipeline locally: file upload, job creation, processing by the Worker, parsed entries stored in the analytics database, and results queryable via the API.
- **FR-009**: System MUST provide a health check command that verifies connectivity to all infrastructure services and reports pass/fail status for each.
- **FR-010**: System MUST detect and report port conflicts before starting services, with guidance on resolution.
- **FR-011**: System MUST handle the absence of Java gracefully by falling back to native log parsing when the JAR analyzer cannot be executed.
- **FR-012**: Database migrations MUST be idempotent — running them multiple times produces the same result without errors.

### Key Entities

- **Infrastructure Service**: A containerized service running a database or middleware, with a health check endpoint and configuration defaults.
- **Environment Configuration**: A configuration file containing connection strings, feature flags, and secrets needed by the backend and frontend services.
- **Development Session**: The state of a developer's local environment, including running containers, active backend processes, and the frontend dev server.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A developer can go from a fresh repository clone to all services running in under 10 minutes, including image downloads.
- **SC-002**: The setup process completes without requiring manual editing of configuration files beyond optionally adding API keys for third-party services.
- **SC-003**: All 5 infrastructure services pass health checks within 60 seconds of starting containers.
- **SC-004**: The API health endpoint returns a successful response within 5 seconds of the server starting.
- **SC-005**: A developer can upload a sample log file and view analysis results without configuring any third-party services.
- **SC-006**: The setup process provides clear, actionable error messages for every failure mode (missing prerequisites, port conflicts, connection failures).
- **SC-007**: The entire local stack (infrastructure + backend + frontend) consumes less than 4 GB of RAM during idle operation.
- **SC-008**: Running the setup command a second time completes in under 30 seconds by detecting and skipping already-running services.

## Assumptions

- The developer's machine runs macOS on Apple Silicon (ARM64) with Docker Desktop installed and running.
- At least 8 GB of free RAM and 10 GB of free disk space are available.
- Required ports (3000, 4222, 5432, 6379, 8080, 8123, 8222, 9000, 9001, 9002) are available or the system detects conflicts.
- The developer has Go 1.22+, Node.js 20+, and npm installed (the setup process checks and reports if missing).
- Java 11+ is optional — the system falls back to native parsing when Java is unavailable.
- Third-party service keys (authentication, AI) are optional for local development — features degrade gracefully.
- The developer has internet connectivity for pulling container images on first run.

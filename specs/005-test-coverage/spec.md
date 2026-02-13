# Feature Specification: Comprehensive Test Coverage

**Feature Branch**: `005-test-coverage`
**Created**: 2026-02-12
**Status**: Draft
**Input**: User description: "Design and implement comprehensive test coverage for the ARLogAnalyzer-25 (RemedyIQ) application targeting 85%+ code coverage across backend and frontend, using real error log data for realistic test scenarios."

## Clarifications

### Session 2026-02-12

- Q: Should existing 35 backend test files be extended, left unchanged, or rewritten? → A: Rewrite all existing test files with a unified testing approach for consistency across the entire test suite.
- Q: How should 85% coverage be measured — aggregate, per-package, or tiered? → A: Tiered approach — critical packages (handlers, storage, middleware) must reach 90%, others must reach 80%, with an overall aggregate of 85%.
- Q: Should the scope include Docker-based integration tests alongside unit tests? → A: Full integration suite — add Docker-based integration tests for all services (PostgreSQL, ClickHouse, NATS, Redis, S3), tagged separately from unit tests so the fast unit suite remains independent.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Backend Core Business Logic Tests (Priority: P1)

As a developer, I need the core backend business logic to be thoroughly tested so that changes to log parsing, storage operations, and API handlers are validated automatically, preventing regressions in production.

**Why this priority**: The backend contains the core business logic (log parsing, data storage, API endpoints) that drives the entire application. Bugs here directly impact data integrity and user trust. The JAR parser, storage layer, and API handlers process real customer log data and must be reliable.

**Independent Test**: Can be fully tested by running `make test` and verifying that all backend unit tests pass with 85%+ coverage across storage, handler, and parser packages. Delivers confidence that core data processing is correct.

**Acceptance Scenarios**:

1. **Given** the backend codebase with all test files rewritten using a unified approach, **When** the complete backend test suite is executed, **Then** code coverage across all backend packages reaches at least 85%
2. **Given** a storage operation (create, read, update, delete), **When** the corresponding test runs with mocked database connections, **Then** the test validates correct behavior for success cases, error cases, and edge cases
3. **Given** an API handler endpoint, **When** the handler test sends various HTTP requests (valid, invalid, missing auth, malformed data), **Then** the test validates correct response codes, response bodies, and error messages
4. **Given** the JAR parser module, **When** parser tests run against real log samples from the `error_logs/` and `testdata/` directories, **Then** the parser correctly extracts all expected fields (timestamps, thread IDs, log levels, error messages)
5. **Given** any backend test, **When** run repeatedly in any order, **Then** the test produces the same result (deterministic, no flakiness)

---

### User Story 2 - Backend Middleware and Infrastructure Tests (Priority: P2)

As a developer, I need the middleware stack (authentication, tenant isolation, CORS, logging, recovery) and infrastructure clients (message queue, cache, search index) to be tested so that cross-cutting concerns like security and multi-tenancy are validated.

**Why this priority**: Middleware handles security (JWT auth), multi-tenant isolation (RLS context), and operational concerns (logging, panic recovery). Untested middleware can lead to security vulnerabilities or tenant data leaks. Infrastructure clients (NATS, Redis, Bleve) are critical for the event-driven architecture.

**Independent Test**: Can be fully tested by running middleware and infrastructure test suites in isolation. Delivers confidence that auth, tenant isolation, and background processing work correctly.

**Acceptance Scenarios**:

1. **Given** the auth middleware, **When** tests send requests with valid tokens, expired tokens, missing tokens, and malformed tokens, **Then** the middleware correctly allows or denies access with appropriate error responses
2. **Given** the tenant middleware, **When** tests provide different tenant contexts, **Then** the middleware correctly sets tenant context and prevents cross-tenant data access
3. **Given** the recovery middleware, **When** a handler panics during request processing, **Then** the middleware recovers gracefully and returns a structured error response without crashing the server
4. **Given** the NATS streaming client, **When** tests publish and subscribe to messages with mocked NATS connections, **Then** message delivery, acknowledgement, and error handling work correctly
5. **Given** the search index (Bleve) and KQL parser, **When** tests execute various search queries against indexed test data, **Then** results are accurate and the KQL parser handles all supported syntax

---

### User Story 3 - Backend AI Skills Tests (Priority: P3)

As a developer, I need the AI analysis skills (summarizer, error explainer, anomaly detection, performance analysis, root cause analysis, natural language query) to be tested with mocked AI responses so that skill prompt construction, response parsing, and error handling are validated.

**Why this priority**: AI skills are user-facing features that process sensitive log data and produce analysis results. While the AI model responses are external, the skill logic (prompt construction, response parsing, token tracking, error handling) must be validated to ensure reliable user experience.

**Independent Test**: Can be fully tested by running AI skill tests with mocked AI client responses. Delivers confidence that skill orchestration and response handling work correctly without requiring actual API calls.

**Acceptance Scenarios**:

1. **Given** an AI skill (summarizer, error explainer, anomaly, performance, root cause, NL query), **When** the skill test runs with a mocked AI client returning structured responses, **Then** the skill correctly constructs prompts from input data and parses responses into expected output format
2. **Given** the AI client, **When** tests simulate API errors (timeout, rate limit, invalid response), **Then** the client handles errors gracefully with appropriate error messages and retry behavior
3. **Given** the skill registry, **When** tests register and look up skills, **Then** the registry correctly manages skill lifecycle and returns the appropriate skill for each query type
4. **Given** real log data from `error_logs/`, **When** skills construct analysis prompts, **Then** the prompts contain properly formatted log excerpts and context

---

### User Story 4 - Frontend Component Tests (Priority: P4)

As a developer, I need all frontend React components to be tested (dashboard sections, explorer, trace, AI chat, upload) so that UI rendering, user interactions, and data display are validated automatically.

**Why this priority**: The frontend currently has 0% test coverage. Dashboard components display critical metrics and charts to users. Explorer, trace, and AI components handle complex user interactions. Without tests, UI regressions can ship silently.

**Independent Test**: Can be fully tested by running `npm test` in the frontend directory and verifying that all component tests pass with 85%+ coverage. Delivers confidence that UI renders correctly and responds to user interactions.

**Acceptance Scenarios**:

1. **Given** a dashboard component (stats cards, charts, sections), **When** the component test renders it with mock data, **Then** the component displays the correct values, labels, and visual elements
2. **Given** the log explorer table, **When** tests render it with a large dataset, **Then** the virtualized list renders visible rows correctly and responds to scroll events
3. **Given** the search bar and filter panel, **When** tests simulate user typing and filter selection, **Then** the components emit correct search queries and filter values
4. **Given** the upload dropzone component, **When** tests simulate drag-and-drop and file selection, **Then** the component validates file types and triggers upload callbacks
5. **Given** any component receiving empty data, error states, or loading states, **Then** the component renders appropriate fallback UI

---

### User Story 5 - Frontend Hooks and Utility Tests (Priority: P5)

As a developer, I need the custom React hooks (use-ai, use-analysis, use-search, use-lazy-section) and utility libraries (API client, WebSocket client) to be tested so that data fetching, state management, and real-time communication logic are validated.

**Why this priority**: Hooks and utilities are shared across multiple components. A bug in the API client or a custom hook would cascade to every component that uses it. Testing these foundational pieces provides broad coverage leverage.

**Independent Test**: Can be fully tested by running hook and utility tests with mocked fetch/WebSocket APIs. Delivers confidence that data fetching, caching, and real-time communication work correctly.

**Acceptance Scenarios**:

1. **Given** the API client utility, **When** tests call each API method with mocked fetch responses (success, error, timeout), **Then** the client correctly sends requests with proper headers and parses responses
2. **Given** a custom hook (use-ai, use-analysis, use-search), **When** the hook test renders it within a test component, **Then** the hook correctly manages loading, success, and error states
3. **Given** the WebSocket client, **When** tests simulate connection, message receipt, disconnection, and reconnection, **Then** the client handles each state transition correctly
4. **Given** the use-lazy-section hook, **When** tests simulate intersection observer events, **Then** the hook correctly triggers lazy loading of dashboard sections

---

### User Story 6 - Test Infrastructure and CI Integration (Priority: P6)

As a developer, I need the test infrastructure configured properly (test runners, coverage tools, test data fixtures) so that tests can be run consistently in both local development and CI environments.

**Why this priority**: Without proper test infrastructure, tests cannot be run reliably. Coverage reporting is needed to verify the 85% target is met. Test data fixtures from `error_logs/` need to be accessible to tests.

**Independent Test**: Can be verified by running the full test suite in a clean environment and confirming coverage reports are generated with accurate metrics.

**Acceptance Scenarios**:

1. **Given** the backend test suite, **When** `make test` is executed, **Then** all tests run and a coverage report is generated showing per-package and total coverage percentages
2. **Given** the frontend test suite, **When** `npm test` is executed, **Then** all tests run and a coverage report is generated showing per-file and total coverage percentages
3. **Given** the `error_logs/` directory containing real AR log files, **When** backend tests reference these files as test fixtures, **Then** the files are accessible and tests can parse real log content
4. **Given** a newly cloned repository, **When** a developer runs the unit test suite without any external services running, **Then** all unit tests pass (integration tests are skipped via build tags)
5. **Given** Docker Compose services are running, **When** a developer runs the integration test suite, **Then** all integration tests pass against real PostgreSQL, ClickHouse, NATS, Redis, and S3 instances

---

### Edge Cases

- What happens when test data files in `error_logs/` are missing or corrupted? Tests should fail with clear error messages indicating the missing fixture.
- How does the system handle testing WebSocket connections that drop mid-stream? Tests should verify reconnection logic and message buffering.
- What happens when the AI mock returns malformed JSON? AI skill tests should verify graceful error handling and meaningful error messages.
- How are tests isolated when multiple tests modify shared state (e.g., search index, in-memory caches)? Each test should set up and tear down its own state.
- What happens when the JAR parser encounters a log format it doesn't recognize? Parser tests should verify graceful degradation with unknown formats.
- How do frontend tests handle components that depend on browser-specific APIs (IntersectionObserver, drag-and-drop)? Tests should provide appropriate polyfills or mocks.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Test suite MUST achieve tiered backend coverage: critical packages (handlers, storage, middleware) at 90% minimum, all other packages at 80% minimum, with an aggregate of at least 85%
- **FR-002**: Test suite MUST achieve tiered frontend coverage: critical directories (components, hooks, lib) at 90% minimum, all other directories at 80% minimum, with an aggregate of at least 85%
- **FR-003**: Backend tests MUST use real log data from the `error_logs/` and `testdata/` directories for parsing and analysis tests
- **FR-004**: All tests MUST be deterministic — producing identical results when run in any order, any number of times
- **FR-005**: Backend tests MUST mock all external dependencies (databases, message queues, object storage, AI APIs) for unit tests
- **FR-006**: Frontend tests MUST mock all API calls and browser APIs for component and hook tests
- **FR-007**: Tests MUST cover both success (happy path) and failure (error, edge case) scenarios for each module
- **FR-008**: Backend handler tests MUST validate HTTP response codes, response body structure, and error messages for all endpoints
- **FR-009**: Middleware tests MUST validate authentication enforcement, tenant isolation, CORS headers, request size limits, and panic recovery
- **FR-010**: AI skill tests MUST validate prompt construction, response parsing, and error handling with mocked AI client responses
- **FR-011**: Frontend component tests MUST validate rendering with mock data, user interaction handling, loading states, and error states
- **FR-012**: Frontend hook tests MUST validate state transitions (idle, loading, success, error) and cleanup on unmount
- **FR-013**: Storage layer tests MUST validate CRUD operations, error handling, and multi-tenant data isolation
- **FR-014**: All unit tests MUST be runnable without external services (databases, NATS, Redis, MinIO) being available
- **FR-018**: Integration tests MUST be provided for all external services (PostgreSQL, ClickHouse, NATS, Redis, S3/MinIO) that run against real Docker Compose services
- **FR-019**: Integration tests MUST be tagged/separated so they can be run independently from unit tests (e.g., via build tags or test runner configuration)
- **FR-020**: Integration tests MUST validate real queries, connection handling, schema compatibility, and failure modes against actual service instances
- **FR-015**: Coverage reports MUST be generated in both human-readable and machine-parseable formats
- **FR-016**: Worker tests MUST validate the ingestion pipeline, job processing, and anomaly detection logic
- **FR-017**: Search tests MUST validate full-text indexing, KQL query parsing, and result ranking

### Key Entities

- **Test Suite**: A collection of test files organized by package/module, each containing multiple test cases with setup, execution, and assertion phases
- **Test Fixture**: Real log data files from `error_logs/` and `testdata/` used as input for parser and analysis tests; mock data structures for API and component tests
- **Coverage Report**: Generated artifact showing line-by-line, function-level, and package/file-level coverage percentages
- **Mock**: A simulated dependency (database, API, WebSocket) that returns controlled responses for deterministic testing

## Assumptions

- All 35 existing backend test files will be rewritten from scratch with a unified testing approach, ensuring consistent patterns, shared mock infrastructure, and uniform conventions across the entire test suite
- Real log files in `error_logs/` and `testdata/` contain representative samples of all log types the application handles
- Frontend testing will use the standard Jest + React Testing Library stack already common in the Next.js ecosystem
- Backend uses Go build tags (e.g., `//go:build integration`) to separate unit and integration tests; integration tests require Docker Compose services to be running
- Docker Compose infrastructure (PostgreSQL, ClickHouse, NATS, Redis, MinIO) is available for integration test execution via `make docker-up`
- The 85% coverage target applies to application source code, excluding auto-generated files, vendor dependencies, and test files themselves
- Mock implementations will be created fresh as part of a shared test utilities package, replacing any existing scattered mock implementations

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Backend test coverage meets tiered thresholds: critical packages (handlers, storage, middleware) at 90%+, all other packages at 80%+, aggregate at 85%+
- **SC-002**: Frontend test coverage meets tiered thresholds: critical directories (components, hooks, lib) at 90%+, all other directories at 80%+, aggregate at 85%+
- **SC-003**: 100% of API endpoints have at least one success and one failure test case
- **SC-004**: 100% of middleware functions have dedicated test cases covering their primary behavior
- **SC-005**: All 5 AI skills have test suites validating prompt construction and response parsing
- **SC-006**: All frontend components render without errors when provided with valid mock data
- **SC-007**: All unit tests pass in a clean environment without any external services running
- **SC-011**: All integration tests pass when Docker Compose services are running, validating real database queries, message queue operations, cache behavior, and object storage
- **SC-008**: Test suite execution completes with zero flaky failures across 3 consecutive runs
- **SC-009**: Real log data from `error_logs/` is used in at least 10 backend test cases for parsing and analysis validation
- **SC-010**: Coverage reports are generated automatically as part of the standard test commands (`make test`, `npm test`)

# Research: Comprehensive Test Coverage

**Branch**: `005-test-coverage` | **Date**: 2026-02-12

## R-001: Backend Unit Test Mocking Strategy

**Decision**: Define Go interfaces for all storage/infrastructure clients and generate mock implementations using testify/mock or hand-written stubs in a shared `internal/testutil/` package.

**Rationale**: The current codebase uses concrete struct types for PostgresClient, ClickHouseClient, RedisClient, S3Client, NATSClient, and AIClient. Handlers accept these concrete types, making unit testing impossible without real connections. By extracting interfaces (which the methods already implicitly satisfy), we can inject mock implementations for unit tests while keeping integration tests against real services.

**Alternatives considered**:
- **mockgen (gomock)**: More ceremony (generated code, controller lifecycle). Testify mocks are lighter and already a project dependency.
- **No interfaces, only integration tests**: Would make tests slow and require Docker for every test run. Contradicts FR-014 (unit tests without external services).
- **Dependency injection framework (wire, fx)**: Over-engineering for this codebase size. Manual constructor injection is sufficient.

## R-002: Frontend Test Framework Selection

**Decision**: Use Vitest + React Testing Library + jsdom for frontend testing.

**Rationale**: Next.js 16 has native Vitest integration. Vitest is faster than Jest for ESM/TypeScript projects, has built-in coverage via v8/istanbul, and shares Vite's config. React Testing Library encourages testing user behavior over implementation details. The project already uses TypeScript 5.x, which Vitest handles natively without babel transforms.

**Alternatives considered**:
- **Jest + React Testing Library**: Industry standard but requires additional babel/SWC config for Next.js 16 ESM modules. Slower test execution.
- **Playwright Component Testing**: Better for visual testing but overkill for unit/component tests. Higher setup cost.
- **Cypress Component Testing**: Similar to Playwright — better for E2E, not optimal for unit coverage targets.

## R-003: Go Build Tag Strategy for Integration Tests

**Decision**: Use `//go:build integration` build tag for all integration tests. Unit tests have no build tag. Makefile provides `make test` (unit only) and `make test-integration` (integration only) and `make test-all` (both).

**Rationale**: The existing codebase already uses `//go:build integration` in 7 test files (postgres_test.go, clickhouse_test.go, s3_test.go, nats_test.go, etc.). This convention is established and works with `go test -tags=integration`. Unit tests run by default with `go test ./...` (no tags needed).

**Alternatives considered**:
- **Environment variable checks**: `if os.Getenv("INTEGRATION") == "" { t.Skip() }`. Less idiomatic Go, doesn't prevent compilation of integration test code.
- **Separate test directories**: `tests/integration/` vs `tests/unit/`. Breaks Go convention of colocating tests with source.

## R-004: Test Fixture Management for Real Log Data

**Decision**: Create a `backend/internal/testutil/fixtures.go` package that provides helper functions to load test data from `error_logs/` and `backend/testdata/` directories. Use `os.Getwd()` + relative path resolution or embed directives for portability.

**Rationale**: Multiple test packages (parser, AI skills, search, handlers) need access to the same real log files. A shared fixture loader avoids path duplication and provides consistent error messages when fixtures are missing. Go's `//go:embed` directive can embed small fixtures directly into test binaries for portability.

**Alternatives considered**:
- **Each test loads its own files**: Duplicates path logic, fragile to directory structure changes.
- **Embed all fixtures in test binary**: The `error_logs/` directory may be large (40+ files). Only embed the frequently-used subset; reference others by path.

## R-005: Shared Mock Infrastructure Design

**Decision**: Create `backend/internal/testutil/mocks.go` containing mock implementations for all storage interfaces (MockPostgresStore, MockClickHouseStore, MockRedisCache, MockS3Storage, MockNATSClient, MockAIClient). Each mock uses testify/mock for flexible expectations.

**Rationale**: The rewrite requires consistent mock patterns across all test files. A centralized mocks package ensures: (1) mock behavior is consistent, (2) interface changes are caught at compile time in one place, (3) test files stay focused on test logic rather than mock setup.

**Alternatives considered**:
- **Per-package mocks**: Each package defines its own mocks. Leads to duplication and inconsistency.
- **Generated mocks (mockery)**: Auto-generation adds toolchain dependency. The interface surface is small enough (~30 methods total) for hand-written mocks.

## R-006: Frontend Coverage Tooling

**Decision**: Use Vitest's built-in v8 coverage provider with per-directory thresholds configured in vitest.config.ts.

**Rationale**: Vitest natively supports coverage thresholds via the `coverage.thresholds` config option, including per-glob patterns. This allows enforcing the tiered coverage model (90% for components/hooks/lib, 80% for others) directly in the test runner config without external tools.

**Alternatives considered**:
- **Istanbul via nyc**: Requires separate setup. v8 is faster and built into Vitest.
- **Codecov/Coveralls**: Good for CI reporting but doesn't enforce local thresholds. Can be added later for CI integration.

## R-007: WebSocket Testing Strategy

**Decision**: Use `gorilla/websocket`'s `httptest` integration for backend WebSocket tests. Create a test helper that upgrades an httptest.Server connection and provides read/write helpers. For frontend, mock the WebSocket constructor in Vitest.

**Rationale**: The backend stream handler uses gorilla/websocket's Upgrader. Testing requires a real HTTP server (httptest.Server) that accepts WebSocket upgrades. The gorilla library is well-tested with httptest. Frontend WebSocket tests mock the global WebSocket class to control connection lifecycle.

**Alternatives considered**:
- **Mock the Upgrader directly**: Requires complex mock of the websocket.Conn type. Real httptest server is simpler and more realistic.
- **Skip WebSocket unit tests, only integration test**: Misses logic bugs in the hub/client registration and message routing.

## R-008: Recharts and react-window Test Mocking

**Decision**: Mock Recharts components as simple div containers that expose data props. Mock react-window's FixedSizeList to render all items (or a subset) without virtualization in tests.

**Rationale**: Recharts renders SVG internally, which jsdom doesn't fully support. Testing chart rendering (tooltips, axes, data points) via DOM assertions is fragile. Instead, verify that the correct data is passed to chart components. For react-window, the virtualization behavior is the library's responsibility; tests should verify the row renderer receives correct data.

**Alternatives considered**:
- **Snapshot testing for charts**: Fragile to Recharts internal changes. Not recommended.
- **Visual regression testing (Playwright)**: Out of scope for unit coverage. Can be a future addition.

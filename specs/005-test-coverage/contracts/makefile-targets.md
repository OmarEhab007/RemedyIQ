# Makefile Contract: Test Targets

These targets will be added/updated in the root Makefile.

## New/Updated Targets

```makefile
# Unit tests only (no external services required)
test:
	go test -v -race -count=1 -coverprofile=coverage.out ./backend/...
	@echo "Coverage report:"
	@go tool cover -func=coverage.out | tail -1

# Integration tests only (requires Docker services)
test-integration:
	go test -v -race -count=1 -tags=integration -coverprofile=coverage-integration.out ./backend/...

# All tests (unit + integration)
test-all: test test-integration

# HTML coverage report
test-coverage:
	go test -v -race -count=1 -coverprofile=coverage.out ./backend/...
	go tool cover -html=coverage.out -o coverage.html
	@echo "Coverage report: coverage.html"

# Per-package coverage breakdown
test-coverage-detail:
	@go test -coverprofile=coverage.out ./backend/... 2>/dev/null
	@go tool cover -func=coverage.out

# Frontend tests
test-frontend:
	cd frontend && npx vitest run --coverage

# Frontend tests in watch mode
test-frontend-watch:
	cd frontend && npx vitest

# Run all tests (backend + frontend)
test-full: test test-frontend
```

## Coverage Enforcement

Backend coverage thresholds are verified by a script that parses `coverage.out`:
- Critical packages (handlers, storage, middleware): >= 90%
- Other packages: >= 80%
- Aggregate: >= 85%

Frontend coverage thresholds are enforced in `vitest.config.ts`:
- Critical directories (components, hooks, lib): >= 90%
- Other directories: >= 80%
- Aggregate: >= 85%

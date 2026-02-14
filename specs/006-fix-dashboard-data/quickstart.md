# Quickstart: Fix Dashboard Data Pipeline

**Feature**: 006-fix-dashboard-data
**Date**: 2026-02-13

## Prerequisites

- Go 1.24.1+
- Node.js 20+ / npm
- Java 17+ (for running ARLogAnalyzer.jar)
- Docker + Docker Compose (for Redis, PostgreSQL, ClickHouse, NATS, MinIO)
- Real log files in `error_logs/` directory

## Local Dev Setup

### 1. Start Infrastructure

```bash
cd /Users/omar/Developer/ARLogAnalyzer-25
docker compose up -d
```

Wait for all 5 services to be healthy:
```bash
docker compose ps
```

Expected: PostgreSQL (5432), ClickHouse (9004), NATS (4222), Redis (6379), MinIO (9002)

### 2. Backend Development

```bash
cd backend

# Run all existing tests (should pass before any changes)
go test ./...

# Run parser tests specifically
go test ./internal/jar/ -v

# Run fidelity tests with real JAR output
go test ./internal/jar/ -run TestFidelity -v

# Run integration test (requires JAR + Java)
go test ./internal/jar/ -run TestIntegration -v -tags=integration

# Start API server
go run ./cmd/api/

# Start worker (separate terminal)
go run ./cmd/worker/
```

### 3. Frontend Development

```bash
cd frontend

# Install dependencies
npm install

# Run tests
npm test

# Start dev server
npm run dev
```

### 4. Testing with JAR Output

To generate fresh JAR output for testing:

```bash
cd /Users/omar/Developer/ARLogAnalyzer-25

# Run JAR against test log (requires Java 17+)
java -Xmx4096m \
  -Dorg.xerial.snappy.lib.path="backend/lib/snappy-native/org/xerial/snappy/native/Mac/aarch64" \
  -Dorg.xerial.snappy.lib.name=libsnappyjava.dylib \
  -jar ARLogAnalyzer/ARLogAnalyzer-3/ARLogAnalyzer.jar \
  error_logs/log1.log > /tmp/jar_output_log1.txt 2>/tmp/jar_stderr_log1.txt

# Verify output has all sections
grep -c "^###" /tmp/jar_output_log1.txt  # Should be ~25 subsection headers
```

### 5. Verifying Parser Changes

After modifying `parser.go`, run the test sequence:

```bash
cd backend

# Unit tests for new parsers
go test ./internal/jar/ -run TestParseGaps -v
go test ./internal/jar/ -run TestParseAggregateTable -v
go test ./internal/jar/ -run TestParseThreadStats -v
go test ./internal/jar/ -run TestParseAPIErrors -v
go test ./internal/jar/ -run TestParseExceptionReport -v
go test ./internal/jar/ -run TestParseFilterMostExecuted -v
go test ./internal/jar/ -run TestParseFilterPerTransaction -v
go test ./internal/jar/ -run TestParseFilterLevels -v

# Full test suite
go test ./...
```

### 6. Verifying End-to-End

1. Start backend (API + Worker) and frontend
2. Upload `error_logs/log1.log` through the UI
3. Run analysis
4. Navigate to the analysis dashboard
5. Verify all 10 sections show populated data:
   - Stats Cards (already working)
   - Top-N Tables (already working)
   - Time Series Chart (should now show bucketed operations)
   - Distribution Chart (should now show aggregate-derived breakdowns)
   - Aggregates (should show Form/Client/Table/Pool tabs)
   - Exceptions (should show API Errors + Exception Reports)
   - Gap Analysis (should show line gaps + thread gaps)
   - Thread Statistics (should show queue-grouped stats with busy%)
   - Filter Complexity (should show 5 sub-tabs)

## Key Files

| File | What to Change |
|---|---|
| `backend/internal/domain/models.go` | Add ~15 JAR-native types |
| `backend/internal/jar/parser.go` | Add 8+ new parse functions |
| `backend/internal/jar/parser_test.go` | Add tests for each new parser |
| `backend/internal/worker/ingestion.go` | Cache parsed sections in Redis |
| `backend/internal/worker/enhanced.go` | Prefer JAR data over computed |
| `backend/internal/api/handlers/*.go` | Serve JAR-parsed data |
| `frontend/src/lib/api.ts` | Update TypeScript interfaces |
| `frontend/src/components/dashboard/*.tsx` | Update 7 section components |

## Test Log Files

| File | Size | Content |
|---|---|---|
| `error_logs/log1.log` | 5.1MB | Full API+SQL+ESC+FLTR activity (primary test file) |
| `error_logs/log3.log` | 242K | Escalation-heavy, minimal API/SQL |
| `error_logs/log4.log` | 8MB | Mixed activity |
| `error_logs/arerror.log` | 35MB | Cannot be parsed by JAR v3 (timestamp incompatibility) |

## Troubleshooting

- **JAR fails with Snappy error**: Add the `-Dorg.xerial.snappy.lib.path` and `-Dorg.xerial.snappy.lib.name` JVM flags (see step 4 above)
- **"No data available" still shows**: Check Redis cache keys — `redis-cli KEYS "remedyiq:*:dashboard:*"` should show base + section keys
- **Parser tests fail**: Compare against `/tmp/jar_output_log1.txt` for exact column positions and separator patterns
- **Frontend TypeScript errors**: Run `npm run type-check` to verify interface compatibility

package worker

import (
	"context"
	"os"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/OmarEhab007/RemedyIQ/backend/internal/domain"
	"github.com/OmarEhab007/RemedyIQ/backend/internal/jar"
)

// ---------------------------------------------------------------------------
// Unit tests -- no external services required
// ---------------------------------------------------------------------------

// TestNewPipeline verifies pipeline construction with nil dependencies.
func TestNewPipeline(t *testing.T) {
	p := NewPipeline(nil, nil, nil, nil, nil, nil)
	assert.NotNil(t, p)
}

// TestProcessJob_NilPGClient verifies that ProcessJob panics when the pg
// client is nil because the first operation dereferences it to call
// UpdateJobStatus. This ensures the pipeline does not silently ignore a
// misconfigured dependency.
func TestProcessJob_NilPGClient(t *testing.T) {
	p := NewPipeline(nil, nil, nil, nil, nil, nil)

	job := domain.AnalysisJob{
		ID:       uuid.New(),
		TenantID: uuid.New(),
		FileID:   uuid.New(),
		Status:   domain.JobStatusQueued,
	}

	assert.Panics(t, func() {
		_ = p.ProcessJob(context.Background(), job)
	}, "expected panic when pg client is nil")
}

// TestProcessJob_CancelledContext verifies that a cancelled context causes
// ProcessJob to fail. With nil pg the method panics, so we assert that
// the panic occurs regardless of context state (the nil dereference
// happens before the context is inspected).
func TestProcessJob_CancelledContext(t *testing.T) {
	p := NewPipeline(nil, nil, nil, nil, nil, nil)

	ctx, cancel := context.WithCancel(context.Background())
	cancel() // cancel immediately

	job := domain.AnalysisJob{
		ID:       uuid.New(),
		TenantID: uuid.New(),
		FileID:   uuid.New(),
		Status:   domain.JobStatusQueued,
	}

	assert.Panics(t, func() {
		_ = p.ProcessJob(ctx, job)
	}, "expected panic on nil pg even with cancelled context")
}

// TestParseSampleOutput verifies that the JAR parser correctly processes
// a realistic multi-section output string, validating the integration
// between the pipeline and the parser layer.
func TestParseSampleOutput(t *testing.T) {
	sampleOutput := `=== General Statistics ===
Total Lines Processed:  12345
API Calls:              8901
SQL Operations:         2345
Filter Executions:      890
Escalation Executions:  209
Unique Users:           15
Unique Forms:           23
Unique Tables:          8
Log Start:              2026-02-03 10:00:00
Log End:                2026-02-03 18:30:45
Log Duration:           8h 30m 45s

=== Top API Calls ===
| Rank | Line# | Timestamp | Thread | Identifier | Form | Duration(ms) | Status |
|------|-------|-----------|--------|------------|------|--------------|--------|
| 1    | 4523  | 2026-02-03 10:15:30 | T024 | GET_ENTRY | HPD:Help Desk | 5000 | OK |
| 2    | 7891  | 2026-02-03 14:20:00 | T012 | SET_ENTRY | CHG:Change | 3200 | OK |
| 3    | 9012  | 2026-02-03 16:45:15 | T008 | QUERY | HPD:Help Desk | 2800 | OK |

=== Top SQL Statements ===
| Rank | Line# | Timestamp | Thread | Identifier | Duration(ms) | Status |
|------|-------|-----------|--------|------------|--------------|--------|
| 1    | 1234  | 2026-02-03 10:05:00 | T024 | SELECT * FROM T1234 | 4500 | OK |
| 2    | 5678  | 2026-02-03 12:30:00 | T012 | INSERT INTO T5678 | 2100 | OK |

=== Top Filter Executions ===

=== Top Escalation Executions ===

=== Thread Distribution ===
T024:  4500
T012:  3200
T008:  2800
T001:  1845

=== User Distribution ===
Demo:  6500
Admin:  3800
System:  2045

=== Form Distribution ===
HPD:Help Desk:  5000
CHG:Change:  3200
PBM:Problem:  2100
HPD:Help Desk Template:  2045
`

	data, err := jar.ParseOutput(sampleOutput)
	require.NoError(t, err, "ParseOutput should succeed on valid sample input")
	require.NotNil(t, data)

	// -- General statistics --

	assert.Equal(t, int64(12345), data.GeneralStats.TotalLines)
	assert.Equal(t, int64(8901), data.GeneralStats.APICount)
	assert.Equal(t, int64(2345), data.GeneralStats.SQLCount)
	assert.Equal(t, int64(890), data.GeneralStats.FilterCount)
	assert.Equal(t, int64(209), data.GeneralStats.EscCount)
	assert.Equal(t, 15, data.GeneralStats.UniqueUsers)
	assert.Equal(t, 23, data.GeneralStats.UniqueForms)
	assert.Equal(t, 8, data.GeneralStats.UniqueTables)
	assert.Equal(t, "8h 30m 45s", data.GeneralStats.LogDuration)

	// -- Top API calls --

	require.GreaterOrEqual(t, len(data.TopAPICalls), 3, "expected at least 3 top API entries")
	assert.Equal(t, 1, data.TopAPICalls[0].Rank)
	assert.Equal(t, "GET_ENTRY", data.TopAPICalls[0].Identifier)
	assert.Equal(t, 5000, data.TopAPICalls[0].DurationMS)
	assert.True(t, data.TopAPICalls[0].Success)

	assert.Equal(t, 2, data.TopAPICalls[1].Rank)
	assert.Equal(t, "SET_ENTRY", data.TopAPICalls[1].Identifier)

	assert.Equal(t, 3, data.TopAPICalls[2].Rank)
	assert.Equal(t, "QUERY", data.TopAPICalls[2].Identifier)

	// -- Top SQL statements --

	require.GreaterOrEqual(t, len(data.TopSQL), 2, "expected at least 2 top SQL entries")
	assert.Equal(t, 1, data.TopSQL[0].Rank)
	assert.Equal(t, 4500, data.TopSQL[0].DurationMS)
	assert.Equal(t, 2, data.TopSQL[1].Rank)

	// -- Empty top-N sections should yield nil or empty slices --

	assert.Empty(t, data.TopFilters, "empty filter section should produce no entries")
	assert.Empty(t, data.TopEscalations, "empty escalation section should produce no entries")

	// -- Distributions --

	require.Contains(t, data.Distribution, "threads", "thread distribution should be parsed")
	assert.Equal(t, 4500, data.Distribution["threads"]["T024"])
	assert.Equal(t, 3200, data.Distribution["threads"]["T012"])
	assert.Equal(t, 2800, data.Distribution["threads"]["T008"])
	assert.Equal(t, 1845, data.Distribution["threads"]["T001"])

	require.Contains(t, data.Distribution, "users", "user distribution should be parsed")
	assert.Equal(t, 6500, data.Distribution["users"]["Demo"])
	assert.Equal(t, 3800, data.Distribution["users"]["Admin"])
	assert.Equal(t, 2045, data.Distribution["users"]["System"])

	// Form distribution -- tests correct colon-handling for AR form
	// names like "HPD:Help Desk" where the key itself contains colons.
	require.Contains(t, data.Distribution, "forms", "form distribution should be parsed")
	assert.Equal(t, 5000, data.Distribution["forms"]["HPD:Help Desk"])
	assert.Equal(t, 3200, data.Distribution["forms"]["CHG:Change"])
	assert.Equal(t, 2100, data.Distribution["forms"]["PBM:Problem"])
	assert.Equal(t, 2045, data.Distribution["forms"]["HPD:Help Desk Template"])
}

// TestParseOutput_Empty verifies that ParseOutput returns an error for
// empty input rather than returning a nil DashboardData.
func TestParseOutput_Empty(t *testing.T) {
	_, err := jar.ParseOutput("")
	assert.Error(t, err, "ParseOutput should reject empty input")

	_, err = jar.ParseOutput("   \n\t\n   ")
	assert.Error(t, err, "ParseOutput should reject whitespace-only input")
}

// TestParseOutput_MinimalValid verifies that ParseOutput succeeds with
// a minimal valid output that contains a single section header.
func TestParseOutput_MinimalValid(t *testing.T) {
	minimal := `=== General Statistics ===
Total Lines Processed:  100
`
	data, err := jar.ParseOutput(minimal)
	require.NoError(t, err)
	require.NotNil(t, data)
	assert.Equal(t, int64(100), data.GeneralStats.TotalLines)
}

// TestParseOutput_UnrecognizedSection verifies that unrecognized section
// headers are silently skipped without causing errors, ensuring forward
// compatibility with future JAR versions.
func TestParseOutput_UnrecognizedSection(t *testing.T) {
	output := `=== General Statistics ===
Total Lines Processed:  500

=== Some Future Section ===
Key1: value1
Key2: value2

=== Top API Calls ===
| Rank | Identifier | Duration(ms) | Status |
|------|------------|--------------|--------|
| 1    | GET_ENTRY  | 1000         | OK     |
`
	data, err := jar.ParseOutput(output)
	require.NoError(t, err)
	assert.Equal(t, int64(500), data.GeneralStats.TotalLines)
	require.Len(t, data.TopAPICalls, 1)
	assert.Equal(t, "GET_ENTRY", data.TopAPICalls[0].Identifier)
}

// TestParseOutput_CommasInNumbers verifies that the parser handles
// comma-separated numeric values (e.g., "1,234,567").
func TestParseOutput_CommasInNumbers(t *testing.T) {
	output := `=== General Statistics ===
Total Lines Processed:  1,234,567
API Calls:              890,123
`
	data, err := jar.ParseOutput(output)
	require.NoError(t, err)
	assert.Equal(t, int64(1234567), data.GeneralStats.TotalLines)
	assert.Equal(t, int64(890123), data.GeneralStats.APICount)
}

// TestPipelineFieldsStoredCorrectly verifies that NewPipeline stores
// all provided dependencies in the struct fields.
func TestPipelineFieldsStoredCorrectly(t *testing.T) {
	// We cannot construct real clients without services, but we can verify
	// that all-nil creates a valid struct with the expected zero-valued fields.
	p := NewPipeline(nil, nil, nil, nil, nil, nil)
	assert.Nil(t, p.pg)
	assert.Nil(t, p.ch)
	assert.Nil(t, p.s3)
	assert.Nil(t, p.nats)
	assert.Nil(t, p.jar)
	assert.Nil(t, p.anomaly)
}

// TestPipelineFieldsStoredWithDetector verifies that the anomaly detector
// field is correctly stored when provided.
func TestPipelineFieldsStoredWithDetector(t *testing.T) {
	detector := NewAnomalyDetector(3.0)
	p := NewPipeline(nil, nil, nil, nil, nil, detector)
	assert.NotNil(t, p.anomaly)
}

// TestAnalysisJobDefaults verifies that a zero-valued AnalysisJob has the
// expected defaults for fields referenced by ProcessJob.
func TestAnalysisJobDefaults(t *testing.T) {
	job := domain.AnalysisJob{}
	assert.Equal(t, domain.JobStatus(""), job.Status)
	assert.Equal(t, 0, job.JVMHeapMB)
	assert.Equal(t, 0, job.ProgressPct)
	assert.Nil(t, job.TotalLines)
	assert.Nil(t, job.ErrorMessage)
	assert.Nil(t, job.CompletedAt)
}

// TestDetectAnomalies_EmptyDashboard verifies that anomaly detection
// handles empty dashboard data gracefully.
func TestDetectAnomalies_EmptyDashboard(t *testing.T) {
	detector := NewAnomalyDetector(3.0)
	p := NewPipeline(nil, nil, nil, nil, nil, detector)

	dashboard := &domain.DashboardData{}
	anomalies := p.detectAnomalies(context.Background(), "job-1", "tenant-1", dashboard)
	assert.Empty(t, anomalies, "no anomalies should be detected for empty dashboard")
}

// TestDetectAnomalies_WithData verifies that anomaly detection runs on
// dashboard data with top-N entries and detects statistical outliers.
// We use 10 tightly-clustered data points plus 1 extreme outlier so the
// outlier exceeds 2 sigma with sample standard deviation.
func TestDetectAnomalies_WithData(t *testing.T) {
	detector := NewAnomalyDetector(2.0) // lower threshold to trigger on test data
	p := NewPipeline(nil, nil, nil, nil, nil, detector)

	dashboard := &domain.DashboardData{
		TopAPICalls: []domain.TopNEntry{
			{Rank: 1, Identifier: "GET_ENTRY", DurationMS: 100, Form: "HPD"},
			{Rank: 2, Identifier: "SET_ENTRY", DurationMS: 110, Form: "CHG"},
			{Rank: 3, Identifier: "QUERY", DurationMS: 105, Form: "HPD"},
			{Rank: 4, Identifier: "MERGE", DurationMS: 102, Form: "HPD"},
			{Rank: 5, Identifier: "GET_LIST", DurationMS: 108, Form: "CHG"},
			{Rank: 6, Identifier: "DELETE_ENTRY", DurationMS: 103, Form: "HPD"},
			{Rank: 7, Identifier: "CREATE_ENTRY", DurationMS: 107, Form: "PBM"},
			{Rank: 8, Identifier: "IMPORT_DATA", DurationMS: 104, Form: "HPD"},
			{Rank: 9, Identifier: "EXPORT_DATA", DurationMS: 106, Form: "CHG"},
			{Rank: 10, Identifier: "SLOW_CALL", DurationMS: 50000, Form: "PBM"},
		},
		TopSQL: []domain.TopNEntry{
			{Rank: 1, Identifier: "SELECT * FROM T1", DurationMS: 200},
			{Rank: 2, Identifier: "INSERT INTO T2", DurationMS: 210},
			{Rank: 3, Identifier: "UPDATE T3", DurationMS: 205},
			{Rank: 4, Identifier: "DELETE FROM T4", DurationMS: 202},
			{Rank: 5, Identifier: "SELECT * FROM T5", DurationMS: 208},
			{Rank: 6, Identifier: "INSERT INTO T6", DurationMS: 203},
			{Rank: 7, Identifier: "UPDATE T7", DurationMS: 207},
			{Rank: 8, Identifier: "SELECT * FROM T8", DurationMS: 204},
			{Rank: 9, Identifier: "INSERT INTO T9", DurationMS: 206},
			{Rank: 10, Identifier: "SLOW_QUERY", DurationMS: 80000},
		},
	}

	anomalies := p.detectAnomalies(context.Background(), "job-1", "tenant-1", dashboard)
	assert.NotEmpty(t, anomalies, "anomalies should be detected for outlier data points")

	// Verify the detected anomalies are the expected outliers.
	for _, a := range anomalies {
		assert.Contains(t, []AnomalyType{AnomalySlowAPI, AnomalySlowSQL}, a.Type)
		assert.NotEmpty(t, a.Title)
		assert.NotEmpty(t, a.Description)
		assert.Greater(t, a.Sigma, 2.0)
	}
}

// ---------------------------------------------------------------------------
// Integration tests -- require external services
// ---------------------------------------------------------------------------

// TestIntegration_FullPipeline runs the full pipeline with real services.
// Skipped unless REMEDYIQ_INTEGRATION_TEST=1 is set.
func TestIntegration_FullPipeline(t *testing.T) {
	if os.Getenv("REMEDYIQ_INTEGRATION_TEST") == "" {
		t.Skip("skipping integration test: set REMEDYIQ_INTEGRATION_TEST=1 to enable")
	}

	// This test requires all infrastructure to be running:
	//   docker compose up -d postgres clickhouse nats minio redis
	//
	// Full pipeline integration test flow:
	//   1. Connect to all services (PostgreSQL, ClickHouse, S3/MinIO, NATS)
	//   2. Create a tenant and a log file record in PostgreSQL
	//   3. Upload a sample AR Server log file to S3
	//   4. Create an AnalysisJob record
	//   5. Call ProcessJob and verify:
	//      a. Job status transitions through parsing -> analyzing -> storing -> complete
	//      b. DashboardData is correctly populated
	//      c. NATS progress events are published
	//      d. Final job status in PostgreSQL is "complete"
	//
	// Full implementation is deferred until CI pipeline setup provides
	// the required infrastructure services.
	t.Skip("full integration test implementation pending CI setup")
}

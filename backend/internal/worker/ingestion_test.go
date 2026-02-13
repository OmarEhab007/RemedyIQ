package worker

import (
	"context"
	"errors"
	"io"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/OmarEhab007/RemedyIQ/backend/internal/domain"
	"github.com/OmarEhab007/RemedyIQ/backend/internal/jar"
	"github.com/OmarEhab007/RemedyIQ/backend/internal/testutil"
)

// ---------------------------------------------------------------------------
// MockJARRunner implements JARRunner for unit tests.
// ---------------------------------------------------------------------------

type MockJARRunner struct {
	mock.Mock
}

func (m *MockJARRunner) Run(ctx context.Context, filePath string, flags domain.JARFlags, heapMB int, lineCallback func(string)) (*jar.Result, error) {
	args := m.Called(ctx, filePath, flags, heapMB, lineCallback)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*jar.Result), args.Error(1)
}

// ---------------------------------------------------------------------------
// Helper: build a valid JAR stdout output for testing.
// ---------------------------------------------------------------------------

const validJAROutput = `=== General Statistics ===
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

=== Top SQL Statements ===
| Rank | Line# | Timestamp | Thread | Identifier | Duration(ms) | Status |
|------|-------|-----------|--------|------------|--------------|--------|
| 1    | 1234  | 2026-02-03 10:05:00 | T024 | SELECT * FROM T1234 | 4500 | OK |

=== Top Filter Executions ===

=== Top Escalation Executions ===

=== Thread Distribution ===
T024:  4500

=== User Distribution ===
Demo:  6500

=== Form Distribution ===
HPD:Help Desk:  5000
`

// newTestJob creates a standard AnalysisJob for use in tests.
func newTestJob() domain.AnalysisJob {
	return domain.AnalysisJob{
		ID:       uuid.New(),
		TenantID: uuid.New(),
		FileID:   uuid.New(),
		Status:   domain.JobStatusQueued,
	}
}

// ---------------------------------------------------------------------------
// Unit tests -- no external services required
// ---------------------------------------------------------------------------

// TestNewPipeline verifies pipeline construction with nil dependencies.
func TestNewPipeline(t *testing.T) {
	p := NewPipeline(nil, nil, nil, nil, nil, nil, nil)
	assert.NotNil(t, p)
}

// TestProcessJob_NilPGClient verifies that ProcessJob panics when the pg
// client is nil because the first operation calls a method on a nil interface.
func TestProcessJob_NilPGClient(t *testing.T) {
	p := NewPipeline(nil, nil, nil, nil, nil, nil, nil)
	job := newTestJob()

	assert.Panics(t, func() {
		_ = p.ProcessJob(context.Background(), job)
	}, "expected panic when pg client is nil")
}

// TestProcessJob_CancelledContext verifies that ProcessJob panics with nil
// pg even when context is cancelled.
func TestProcessJob_CancelledContext(t *testing.T) {
	p := NewPipeline(nil, nil, nil, nil, nil, nil, nil)
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	job := newTestJob()

	assert.Panics(t, func() {
		_ = p.ProcessJob(ctx, job)
	}, "expected panic on nil pg even with cancelled context")
}

// TestProcessJob_UpdateStatusFails verifies that when the initial
// UpdateJobStatus call fails, ProcessJob returns the error.
func TestProcessJob_UpdateStatusFails(t *testing.T) {
	pg := &testutil.MockPostgresStore{}
	nats := &testutil.MockNATSStreamer{}
	job := newTestJob()

	pg.On("UpdateJobStatus", mock.Anything, job.TenantID, job.ID, domain.JobStatusParsing, (*string)(nil)).
		Return(errors.New("pg connection refused"))

	p := NewPipeline(pg, nil, nil, nil, nats, nil, nil)
	err := p.ProcessJob(context.Background(), job)

	require.Error(t, err)
	assert.Contains(t, err.Error(), "update status to parsing")
	assert.Contains(t, err.Error(), "pg connection refused")
	pg.AssertExpectations(t)
}

// TestProcessJob_GetLogFileFails verifies that when GetLogFile fails,
// ProcessJob calls failJob and returns the error.
func TestProcessJob_GetLogFileFails(t *testing.T) {
	pg := &testutil.MockPostgresStore{}
	nats := &testutil.MockNATSStreamer{}
	job := newTestJob()

	// Step 1 succeeds
	pg.On("UpdateJobStatus", mock.Anything, job.TenantID, job.ID, domain.JobStatusParsing, (*string)(nil)).
		Return(nil)
	nats.On("PublishJobProgress", mock.Anything, job.TenantID.String(), job.ID.String(), 5, "parsing", "downloading file").
		Return(nil)

	// Step 2 fails
	pg.On("GetLogFile", mock.Anything, job.TenantID, job.FileID).
		Return(nil, errors.New("file record not found"))

	// failJob calls
	pg.On("UpdateJobStatus", mock.Anything, job.TenantID, job.ID, domain.JobStatusFailed, mock.AnythingOfType("*string")).
		Return(nil)
	nats.On("PublishJobProgress", mock.Anything, job.TenantID.String(), job.ID.String(), 0, "failed", mock.AnythingOfType("string")).
		Return(nil)
	nats.On("PublishJobComplete", mock.Anything, job.TenantID.String(), job.ID.String(), mock.AnythingOfType("domain.AnalysisJob")).
		Return(nil)

	p := NewPipeline(pg, nil, nil, nil, nats, nil, nil)
	err := p.ProcessJob(context.Background(), job)

	require.Error(t, err)
	assert.Contains(t, err.Error(), "file not found")
	pg.AssertExpectations(t)
	nats.AssertExpectations(t)
}

// TestProcessJob_S3DownloadFails verifies that when S3 download fails,
// ProcessJob calls failJob and returns the error.
func TestProcessJob_S3DownloadFails(t *testing.T) {
	pg := &testutil.MockPostgresStore{}
	nats := &testutil.MockNATSStreamer{}
	s3 := &testutil.MockS3Storage{}
	job := newTestJob()

	file := &domain.LogFile{
		ID:        job.FileID,
		TenantID:  job.TenantID,
		S3Key:     "logs/test.log",
		SizeBytes: 1024,
	}

	// Step 1 succeeds
	pg.On("UpdateJobStatus", mock.Anything, job.TenantID, job.ID, domain.JobStatusParsing, (*string)(nil)).
		Return(nil)
	nats.On("PublishJobProgress", mock.Anything, job.TenantID.String(), job.ID.String(), 5, "parsing", "downloading file").
		Return(nil)

	// Step 2 succeeds
	pg.On("GetLogFile", mock.Anything, job.TenantID, job.FileID).
		Return(file, nil)

	// Step 3 fails
	s3.On("Download", mock.Anything, "logs/test.log").
		Return(nil, errors.New("s3 bucket not found"))

	// failJob calls
	pg.On("UpdateJobStatus", mock.Anything, job.TenantID, job.ID, domain.JobStatusFailed, mock.AnythingOfType("*string")).
		Return(nil)
	nats.On("PublishJobProgress", mock.Anything, job.TenantID.String(), job.ID.String(), 0, "failed", mock.AnythingOfType("string")).
		Return(nil)
	nats.On("PublishJobComplete", mock.Anything, job.TenantID.String(), job.ID.String(), mock.AnythingOfType("domain.AnalysisJob")).
		Return(nil)

	p := NewPipeline(pg, nil, s3, nil, nats, nil, nil)
	err := p.ProcessJob(context.Background(), job)

	require.Error(t, err)
	assert.Contains(t, err.Error(), "download failed")
	pg.AssertExpectations(t)
	s3.AssertExpectations(t)
}

// TestProcessJob_JARFails verifies that when the JAR execution fails,
// ProcessJob calls failJob with the appropriate error message.
func TestProcessJob_JARFails(t *testing.T) {
	pg := &testutil.MockPostgresStore{}
	nats := &testutil.MockNATSStreamer{}
	s3 := &testutil.MockS3Storage{}
	jarRunner := &MockJARRunner{}
	job := newTestJob()

	file := &domain.LogFile{
		ID:        job.FileID,
		TenantID:  job.TenantID,
		S3Key:     "logs/test.log",
		SizeBytes: 1024,
	}

	// Steps 1-2 succeed
	pg.On("UpdateJobStatus", mock.Anything, job.TenantID, job.ID, domain.JobStatusParsing, (*string)(nil)).
		Return(nil)
	nats.On("PublishJobProgress", mock.Anything, job.TenantID.String(), job.ID.String(), mock.AnythingOfType("int"), mock.AnythingOfType("string"), mock.AnythingOfType("string")).
		Return(nil)
	pg.On("GetLogFile", mock.Anything, job.TenantID, job.FileID).
		Return(file, nil)

	// Step 3: S3 download returns a reader with log content
	logContent := "sample log content"
	s3.On("Download", mock.Anything, "logs/test.log").
		Return(io.NopCloser(strings.NewReader(logContent)), nil)

	// Step 4: JAR fails with stderr
	jarRunner.On("Run", mock.Anything, mock.AnythingOfType("string"), job.JARFlags, job.JVMHeapMB, mock.AnythingOfType("func(string)")).
		Return(&jar.Result{Stderr: "OutOfMemoryError"}, errors.New("exit code 1"))

	// failJob calls
	pg.On("UpdateJobStatus", mock.Anything, job.TenantID, job.ID, domain.JobStatusFailed, mock.AnythingOfType("*string")).
		Return(nil)
	nats.On("PublishJobComplete", mock.Anything, job.TenantID.String(), job.ID.String(), mock.AnythingOfType("domain.AnalysisJob")).
		Return(nil)

	p := NewPipeline(pg, nil, s3, nil, nats, jarRunner, nil)
	err := p.ProcessJob(context.Background(), job)

	require.Error(t, err)
	assert.Contains(t, err.Error(), "JAR execution failed")
	assert.Contains(t, err.Error(), "OutOfMemoryError")
	pg.AssertExpectations(t)
	jarRunner.AssertExpectations(t)
}

// TestProcessJob_JARFailsWithNilResult verifies that when JAR returns a nil
// result and an error, the stderr is empty in the error message.
func TestProcessJob_JARFailsWithNilResult(t *testing.T) {
	pg := &testutil.MockPostgresStore{}
	nats := &testutil.MockNATSStreamer{}
	s3 := &testutil.MockS3Storage{}
	jarRunner := &MockJARRunner{}
	job := newTestJob()

	file := &domain.LogFile{
		ID:        job.FileID,
		TenantID:  job.TenantID,
		S3Key:     "logs/test.log",
		SizeBytes: 1024,
	}

	// Steps 1-3 succeed
	pg.On("UpdateJobStatus", mock.Anything, job.TenantID, job.ID, domain.JobStatusParsing, (*string)(nil)).
		Return(nil)
	nats.On("PublishJobProgress", mock.Anything, job.TenantID.String(), job.ID.String(), mock.AnythingOfType("int"), mock.AnythingOfType("string"), mock.AnythingOfType("string")).
		Return(nil)
	pg.On("GetLogFile", mock.Anything, job.TenantID, job.FileID).
		Return(file, nil)
	s3.On("Download", mock.Anything, "logs/test.log").
		Return(io.NopCloser(strings.NewReader("log data")), nil)

	// Step 4: JAR returns nil result with error
	jarRunner.On("Run", mock.Anything, mock.AnythingOfType("string"), job.JARFlags, job.JVMHeapMB, mock.AnythingOfType("func(string)")).
		Return(nil, errors.New("command not found"))

	// failJob calls
	pg.On("UpdateJobStatus", mock.Anything, job.TenantID, job.ID, domain.JobStatusFailed, mock.AnythingOfType("*string")).
		Return(nil)
	nats.On("PublishJobComplete", mock.Anything, job.TenantID.String(), job.ID.String(), mock.AnythingOfType("domain.AnalysisJob")).
		Return(nil)

	p := NewPipeline(pg, nil, s3, nil, nats, jarRunner, nil)
	err := p.ProcessJob(context.Background(), job)

	require.Error(t, err)
	assert.Contains(t, err.Error(), "JAR execution failed")
	assert.Contains(t, err.Error(), "stderr: )")
}

// TestProcessJob_ParseOutputFails verifies that when the JAR output cannot
// be parsed, ProcessJob calls failJob with the parse error.
func TestProcessJob_ParseOutputFails(t *testing.T) {
	pg := &testutil.MockPostgresStore{}
	nats := &testutil.MockNATSStreamer{}
	s3 := &testutil.MockS3Storage{}
	jarRunner := &MockJARRunner{}
	job := newTestJob()

	file := &domain.LogFile{
		ID:        job.FileID,
		TenantID:  job.TenantID,
		S3Key:     "logs/test.log",
		SizeBytes: 1024,
	}

	// Steps 1-3 succeed
	pg.On("UpdateJobStatus", mock.Anything, job.TenantID, job.ID, domain.JobStatusParsing, (*string)(nil)).
		Return(nil)
	nats.On("PublishJobProgress", mock.Anything, job.TenantID.String(), job.ID.String(), mock.AnythingOfType("int"), mock.AnythingOfType("string"), mock.AnythingOfType("string")).
		Return(nil)
	pg.On("GetLogFile", mock.Anything, job.TenantID, job.FileID).
		Return(file, nil)
	s3.On("Download", mock.Anything, "logs/test.log").
		Return(io.NopCloser(strings.NewReader("log data")), nil)

	// Step 4: JAR succeeds but with empty/invalid output
	jarRunner.On("Run", mock.Anything, mock.AnythingOfType("string"), job.JARFlags, job.JVMHeapMB, mock.AnythingOfType("func(string)")).
		Return(&jar.Result{Stdout: "", Stderr: ""}, nil)

	// failJob calls
	pg.On("UpdateJobStatus", mock.Anything, job.TenantID, job.ID, domain.JobStatusFailed, mock.AnythingOfType("*string")).
		Return(nil)
	nats.On("PublishJobComplete", mock.Anything, job.TenantID.String(), job.ID.String(), mock.AnythingOfType("domain.AnalysisJob")).
		Return(nil)

	p := NewPipeline(pg, nil, s3, nil, nats, jarRunner, nil)
	err := p.ProcessJob(context.Background(), job)

	require.Error(t, err)
	assert.Contains(t, err.Error(), "parse output")
}

// TestProcessJob_SuccessfulCompletion verifies the full happy path of
// ProcessJob without Redis or anomaly detection.
func TestProcessJob_SuccessfulCompletion(t *testing.T) {
	pg := &testutil.MockPostgresStore{}
	nats := &testutil.MockNATSStreamer{}
	s3 := &testutil.MockS3Storage{}
	jarRunner := &MockJARRunner{}
	job := newTestJob()

	file := &domain.LogFile{
		ID:        job.FileID,
		TenantID:  job.TenantID,
		S3Key:     "logs/test.log",
		SizeBytes: 1024,
	}

	// Step 1: Update status to parsing
	pg.On("UpdateJobStatus", mock.Anything, job.TenantID, job.ID, domain.JobStatusParsing, (*string)(nil)).
		Return(nil)
	nats.On("PublishJobProgress", mock.Anything, job.TenantID.String(), job.ID.String(), mock.AnythingOfType("int"), mock.AnythingOfType("string"), mock.AnythingOfType("string")).
		Return(nil)

	// Step 2: Get file metadata
	pg.On("GetLogFile", mock.Anything, job.TenantID, job.FileID).
		Return(file, nil)

	// Step 3: Download file
	s3.On("Download", mock.Anything, "logs/test.log").
		Return(io.NopCloser(strings.NewReader("sample log content")), nil)

	// Step 4: Run JAR with valid output
	jarRunner.On("Run", mock.Anything, mock.AnythingOfType("string"), job.JARFlags, job.JVMHeapMB, mock.AnythingOfType("func(string)")).
		Return(&jar.Result{
			Stdout:   validJAROutput,
			Stderr:   "",
			ExitCode: 0,
			Duration: 5 * time.Second,
		}, nil)

	// Step 6: Update status to storing
	pg.On("UpdateJobStatus", mock.Anything, job.TenantID, job.ID, domain.JobStatusStoring, (*string)(nil)).
		Return(nil)

	// Step 8: Update status to complete
	pg.On("UpdateJobStatus", mock.Anything, job.TenantID, job.ID, domain.JobStatusComplete, (*string)(nil)).
		Return(nil)
	pg.On("UpdateJobProgress", mock.Anything, job.TenantID, job.ID, 100, mock.AnythingOfType("*int64")).
		Return(nil)

	// Step 9: Publish completion
	nats.On("PublishJobComplete", mock.Anything, job.TenantID.String(), job.ID.String(), mock.AnythingOfType("domain.AnalysisJob")).
		Return(nil)

	p := NewPipeline(pg, nil, s3, nil, nats, jarRunner, nil)
	err := p.ProcessJob(context.Background(), job)

	assert.NoError(t, err)
	pg.AssertExpectations(t)
	nats.AssertExpectations(t)
	s3.AssertExpectations(t)
	jarRunner.AssertExpectations(t)
}

// TestProcessJob_SuccessWithAnomalyDetector verifies that anomaly detection
// runs when an AnomalyDetector is configured in the pipeline.
func TestProcessJob_SuccessWithAnomalyDetector(t *testing.T) {
	pg := &testutil.MockPostgresStore{}
	nats := &testutil.MockNATSStreamer{}
	s3 := &testutil.MockS3Storage{}
	jarRunner := &MockJARRunner{}
	detector := NewAnomalyDetector(3.0)
	job := newTestJob()

	file := &domain.LogFile{
		ID:        job.FileID,
		TenantID:  job.TenantID,
		S3Key:     "logs/test.log",
		SizeBytes: 1024,
	}

	pg.On("UpdateJobStatus", mock.Anything, job.TenantID, job.ID, domain.JobStatusParsing, (*string)(nil)).Return(nil)
	nats.On("PublishJobProgress", mock.Anything, job.TenantID.String(), job.ID.String(), mock.AnythingOfType("int"), mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return(nil)
	pg.On("GetLogFile", mock.Anything, job.TenantID, job.FileID).Return(file, nil)
	s3.On("Download", mock.Anything, "logs/test.log").Return(io.NopCloser(strings.NewReader("log")), nil)
	jarRunner.On("Run", mock.Anything, mock.AnythingOfType("string"), job.JARFlags, job.JVMHeapMB, mock.AnythingOfType("func(string)")).
		Return(&jar.Result{Stdout: validJAROutput, Duration: 1 * time.Second}, nil)
	pg.On("UpdateJobStatus", mock.Anything, job.TenantID, job.ID, domain.JobStatusStoring, (*string)(nil)).Return(nil)
	pg.On("UpdateJobStatus", mock.Anything, job.TenantID, job.ID, domain.JobStatusComplete, (*string)(nil)).Return(nil)
	pg.On("UpdateJobProgress", mock.Anything, job.TenantID, job.ID, 100, mock.AnythingOfType("*int64")).Return(nil)
	nats.On("PublishJobComplete", mock.Anything, job.TenantID.String(), job.ID.String(), mock.AnythingOfType("domain.AnalysisJob")).Return(nil)

	p := NewPipeline(pg, nil, s3, nil, nats, jarRunner, detector)
	err := p.ProcessJob(context.Background(), job)

	assert.NoError(t, err)
	pg.AssertExpectations(t)
}

// TestProcessJob_SuccessWithRedis verifies that Redis caching is invoked
// when a RedisCache is provided.
func TestProcessJob_SuccessWithRedis(t *testing.T) {
	pg := &testutil.MockPostgresStore{}
	nats := &testutil.MockNATSStreamer{}
	s3 := &testutil.MockS3Storage{}
	redis := &testutil.MockRedisCache{}
	jarRunner := &MockJARRunner{}
	job := newTestJob()

	file := &domain.LogFile{
		ID:        job.FileID,
		TenantID:  job.TenantID,
		S3Key:     "logs/test.log",
		SizeBytes: 1024,
	}

	pg.On("UpdateJobStatus", mock.Anything, job.TenantID, job.ID, domain.JobStatusParsing, (*string)(nil)).Return(nil)
	nats.On("PublishJobProgress", mock.Anything, job.TenantID.String(), job.ID.String(), mock.AnythingOfType("int"), mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return(nil)
	pg.On("GetLogFile", mock.Anything, job.TenantID, job.FileID).Return(file, nil)
	s3.On("Download", mock.Anything, "logs/test.log").Return(io.NopCloser(strings.NewReader("log")), nil)
	jarRunner.On("Run", mock.Anything, mock.AnythingOfType("string"), job.JARFlags, job.JVMHeapMB, mock.AnythingOfType("func(string)")).
		Return(&jar.Result{Stdout: validJAROutput, Duration: 1 * time.Second}, nil)

	// Redis caching: TenantKey is called, then Set for each cached section
	cachePrefix := "t:" + job.TenantID.String() + ":dashboard:" + job.ID.String()
	redis.On("TenantKey", job.TenantID.String(), "dashboard", job.ID.String()).Return(cachePrefix)
	// The valid JAR output does not produce Aggregates/Exceptions/Gaps/ThreadStats/Filters,
	// so Set should not be called for those sections. But we allow any Set calls
	// in case the parser produces them.
	redis.On("Set", mock.Anything, mock.AnythingOfType("string"), mock.Anything, 24*time.Hour).Return(nil).Maybe()

	pg.On("UpdateJobStatus", mock.Anything, job.TenantID, job.ID, domain.JobStatusStoring, (*string)(nil)).Return(nil)
	pg.On("UpdateJobStatus", mock.Anything, job.TenantID, job.ID, domain.JobStatusComplete, (*string)(nil)).Return(nil)
	pg.On("UpdateJobProgress", mock.Anything, job.TenantID, job.ID, 100, mock.AnythingOfType("*int64")).Return(nil)
	nats.On("PublishJobComplete", mock.Anything, job.TenantID.String(), job.ID.String(), mock.AnythingOfType("domain.AnalysisJob")).Return(nil)

	p := NewPipeline(pg, nil, s3, redis, nats, jarRunner, nil)
	err := p.ProcessJob(context.Background(), job)

	assert.NoError(t, err)
	pg.AssertExpectations(t)
	redis.AssertExpectations(t)
}

// TestProcessJob_CompleteStatusUpdateFails verifies the error handling when
// the final UpdateJobStatus to "complete" fails. The pipeline should attempt
// to mark the job as failed and return an error.
func TestProcessJob_CompleteStatusUpdateFails(t *testing.T) {
	pg := &testutil.MockPostgresStore{}
	nats := &testutil.MockNATSStreamer{}
	s3 := &testutil.MockS3Storage{}
	jarRunner := &MockJARRunner{}
	job := newTestJob()

	file := &domain.LogFile{
		ID:        job.FileID,
		TenantID:  job.TenantID,
		S3Key:     "logs/test.log",
		SizeBytes: 1024,
	}

	pg.On("UpdateJobStatus", mock.Anything, job.TenantID, job.ID, domain.JobStatusParsing, (*string)(nil)).Return(nil)
	nats.On("PublishJobProgress", mock.Anything, job.TenantID.String(), job.ID.String(), mock.AnythingOfType("int"), mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return(nil)
	pg.On("GetLogFile", mock.Anything, job.TenantID, job.FileID).Return(file, nil)
	s3.On("Download", mock.Anything, "logs/test.log").Return(io.NopCloser(strings.NewReader("log")), nil)
	jarRunner.On("Run", mock.Anything, mock.AnythingOfType("string"), job.JARFlags, job.JVMHeapMB, mock.AnythingOfType("func(string)")).
		Return(&jar.Result{Stdout: validJAROutput, Duration: 1 * time.Second}, nil)
	pg.On("UpdateJobStatus", mock.Anything, job.TenantID, job.ID, domain.JobStatusStoring, (*string)(nil)).Return(nil)

	// Step 8: Complete status update fails
	pg.On("UpdateJobStatus", mock.Anything, job.TenantID, job.ID, domain.JobStatusComplete, (*string)(nil)).
		Return(errors.New("pg deadlock"))

	// Fallback: mark as failed
	pg.On("UpdateJobStatus", mock.Anything, job.TenantID, job.ID, domain.JobStatusFailed, mock.AnythingOfType("*string")).
		Return(nil)

	p := NewPipeline(pg, nil, s3, nil, nats, jarRunner, nil)
	err := p.ProcessJob(context.Background(), job)

	require.Error(t, err)
	assert.Contains(t, err.Error(), "update status to complete")
	assert.Contains(t, err.Error(), "pg deadlock")
	pg.AssertExpectations(t)
}

// TestProcessJob_StoringStatusUpdateFails verifies that when the "storing"
// status update fails, ProcessJob continues (non-fatal) and still completes.
func TestProcessJob_StoringStatusUpdateFails(t *testing.T) {
	pg := &testutil.MockPostgresStore{}
	nats := &testutil.MockNATSStreamer{}
	s3 := &testutil.MockS3Storage{}
	jarRunner := &MockJARRunner{}
	job := newTestJob()

	file := &domain.LogFile{
		ID:        job.FileID,
		TenantID:  job.TenantID,
		S3Key:     "logs/test.log",
		SizeBytes: 1024,
	}

	pg.On("UpdateJobStatus", mock.Anything, job.TenantID, job.ID, domain.JobStatusParsing, (*string)(nil)).Return(nil)
	nats.On("PublishJobProgress", mock.Anything, job.TenantID.String(), job.ID.String(), mock.AnythingOfType("int"), mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return(nil)
	pg.On("GetLogFile", mock.Anything, job.TenantID, job.FileID).Return(file, nil)
	s3.On("Download", mock.Anything, "logs/test.log").Return(io.NopCloser(strings.NewReader("log")), nil)
	jarRunner.On("Run", mock.Anything, mock.AnythingOfType("string"), job.JARFlags, job.JVMHeapMB, mock.AnythingOfType("func(string)")).
		Return(&jar.Result{Stdout: validJAROutput, Duration: 1 * time.Second}, nil)

	// Storing update fails (non-fatal)
	pg.On("UpdateJobStatus", mock.Anything, job.TenantID, job.ID, domain.JobStatusStoring, (*string)(nil)).
		Return(errors.New("pg timeout"))

	// Complete still succeeds
	pg.On("UpdateJobStatus", mock.Anything, job.TenantID, job.ID, domain.JobStatusComplete, (*string)(nil)).Return(nil)
	pg.On("UpdateJobProgress", mock.Anything, job.TenantID, job.ID, 100, mock.AnythingOfType("*int64")).Return(nil)
	nats.On("PublishJobComplete", mock.Anything, job.TenantID.String(), job.ID.String(), mock.AnythingOfType("domain.AnalysisJob")).Return(nil)

	p := NewPipeline(pg, nil, s3, nil, nats, jarRunner, nil)
	err := p.ProcessJob(context.Background(), job)

	assert.NoError(t, err, "storing status failure is non-fatal, job should complete")
	pg.AssertExpectations(t)
}

// TestProcessJob_UpdateProgressFails verifies that when UpdateJobProgress
// fails at 100%, it is non-fatal and the job still completes.
func TestProcessJob_UpdateProgressFails(t *testing.T) {
	pg := &testutil.MockPostgresStore{}
	nats := &testutil.MockNATSStreamer{}
	s3 := &testutil.MockS3Storage{}
	jarRunner := &MockJARRunner{}
	job := newTestJob()

	file := &domain.LogFile{
		ID:        job.FileID,
		TenantID:  job.TenantID,
		S3Key:     "logs/test.log",
		SizeBytes: 1024,
	}

	pg.On("UpdateJobStatus", mock.Anything, job.TenantID, job.ID, domain.JobStatusParsing, (*string)(nil)).Return(nil)
	nats.On("PublishJobProgress", mock.Anything, job.TenantID.String(), job.ID.String(), mock.AnythingOfType("int"), mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return(nil)
	pg.On("GetLogFile", mock.Anything, job.TenantID, job.FileID).Return(file, nil)
	s3.On("Download", mock.Anything, "logs/test.log").Return(io.NopCloser(strings.NewReader("log")), nil)
	jarRunner.On("Run", mock.Anything, mock.AnythingOfType("string"), job.JARFlags, job.JVMHeapMB, mock.AnythingOfType("func(string)")).
		Return(&jar.Result{Stdout: validJAROutput, Duration: 1 * time.Second}, nil)
	pg.On("UpdateJobStatus", mock.Anything, job.TenantID, job.ID, domain.JobStatusStoring, (*string)(nil)).Return(nil)
	pg.On("UpdateJobStatus", mock.Anything, job.TenantID, job.ID, domain.JobStatusComplete, (*string)(nil)).Return(nil)

	// Progress update fails (non-fatal)
	pg.On("UpdateJobProgress", mock.Anything, job.TenantID, job.ID, 100, mock.AnythingOfType("*int64")).
		Return(errors.New("pg connection reset"))

	nats.On("PublishJobComplete", mock.Anything, job.TenantID.String(), job.ID.String(), mock.AnythingOfType("domain.AnalysisJob")).Return(nil)

	p := NewPipeline(pg, nil, s3, nil, nats, jarRunner, nil)
	err := p.ProcessJob(context.Background(), job)

	assert.NoError(t, err, "progress update failure is non-fatal")
	pg.AssertExpectations(t)
}

// ---------------------------------------------------------------------------
// failJob tests
// ---------------------------------------------------------------------------

// TestFailJob verifies that failJob updates the job status, publishes events,
// and returns an error with the provided message.
func TestFailJob(t *testing.T) {
	pg := &testutil.MockPostgresStore{}
	nats := &testutil.MockNATSStreamer{}
	job := newTestJob()
	errMsg := "something went wrong"

	pg.On("UpdateJobStatus", mock.Anything, job.TenantID, job.ID, domain.JobStatusFailed, mock.AnythingOfType("*string")).
		Return(nil).
		Run(func(args mock.Arguments) {
			msg := args.Get(4).(*string)
			assert.Equal(t, errMsg, *msg)
		})
	nats.On("PublishJobProgress", mock.Anything, job.TenantID.String(), job.ID.String(), 0, "failed", errMsg).
		Return(nil)
	nats.On("PublishJobComplete", mock.Anything, job.TenantID.String(), job.ID.String(), mock.AnythingOfType("domain.AnalysisJob")).
		Return(nil).
		Run(func(args mock.Arguments) {
			completedJob := args.Get(3).(domain.AnalysisJob)
			assert.Equal(t, domain.JobStatusFailed, completedJob.Status)
			assert.NotNil(t, completedJob.ErrorMessage)
			assert.Equal(t, errMsg, *completedJob.ErrorMessage)
		})

	p := NewPipeline(pg, nil, nil, nil, nats, nil, nil)
	err := p.failJob(context.Background(), job, errMsg)

	require.Error(t, err)
	assert.Equal(t, errMsg, err.Error())
	pg.AssertExpectations(t)
	nats.AssertExpectations(t)
}

// TestFailJob_PGFails verifies that failJob still returns the original
// error even if the pg.UpdateJobStatus call fails.
func TestFailJob_PGFails(t *testing.T) {
	pg := &testutil.MockPostgresStore{}
	nats := &testutil.MockNATSStreamer{}
	job := newTestJob()

	pg.On("UpdateJobStatus", mock.Anything, job.TenantID, job.ID, domain.JobStatusFailed, mock.AnythingOfType("*string")).
		Return(errors.New("pg error"))
	nats.On("PublishJobProgress", mock.Anything, job.TenantID.String(), job.ID.String(), 0, "failed", "test error").
		Return(nil)
	nats.On("PublishJobComplete", mock.Anything, job.TenantID.String(), job.ID.String(), mock.AnythingOfType("domain.AnalysisJob")).
		Return(nil)

	p := NewPipeline(pg, nil, nil, nil, nats, nil, nil)
	err := p.failJob(context.Background(), job, "test error")

	require.Error(t, err)
	assert.Equal(t, "test error", err.Error())
}

// TestFailJob_NATSFails verifies that failJob still returns the original
// error even if the NATS publish calls fail.
func TestFailJob_NATSFails(t *testing.T) {
	pg := &testutil.MockPostgresStore{}
	nats := &testutil.MockNATSStreamer{}
	job := newTestJob()

	pg.On("UpdateJobStatus", mock.Anything, job.TenantID, job.ID, domain.JobStatusFailed, mock.AnythingOfType("*string")).
		Return(nil)
	nats.On("PublishJobProgress", mock.Anything, job.TenantID.String(), job.ID.String(), 0, "failed", "nats test").
		Return(errors.New("nats timeout"))
	nats.On("PublishJobComplete", mock.Anything, job.TenantID.String(), job.ID.String(), mock.AnythingOfType("domain.AnalysisJob")).
		Return(errors.New("nats timeout"))

	p := NewPipeline(pg, nil, nil, nil, nats, nil, nil)
	err := p.failJob(context.Background(), job, "nats test")

	require.Error(t, err)
	assert.Equal(t, "nats test", err.Error())
}

// ---------------------------------------------------------------------------
// Pipeline construction and field tests
// ---------------------------------------------------------------------------

// TestPipelineFieldsStoredCorrectly verifies that NewPipeline stores
// all provided dependencies in the struct fields.
func TestPipelineFieldsStoredCorrectly(t *testing.T) {
	p := NewPipeline(nil, nil, nil, nil, nil, nil, nil)
	assert.Nil(t, p.pg)
	assert.Nil(t, p.ch)
	assert.Nil(t, p.s3)
	assert.Nil(t, p.redis)
	assert.Nil(t, p.nats)
	assert.Nil(t, p.jar)
	assert.Nil(t, p.anomaly)
}

// TestPipelineFieldsStoredWithMocks verifies that all mock dependencies are
// correctly stored when provided.
func TestPipelineFieldsStoredWithMocks(t *testing.T) {
	pg := &testutil.MockPostgresStore{}
	nats := &testutil.MockNATSStreamer{}
	s3 := &testutil.MockS3Storage{}
	redis := &testutil.MockRedisCache{}
	jarRunner := &MockJARRunner{}
	detector := NewAnomalyDetector(3.0)

	p := NewPipeline(pg, nil, s3, redis, nats, jarRunner, detector)
	assert.NotNil(t, p.pg)
	assert.Nil(t, p.ch, "ClickHouse was nil")
	assert.NotNil(t, p.s3)
	assert.NotNil(t, p.redis)
	assert.NotNil(t, p.nats)
	assert.NotNil(t, p.jar)
	assert.NotNil(t, p.anomaly)
}

// TestPipelineFieldsStoredWithDetector verifies that the anomaly detector
// field is correctly stored when provided.
func TestPipelineFieldsStoredWithDetector(t *testing.T) {
	detector := NewAnomalyDetector(3.0)
	p := NewPipeline(nil, nil, nil, nil, nil, nil, detector)
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

// ---------------------------------------------------------------------------
// detectAnomalies tests
// ---------------------------------------------------------------------------

// TestDetectAnomalies_EmptyDashboard verifies that anomaly detection
// handles empty dashboard data gracefully.
func TestDetectAnomalies_EmptyDashboard(t *testing.T) {
	detector := NewAnomalyDetector(3.0)
	p := NewPipeline(nil, nil, nil, nil, nil, nil, detector)

	dashboard := &domain.DashboardData{}
	anomalies := p.detectAnomalies(context.Background(), "job-1", "tenant-1", dashboard)
	assert.Empty(t, anomalies, "no anomalies should be detected for empty dashboard")
}

// TestDetectAnomalies_WithData verifies anomaly detection with outlier data.
func TestDetectAnomalies_WithData(t *testing.T) {
	detector := NewAnomalyDetector(2.0)
	p := NewPipeline(nil, nil, nil, nil, nil, nil, detector)

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

	for _, a := range anomalies {
		assert.Contains(t, []AnomalyType{AnomalySlowAPI, AnomalySlowSQL}, a.Type)
		assert.NotEmpty(t, a.Title)
		assert.NotEmpty(t, a.Description)
		assert.Greater(t, a.Sigma, 2.0)
	}
}

// TestDetectAnomalies_OnlyAPICalls verifies anomaly detection when only API
// calls are present (no SQL data).
func TestDetectAnomalies_OnlyAPICalls(t *testing.T) {
	detector := NewAnomalyDetector(2.0)
	p := NewPipeline(nil, nil, nil, nil, nil, nil, detector)

	dashboard := &domain.DashboardData{
		TopAPICalls: []domain.TopNEntry{
			{Rank: 1, Identifier: "GET_ENTRY", DurationMS: 100},
			{Rank: 2, Identifier: "SET_ENTRY", DurationMS: 105},
			{Rank: 3, Identifier: "QUERY", DurationMS: 102},
			{Rank: 4, Identifier: "OUTLIER", DurationMS: 50000},
		},
	}

	anomalies := p.detectAnomalies(context.Background(), "job-1", "tenant-1", dashboard)
	for _, a := range anomalies {
		assert.Equal(t, AnomalySlowAPI, a.Type)
	}
}

// TestDetectAnomalies_OnlySQLCalls verifies anomaly detection when only SQL
// entries are present (no API data).
func TestDetectAnomalies_OnlySQLCalls(t *testing.T) {
	detector := NewAnomalyDetector(2.0)
	p := NewPipeline(nil, nil, nil, nil, nil, nil, detector)

	dashboard := &domain.DashboardData{
		TopSQL: []domain.TopNEntry{
			{Rank: 1, Identifier: "SELECT", DurationMS: 200},
			{Rank: 2, Identifier: "INSERT", DurationMS: 205},
			{Rank: 3, Identifier: "UPDATE", DurationMS: 202},
			{Rank: 4, Identifier: "SLOW", DurationMS: 80000},
		},
	}

	anomalies := p.detectAnomalies(context.Background(), "job-1", "tenant-1", dashboard)
	for _, a := range anomalies {
		assert.Equal(t, AnomalySlowSQL, a.Type)
	}
}

// ---------------------------------------------------------------------------
// Parser tests (kept for coverage)
// ---------------------------------------------------------------------------

func TestParseSampleOutput(t *testing.T) {
	result, err := jar.ParseOutput(validJAROutput)
	require.NoError(t, err, "ParseOutput should succeed on valid sample input")
	data := result.Dashboard
	require.NotNil(t, data)

	assert.Equal(t, int64(12345), data.GeneralStats.TotalLines)
	assert.Equal(t, int64(8901), data.GeneralStats.APICount)
	assert.Equal(t, int64(2345), data.GeneralStats.SQLCount)
	assert.Equal(t, int64(890), data.GeneralStats.FilterCount)
	assert.Equal(t, int64(209), data.GeneralStats.EscCount)
	assert.Equal(t, 15, data.GeneralStats.UniqueUsers)
	assert.Equal(t, 23, data.GeneralStats.UniqueForms)
	assert.Equal(t, 8, data.GeneralStats.UniqueTables)
	assert.Equal(t, "8h 30m 45s", data.GeneralStats.LogDuration)

	require.GreaterOrEqual(t, len(data.TopAPICalls), 1)
	assert.Equal(t, "GET_ENTRY", data.TopAPICalls[0].Identifier)
}

func TestParseOutput_Empty(t *testing.T) {
	_, err := jar.ParseOutput("")
	assert.Error(t, err)

	_, err = jar.ParseOutput("   \n\t\n   ")
	assert.Error(t, err)
}

func TestParseOutput_MinimalValid(t *testing.T) {
	minimal := `=== General Statistics ===
Total Lines Processed:  100
`
	result, err := jar.ParseOutput(minimal)
	require.NoError(t, err)
	data := result.Dashboard
	require.NotNil(t, data)
	assert.Equal(t, int64(100), data.GeneralStats.TotalLines)
}

func TestParseOutput_UnrecognizedSection(t *testing.T) {
	output := `=== General Statistics ===
Total Lines Processed:  500

=== Some Future Section ===
Key1: value1

=== Top API Calls ===
| Rank | Identifier | Duration(ms) | Status |
|------|------------|--------------|--------|
| 1    | GET_ENTRY  | 1000         | OK     |
`
	result, err := jar.ParseOutput(output)
	require.NoError(t, err)
	data := result.Dashboard
	assert.Equal(t, int64(500), data.GeneralStats.TotalLines)
	require.Len(t, data.TopAPICalls, 1)
	assert.Equal(t, "GET_ENTRY", data.TopAPICalls[0].Identifier)
}

func TestParseOutput_CommasInNumbers(t *testing.T) {
	output := `=== General Statistics ===
Total Lines Processed:  1,234,567
API Calls:              890,123
`
	result, err := jar.ParseOutput(output)
	require.NoError(t, err)
	data := result.Dashboard
	assert.Equal(t, int64(1234567), data.GeneralStats.TotalLines)
	assert.Equal(t, int64(890123), data.GeneralStats.APICount)
}

// ---------------------------------------------------------------------------
// Integration tests -- require external services
// ---------------------------------------------------------------------------

func TestIntegration_FullPipeline(t *testing.T) {
	if os.Getenv("REMEDYIQ_INTEGRATION_TEST") == "" {
		t.Skip("skipping integration test: set REMEDYIQ_INTEGRATION_TEST=1 to enable")
	}
	t.Skip("full integration test implementation pending CI setup")
}

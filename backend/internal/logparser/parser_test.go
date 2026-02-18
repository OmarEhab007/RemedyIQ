package logparser

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/OmarEhab007/RemedyIQ/backend/internal/domain"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const (
	testTenantID = "tenant-001"
	testJobID    = "job-001"
)

// Sample log lines in the real angle-bracket AR Server format.
const (
	sampleESCL = `<ESCL> <TrID: oKNmA5MvSwOxCzBulz9-zQ:0002868> <TID: 0000000532> <RPC ID: 0000015447> <Queue: Escalation> <Client-RPC: 390603   > <USER: AR_ESCALATOR (Pool 3)                        > <Overlay-Group: 1         > /* Mon Nov 24 2025 14:46:58.5050 */               Survey Submitter (536870919) = rjarba`
	sampleSQL  = `<SQL > <TrID: oKNmA5MvSwOxCzBulz9-zQ:0002868> <TID: 0000000532> <RPC ID: 0000015447> <Queue: Escalation> <Client-RPC: 390603   > <USER: AR_ESCALATOR                                 > <Overlay-Group: 1         > /* Mon Nov 24 2025 14:46:58.5090 */ SELECT T4381.C1 FROM T4381 WHERE (T4381.C1 = N'000000000003816')`
	sampleFLTR = `<FLTR> <TrID: oKNmA5MvSwOxCzBulz9-zQ:0002868> <TID: 0000000532> <RPC ID: 0000015447> <Queue: Escalation> <Client-RPC: 390603   > <USER: AR_ESCALATOR                                 > <Overlay-Group: 1         > /* Mon Nov 24 2025 14:46:58.5090 */    Start filter processing (phase 1) -- Operation - SET on CITC:DWPC-Survey - 000000000003816`
	sampleAPI  = `<API > <TrID: abc123:0001> <TID: 0000000100> <RPC ID: 0000005000> <Queue: Fast        > <Client-RPC: 100200   > <USER: Demo                                         > <Overlay-Group: 1         > /* Tue Dec 02 2025 09:30:15.1234 */ GE HPD:Help Desk`
)

func TestParseLine_ESCL(t *testing.T) {
	entry, err := ParseLine(sampleESCL, 1, testTenantID, testJobID)
	require.NoError(t, err)
	require.NotNil(t, entry)

	assert.Equal(t, domain.LogTypeEscalation, entry.LogType)
	assert.Equal(t, testTenantID, entry.TenantID)
	assert.Equal(t, testJobID, entry.JobID)
	assert.Equal(t, uint32(1), entry.LineNumber)
	assert.NotEmpty(t, entry.EntryID)

	// Correlation fields.
	assert.Equal(t, "oKNmA5MvSwOxCzBulz9-zQ:0002868", entry.TraceID)
	assert.Equal(t, "0000000532", entry.ThreadID)
	assert.Equal(t, "0000015447", entry.RPCID)
	assert.Equal(t, "Escalation", entry.Queue)

	// User should have pool annotation stripped.
	assert.Equal(t, "AR_ESCALATOR", entry.User)

	// Timestamp.
	expected := time.Date(2025, 11, 24, 14, 46, 58, 505000000, time.UTC)
	assert.Equal(t, expected, entry.Timestamp)

	// Escalation-specific.
	assert.Equal(t, "Survey Submitter", entry.EscName)
	assert.Contains(t, entry.RawText, "Survey Submitter")
}

func TestParseLine_SQL(t *testing.T) {
	entry, err := ParseLine(sampleSQL, 9, testTenantID, testJobID)
	require.NoError(t, err)
	require.NotNil(t, entry)

	assert.Equal(t, domain.LogTypeSQL, entry.LogType)
	assert.Equal(t, uint32(9), entry.LineNumber)
	assert.Equal(t, "AR_ESCALATOR", entry.User)

	// SQL-specific.
	assert.Contains(t, entry.SQLStatement, "SELECT T4381.C1 FROM T4381")
	assert.Equal(t, "T4381", entry.SQLTable)
}

func TestParseLine_SQL_OK(t *testing.T) {
	line := `<SQL > <TrID: abc:001> <TID: 0000000001> <RPC ID: 0000000001> <Queue: Fast> <Client-RPC: 100> <USER: Admin> <Overlay-Group: 1> /* Mon Nov 24 2025 14:46:58.5090 */ OK`
	entry, err := ParseLine(line, 10, testTenantID, testJobID)
	require.NoError(t, err)

	assert.Equal(t, domain.LogTypeSQL, entry.LogType)
	assert.Equal(t, "OK", entry.SQLStatement)
	assert.Empty(t, entry.SQLTable) // No table for OK responses.
}

func TestParseLine_SQL_CommitBegin(t *testing.T) {
	commitLine := `<SQL > <TrID: abc:001> <TID: 0000000001> <RPC ID: 0000000001> <Queue: Fast> <Client-RPC: 100> <USER: Admin> <Overlay-Group: 1> /* Mon Nov 24 2025 14:46:58.5100 */ COMMIT TRANSACTION`
	entry, err := ParseLine(commitLine, 14, testTenantID, testJobID)
	require.NoError(t, err)
	assert.Equal(t, "COMMIT TRANSACTION", entry.SQLStatement)
	assert.Empty(t, entry.SQLTable)

	beginLine := `<SQL > <TrID: abc:001> <TID: 0000000001> <RPC ID: 0000000001> <Queue: Fast> <Client-RPC: 100> <USER: Admin> <Overlay-Group: 1> /* Mon Nov 24 2025 14:46:58.5130 */ BEGIN TRANSACTION`
	entry, err = ParseLine(beginLine, 15, testTenantID, testJobID)
	require.NoError(t, err)
	assert.Equal(t, "BEGIN TRANSACTION", entry.SQLStatement)
	assert.Empty(t, entry.SQLTable)
}

func TestParseLine_SQL_Update(t *testing.T) {
	line := `<SQL > <TrID: abc:001> <TID: 0000000001> <RPC ID: 0000000001> <Queue: Fast> <Client-RPC: 100> <USER: Admin> <Overlay-Group: 1> /* Mon Nov 24 2025 14:46:58.5090 */ UPDATE T4381 SET T4381.C536870913 = N'43540' WHERE (T4381.C1 = N'000000000003816')`
	entry, err := ParseLine(line, 12, testTenantID, testJobID)
	require.NoError(t, err)

	assert.Equal(t, "T4381", entry.SQLTable)
	assert.Contains(t, entry.SQLStatement, "UPDATE T4381")
}

func TestParseLine_FLTR(t *testing.T) {
	entry, err := ParseLine(sampleFLTR, 7, testTenantID, testJobID)
	require.NoError(t, err)
	require.NotNil(t, entry)

	assert.Equal(t, domain.LogTypeFilter, entry.LogType)
	assert.Equal(t, uint32(7), entry.LineNumber)
	assert.Equal(t, "AR_ESCALATOR", entry.User)

	// Filter-specific: operation and form from "Operation - SET on CITC:DWPC-Survey".
	assert.Equal(t, "SET", entry.Operation)
	assert.Equal(t, "CITC:DWPC-Survey", entry.Form)
}

func TestParseLine_FLTR_EndProcessing(t *testing.T) {
	line := `<FLTR> <TrID: abc:001> <TID: 0000000532> <RPC ID: 0000015447> <Queue: Escalation> <Client-RPC: 390603> <USER: AR_ESCALATOR> <Overlay-Group: 1> /* Mon Nov 24 2025 14:46:58.5090 */    End of filter processing (phase 1) -- Operation - SET on CITC:DWPC-Survey - 000000000003816`
	entry, err := ParseLine(line, 8, testTenantID, testJobID)
	require.NoError(t, err)

	assert.Equal(t, domain.LogTypeFilter, entry.LogType)
	assert.Equal(t, "SET", entry.Operation)
	assert.Equal(t, "CITC:DWPC-Survey", entry.Form)
}

func TestParseLine_API(t *testing.T) {
	entry, err := ParseLine(sampleAPI, 1, testTenantID, testJobID)
	require.NoError(t, err)
	require.NotNil(t, entry)

	assert.Equal(t, domain.LogTypeAPI, entry.LogType)
	assert.Equal(t, "Demo", entry.User)
	assert.Equal(t, "abc123:0001", entry.TraceID)
	assert.Equal(t, "0000000100", entry.ThreadID)
	assert.Equal(t, "0000005000", entry.RPCID)
	assert.Equal(t, "Fast", entry.Queue)

	// API-specific.
	assert.Equal(t, "GE", entry.APICode)
	assert.Equal(t, "HPD:Help Desk", entry.Form)

	// Timestamp.
	expected := time.Date(2025, 12, 2, 9, 30, 15, 123400000, time.UTC)
	assert.Equal(t, expected, entry.Timestamp)
}

func TestParseLine_MalformedLine(t *testing.T) {
	cases := []struct {
		name string
		line string
	}{
		{"empty", ""},
		{"random text", "this is not a log line"},
		{"incomplete brackets", "<SQL> <TrID: abc>"},
		{"missing timestamp", `<SQL > <TrID: abc> <TID: 1> <RPC ID: 1> <Queue: Q> <Client-RPC: 1> <USER: U> <Overlay-Group: 1> content without timestamp`},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			entry, err := ParseLine(tc.line, 1, testTenantID, testJobID)
			assert.Error(t, err)
			assert.Nil(t, entry)
		})
	}
}

func TestParseLine_UnknownLogType(t *testing.T) {
	line := `<XYZZ> <TrID: abc:001> <TID: 0000000001> <RPC ID: 0000000001> <Queue: Fast> <Client-RPC: 100> <USER: Admin> <Overlay-Group: 1> /* Mon Nov 24 2025 14:46:58.5090 */ some content`
	entry, err := ParseLine(line, 1, testTenantID, testJobID)
	assert.Error(t, err)
	assert.Nil(t, entry)
}

func TestParseLine_TimestampParsing(t *testing.T) {
	// Verify various day/month combinations parse correctly.
	line := `<SQL > <TrID: t:1> <TID: 0000000001> <RPC ID: 0000000001> <Queue: Q> <Client-RPC: 1> <USER: U> <Overlay-Group: 1> /* Wed Jan 01 2025 00:00:00.0000 */ OK`
	entry, err := ParseLine(line, 1, testTenantID, testJobID)
	require.NoError(t, err)
	assert.Equal(t, time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC), entry.Timestamp)
}

func TestParseFile_BatchCallback(t *testing.T) {
	// Create a temp file with 7 valid lines.
	dir := t.TempDir()
	path := filepath.Join(dir, "test.log")

	lines := []string{
		sampleESCL,
		sampleSQL,
		sampleFLTR,
		sampleAPI,
		"this is a malformed line that should be skipped",
		sampleESCL,
		sampleSQL,
		"", // empty line
		sampleFLTR,
	}
	content := ""
	for _, l := range lines {
		content += l + "\n"
	}
	require.NoError(t, os.WriteFile(path, []byte(content), 0644))

	var batches []int
	total, err := ParseFile(context.Background(), path, testTenantID, testJobID, 3, func(batch []domain.LogEntry) error {
		batches = append(batches, len(batch))
		return nil
	})

	require.NoError(t, err)
	assert.Equal(t, int64(7), total) // 7 valid lines (2 malformed/empty skipped)
	// With batch size 3: batches of [3, 3, 1]
	assert.Equal(t, []int{3, 3, 1}, batches)
}

func TestParseFile_EmptyFile(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "empty.log")
	require.NoError(t, os.WriteFile(path, []byte(""), 0644))

	callbackCalled := false
	total, err := ParseFile(context.Background(), path, testTenantID, testJobID, 100, func(batch []domain.LogEntry) error {
		callbackCalled = true
		return nil
	})

	require.NoError(t, err)
	assert.Equal(t, int64(0), total)
	assert.False(t, callbackCalled)
}

func TestParseFile_NonexistentFile(t *testing.T) {
	total, err := ParseFile(context.Background(), "/nonexistent/file.log", testTenantID, testJobID, 100, func(batch []domain.LogEntry) error {
		return nil
	})

	assert.Error(t, err)
	assert.Equal(t, int64(0), total)
}

func TestParseFile_ContextCancellation(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "test.log")

	// Write enough lines to trigger multiple batches.
	content := ""
	for i := 0; i < 100; i++ {
		content += sampleSQL + "\n"
	}
	require.NoError(t, os.WriteFile(path, []byte(content), 0644))

	ctx, cancel := context.WithCancel(context.Background())
	batchCount := 0
	total, err := ParseFile(ctx, path, testTenantID, testJobID, 10, func(batch []domain.LogEntry) error {
		batchCount++
		if batchCount == 2 {
			cancel()
		}
		return nil
	})

	// Should have processed some but not all.
	assert.Error(t, err)
	assert.Less(t, total, int64(100))
}

func TestParseFile_CallbackError(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "test.log")

	content := ""
	for i := 0; i < 20; i++ {
		content += sampleSQL + "\n"
	}
	require.NoError(t, os.WriteFile(path, []byte(content), 0644))

	callbackErr := fmt.Errorf("clickhouse insert failed")
	total, err := ParseFile(context.Background(), path, testTenantID, testJobID, 5, func(batch []domain.LogEntry) error {
		return callbackErr
	})

	assert.Error(t, err)
	assert.Equal(t, int64(0), total) // First batch fails, no entries counted.
}

func TestParseFile_RealLogFile(t *testing.T) {
	// Test against the actual log file if it exists.
	realPath := filepath.Join("..", "..", "..", "error_logs", "log1.log")
	if _, err := os.Stat(realPath); os.IsNotExist(err) {
		t.Skip("real log file not available")
	}

	var totalEntries int64
	var logTypes = map[domain.LogType]int{}

	total, err := ParseFile(context.Background(), realPath, testTenantID, testJobID, 5000, func(batch []domain.LogEntry) error {
		for _, e := range batch {
			logTypes[e.LogType]++
		}
		return nil
	})
	require.NoError(t, err)
	totalEntries = total

	t.Logf("Parsed %d entries from real log file", totalEntries)
	for lt, count := range logTypes {
		t.Logf("  %s: %d entries", lt, count)
	}

	assert.Greater(t, totalEntries, int64(0))
}

func TestCleanUser(t *testing.T) {
	cases := []struct {
		input    string
		expected string
	}{
		{"AR_ESCALATOR (Pool 3)", "AR_ESCALATOR"},
		{"AR_ESCALATOR", "AR_ESCALATOR"},
		{"Demo", "Demo"},
		{"Admin (Pool 1)", "Admin"},
	}

	for _, tc := range cases {
		t.Run(tc.input, func(t *testing.T) {
			assert.Equal(t, tc.expected, cleanUser(tc.input))
		})
	}
}

func TestNormalizeLogType(t *testing.T) {
	cases := []struct {
		input    string
		expected domain.LogType
	}{
		{"SQL", domain.LogTypeSQL},
		{"sql", domain.LogTypeSQL},
		{"API", domain.LogTypeAPI},
		{"FLTR", domain.LogTypeFilter},
		{"ESCL", domain.LogTypeEscalation},
		{"XYZZ", ""},
	}

	for _, tc := range cases {
		t.Run(tc.input, func(t *testing.T) {
			assert.Equal(t, tc.expected, normalizeLogType(tc.input))
		})
	}
}

package streaming

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ---------------------------------------------------------------------------
// NATS subject helper tests
// ---------------------------------------------------------------------------

func TestSubjectJobSubmit(t *testing.T) {
	tests := []struct {
		name     string
		tenantID string
		expected string
	}{
		{
			name:     "standard tenant",
			tenantID: "tenant-1",
			expected: "jobs.tenant-1.submit",
		},
		{
			name:     "UUID tenant",
			tenantID: "550e8400-e29b-41d4-a716-446655440000",
			expected: "jobs.550e8400-e29b-41d4-a716-446655440000.submit",
		},
		{
			name:     "empty tenant",
			tenantID: "",
			expected: "jobs..submit",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.expected, subjectJobSubmit(tt.tenantID))
		})
	}
}

func TestSubjectJobProgress(t *testing.T) {
	tests := []struct {
		name     string
		tenantID string
		expected string
	}{
		{
			name:     "standard tenant",
			tenantID: "tenant-abc",
			expected: "jobs.tenant-abc.progress",
		},
		{
			name:     "UUID tenant",
			tenantID: "550e8400-e29b-41d4-a716-446655440000",
			expected: "jobs.550e8400-e29b-41d4-a716-446655440000.progress",
		},
		{
			name:     "empty tenant",
			tenantID: "",
			expected: "jobs..progress",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.expected, subjectJobProgress(tt.tenantID))
		})
	}
}

func TestSubjectJobComplete(t *testing.T) {
	tests := []struct {
		name     string
		tenantID string
		expected string
	}{
		{
			name:     "standard tenant",
			tenantID: "tenant-xyz",
			expected: "jobs.tenant-xyz.complete",
		},
		{
			name:     "UUID tenant",
			tenantID: "123e4567-e89b-12d3-a456-426614174000",
			expected: "jobs.123e4567-e89b-12d3-a456-426614174000.complete",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.expected, subjectJobComplete(tt.tenantID))
		})
	}
}

func TestSubjectLiveTail(t *testing.T) {
	tests := []struct {
		name     string
		tenantID string
		logType  string
		expected string
	}{
		{
			name:     "SQL log type",
			tenantID: "tenant-1",
			logType:  "sql",
			expected: "logs.tenant-1.tail.sql",
		},
		{
			name:     "exception log type",
			tenantID: "tenant-2",
			logType:  "exception",
			expected: "logs.tenant-2.tail.exception",
		},
		{
			name:     "generic log type",
			tenantID: "tenant-3",
			logType:  "generic",
			expected: "logs.tenant-3.tail.generic",
		},
		{
			name:     "UUID tenant with log type",
			tenantID: "550e8400-e29b-41d4-a716-446655440000",
			logType:  "trace",
			expected: "logs.550e8400-e29b-41d4-a716-446655440000.tail.trace",
		},
		{
			name:     "empty values",
			tenantID: "",
			logType:  "",
			expected: "logs..tail.",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.expected, subjectLiveTail(tt.tenantID, tt.logType))
		})
	}
}

// ---------------------------------------------------------------------------
// Subject naming pattern consistency tests
// ---------------------------------------------------------------------------

func TestSubjectNamingPatterns(t *testing.T) {
	tenantID := "test-tenant"

	t.Run("all job subjects share the jobs prefix", func(t *testing.T) {
		assert.Contains(t, subjectJobSubmit(tenantID), "jobs.")
		assert.Contains(t, subjectJobProgress(tenantID), "jobs.")
		assert.Contains(t, subjectJobComplete(tenantID), "jobs.")
	})

	t.Run("live tail subjects use the logs prefix", func(t *testing.T) {
		assert.Contains(t, subjectLiveTail(tenantID, "sql"), "logs.")
	})

	t.Run("subjects are tenant-scoped", func(t *testing.T) {
		assert.Contains(t, subjectJobSubmit(tenantID), tenantID)
		assert.Contains(t, subjectJobProgress(tenantID), tenantID)
		assert.Contains(t, subjectJobComplete(tenantID), tenantID)
		assert.Contains(t, subjectLiveTail(tenantID, "sql"), tenantID)
	})

	t.Run("different tenants produce different subjects", func(t *testing.T) {
		s1 := subjectJobSubmit("tenant-A")
		s2 := subjectJobSubmit("tenant-B")
		assert.NotEqual(t, s1, s2)
	})
}

// ---------------------------------------------------------------------------
// Subject wildcard compatibility tests
//
// NATS uses "." as a token separator and ">" as a trailing wildcard.
// These tests verify that our subjects work with the wildcard pattern
// used in SubscribeAllJobSubmits ("jobs.*.submit").
// ---------------------------------------------------------------------------

func TestSubjectWildcardCompatibility(t *testing.T) {
	tests := []struct {
		name     string
		tenantID string
	}{
		{name: "simple tenant", tenantID: "org-1"},
		{name: "UUID tenant", tenantID: "550e8400-e29b-41d4-a716-446655440000"},
		{name: "hyphenated", tenantID: "my-org-id"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			subject := subjectJobSubmit(tt.tenantID)

			// The subject should have exactly 3 tokens separated by dots,
			// matching the pattern "jobs.<tenant>.submit".
			parts := splitDot(subject)
			require.Len(t, parts, 3, "job submit subject should have 3 dot-separated tokens")
			assert.Equal(t, "jobs", parts[0])
			assert.Equal(t, tt.tenantID, parts[1])
			assert.Equal(t, "submit", parts[2])
		})
	}
}

// splitDot is a tiny helper that splits a string by ".".
func splitDot(s string) []string {
	var parts []string
	start := 0
	for i := 0; i < len(s); i++ {
		if s[i] == '.' {
			parts = append(parts, s[start:i])
			start = i + 1
		}
	}
	parts = append(parts, s[start:])
	return parts
}

// ---------------------------------------------------------------------------
// JobProgress serialization tests
// ---------------------------------------------------------------------------

func TestJobProgressSerialization(t *testing.T) {
	tests := []struct {
		name     string
		progress JobProgress
		checkFn  func(t *testing.T, data []byte, decoded JobProgress)
	}{
		{
			name: "full progress",
			progress: JobProgress{
				JobID:          "job-123",
				Status:         "parsing",
				ProgressPct:    75,
				ProcessedLines: 7500,
				TotalLines:     10000,
				Message:        "Processing log entries",
			},
			checkFn: func(t *testing.T, data []byte, decoded JobProgress) {
				assert.Equal(t, "job-123", decoded.JobID)
				assert.Equal(t, "parsing", decoded.Status)
				assert.Equal(t, 75, decoded.ProgressPct)
				assert.Equal(t, int64(7500), decoded.ProcessedLines)
				assert.Equal(t, int64(10000), decoded.TotalLines)
				assert.Equal(t, "Processing log entries", decoded.Message)
			},
		},
		{
			name: "zero values",
			progress: JobProgress{
				JobID: "job-zero",
			},
			checkFn: func(t *testing.T, data []byte, decoded JobProgress) {
				assert.Equal(t, "job-zero", decoded.JobID)
				assert.Equal(t, "", decoded.Status)
				assert.Equal(t, 0, decoded.ProgressPct)
				assert.Equal(t, int64(0), decoded.ProcessedLines)
				assert.Equal(t, int64(0), decoded.TotalLines)
				assert.Equal(t, "", decoded.Message)
			},
		},
		{
			name: "100 percent complete",
			progress: JobProgress{
				JobID:          "job-done",
				Status:         "complete",
				ProgressPct:    100,
				ProcessedLines: 50000,
				TotalLines:     50000,
				Message:        "Analysis complete",
			},
			checkFn: func(t *testing.T, data []byte, decoded JobProgress) {
				assert.Equal(t, 100, decoded.ProgressPct)
				assert.Equal(t, decoded.ProcessedLines, decoded.TotalLines)
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			data, err := json.Marshal(tt.progress)
			require.NoError(t, err)

			var decoded JobProgress
			require.NoError(t, json.Unmarshal(data, &decoded))

			tt.checkFn(t, data, decoded)
		})
	}
}

func TestJobProgressJSONFieldNames(t *testing.T) {
	p := JobProgress{
		JobID:          "j1",
		Status:         "running",
		ProgressPct:    50,
		ProcessedLines: 500,
		TotalLines:     1000,
		Message:        "halfway",
	}

	data, err := json.Marshal(p)
	require.NoError(t, err)

	raw := string(data)

	// Verify JSON field names match the expected wire format.
	assert.Contains(t, raw, `"job_id"`)
	assert.Contains(t, raw, `"status"`)
	assert.Contains(t, raw, `"progress_pct"`)
	assert.Contains(t, raw, `"processed_lines"`)
	assert.Contains(t, raw, `"total_lines"`)
	assert.Contains(t, raw, `"message"`)
}

func TestJobProgressRoundTrip(t *testing.T) {
	original := JobProgress{
		JobID:          "round-trip-job",
		Status:         "analyzing",
		ProgressPct:    33,
		ProcessedLines: 3300,
		TotalLines:     10000,
		Message:        "Analyzing patterns",
	}

	data, err := json.Marshal(original)
	require.NoError(t, err)

	var decoded JobProgress
	require.NoError(t, json.Unmarshal(data, &decoded))

	assert.Equal(t, original, decoded)
}

// ---------------------------------------------------------------------------
// NATSClient nil safety tests
// ---------------------------------------------------------------------------

func TestNATSClientCloseNilConn(t *testing.T) {
	// Close should not panic when conn is nil.
	client := &NATSClient{}
	assert.NotPanics(t, func() {
		client.Close()
	})
}

// ---------------------------------------------------------------------------
// NATSStreamer interface compliance test
// ---------------------------------------------------------------------------

func TestNATSClientImplementsInterface(t *testing.T) {
	// Compile-time check that NATSClient satisfies the NATSStreamer interface.
	var _ NATSStreamer = (*NATSClient)(nil)
}

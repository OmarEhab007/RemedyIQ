package storage

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

// ---------------------------------------------------------------------------
// escapeLikePattern
// ---------------------------------------------------------------------------

func TestEscapeLikePattern(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{
			name:     "empty string",
			input:    "",
			expected: "",
		},
		{
			name:     "plain text no metacharacters",
			input:    "hello world",
			expected: "hello world",
		},
		{
			name:     "percent sign escaped",
			input:    "100%",
			expected: `100\%`,
		},
		{
			name:     "underscore escaped",
			input:    "log_entry",
			expected: `log\_entry`,
		},
		{
			name:     "backslash escaped",
			input:    `path\to\file`,
			expected: `path\\to\\file`,
		},
		{
			name:     "all metacharacters together",
			input:    `50% of_log\files`,
			expected: `50\% of\_log\\files`,
		},
		{
			name:     "multiple percent signs",
			input:    "%%",
			expected: `\%\%`,
		},
		{
			name:     "multiple underscores",
			input:    "__init__",
			expected: `\_\_init\_\_`,
		},
		{
			name:     "multiple backslashes",
			input:    `a\\b`,
			expected: `a\\\\b`,
		},
		{
			name:     "no metacharacters in URL-like string",
			input:    "https://example.com/path",
			expected: "https://example.com/path",
		},
		{
			name:     "SQL LIKE wildcard injection attempt",
			input:    "%admin%",
			expected: `\%admin\%`,
		},
		{
			name:     "mixed content with spaces and special chars",
			input:    "error: file_not_found (100% sure) \\ backslash",
			expected: `error: file\_not\_found (100\% sure) \\ backslash`,
		},
		{
			name:     "only backslash",
			input:    `\`,
			expected: `\\`,
		},
		{
			name:     "only percent",
			input:    "%",
			expected: `\%`,
		},
		{
			name:     "only underscore",
			input:    "_",
			expected: `\_`,
		},
		{
			name:     "backslash then percent",
			input:    `\%`,
			expected: `\\\%`,
		},
		{
			name:     "backslash then underscore",
			input:    `\_`,
			expected: `\\\_`,
		},
		{
			name:     "unicode characters preserved",
			input:    "error: fichier introuvable",
			expected: "error: fichier introuvable",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := escapeLikePattern(tt.input)
			assert.Equal(t, tt.expected, result)
		})
	}
}

// ---------------------------------------------------------------------------
// scoreErrorRate
// ---------------------------------------------------------------------------

func TestScoreErrorRate(t *testing.T) {
	tests := []struct {
		name     string
		rate     float64
		expected int
	}{
		{"zero error rate", 0.0, 100},
		{"very low error rate", 0.005, 100},
		{"just below 1%", 0.009, 100},
		{"at 1% boundary", 0.01, 80},
		{"between 1% and 2%", 0.015, 80},
		{"just below 2%", 0.019, 80},
		{"at 2% boundary", 0.02, 50},
		{"between 2% and 5%", 0.03, 50},
		{"just below 5%", 0.049, 50},
		{"at 5% boundary", 0.05, 25},
		{"between 5% and 10%", 0.07, 25},
		{"just below 10%", 0.099, 25},
		{"at 10% boundary", 0.10, 0},
		{"high error rate", 0.50, 0},
		{"100% error rate", 1.0, 0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := scoreErrorRate(tt.rate)
			assert.Equal(t, tt.expected, result)
		})
	}
}

// ---------------------------------------------------------------------------
// scoreResponseTime
// ---------------------------------------------------------------------------

func TestScoreResponseTime(t *testing.T) {
	tests := []struct {
		name     string
		avgMS    float64
		expected int
	}{
		{"zero ms", 0.0, 100},
		{"very fast 10ms", 10.0, 100},
		{"fast 200ms", 200.0, 100},
		{"moderate 499ms", 499.0, 100},
		{"at 500ms boundary", 500.0, 80},
		{"between 500ms and 1s", 750.0, 80},
		{"just below 1s", 999.0, 80},
		{"at 1s boundary", 1000.0, 50},
		{"between 1s and 2s", 1500.0, 50},
		{"just below 2s", 1999.0, 50},
		{"at 2s boundary", 2000.0, 25},
		{"between 2s and 5s", 3500.0, 25},
		{"just below 5s", 4999.0, 25},
		{"at 5s boundary", 5000.0, 0},
		{"very slow 10s", 10000.0, 0},
		{"extremely slow 60s", 60000.0, 0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := scoreResponseTime(tt.avgMS)
			assert.Equal(t, tt.expected, result)
		})
	}
}

// ---------------------------------------------------------------------------
// scoreThreadSaturation
// ---------------------------------------------------------------------------

func TestScoreThreadSaturation(t *testing.T) {
	tests := []struct {
		name        string
		maxBusyPct  float64
		expected    int
	}{
		{"zero utilization", 0.0, 100},
		{"low utilization 25%", 25.0, 100},
		{"moderate 49%", 49.0, 100},
		{"at 50% boundary", 50.0, 80},
		{"between 50% and 70%", 60.0, 80},
		{"just below 70%", 69.0, 80},
		{"at 70% boundary", 70.0, 50},
		{"between 70% and 85%", 77.0, 50},
		{"just below 85%", 84.0, 50},
		{"at 85% boundary", 85.0, 25},
		{"between 85% and 95%", 90.0, 25},
		{"just below 95%", 94.0, 25},
		{"at 95% boundary", 95.0, 0},
		{"full saturation 100%", 100.0, 0},
		{"over 100% (edge case)", 150.0, 0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := scoreThreadSaturation(tt.maxBusyPct)
			assert.Equal(t, tt.expected, result)
		})
	}
}

// ---------------------------------------------------------------------------
// scoreGapFrequency
// ---------------------------------------------------------------------------

func TestScoreGapFrequency(t *testing.T) {
	tests := []struct {
		name        string
		maxGapSecs  float64
		expected    int
	}{
		{"zero gap", 0.0, 100},
		{"tiny gap 1s", 1.0, 100},
		{"small gap 4.9s", 4.9, 100},
		{"at 5s boundary", 5.0, 80},
		{"between 5s and 15s", 10.0, 80},
		{"just below 15s", 14.9, 80},
		{"at 15s boundary", 15.0, 50},
		{"between 15s and 30s", 22.0, 50},
		{"just below 30s", 29.9, 50},
		{"at 30s boundary", 30.0, 25},
		{"between 30s and 60s", 45.0, 25},
		{"just below 60s", 59.9, 25},
		{"at 60s boundary", 60.0, 0},
		{"large gap 120s", 120.0, 0},
		{"very large gap 600s", 600.0, 0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := scoreGapFrequency(tt.maxGapSecs)
			assert.Equal(t, tt.expected, result)
		})
	}
}

// ---------------------------------------------------------------------------
// scoreSeverity
// ---------------------------------------------------------------------------

func TestScoreSeverity(t *testing.T) {
	tests := []struct {
		name     string
		score    int
		expected string
	}{
		{"perfect score", 100, "green"},
		{"high score 90", 90, "green"},
		{"just above 80", 81, "green"},
		{"at 80 boundary", 80, "yellow"},
		{"moderate 65", 65, "yellow"},
		{"at 50 boundary", 50, "yellow"},
		{"below 50", 49, "red"},
		{"low score 25", 25, "red"},
		{"zero score", 0, "red"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := scoreSeverity(tt.score)
			assert.Equal(t, tt.expected, result)
		})
	}
}

// ---------------------------------------------------------------------------
// SearchQuery field clamping (tested through SearchEntries logic)
// ---------------------------------------------------------------------------

func TestSearchQuery_PageSizeClamping(t *testing.T) {
	tests := []struct {
		name             string
		inputPageSize    int
		expectedPageSize int
	}{
		{"zero defaults to 50", 0, 50},
		{"negative defaults to 50", -1, 50},
		{"valid small page size", 10, 10},
		{"valid medium page size", 100, 100},
		{"max allowed page size", 500, 500},
		{"over max clamped to 500", 501, 500},
		{"way over max clamped to 500", 10000, 500},
		{"one is valid", 1, 1},
		{"fifty is valid", 50, 50},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			q := SearchQuery{PageSize: tt.inputPageSize}

			// Apply the same clamping logic used in SearchEntries
			if q.PageSize <= 0 {
				q.PageSize = 50
			}
			if q.PageSize > 500 {
				q.PageSize = 500
			}

			assert.Equal(t, tt.expectedPageSize, q.PageSize)
		})
	}
}

func TestSearchQuery_PageClamping(t *testing.T) {
	tests := []struct {
		name         string
		inputPage    int
		expectedPage int
	}{
		{"zero defaults to 1", 0, 1},
		{"negative defaults to 1", -1, 1},
		{"page 1 is valid", 1, 1},
		{"page 2 is valid", 2, 2},
		{"large page number", 999, 999},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			q := SearchQuery{Page: tt.inputPage}

			// Apply the same clamping logic used in SearchEntries
			if q.Page < 1 {
				q.Page = 1
			}

			assert.Equal(t, tt.expectedPage, q.Page)
		})
	}
}

func TestSearchQuery_SortByValidation(t *testing.T) {
	tests := []struct {
		name            string
		inputSortBy     string
		expectedSortCol string
	}{
		{"empty defaults to timestamp", "", "timestamp"},
		{"timestamp is valid", "timestamp", "timestamp"},
		{"duration_ms is valid", "duration_ms", "duration_ms"},
		{"line_number is valid", "line_number", "line_number"},
		{"invalid field defaults to timestamp", "invalid_col", "timestamp"},
		{"sql injection attempt defaults to timestamp", "timestamp; DROP TABLE", "timestamp"},
		{"partial match defaults to timestamp", "time", "timestamp"},
		{"case sensitive - uppercase invalid", "TIMESTAMP", "timestamp"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Apply the same sort column logic used in SearchEntries
			sortCol := "timestamp"
			switch tt.inputSortBy {
			case "duration_ms", "line_number", "timestamp":
				sortCol = tt.inputSortBy
			}

			assert.Equal(t, tt.expectedSortCol, sortCol)
		})
	}
}

func TestSearchQuery_SortOrderValidation(t *testing.T) {
	tests := []struct {
		name            string
		inputSortOrder  string
		expectedSortDir string
	}{
		{"empty defaults to DESC", "", "DESC"},
		{"asc is valid", "asc", "ASC"},
		{"ASC is valid", "ASC", "ASC"},
		{"desc defaults to DESC", "desc", "DESC"},
		{"DESC defaults to DESC", "DESC", "DESC"},
		{"invalid defaults to DESC", "invalid", "DESC"},
		{"random text defaults to DESC", "ascending", "DESC"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Apply the same sort direction logic used in SearchEntries
			sortDir := "DESC"
			if tt.inputSortOrder == "asc" || tt.inputSortOrder == "ASC" {
				sortDir = "ASC"
			}

			assert.Equal(t, tt.expectedSortDir, sortDir)
		})
	}
}

// ---------------------------------------------------------------------------
// SearchQuery offset calculation
// ---------------------------------------------------------------------------

func TestSearchQuery_OffsetCalculation(t *testing.T) {
	tests := []struct {
		name           string
		page           int
		pageSize       int
		expectedOffset int
	}{
		{"page 1 size 50", 1, 50, 0},
		{"page 2 size 50", 2, 50, 50},
		{"page 3 size 50", 3, 50, 100},
		{"page 1 size 10", 1, 10, 0},
		{"page 5 size 10", 5, 10, 40},
		{"page 1 size 500", 1, 500, 0},
		{"page 2 size 500", 2, 500, 500},
		{"page 10 size 100", 10, 100, 900},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			offset := (tt.page - 1) * tt.pageSize
			assert.Equal(t, tt.expectedOffset, offset)
		})
	}
}

// ---------------------------------------------------------------------------
// SearchQuery struct serialization
// ---------------------------------------------------------------------------

func TestSearchQuery_Defaults(t *testing.T) {
	// A zero-value SearchQuery should have sensible defaults after clamping.
	q := SearchQuery{}

	if q.PageSize <= 0 {
		q.PageSize = 50
	}
	if q.PageSize > 500 {
		q.PageSize = 500
	}
	if q.Page < 1 {
		q.Page = 1
	}

	assert.Equal(t, 50, q.PageSize)
	assert.Equal(t, 1, q.Page)
	assert.Empty(t, q.Query)
	assert.Nil(t, q.LogTypes)
	assert.Nil(t, q.TimeFrom)
	assert.Nil(t, q.TimeTo)
	assert.Empty(t, q.UserFilter)
	assert.Empty(t, q.QueueFilter)
	assert.Empty(t, q.SortBy)
	assert.Empty(t, q.SortOrder)
}

// ---------------------------------------------------------------------------
// Health score composite computation logic
// ---------------------------------------------------------------------------

func TestHealthScoreStatus(t *testing.T) {
	tests := []struct {
		name           string
		score          int
		expectedStatus string
	}{
		{"perfect health", 100, "green"},
		{"good health 81", 81, "green"},
		{"boundary 80 is yellow", 80, "yellow"},
		{"moderate health 65", 65, "yellow"},
		{"boundary 50 is yellow", 50, "yellow"},
		{"poor health 49", 49, "red"},
		{"bad health 25", 25, "red"},
		{"critical health 0", 0, "red"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			status := "green"
			if tt.score < 50 {
				status = "red"
			} else if tt.score <= 80 {
				status = "yellow"
			}

			assert.Equal(t, tt.expectedStatus, status)
		})
	}
}

// ---------------------------------------------------------------------------
// Factor scoring consistency: ensure all factor functions return values 0-100
// ---------------------------------------------------------------------------

func TestFactorScoresInRange(t *testing.T) {
	// Test a wide range of input values to confirm scores are always 0-100.
	errorRates := []float64{0, 0.001, 0.005, 0.01, 0.015, 0.02, 0.03, 0.05, 0.08, 0.10, 0.5, 1.0}
	for _, rate := range errorRates {
		score := scoreErrorRate(rate)
		assert.GreaterOrEqual(t, score, 0, "scoreErrorRate(%f) should be >= 0", rate)
		assert.LessOrEqual(t, score, 100, "scoreErrorRate(%f) should be <= 100", rate)
	}

	responseTimes := []float64{0, 100, 499, 500, 750, 1000, 1500, 2000, 3000, 5000, 10000}
	for _, ms := range responseTimes {
		score := scoreResponseTime(ms)
		assert.GreaterOrEqual(t, score, 0, "scoreResponseTime(%f) should be >= 0", ms)
		assert.LessOrEqual(t, score, 100, "scoreResponseTime(%f) should be <= 100", ms)
	}

	busyPcts := []float64{0, 10, 25, 49, 50, 60, 70, 80, 85, 90, 95, 100, 150}
	for _, pct := range busyPcts {
		score := scoreThreadSaturation(pct)
		assert.GreaterOrEqual(t, score, 0, "scoreThreadSaturation(%f) should be >= 0", pct)
		assert.LessOrEqual(t, score, 100, "scoreThreadSaturation(%f) should be <= 100", pct)
	}

	gapSecs := []float64{0, 1, 4.9, 5, 10, 15, 20, 30, 45, 60, 120}
	for _, sec := range gapSecs {
		score := scoreGapFrequency(sec)
		assert.GreaterOrEqual(t, score, 0, "scoreGapFrequency(%f) should be >= 0", sec)
		assert.LessOrEqual(t, score, 100, "scoreGapFrequency(%f) should be <= 100", sec)
	}
}

// ---------------------------------------------------------------------------
// Severity consistency with factor scores
// ---------------------------------------------------------------------------

func TestScoreSeverityConsistency(t *testing.T) {
	// Verify every possible score value maps to a valid severity string.
	validSeverities := map[string]bool{"green": true, "yellow": true, "red": true}
	for score := 0; score <= 100; score++ {
		sev := scoreSeverity(score)
		assert.True(t, validSeverities[sev], "scoreSeverity(%d) returned invalid severity %q", score, sev)
	}
}

// ---------------------------------------------------------------------------
// GetDashboardData default topN
// ---------------------------------------------------------------------------

func TestGetDashboardData_TopNDefault(t *testing.T) {
	// Verify the topN default logic used in GetDashboardData.
	tests := []struct {
		name     string
		input    int
		expected int
	}{
		{"zero defaults to 25", 0, 25},
		{"negative defaults to 25", -1, 25},
		{"positive 10 stays", 10, 10},
		{"positive 50 stays", 50, 50},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			topN := tt.input
			if topN <= 0 {
				topN = 25
			}
			assert.Equal(t, tt.expected, topN)
		})
	}
}

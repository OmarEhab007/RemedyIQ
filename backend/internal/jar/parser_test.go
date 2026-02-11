package jar

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ---------------------------------------------------------------------------
// Parser Tests for utility functions and edge cases.
//
// NOTE: The v4.0.0 format integration tests (### SECTION: headers, ISO 8601
// timestamps, whitespace-aligned tables) are deferred until the parser is
// extended to handle v4 output natively. The realisticJAROutput fixture and
// corresponding tests will be added in the v4 parser enhancement task.
//
// The existing fidelity_test.go and runner_test.go files provide comprehensive
// coverage for the current parser (=== Section Name === format).
// ---------------------------------------------------------------------------

// TestParseOutput_EmptyInput verifies the parser rejects empty input.
func TestParseOutput_EmptyInput_V4(t *testing.T) {
	_, err := ParseOutput("")
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "empty output")
}

// TestParseOutput_WhitespaceOnly verifies the parser rejects whitespace-only input.
func TestParseOutput_WhitespaceOnly_V4(t *testing.T) {
	_, err := ParseOutput("   \n\n  \t\n  ")
	assert.Error(t, err)
}

// TestParseOutput_BannerOnlyOutput verifies that output with only banner text
// (no stats, no sections) still succeeds with zero values.
func TestParseOutput_BannerOnlyOutput(t *testing.T) {
	output := `AR System Log Analyzer, version 4.0.0 (for AR server logs versions 25.3.x+).
Build: 250711.01
( Copyright 1997-2025 BMC Helix Inc.)
`

	parseResult, err := ParseOutput(output)
	require.NoError(t, err)
	assert.Equal(t, int64(0), parseResult.Dashboard.GeneralStats.TotalLines)
}

// TestParseTimestamp_Invalid verifies that invalid timestamps return zero time.
func TestParseTimestamp_Invalid(t *testing.T) {
	ts := parseTimestampSafe("garbage")
	assert.True(t, ts.IsZero())

	ts2 := parseTimestampSafe("")
	assert.True(t, ts2.IsZero())
}

// ---------------------------------------------------------------------------
// Utility function tests
// ---------------------------------------------------------------------------

// TestSplitKeyValue verifies key-value splitting on the first colon.
func TestSplitKeyValue_V4(t *testing.T) {
	tests := []struct {
		input   string
		wantKey string
		wantVal string
		wantOk  bool
	}{
		{"Total Lines: 123", "Total Lines", "123", true},
		{"API Count:  456", "API Count", "456", true},
		{"Start Time: 2025-02-04T12:00:01.001+0000", "Start Time", "2025-02-04T12:00:01.001+0000", true},
		{"no colon here", "", "", false},
		{":  missing key", "", "", false},
		{"key:", "key", "", true},
	}

	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			k, v, ok := splitKeyValue(tt.input)
			assert.Equal(t, tt.wantOk, ok)
			if ok {
				assert.Equal(t, tt.wantKey, k)
				assert.Equal(t, tt.wantVal, v)
			}
		})
	}
}

// TestSplitKeyValueNumeric verifies numeric key-value splitting with colon-
// containing keys (used for distribution-style data).
func TestSplitKeyValueNumeric_V4(t *testing.T) {
	tests := []struct {
		name    string
		input   string
		wantKey string
		wantVal int
		wantOk  bool
	}{
		{"simple", "Demo:  100", "Demo", 100, true},
		{"colon_in_key", "HPD:Help Desk:  5000", "HPD:Help Desk", 5000, true},
		{"multiple_colons", "HPD:Help Desk Template:  2045", "HPD:Help Desk Template", 2045, true},
		{"comma_number", "Demo:  1,234", "Demo", 1234, true},
		{"tab_separated", "Demo\t100", "Demo", 100, true},
		{"no_number", "Demo:  abc", "", 0, false},
		{"empty_line", "", "", 0, false},
		{"just_colon", ":", "", 0, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			key, val, ok := splitKeyValueNumeric(tt.input)
			assert.Equal(t, tt.wantOk, ok, "ok mismatch")
			if ok {
				assert.Equal(t, tt.wantKey, key, "key mismatch")
				assert.Equal(t, tt.wantVal, val, "value mismatch")
			}
		})
	}
}

// TestParseIntSafe verifies integer parsing with various formats.
func TestParseIntSafe_V4(t *testing.T) {
	assert.Equal(t, int64(1234567), parseIntSafe("1,234,567"))
	assert.Equal(t, int64(42), parseIntSafe("  42  "))
	assert.Equal(t, int64(0), parseIntSafe("not a number"))
	assert.Equal(t, int64(0), parseIntSafe(""))
}

// TestSplitFields verifies whitespace-delimited field splitting.
func TestSplitFields_V4(t *testing.T) {
	fields := splitFields("  foo  bar  baz  ")
	require.Len(t, fields, 3)
	assert.Equal(t, "foo", fields[0])
	assert.Equal(t, "bar", fields[1])
	assert.Equal(t, "baz", fields[2])
}

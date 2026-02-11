package jar

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ---------------------------------------------------------------------------
// Fidelity Tests (T032)
//
// These tests validate that the JAR output parser correctly extracts
// structured data from every supported output format. Per Constitution
// Article VII (Log Format Fidelity), the parser must accurately represent
// all data from the JAR output without loss or corruption.
// ---------------------------------------------------------------------------

// TestFidelity_EmptyOutput verifies the parser rejects empty input.
func TestFidelity_EmptyOutput(t *testing.T) {
	_, err := ParseOutput("")
	assert.Error(t, err)

	_, err = ParseOutput("   \n\n  ")
	assert.Error(t, err)
}

// TestFidelity_GeneralStatistics_Complete verifies full parsing of general stats.
func TestFidelity_GeneralStatistics_Complete(t *testing.T) {
	output := `=== General Statistics ===
Total Lines Processed:  1,234,567
API Calls:              890,123
SQL Operations:         234,567
Filter Executions:      123,456
Escalation Executions:  12,345
Unique Users:           42
Unique Forms:           87
Unique Tables:          35
Log Start:              Mon Feb 03 2026 10:00:00.123
Log End:                Mon Feb 03 2026 18:30:45.678
Log Duration:           8h 30m 45s
`

	result, err := ParseOutput(output)
	require.NoError(t, err)
	data := result.Dashboard
	require.NotNil(t, data)

	assert.Equal(t, int64(1234567), data.GeneralStats.TotalLines, "comma-separated number parsing")
	assert.Equal(t, int64(890123), data.GeneralStats.APICount)
	assert.Equal(t, int64(234567), data.GeneralStats.SQLCount)
	assert.Equal(t, int64(123456), data.GeneralStats.FilterCount)
	assert.Equal(t, int64(12345), data.GeneralStats.EscCount)
	assert.Equal(t, 42, data.GeneralStats.UniqueUsers)
	assert.Equal(t, 87, data.GeneralStats.UniqueForms)
	assert.Equal(t, 35, data.GeneralStats.UniqueTables)
	assert.False(t, data.GeneralStats.LogStart.IsZero(), "LogStart should be parsed")
	assert.False(t, data.GeneralStats.LogEnd.IsZero(), "LogEnd should be parsed")
	assert.Equal(t, "8h 30m 45s", data.GeneralStats.LogDuration)
}

// TestFidelity_GeneralStatistics_MinimalOutput verifies parsing with partial stats.
func TestFidelity_GeneralStatistics_MinimalOutput(t *testing.T) {
	output := `=== General Statistics ===
Total Lines Processed:  100
API Calls:              50
`

	result, err := ParseOutput(output)
	require.NoError(t, err)
	data := result.Dashboard
	assert.Equal(t, int64(100), data.GeneralStats.TotalLines)
	assert.Equal(t, int64(50), data.GeneralStats.APICount)
	assert.Equal(t, int64(0), data.GeneralStats.SQLCount, "missing fields default to zero")
}

// TestFidelity_TopN_PipeDelimited verifies pipe-delimited table parsing with
// column-to-field mapping via named headers. This is the primary table format
// produced by ARLogAnalyzer.jar.
func TestFidelity_TopN_PipeDelimited(t *testing.T) {
	output := `=== Top API Calls ===
| Rank | Line# | Timestamp | Thread | Identifier | Form | User | Duration(ms) | Status |
|------|-------|-----------|--------|------------|------|------|--------------|--------|
| 1    | 4523  | 2026-02-03 10:15:30 | T024 | GET_ENTRY | HPD:Help Desk | Demo | 5000 | OK |
| 2    | 7891  | 2026-02-03 14:20:00 | T012 | SET_ENTRY | CHG:Change | Admin | 3200 | Success |
| 3    | 9012  | 2026-02-03 16:45:15 | T008 | QUERY | PBM:Problem | System | 2800 | OK |
`

	result, err := ParseOutput(output)
	require.NoError(t, err)
	data := result.Dashboard
	require.Len(t, data.TopAPICalls, 3)

	first := data.TopAPICalls[0]
	assert.Equal(t, 1, first.Rank)
	assert.Equal(t, 4523, first.LineNumber)
	assert.Equal(t, "GET_ENTRY", first.Identifier)
	assert.Equal(t, "HPD:Help Desk", first.Form)
	assert.Equal(t, "Demo", first.User)
	assert.Equal(t, 5000, first.DurationMS)
	assert.True(t, first.Success)

	second := data.TopAPICalls[1]
	assert.Equal(t, 2, second.Rank)
	assert.True(t, second.Success, "Success should be true for status=Success")
}

// TestFidelity_TopN_WhitespaceAligned verifies whitespace-aligned table parsing.
// The parser uses a heuristic approach to extract fields from position-based
// columns separated by two or more spaces.
func TestFidelity_TopN_WhitespaceAligned(t *testing.T) {
	output := `=== Top SQL Statements ===
1  1234  2026-02-03 10:05:00  T024  398  Fast  SELECT  4500  OK
2  5678  2026-02-03 12:30:00  T012  245  Regular  INSERT  2100  OK
`

	result, err := ParseOutput(output)
	require.NoError(t, err)
	data := result.Dashboard
	assert.NotEmpty(t, data.TopSQL, "should parse whitespace-aligned table")

	// Verify that at least rank and some fields are extracted.
	assert.Equal(t, 1, data.TopSQL[0].Rank)
	assert.Equal(t, 1234, data.TopSQL[0].LineNumber)
}

// TestFidelity_Distribution_SimpleKeys verifies distribution with simple keys.
func TestFidelity_Distribution_SimpleKeys(t *testing.T) {
	output := `=== Thread Distribution ===
T024:  4500
T012:  3200
T008:  2800
T001:  1845
`

	result, err := ParseOutput(output)
	require.NoError(t, err)
	data := result.Dashboard
	require.Contains(t, data.Distribution, "threads")

	threads := data.Distribution["threads"]
	assert.Equal(t, 4500, threads["T024"])
	assert.Equal(t, 3200, threads["T012"])
	assert.Equal(t, 2800, threads["T008"])
	assert.Equal(t, 1845, threads["T001"])
}

// TestFidelity_Distribution_ColonContainingKeys verifies the critical case
// where AR form names contain colons (e.g., "HPD:Help Desk").
// The splitKeyValueNumeric function splits on the LAST colon whose right-hand
// side is a valid integer, preserving the full form name as the key.
func TestFidelity_Distribution_ColonContainingKeys(t *testing.T) {
	output := `=== Form Distribution ===
HPD:Help Desk:  5000
CHG:Change:  3200
PBM:Problem:  2100
HPD:Help Desk Template:  2045
SRM:Request:  890
`

	result, err := ParseOutput(output)
	require.NoError(t, err)
	data := result.Dashboard
	require.Contains(t, data.Distribution, "forms")

	forms := data.Distribution["forms"]
	assert.Equal(t, 5000, forms["HPD:Help Desk"], "form name with colon should be preserved")
	assert.Equal(t, 3200, forms["CHG:Change"])
	assert.Equal(t, 2100, forms["PBM:Problem"])
	assert.Equal(t, 2045, forms["HPD:Help Desk Template"])
	assert.Equal(t, 890, forms["SRM:Request"])
}

// TestFidelity_Distribution_TabSeparated verifies tab-delimited distribution.
// When no colon-delimited split produces a numeric value, the parser falls
// back to tab-separated parsing.
func TestFidelity_Distribution_TabSeparated(t *testing.T) {
	output := "=== User Distribution ===\nDemo\t6500\nAdmin\t3800\n"

	result, err := ParseOutput(output)
	require.NoError(t, err)
	data := result.Dashboard
	require.Contains(t, data.Distribution, "users")
	assert.Equal(t, 6500, data.Distribution["users"]["Demo"])
	assert.Equal(t, 3800, data.Distribution["users"]["Admin"])
}

// TestFidelity_Distribution_CommaNumbers verifies parsing of comma-formatted counts.
func TestFidelity_Distribution_CommaNumbers(t *testing.T) {
	output := `=== User Distribution ===
Demo:  1,234,567
Admin:  890,123
`

	result, err := ParseOutput(output)
	require.NoError(t, err)
	data := result.Dashboard
	require.Contains(t, data.Distribution, "users")
	assert.Equal(t, 1234567, data.Distribution["users"]["Demo"])
	assert.Equal(t, 890123, data.Distribution["users"]["Admin"])
}

// TestFidelity_MultipleSections verifies end-to-end parsing of a complete report
// containing all supported section types. This is the primary integration test
// that validates the parser handles a realistic multi-section JAR output.
func TestFidelity_MultipleSections(t *testing.T) {
	output := `=== General Statistics ===
Total Lines Processed:  50000
API Calls:              30000
SQL Operations:         15000
Filter Executions:      4000
Escalation Executions:  1000
Unique Users:           10
Unique Forms:           20

=== Top API Calls ===
| Rank | Line# | Identifier | Duration(ms) | Status |
|------|-------|------------|--------------|--------|
| 1    | 100   | GET_ENTRY  | 5000         | OK     |
| 2    | 200   | SET_ENTRY  | 3000         | OK     |

=== Top SQL Statements ===
| Rank | Line# | Identifier | Duration(ms) | Status |
|------|-------|------------|--------------|--------|
| 1    | 300   | SELECT     | 4000         | OK     |

=== Top Filter Executions ===
| Rank | Line# | Identifier | Duration(ms) | Status |
|------|-------|------------|--------------|--------|
| 1    | 400   | MyFilter   | 1000         | OK     |

=== Top Escalation Executions ===
| Rank | Line# | Identifier | Duration(ms) | Status |
|------|-------|------------|--------------|--------|
| 1    | 500   | DailyCheck | 500          | OK     |

=== Thread Distribution ===
T001:  25000
T002:  15000
T003:  10000

=== User Distribution ===
Demo:  30000
Admin:  15000
System:  5000

=== Error Distribution ===
ARERR 302:  150
ARERR 8745:  75

=== Form Distribution ===
HPD:Help Desk:  20000
CHG:Change:  10000
`

	result, err := ParseOutput(output)
	require.NoError(t, err)
	data := result.Dashboard

	// General stats
	assert.Equal(t, int64(50000), data.GeneralStats.TotalLines)
	assert.Equal(t, int64(30000), data.GeneralStats.APICount)

	// Top N sections
	assert.Len(t, data.TopAPICalls, 2)
	assert.Len(t, data.TopSQL, 1)
	assert.Len(t, data.TopFilters, 1)
	assert.Len(t, data.TopEscalations, 1)

	// Distributions
	assert.Len(t, data.Distribution, 4, "should have threads, users, errors, forms")
	assert.Contains(t, data.Distribution, "threads")
	assert.Contains(t, data.Distribution, "users")
	assert.Contains(t, data.Distribution, "errors")
	assert.Contains(t, data.Distribution, "forms")

	// Verify specific values
	assert.Equal(t, "GET_ENTRY", data.TopAPICalls[0].Identifier)
	assert.Equal(t, 5000, data.TopAPICalls[0].DurationMS)
	assert.Equal(t, 25000, data.Distribution["threads"]["T001"])
	assert.Equal(t, 20000, data.Distribution["forms"]["HPD:Help Desk"])
	assert.Equal(t, 150, data.Distribution["errors"]["ARERR 302"])
}

// TestFidelity_SplitKeyValueNumeric verifies the utility function directly
// across all supported input formats including edge cases.
func TestFidelity_SplitKeyValueNumeric(t *testing.T) {
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

// TestFidelity_SplitSections verifies section splitting.
// Note: splitSections includes all lines (including blank lines) in each
// section body. The trailing newline at the end of input produces an empty
// string when split, which is included in the last section's body.
func TestFidelity_SplitSections(t *testing.T) {
	output := `Some preamble text
=== Section One ===
line 1
line 2
=== Section Two ===
line A
line B
line C
`

	sections := splitSections(output)
	assert.Len(t, sections, 2)
	assert.Contains(t, sections, "Section One")
	assert.Contains(t, sections, "Section Two")

	// Section One body: "line 1", "line 2" -- no blank line between the last
	// content line and the next section header because they are adjacent.
	assert.Len(t, sections["Section One"], 2)
	assert.Equal(t, "line 1", sections["Section One"][0])
	assert.Equal(t, "line 2", sections["Section One"][1])

	// Section Two body: "line A", "line B", "line C", "" (trailing newline
	// produces an empty string when the input is split by \n).
	assert.Len(t, sections["Section Two"], 4,
		"section body includes the empty string from trailing newline")
	assert.Equal(t, "line A", sections["Section Two"][0])
	assert.Equal(t, "line B", sections["Section Two"][1])
	assert.Equal(t, "line C", sections["Section Two"][2])
}

// TestFidelity_SplitSections_NoPreamble verifies sections without preamble text.
func TestFidelity_SplitSections_NoPreamble(t *testing.T) {
	output := `=== Alpha ===
alpha1
=== Beta ===
beta1
beta2
`

	sections := splitSections(output)
	assert.Len(t, sections, 2)
	assert.Contains(t, sections, "Alpha")
	assert.Contains(t, sections, "Beta")
}

// TestFidelity_SplitSections_EmptyBody verifies a section with no body lines.
func TestFidelity_SplitSections_EmptyBody(t *testing.T) {
	output := `=== Empty ===
=== Next ===
has content
`

	sections := splitSections(output)
	assert.Len(t, sections, 2)
	// "Empty" section has nil body (no lines appended before next header).
	assert.Nil(t, sections["Empty"])
	assert.Contains(t, sections, "Next")
}

// TestFidelity_UnknownSections verifies that unknown sections are silently skipped.
func TestFidelity_UnknownSections(t *testing.T) {
	output := `=== General Statistics ===
Total Lines Processed:  100

=== Some Unknown Section ===
random data here

=== Another Unknown ===
more random data
`

	result, err := ParseOutput(output)
	require.NoError(t, err)
	data := result.Dashboard
	assert.Equal(t, int64(100), data.GeneralStats.TotalLines)
	// Unknown sections should not cause errors
}

// TestFidelity_TopN_PipeDelimited_AllColumns verifies that all column types
// in a pipe-delimited table are correctly mapped to TopNEntry fields.
func TestFidelity_TopN_PipeDelimited_AllColumns(t *testing.T) {
	output := `=== Top API Calls ===
| Rank | Line# | File | Timestamp | Thread | RPC | Queue | Identifier | Form | User | Duration(ms) | Status | Details |
|------|-------|------|-----------|--------|-----|-------|------------|------|------|--------------|--------|---------|
| 1 | 4523 | 2 | 2026-02-03 10:15:30 | T00000027 | 398 | Fast | GET_ENTRY | HPD:Help Desk | Demo | 5000 | Success | cached result |
`

	result, err := ParseOutput(output)
	require.NoError(t, err)
	data := result.Dashboard
	require.Len(t, data.TopAPICalls, 1)

	entry := data.TopAPICalls[0]
	assert.Equal(t, 1, entry.Rank)
	assert.Equal(t, 4523, entry.LineNumber)
	assert.Equal(t, 2, entry.FileNumber)
	assert.False(t, entry.Timestamp.IsZero(), "Timestamp should be parsed")
	assert.Equal(t, "T00000027", entry.TraceID)
	assert.Equal(t, "398", entry.RPCID)
	assert.Equal(t, "Fast", entry.Queue)
	assert.Equal(t, "GET_ENTRY", entry.Identifier)
	assert.Equal(t, "HPD:Help Desk", entry.Form)
	assert.Equal(t, "Demo", entry.User)
	assert.Equal(t, 5000, entry.DurationMS)
	assert.True(t, entry.Success)
	assert.Equal(t, "cached result", entry.Details)
}

// TestFidelity_TopN_PipeDelimited_FailedStatus verifies that non-success
// status values are correctly mapped to Success=false.
func TestFidelity_TopN_PipeDelimited_FailedStatus(t *testing.T) {
	output := `=== Top API Calls ===
| Rank | Identifier | Duration(ms) | Status |
|------|------------|--------------|--------|
| 1 | GET_ENTRY | 5000 | Failed |
| 2 | SET_ENTRY | 3000 | Error |
| 3 | QUERY | 1000 | OK |
`

	result, err := ParseOutput(output)
	require.NoError(t, err)
	data := result.Dashboard
	require.Len(t, data.TopAPICalls, 3)

	assert.False(t, data.TopAPICalls[0].Success, "Failed status should be false")
	assert.False(t, data.TopAPICalls[1].Success, "Error status should be false")
	assert.True(t, data.TopAPICalls[2].Success, "OK status should be true")
}

// TestFidelity_Distribution_ZeroValues verifies that zero-count entries
// are excluded from the distribution map (parseDistribution only adds count > 0).
func TestFidelity_Distribution_ZeroValues(t *testing.T) {
	output := `=== User Distribution ===
Active:  100
Inactive:  0
`

	result, err := ParseOutput(output)
	require.NoError(t, err)
	data := result.Dashboard
	require.Contains(t, data.Distribution, "users")

	users := data.Distribution["users"]
	assert.Equal(t, 100, users["Active"])
	_, hasInactive := users["Inactive"]
	assert.False(t, hasInactive, "zero-count entries should be excluded")
}

// TestFidelity_Distribution_ErrorKeysWithColons verifies that error keys
// containing colons (e.g., "ARERR[302] Entry does not exist") are parsed
// correctly using the last-colon-numeric strategy.
func TestFidelity_Distribution_ErrorKeysWithColons(t *testing.T) {
	output := `=== Exception Distribution ===
ARERR[302] Entry does not exist:  50
ARERR[9352] Permission denied:  25
ORA-00942 table or view:  10
`

	result, err := ParseOutput(output)
	require.NoError(t, err)
	data := result.Dashboard
	require.Contains(t, data.Distribution, "errors")

	errors := data.Distribution["errors"]
	assert.Equal(t, 50, errors["ARERR[302] Entry does not exist"])
	assert.Equal(t, 25, errors["ARERR[9352] Permission denied"])
	assert.Equal(t, 10, errors["ORA-00942 table or view"])
}

// TestFidelity_Distribution_EmptySection verifies that an empty distribution
// section does not create an entry in the distribution map.
func TestFidelity_Distribution_EmptySection(t *testing.T) {
	output := `=== Thread Distribution ===

=== General Statistics ===
Total Lines Processed:  100
`

	result, err := ParseOutput(output)
	require.NoError(t, err)
	data := result.Dashboard
	assert.Equal(t, int64(100), data.GeneralStats.TotalLines)
	// Empty distribution sections should not create map entries.
	_, hasThreads := data.Distribution["threads"]
	assert.False(t, hasThreads, "empty distribution should not be added")
}

// TestFidelity_TopN_EmptySection verifies that an empty top-N section
// produces a nil/empty slice.
func TestFidelity_TopN_EmptySection(t *testing.T) {
	output := `=== Top API Calls ===

=== General Statistics ===
Total Lines Processed:  100
`

	result, err := ParseOutput(output)
	require.NoError(t, err)
	data := result.Dashboard
	assert.Empty(t, data.TopAPICalls, "empty top-N section should produce empty slice")
	assert.Equal(t, int64(100), data.GeneralStats.TotalLines)
}

// TestFidelity_PipeTable_SeparatorRowVariants verifies that various separator
// row formats are correctly identified and skipped.
func TestFidelity_PipeTable_SeparatorRowVariants(t *testing.T) {
	// Separator rows can contain dashes and colons (markdown alignment syntax).
	assert.True(t, isSeparatorRow([]string{"---", "------", "---:"}))
	assert.True(t, isSeparatorRow([]string{":---:", "------:", ":---"}))
	assert.True(t, isSeparatorRow([]string{"----", "----"}))
	assert.False(t, isSeparatorRow([]string{"Rank", "Line#"}))
	assert.False(t, isSeparatorRow([]string{"1", "4523"}))
}

// TestFidelity_GeneralStatistics_SeparatorLinesIgnored verifies that
// separator lines (---) within the general statistics section are skipped.
func TestFidelity_GeneralStatistics_SeparatorLinesIgnored(t *testing.T) {
	output := `=== General Statistics ===
---
Total Lines Processed:  500
---
API Calls:              200
---
`

	result, err := ParseOutput(output)
	require.NoError(t, err)
	data := result.Dashboard
	assert.Equal(t, int64(500), data.GeneralStats.TotalLines)
	assert.Equal(t, int64(200), data.GeneralStats.APICount)
}

// TestFidelity_SplitKeyValueNumeric_DeepColonNesting verifies that deeply
// nested colon keys are handled correctly. The parser walks backward through
// colons to find the last one with a numeric right-hand side.
func TestFidelity_SplitKeyValueNumeric_DeepColonNesting(t *testing.T) {
	tests := []struct {
		name    string
		input   string
		wantKey string
		wantVal int
	}{
		{
			name:    "three_colons",
			input:   "A:B:C:  42",
			wantKey: "A:B:C",
			wantVal: 42,
		},
		{
			name:    "four_colons",
			input:   "NS:Module:Sub:Detail:  99",
			wantKey: "NS:Module:Sub:Detail",
			wantVal: 99,
		},
		{
			name:    "colon_with_spaces_in_segments",
			input:   "HPD:Help Desk Template:  777",
			wantKey: "HPD:Help Desk Template",
			wantVal: 777,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			key, val, ok := splitKeyValueNumeric(tt.input)
			require.True(t, ok)
			assert.Equal(t, tt.wantKey, key)
			assert.Equal(t, tt.wantVal, val)
		})
	}
}

// TestFidelity_MultipleSections_SectionOrder verifies that section parsing
// is order-independent. The JAR output may present sections in any order.
func TestFidelity_MultipleSections_SectionOrder(t *testing.T) {
	// Reversed order compared to typical JAR output.
	output := `=== Form Statistics ===
HPD:Help Desk:  100

=== Thread Statistics ===
T001:  50

=== General Statistics ===
Total Lines Processed:  200
API Calls:              100
`

	result, err := ParseOutput(output)
	require.NoError(t, err)
	data := result.Dashboard

	assert.Equal(t, int64(200), data.GeneralStats.TotalLines)
	assert.Equal(t, 100, data.Distribution["forms"]["HPD:Help Desk"])
	assert.Equal(t, 50, data.Distribution["threads"]["T001"])
}

// TestFidelity_TopN_PipeDelimited_MinimalColumns verifies that a pipe table
// with only essential columns still produces valid entries.
func TestFidelity_TopN_PipeDelimited_MinimalColumns(t *testing.T) {
	output := `=== Top API Calls ===
| Rank | Identifier |
|------|------------|
| 1 | GET_ENTRY |
| 2 | SET_ENTRY |
`

	result, err := ParseOutput(output)
	require.NoError(t, err)
	data := result.Dashboard
	require.Len(t, data.TopAPICalls, 2)
	assert.Equal(t, 1, data.TopAPICalls[0].Rank)
	assert.Equal(t, "GET_ENTRY", data.TopAPICalls[0].Identifier)
	assert.Equal(t, 2, data.TopAPICalls[1].Rank)
	assert.Equal(t, "SET_ENTRY", data.TopAPICalls[1].Identifier)
}

// TestFidelity_GeneralStatistics_ExtraWhitespace verifies that the parser
// handles varying amounts of whitespace between key and value.
func TestFidelity_GeneralStatistics_ExtraWhitespace(t *testing.T) {
	output := `=== General Statistics ===
Total Lines Processed:     500
API Calls:  200
SQL Operations:                  150
`

	result, err := ParseOutput(output)
	require.NoError(t, err)
	data := result.Dashboard
	assert.Equal(t, int64(500), data.GeneralStats.TotalLines)
	assert.Equal(t, int64(200), data.GeneralStats.APICount)
	assert.Equal(t, int64(150), data.GeneralStats.SQLCount)
}

// TestFidelity_Distribution_MixedSeparators verifies that the parser handles
// distribution sections where entries use different separator styles.
func TestFidelity_Distribution_MixedSeparators(t *testing.T) {
	// Colon-separated and tab-separated entries can appear in different sections.
	// Within a section, the parser tries colon first, then falls back to tab.
	colonOutput := `=== User Statistics ===
Demo:  100
Admin:  50
`
	tabOutput := "=== User Statistics ===\nDemo\t100\nAdmin\t50\n"

	colonResult, err := ParseOutput(colonOutput)
	require.NoError(t, err)
	colonData := colonResult.Dashboard
	tabResult, err := ParseOutput(tabOutput)
	require.NoError(t, err)
	tabData := tabResult.Dashboard

	assert.Equal(t, 100, colonData.Distribution["users"]["Demo"])
	assert.Equal(t, 100, tabData.Distribution["users"]["Demo"])
	assert.Equal(t, 50, colonData.Distribution["users"]["Admin"])
	assert.Equal(t, 50, tabData.Distribution["users"]["Admin"])
}

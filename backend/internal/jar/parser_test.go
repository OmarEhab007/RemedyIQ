package jar

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ---------------------------------------------------------------------------
// Parser Tests — v4.0.0 format (### SECTION headers, fixed-width tables,
// preamble stats, float-second durations) and utility functions.
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

// ---------------------------------------------------------------------------
// V4 format: Preamble general statistics
// ---------------------------------------------------------------------------

// TestV4_PreambleGeneralStatistics verifies parsing of the v4 preamble format
// where general stats appear before any ### section header.
func TestV4_PreambleGeneralStatistics(t *testing.T) {
	output := `AR System Log Analyzer, version 4.0.0 (for AR server logs versions 25.3.x+).
Build: 250711.01
( Copyright 1997-2025 BMC Helix Inc.)
No Locale specified, using EN

             Start Time: Mon Nov 24 2025 14:46:58.505
               End Time: Mon Nov 24 2025 14:47:08.667
           Elapsed Time: 10.162
            Total Lines: 16880
              API Count: 251
              SQL Count: 7307
              ESC Count: 6260
             Form Count: 32
            Table Count: 60
             User Count: 8
 AssignEng Thread Count: 1
Escalation Thread Count: 2
      Fast Thread Count: 4
      Init Thread Count: 2
      List Thread Count: 20
     Total Thread Count: 31
    API Exception Count: 3
    SQL Exception Count: 1
    ESC Exception Count: 0

###  SECTION: GAP ANALYSIS  #####################################################

### 50 LONGEST LINE GAPS

    Line Gap    Line#                           TrID                    Date/Time                        Details
------------ -------- ------------------------------ ---------------------------- ------------------------------
       0.265        0 oKNmA5MvSwOxCzBulz9-zQ:0003436 Mon Nov 24 2025 14:47:07.436              BEGIN TRANSACTION
`

	result, err := ParseOutput(output)
	require.NoError(t, err)
	data := result.Dashboard

	// General statistics from the preamble.
	assert.Equal(t, int64(16880), data.GeneralStats.TotalLines)
	assert.Equal(t, int64(251), data.GeneralStats.APICount)
	assert.Equal(t, int64(7307), data.GeneralStats.SQLCount)
	assert.Equal(t, int64(6260), data.GeneralStats.EscCount)
	assert.Equal(t, 32, data.GeneralStats.UniqueForms)
	assert.Equal(t, 60, data.GeneralStats.UniqueTables)
	assert.Equal(t, 8, data.GeneralStats.UniqueUsers)
	assert.False(t, data.GeneralStats.LogStart.IsZero(), "Start Time should be parsed")
	assert.False(t, data.GeneralStats.LogEnd.IsZero(), "End Time should be parsed")
	assert.Equal(t, "10.162", data.GeneralStats.LogDuration)
}

// ---------------------------------------------------------------------------
// V4 format: Section splitting with ### headers
// ---------------------------------------------------------------------------

// TestV4_SplitSections_MajorAndSub verifies splitting with both major
// (### SECTION: Name ###...) and subsection (### Name) headers.
func TestV4_SplitSections_MajorAndSub(t *testing.T) {
	output := `preamble line
###  SECTION: API  #####################################################

### 50 LONGEST RUNNING INDIVIDUAL API CALLS

header row
------------ ----------- ----------
data row 1

### API CALL AGGREGATES grouped by Form sorted by descending AVG execution time

agg data
`

	sections := splitSections(output)
	assert.Contains(t, sections, "_preamble")
	assert.Contains(t, sections, "API")
	assert.Contains(t, sections, "50 LONGEST RUNNING INDIVIDUAL API CALLS")
	assert.Contains(t, sections, "API CALL AGGREGATES grouped by Form sorted by descending AVG execution time")
}

// ---------------------------------------------------------------------------
// V4 format: Fixed-width API table
// ---------------------------------------------------------------------------

// TestV4_TopAPICalls_FixedWidth tests parsing of the v4 fixed-width API table
// using real column names and float-second durations.
func TestV4_TopAPICalls_FixedWidth(t *testing.T) {
	output := `preamble
            Total Lines: 100
              API Count: 50

###  SECTION: API  #####################################################

### 50 LONGEST RUNNING INDIVIDUAL API CALLS

    Run Time First Line# Last Line#                           TrID Queue      API        Form                                                                          Start Time    Q Time Success
------------ ----------- ---------- ------------------------------ ---------- ---------- ----------------------------------------------------------- ---------------------------- --------- -------
       0.122        8620      10031 ppvN52iaQZmnf3QKV41xnA:0009991 Prv:390680 SE         SRM:RequestApDetailSignature                                Mon Nov 24 2025 14:47:03.770     0.000 true
       0.118       16421      16434 uNFzUimrQvidJDExR4_0dQ:0000458 List       GLEWF      AR System Administration: Client Type Configuration Setting Mon Nov 24 2025 14:47:08.347     0.000 true
       0.061        7922       8344 ppvN52iaQZmnf3QKV41xnA:0009973 Prv:390680 CE         AP:Signature                                                Mon Nov 24 2025 14:47:03.615     0.000 true
       0.015        6014       6211 nZ0UaxoDR9eTQGaKLpHwgQ:0000001 AssignEng  SE         SRM:Request                                                 Mon Nov 24 2025 14:47:02.814     0.000 false
`

	result, err := ParseOutput(output)
	require.NoError(t, err)
	data := result.Dashboard

	// General stats from preamble.
	assert.Equal(t, int64(100), data.GeneralStats.TotalLines)
	assert.Equal(t, int64(50), data.GeneralStats.APICount)

	// Top API calls.
	require.Len(t, data.TopAPICalls, 4, "should parse 4 API rows")

	first := data.TopAPICalls[0]
	assert.Equal(t, 1, first.Rank, "auto-assigned rank")
	assert.Equal(t, 122, first.DurationMS, "0.122s -> 122ms")
	assert.Equal(t, 8620, first.LineNumber)
	assert.Equal(t, "ppvN52iaQZmnf3QKV41xnA:0009991", first.TraceID)
	assert.Equal(t, "Prv:390680", first.Queue)
	assert.Equal(t, "SE", first.Identifier)
	assert.Equal(t, "SRM:RequestApDetailSignature", first.Form)
	assert.False(t, first.Timestamp.IsZero(), "timestamp should be parsed")
	assert.Equal(t, 0, first.QueueTimeMS)
	assert.True(t, first.Success)

	second := data.TopAPICalls[1]
	assert.Equal(t, 2, second.Rank)
	assert.Equal(t, 118, second.DurationMS, "0.118s -> 118ms")
	assert.Equal(t, "GLEWF", second.Identifier)
	assert.Equal(t, "AR System Administration: Client Type Configuration Setting", second.Form)

	fourth := data.TopAPICalls[3]
	assert.Equal(t, 4, fourth.Rank)
	assert.Equal(t, 15, fourth.DurationMS, "0.015s -> 15ms")
	assert.False(t, fourth.Success, "false should map to Success=false")
}

// ---------------------------------------------------------------------------
// V4 format: Fixed-width SQL table
// ---------------------------------------------------------------------------

// TestV4_TopSQL_FixedWidth tests parsing of the v4 fixed-width SQL table.
func TestV4_TopSQL_FixedWidth(t *testing.T) {
	output := `preamble
            Total Lines: 16880

###  SECTION: SQL  #####################################################

### 50 LONGEST RUNNING INDIVIDUAL SQL CALLS

    Run Time    Line#                           TrID Queue      Table                                            Start Time Success SQL Statement
------------ -------- ------------------------------ ---------- ------------------------------ ---------------------------- ------- -------------
       0.085    16351 oKNmA5MvSwOxCzBulz9-zQ:0003478 Escalation T4381                          Mon Nov 24 2025 14:47:07.983 true    SELECT T4381.C1 FROM T4381
       0.053    16420 oKNmA5MvSwOxCzBulz9-zQ:0003481 Escalation T4381                          Mon Nov 24 2025 14:47:08.335 true    UPDATE T4381 SET T4381.C536870913 = N'50836'
       0.047     5308 oKNmA5MvSwOxCzBulz9-zQ:0003109 Escalation T4381                          Mon Nov 24 2025 14:47:02.244 true    WITH AR_SQL_Alias$1 AS (SELECT T4381.C1)
`

	result, err := ParseOutput(output)
	require.NoError(t, err)
	data := result.Dashboard

	require.Len(t, data.TopSQL, 3, "should parse 3 SQL rows")

	first := data.TopSQL[0]
	assert.Equal(t, 1, first.Rank, "auto-assigned rank")
	assert.Equal(t, 85, first.DurationMS, "0.085s -> 85ms")
	assert.Equal(t, 16351, first.LineNumber)
	assert.Equal(t, "oKNmA5MvSwOxCzBulz9-zQ:0003478", first.TraceID)
	assert.Equal(t, "Escalation", first.Queue)
	assert.Equal(t, "T4381", first.Form, "Table maps to Form field")
	assert.True(t, first.Success)
	assert.Contains(t, first.Identifier, "SELECT T4381.C1")

	second := data.TopSQL[1]
	assert.Equal(t, 53, second.DurationMS)
	assert.Contains(t, second.Identifier, "UPDATE")
}

// ---------------------------------------------------------------------------
// V4 format: Full realistic output (API + SQL + preamble)
// ---------------------------------------------------------------------------

// TestV4_FullRealisticOutput tests a multi-section v4 output with preamble,
// API, and SQL sections to verify end-to-end parsing.
func TestV4_FullRealisticOutput(t *testing.T) {
	output := `AR System Log Analyzer, version 4.0.0 (for AR server logs versions 25.3.x+).
Build: 250711.01
( Copyright 1997-2025 BMC Helix Inc.)
ARLogAnalyzer "error_logs/log1.log"
No Locale specified, using EN

Total Log size: 0.00 GB
Max Heap Allocated: 4.1 GB

Loading specified files
Language Found: English
Processing Transactions

             Start Time: Mon Nov 24 2025 14:46:58.505
               End Time: Mon Nov 24 2025 14:47:08.667
           Elapsed Time: 10.162
            Total Lines: 16880
              API Count: 251
              SQL Count: 7307
              ESC Count: 6260
             Form Count: 32
            Table Count: 60
             User Count: 8

###  SECTION: GAP ANALYSIS  #####################################################

### 50 LONGEST LINE GAPS

    Line Gap    Line#                           TrID                    Date/Time                        Details
------------ -------- ------------------------------ ---------------------------- ------------------------------
       0.265        0 oKNmA5MvSwOxCzBulz9-zQ:0003436 Mon Nov 24 2025 14:47:07.436              BEGIN TRANSACTION
       0.191        0 oKNmA5MvSwOxCzBulz9-zQ:0002980 Mon Nov 24 2025 14:47:00.268              BEGIN TRANSACTION

###  SECTION: API  #####################################################

### API Call Abbreviation Legend

   CE = ARCreateEntry
   GE = ARGetEntry
   SE = ARSetEntry

### 50 LONGEST RUNNING INDIVIDUAL API CALLS

    Run Time First Line# Last Line#                           TrID Queue      API        Form                                                                          Start Time    Q Time Success
------------ ----------- ---------- ------------------------------ ---------- ---------- ----------------------------------------------------------- ---------------------------- --------- -------
       0.122        8620      10031 ppvN52iaQZmnf3QKV41xnA:0009991 Prv:390680 SE         SRM:RequestApDetailSignature                                Mon Nov 24 2025 14:47:03.770     0.000 true
       0.118       16421      16434 uNFzUimrQvidJDExR4_0dQ:0000458 List       GLEWF      AR System Administration: Client Type Configuration Setting Mon Nov 24 2025 14:47:08.347     0.000 true
       0.061        7922       8344 ppvN52iaQZmnf3QKV41xnA:0009973 Prv:390680 CE         AP:Signature                                                Mon Nov 24 2025 14:47:03.615     0.000 true

### 50 LONGEST QUEUED INDIVIDUAL API CALLS

No Queued API's

###  SECTION: SQL  #####################################################

### 50 LONGEST RUNNING INDIVIDUAL SQL CALLS

    Run Time    Line#                           TrID Queue      Table                                            Start Time Success SQL Statement
------------ -------- ------------------------------ ---------- ------------------------------ ---------------------------- ------- -------------
       0.085    16351 oKNmA5MvSwOxCzBulz9-zQ:0003478 Escalation T4381                          Mon Nov 24 2025 14:47:07.983 true    SELECT T4381.C1 FROM T4381
       0.053    16420 oKNmA5MvSwOxCzBulz9-zQ:0003481 Escalation T4381                          Mon Nov 24 2025 14:47:08.335 true    UPDATE T4381 SET foo = bar
`

	result, err := ParseOutput(output)
	require.NoError(t, err)
	data := result.Dashboard

	// General stats from preamble.
	assert.Equal(t, int64(16880), data.GeneralStats.TotalLines)
	assert.Equal(t, int64(251), data.GeneralStats.APICount)
	assert.Equal(t, int64(7307), data.GeneralStats.SQLCount)
	assert.Equal(t, int64(6260), data.GeneralStats.EscCount)
	assert.Equal(t, 32, data.GeneralStats.UniqueForms)
	assert.Equal(t, 60, data.GeneralStats.UniqueTables)
	assert.Equal(t, 8, data.GeneralStats.UniqueUsers)
	assert.False(t, data.GeneralStats.LogStart.IsZero())
	assert.False(t, data.GeneralStats.LogEnd.IsZero())
	assert.Equal(t, "10.162", data.GeneralStats.LogDuration)

	// API calls.
	require.Len(t, data.TopAPICalls, 3)
	assert.Equal(t, 122, data.TopAPICalls[0].DurationMS)
	assert.Equal(t, "SE", data.TopAPICalls[0].Identifier)
	assert.Equal(t, "SRM:RequestApDetailSignature", data.TopAPICalls[0].Form)

	// SQL calls.
	require.Len(t, data.TopSQL, 2)
	assert.Equal(t, 85, data.TopSQL[0].DurationMS)
	assert.Equal(t, "T4381", data.TopSQL[0].Form)
	assert.Contains(t, data.TopSQL[0].Identifier, "SELECT")
}

// ---------------------------------------------------------------------------
// V4 format: parseFloatSecondsToMS
// ---------------------------------------------------------------------------

func TestParseFloatSecondsToMS(t *testing.T) {
	tests := []struct {
		input string
		want  int
	}{
		{"0.122", 122},
		{"0.000", 0},
		{"1.500", 1500},
		{"0.001", 1},
		{"10.162", 10162},
		{"0.0005", 1},   // Rounds up.
		{"garbage", 0},
		{"", 0},
	}
	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			assert.Equal(t, tt.want, parseFloatSecondsToMS(tt.input))
		})
	}
}

// ---------------------------------------------------------------------------
// V4 format: isDashSeparator
// ---------------------------------------------------------------------------

func TestIsDashSeparator(t *testing.T) {
	assert.True(t, isDashSeparator("------------ ----------- ----------"))
	assert.True(t, isDashSeparator("------------ -------- ------------------------------ ----------"))
	assert.True(t, isDashSeparator("   --------   "))
	assert.False(t, isDashSeparator(""))
	assert.False(t, isDashSeparator("   "))
	assert.False(t, isDashSeparator("Run Time    Line#"))
	assert.False(t, isDashSeparator("0.085    16351"))
}

// ---------------------------------------------------------------------------
// V4 format: extractColumnBoundaries
// ---------------------------------------------------------------------------

func TestExtractColumnBoundaries(t *testing.T) {
	sepLine := "------------ ----------- ---------- ------------------------------ ----------"
	bounds := extractColumnBoundaries(sepLine)
	require.Len(t, bounds, 5)

	// First column: 0-12
	assert.Equal(t, 0, bounds[0][0])
	assert.Equal(t, 12, bounds[0][1])

	// Second column: 13-24
	assert.Equal(t, 13, bounds[1][0])
	assert.Equal(t, 24, bounds[1][1])
}

// ---------------------------------------------------------------------------
// V4 format: Column extraction
// ---------------------------------------------------------------------------

func TestExtractColumnValues(t *testing.T) {
	sepLine := "------------ ----------- ----------"
	bounds := extractColumnBoundaries(sepLine)

	dataLine := "       0.122        8620      10031"
	values := extractColumnValues(dataLine, bounds)
	require.Len(t, values, 3)
	assert.Equal(t, "0.122", values[0])
	assert.Equal(t, "8620", values[1])
	assert.Equal(t, "10031", values[2])
}

// ---------------------------------------------------------------------------
// V4+V3 backward compatibility
// ---------------------------------------------------------------------------

// TestBackwardCompatibility_V3SectionsStillWork verifies that v3 format
// (=== headers, pipe tables) still works after the v4 parser additions.
func TestBackwardCompatibility_V3SectionsStillWork(t *testing.T) {
	output := `=== General Statistics ===
Total Lines Processed:  50000
API Calls:              30000
SQL Operations:         15000
Unique Users:           10

=== Top API Calls ===
| Rank | Identifier | Duration(ms) | Status |
|------|------------|--------------|--------|
| 1    | GET_ENTRY  | 5000         | OK     |
| 2    | SET_ENTRY  | 3000         | OK     |

=== Thread Distribution ===
T001:  25000
T002:  15000
`

	result, err := ParseOutput(output)
	require.NoError(t, err)
	data := result.Dashboard

	assert.Equal(t, int64(50000), data.GeneralStats.TotalLines)
	assert.Equal(t, int64(30000), data.GeneralStats.APICount)
	assert.Equal(t, 10, data.GeneralStats.UniqueUsers)

	require.Len(t, data.TopAPICalls, 2)
	assert.Equal(t, "GET_ENTRY", data.TopAPICalls[0].Identifier)
	assert.Equal(t, 5000, data.TopAPICalls[0].DurationMS)

	assert.Equal(t, 25000, data.Distribution["threads"]["T001"])
}

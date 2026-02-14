package jar

import (
	"strings"
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

// ---------------------------------------------------------------------------
// Filter parser tests (T042-T045)
// ---------------------------------------------------------------------------

// TestParseMostExecutedFilters verifies parsing of the "MOST EXECUTED FILTERS" table
// including truncated filter names with backtick-exclamation markers.
func TestParseMostExecutedFilters(t *testing.T) {
	input := `Filter                                                  Pass Count Fail Count
------------------------------------------------------- ---------- ----------
AP:Detail - SetFlagStatus                                        0          6
SRM:REQ:NotifyApprover_899_ParseApprovers-NEW-GT1                3          0
SHR:SHR:Social_SkipSmartitInstalled                              3          0
SRM:REQ:NotifyApprover_899_ParseApprovers-SendNotific` + "`" + `!          3          0
INT:SOCAPR:ParseApproverInfo_Init                                0          1
CST:UP:Approval:Approval:getSRDname` + "`" + `!                            1          0`

	lines := strings.Split(input, "\n")
	entries := parseMostExecutedFilters(lines)

	require.Len(t, entries, 6, "should parse 6 filter entries")

	// First entry.
	assert.Equal(t, "AP:Detail - SetFlagStatus", entries[0].FilterName)
	assert.Equal(t, 0, entries[0].PassCount)
	assert.Equal(t, 6, entries[0].FailCount)

	// Fourth entry: truncated name with backtick-exclamation.
	assert.Contains(t, entries[3].FilterName, "SendNotific`!")

	// Fifth entry.
	assert.Equal(t, 0, entries[4].PassCount)
	assert.Equal(t, 1, entries[4].FailCount)

	// Sixth entry.
	assert.Equal(t, "CST:UP:Approval:Approval:getSRDname`!", entries[5].FilterName)
	assert.Equal(t, 1, entries[5].PassCount)
}

// TestParseFilterPerTransaction verifies parsing of "50 MOST FILTERS PER TRANSACTION"
// including NaN filters/sec being converted to 0.
func TestParseFilterPerTransaction(t *testing.T) {
	input := `   Line#                           TrID Filter Count Operation Form                                         Request ID                                      Filters/sec
-------- ------------------------------ ------------ --------- -------------------------------------------- ----------------------------------------------- -----------
    8622 ppvN52iaQZmnf3QKV41xnA:0009991          251 SET       SRM:RequestApDetailSignature                 000000000149179|000000000081466|000000000083473        0.45
    6017 nZ0UaxoDR9eTQGaKLpHwgQ:0000001           64 SET       SRM:Request                                  <NULL                                                  0.16
   14600 oKNmA5MvSwOxCzBulz9-zQ:0003400            0 SET       CITC:DWPC-Survey                             000000000006355                                         NaN`

	lines := strings.Split(input, "\n")
	entries := parseFilterPerTransaction(lines)

	require.Len(t, entries, 3, "should parse 3 entries")

	// First entry.
	assert.Equal(t, 8622, entries[0].LineNumber)
	assert.Equal(t, 251, entries[0].FilterCount)
	assert.Equal(t, "SET", entries[0].Operation)
	assert.Equal(t, "SRM:RequestApDetailSignature", entries[0].Form)
	assert.Equal(t, 0.45, entries[0].FiltersPerSec)

	// Second entry.
	assert.Equal(t, 64, entries[1].FilterCount)
	assert.Equal(t, "<NULL", entries[1].RequestID)

	// Third entry: NaN becomes 0.
	assert.Equal(t, 0, entries[2].FilterCount)
	assert.Equal(t, float64(0), entries[2].FiltersPerSec, "NaN should be converted to 0")
}

// TestParseFilterExecutedPerTxn verifies parsing of "50 MOST EXECUTED FLTR PER TRANSACTION"
// section with line numbers, filter names, and pass/fail counts.
func TestParseFilterExecutedPerTxn(t *testing.T) {
	input := `   Line#                           TrID Filter                                                  Pass Count Fail Count
-------- ------------------------------ ------------------------------------------------------- ---------- ----------
    8622 ppvN52iaQZmnf3QKV41xnA:0009991 SRM:REQ:NotifyApprover_899_ParseApprovers-NEW-GT1                3          0
    8622 ppvN52iaQZmnf3QKV41xnA:0009991 SHR:SHR:Social_SkipSmartitInstalled                              3          0
    7575 ppvN52iaQZmnf3QKV41xnA:0009951 AP:Detail - SetFlagStatus                                        0          1`

	lines := strings.Split(input, "\n")
	entries := parseFilterExecutedPerTxn(lines)

	require.Len(t, entries, 3, "should parse 3 entries")

	// First entry.
	assert.Equal(t, 8622, entries[0].LineNumber)
	assert.Equal(t, "SRM:REQ:NotifyApprover_899_ParseApprovers-NEW-GT1", entries[0].FilterName)
	assert.Equal(t, 3, entries[0].PassCount)
	assert.Equal(t, 0, entries[0].FailCount)

	// Third entry.
	assert.Equal(t, "AP:Detail - SetFlagStatus", entries[2].FilterName)
	assert.Equal(t, 0, entries[2].PassCount)
	assert.Equal(t, 1, entries[2].FailCount)
}

// TestParseFilterLevels verifies parsing of "50 MOST FILTER LEVELS IN TRANSACTIONS"
// section with filter levels, operations, and forms.
func TestParseFilterLevels(t *testing.T) {
	input := `   Line#                           TrID Filter Level Operation Form                                         Request ID
-------- ------------------------------ ------------ --------- -------------------------------------------- -----------------------------------------------
    8622 ppvN52iaQZmnf3QKV41xnA:0009991            2 SET       SRM:RequestApDetailSignature                 000000000149179|000000000081466|000000000083473
    7927 ppvN52iaQZmnf3QKV41xnA:0009973            1 CREATE    AP:Signature                                 <NULL
    6017 nZ0UaxoDR9eTQGaKLpHwgQ:0000001            0 SET       SRM:Request                                  <NULL                                          `

	lines := strings.Split(input, "\n")
	entries := parseFilterLevels(lines)

	require.Len(t, entries, 3, "should parse 3 entries")

	// First entry.
	assert.Equal(t, 8622, entries[0].LineNumber)
	assert.Equal(t, 2, entries[0].FilterLevel)
	assert.Equal(t, "SET", entries[0].Operation)
	assert.Equal(t, "SRM:RequestApDetailSignature", entries[0].Form)

	// Second entry.
	assert.Equal(t, 1, entries[1].FilterLevel)
	assert.Equal(t, "CREATE", entries[1].Operation)

	// Third entry.
	assert.Equal(t, 0, entries[2].FilterLevel)
}

// ---------------------------------------------------------------------------
// T023: parseGroupedAggregateTable — API by Form
// ---------------------------------------------------------------------------

func TestParseAggregateTable_APIByForm(t *testing.T) {
	input := `
Form                                                        API            OK   Fail  Total     MIN Time MIN Line     MAX Time MAX Line     AVG Time     SUM Time
----------------------------------------------------------- ---------- ------ ------ ------ ------------ -------- ------------ -------- ------------ ------------
SRM:RequestApDetailSignature                                SE              1             1        0.122     8620        0.122     8620        0.122        0.122
                                                            GS              1             1        0.000     8594        0.000     8594        0.000        0.000
                                                                       ------ ------ ------                                                          ------------
                                                                            2             2                                                                 0.122

AP:Signature                                                CE              1             1        0.061     7922        0.061     7922        0.061        0.061
                                                            GLEWF           2             2        0.003     7714        0.021    10116        0.012        0.024
                                                            GE              1             1        0.003     8367        0.003     8367        0.003        0.003
                                                            GLE             1             1        0.002     7733        0.002     7733        0.002        0.002
                                                            GSF             4             4        0.002     7644        0.002     7644        0.002        0.008
                                                                       ------ ------ ------                                                          ------------
                                                                            9             9                                                                 0.098

                                                                       ====== ====== ======                                                          ============
                                                                           11            11                                                                 0.220
`
	lines := strings.Split(input, "\n")
	table := parseGroupedAggregateTable(lines)
	require.NotNil(t, table, "parseGroupedAggregateTable should return a non-nil table")

	// GroupedBy should reflect the first header column.
	assert.Contains(t, table.GroupedBy, "Form")

	// 2 groups: SRM:RequestApDetailSignature, AP:Signature
	require.Len(t, table.Groups, 2, "should have 2 groups")

	// --- Group 0: SRM:RequestApDetailSignature ---
	g0 := table.Groups[0]
	assert.Equal(t, "SRM:RequestApDetailSignature", g0.EntityName)
	require.Len(t, g0.Rows, 2, "SRM:RequestApDetailSignature should have 2 rows")
	assert.Equal(t, "SE", g0.Rows[0].OperationType)
	assert.Equal(t, "GS", g0.Rows[1].OperationType)
	require.NotNil(t, g0.Subtotal)
	assert.Equal(t, 2, g0.Subtotal.Total)
	assert.InDelta(t, 0.122, g0.Subtotal.SumTime, 0.001)

	// --- Group 1: AP:Signature ---
	g1 := table.Groups[1]
	assert.Equal(t, "AP:Signature", g1.EntityName)
	require.Len(t, g1.Rows, 5, "AP:Signature should have 5 rows")
	assert.Equal(t, "CE", g1.Rows[0].OperationType)
	assert.Equal(t, "GLEWF", g1.Rows[1].OperationType)
	assert.Equal(t, "GE", g1.Rows[2].OperationType)
	assert.Equal(t, "GLE", g1.Rows[3].OperationType)
	assert.Equal(t, "GSF", g1.Rows[4].OperationType)
	require.NotNil(t, g1.Subtotal)
	assert.Equal(t, 9, g1.Subtotal.Total)
	assert.InDelta(t, 0.098, g1.Subtotal.SumTime, 0.001)

	// --- Grand total ---
	require.NotNil(t, table.GrandTotal, "grand total should be present")
	assert.Equal(t, 11, table.GrandTotal.Total)
	assert.InDelta(t, 0.220, table.GrandTotal.SumTime, 0.001)
}

// ---------------------------------------------------------------------------
// T024: parseGroupedAggregateTable — SQL by Table
// ---------------------------------------------------------------------------

func TestParseAggregateTable_SQLByTable(t *testing.T) {
	input := `
Table                 SQL        OK   Fail  Total     MIN Time MIN Line     MAX Time MAX Line     AVG Time     SUM Time
--------------------- ------ ------ ------ ------ ------------ -------- ------------ -------- ------------ ------------
T18                   INSERT      1             1        0.031    16693        0.031    16693        0.031        0.031
                             ------ ------ ------                                                          ------------
                                  1             1                                                                 0.031

T4382                 SELECT      6             6        0.018      741        0.039    12363        0.030        0.178
                             ------ ------ ------                                                          ------------
                                  6             6                                                                 0.178

T384                  SELECT      2             2        0.000     7340        0.033     7279        0.017        0.033
                      INSERT      1             1        0.001     7352        0.001     7352        0.001        0.001
                             ------ ------ ------                                                          ------------
                                  3             3                                                                 0.034

                             ====== ====== ======                                                          ============
                               10            10                                                                 0.243
`
	lines := strings.Split(input, "\n")
	table := parseGroupedAggregateTable(lines)
	require.NotNil(t, table)

	// 3 groups: T18, T4382, T384
	require.Len(t, table.Groups, 3, "should have 3 groups")

	assert.Equal(t, "T18", table.Groups[0].EntityName)
	require.Len(t, table.Groups[0].Rows, 1)
	assert.Equal(t, "INSERT", table.Groups[0].Rows[0].OperationType)

	assert.Equal(t, "T4382", table.Groups[1].EntityName)
	require.Len(t, table.Groups[1].Rows, 1)
	assert.Equal(t, "SELECT", table.Groups[1].Rows[0].OperationType)
	assert.Equal(t, 6, table.Groups[1].Rows[0].OK)

	assert.Equal(t, "T384", table.Groups[2].EntityName)
	require.Len(t, table.Groups[2].Rows, 2, "T384 should have 2 rows (SELECT, INSERT)")
	assert.Equal(t, "SELECT", table.Groups[2].Rows[0].OperationType)
	assert.Equal(t, "INSERT", table.Groups[2].Rows[1].OperationType)
	require.NotNil(t, table.Groups[2].Subtotal)
	assert.Equal(t, 3, table.Groups[2].Subtotal.Total)

	// Grand total
	require.NotNil(t, table.GrandTotal)
	assert.Equal(t, 10, table.GrandTotal.Total)
}

// ---------------------------------------------------------------------------
// T025: parseGroupedAggregateTable — Escalation by Pool
// ---------------------------------------------------------------------------

func TestParseAggregateTable_EscByPool(t *testing.T) {
	input := `
Pool Escalation             Count     MIN Time MIN Line     MAX Time MAX Line     AVG Time     SUM Time
---- --------------------- ------ ------------ -------- ------------ -------- ------------ ------------
   6 INTG:SMS-POOL_CALLAPI      1        0.003    12327        0.003    12327        0.003        0.003
                           ------                                                          ------------
                                1                                                                 0.003

                           ======                                                          ============
                                1                                                                 0.003
`
	lines := strings.Split(input, "\n")
	table := parseGroupedAggregateTable(lines)
	require.NotNil(t, table)

	// 1 group with entity "6"
	require.Len(t, table.Groups, 1, "should have 1 group")
	assert.Equal(t, "6", table.Groups[0].EntityName)
	require.Len(t, table.Groups[0].Rows, 1)
	assert.Equal(t, "INTG:SMS-POOL_CALLAPI", table.Groups[0].Rows[0].OperationType)
	assert.Equal(t, 1, table.Groups[0].Rows[0].Total)

	// Grand total
	require.NotNil(t, table.GrandTotal)
	assert.Equal(t, 1, table.GrandTotal.Total)
}

// ---------------------------------------------------------------------------
// T029: parseGapEntries — Line Gaps
// ---------------------------------------------------------------------------

func TestParseGapEntries_LineGaps(t *testing.T) {
	input := `
    Line Gap    Line#                           TrID                    Date/Time                        Details
------------ -------- ------------------------------ ---------------------------- ------------------------------
       0.265        0 oKNmA5MvSwOxCzBulz9-zQ:0003436 Mon Nov 24 2025 14:47:07.436              BEGIN TRANSACTION
       0.191        0 oKNmA5MvSwOxCzBulz9-zQ:0002980 Mon Nov 24 2025 14:47:00.268              BEGIN TRANSACTION
       0.085        0 oKNmA5MvSwOxCzBulz9-zQ:0003478 Mon Nov 24 2025 14:47:08.068                             OK
`
	lines := strings.Split(input, "\n")
	entries := parseGapEntries(lines)
	require.Len(t, entries, 3, "should parse 3 gap entries")

	// First entry
	assert.InDelta(t, 0.265, entries[0].GapDuration, 0.001)
	assert.Equal(t, 0, entries[0].LineNumber)
	assert.Equal(t, "oKNmA5MvSwOxCzBulz9-zQ:0003436", entries[0].TraceID)
	assert.Contains(t, entries[0].Details, "BEGIN TRANSACTION")

	// Second entry
	assert.InDelta(t, 0.191, entries[1].GapDuration, 0.001)

	// Third entry
	assert.Contains(t, entries[2].Details, "OK")
}

// ---------------------------------------------------------------------------
// T030: parseGapEntries — Thread Gaps
// ---------------------------------------------------------------------------

func TestParseGapEntries_ThreadGaps(t *testing.T) {
	input := `
  Thread Gap    Line#                           TrID                    Date/Time                        Details
------------ -------- ------------------------------ ---------------------------- ------------------------------
       0.075    16425 uNFzUimrQvidJDExR4_0dQ:0000458 Mon Nov 24 2025 14:47:08.422 WITH AR_SQL_Alias$1 AS (SELECT T338...)
       0.024        0 uNFzUimrQvidJDExR4_0dQ:0000458 Mon Nov 24 2025 14:47:08.465           -GLEWF            OK
`
	lines := strings.Split(input, "\n")
	entries := parseGapEntries(lines)
	require.Len(t, entries, 2, "should parse 2 thread gap entries")

	// First entry has LineNumber=16425 and long SQL in Details.
	assert.Equal(t, 16425, entries[0].LineNumber)
	assert.InDelta(t, 0.075, entries[0].GapDuration, 0.001)
	assert.Contains(t, entries[0].Details, "SELECT T338")

	// Second entry
	assert.InDelta(t, 0.024, entries[1].GapDuration, 0.001)
}

// ---------------------------------------------------------------------------
// T031: parseThreadStatsTable — API (with QCount/QTime columns)
// ---------------------------------------------------------------------------

func TestParseThreadStats_API(t *testing.T) {
	input := `
Queue          Thread            First Thread Time             Last Thread Time  Count Q Count    Q Time   Total Time   Busy%
---------- ---------- ---------------------------- ---------------------------- ------ ------- --------- ------------ -------
AssignEng  0000000365 Mon Nov 24 2025 14:47:02.798 Mon Nov 24 2025 14:47:02.835      5                          0.034   0.33%
Fast       0000000314 Mon Nov 24 2025 14:47:07.005 Mon Nov 24 2025 14:47:07.007      1                          0.002   0.02%
           0000000316 Mon Nov 24 2025 14:47:06.695 Mon Nov 24 2025 14:47:06.697      1                          0.002   0.02%
Prv:390680 0000000356 Mon Nov 24 2025 14:47:03.376 Mon Nov 24 2025 14:47:03.937     39                          0.137   1.35%
           0000000357 Mon Nov 24 2025 14:47:03.373 Mon Nov 24 2025 14:47:03.959     40                          0.404   3.98%
`
	lines := strings.Split(input, "\n")
	entries := parseThreadStatsTable(lines)
	require.Len(t, entries, 5, "should parse 5 thread stat entries")

	// First: Queue="AssignEng", ThreadID="0000000365", Count=5
	assert.Equal(t, "AssignEng", entries[0].Queue)
	assert.Equal(t, "0000000365", entries[0].ThreadID)
	assert.Equal(t, 5, entries[0].Count)
	assert.InDelta(t, 0.034, entries[0].TotalTime, 0.001)
	assert.InDelta(t, 0.33, entries[0].BusyPct, 0.01)

	// Queue propagation: 0000000316 should inherit Queue="Fast" from 0000000314.
	assert.Equal(t, "Fast", entries[1].Queue)
	assert.Equal(t, "0000000314", entries[1].ThreadID)
	assert.Equal(t, "Fast", entries[2].Queue)
	assert.Equal(t, "0000000316", entries[2].ThreadID)

	// Prv:390680 entries.
	assert.Equal(t, "Prv:390680", entries[3].Queue)
	assert.Equal(t, "0000000356", entries[3].ThreadID)
	assert.Equal(t, 39, entries[3].Count)

	assert.Equal(t, "Prv:390680", entries[4].Queue)
	assert.Equal(t, "0000000357", entries[4].ThreadID)
	assert.Equal(t, 40, entries[4].Count)
	assert.InDelta(t, 3.98, entries[4].BusyPct, 0.01)
}

// ---------------------------------------------------------------------------
// T032: parseThreadStatsTable — SQL (no QCount/QTime)
// ---------------------------------------------------------------------------

func TestParseThreadStats_SQL(t *testing.T) {
	input := `
Queue          Thread            First Thread Time             Last Thread Time  Count   Total Time   Busy%
---------- ---------- ---------------------------- ---------------------------- ------ ------------ -------
AssignEng  0000000365 Mon Nov 24 2025 14:47:02.801 Mon Nov 24 2025 14:47:02.832      8        0.007   0.07%
Escalation 0000000532 Mon Nov 24 2025 14:46:58.509 Mon Nov 24 2025 14:47:08.645   1881        6.169  60.71%
           0000003876 Mon Nov 24 2025 14:47:05.440 Mon Nov 24 2025 14:47:05.442      1        0.002   0.02%
`
	lines := strings.Split(input, "\n")
	entries := parseThreadStatsTable(lines)
	require.Len(t, entries, 3, "should parse 3 SQL thread stat entries")

	// Escalation thread with heavy usage.
	assert.Equal(t, "Escalation", entries[1].Queue)
	assert.Equal(t, "0000000532", entries[1].ThreadID)
	assert.Equal(t, 1881, entries[1].Count)
	assert.InDelta(t, 6.169, entries[1].TotalTime, 0.001)
	assert.InDelta(t, 60.71, entries[1].BusyPct, 0.01)

	// Queue propagation: 0000003876 inherits "Escalation".
	assert.Equal(t, "Escalation", entries[2].Queue)
	assert.Equal(t, "0000003876", entries[2].ThreadID)
}

// ---------------------------------------------------------------------------
// T037: parseAPIErrors
// ---------------------------------------------------------------------------

func TestParseAPIErrors(t *testing.T) {
	input := `
End Line#                           TrID Queue      API        Form        User                                         Start Time Error Message
--------- ------------------------------ ---------- ---------- ----------- -------------------------- ---------------------------- -------------
     6211 nZ0UaxoDR9eTQGaKLpHwgQ:0000001 AssignEng  SE         SRM:Request Remedy Application Service Mon Nov 24 2025 14:47:02.814 -SE      FAIL -- AR Error(45386) null : Required field (without a default) not specified :  Category 1*
`
	lines := strings.Split(input, "\n")
	entries := parseAPIErrors(lines)
	require.Len(t, entries, 1, "should parse 1 API error entry")

	e := entries[0]
	assert.Equal(t, 6211, e.EndLine)
	assert.Equal(t, "nZ0UaxoDR9eTQGaKLpHwgQ:0000001", e.TraceID)
	assert.Equal(t, "AssignEng", e.Queue)
	assert.Equal(t, "SE", e.API)
	assert.Equal(t, "SRM:Request", e.Form)
	assert.Equal(t, "Remedy Application Service", e.User)
	assert.Contains(t, e.ErrorMessage, "AR Error(45386)")
}

// ---------------------------------------------------------------------------
// T038: parseExceptionReport — API exceptions
// ---------------------------------------------------------------------------

func TestParseExceptionReport_API(t *testing.T) {
	input := `
   Line#                           TrID Type                                             Message
-------- ------------------------------ ---- ---------------------------------------------------
   16447 SsjZsHC9R4a1jxb56Qmy0A:0000315  SGE WARNING: Start of API call has no corresponding end
   16448 SsjZsHC9R4a1jxb56Qmy0A:0000316   SE WARNING: Start of API call has no corresponding end
   16589 SsjZsHC9R4a1jxb56Qmy0A:0000316  SSI WARNING: Start of API call has no corresponding end
`
	lines := strings.Split(input, "\n")
	entries := parseExceptionReport(lines)
	require.Len(t, entries, 3, "should parse 3 API exception entries")

	// First entry.
	assert.Equal(t, 16447, entries[0].LineNumber)
	assert.Equal(t, "SsjZsHC9R4a1jxb56Qmy0A:0000315", entries[0].TraceID)
	assert.Equal(t, "SGE", entries[0].Type)
	assert.Contains(t, entries[0].Message, "WARNING")

	// Second entry.
	assert.Equal(t, 16448, entries[1].LineNumber)
	assert.Equal(t, "SsjZsHC9R4a1jxb56Qmy0A:0000316", entries[1].TraceID)
	assert.Equal(t, "SE", entries[1].Type)

	// Third entry.
	assert.Equal(t, 16589, entries[2].LineNumber)
	assert.Equal(t, "SSI", entries[2].Type)
}

// ---------------------------------------------------------------------------
// T039: parseExceptionReport — SQL exceptions
// ---------------------------------------------------------------------------

func TestParseExceptionReport_SQL(t *testing.T) {
	input := `
   Line#                           TrID                 Message                                                    SQL Statement
-------- ------------------------------ ----------------------- ----------------------------------------------------------------
   16992 oKNmA5MvSwOxCzBulz9-zQ:0003493 WARNING: Start of SQL call has no corresponding end SELECT T4381.C1 FROM T4381 WHERE (T4381.C1 = N'000000000003768')
`
	lines := strings.Split(input, "\n")
	entries := parseExceptionReport(lines)
	require.Len(t, entries, 1, "should parse 1 SQL exception entry")

	e := entries[0]
	assert.Equal(t, 16992, e.LineNumber)
	assert.Equal(t, "oKNmA5MvSwOxCzBulz9-zQ:0003493", e.TraceID)
	assert.Contains(t, e.Message, "WARNING")
	assert.Contains(t, e.SQLStatement, "SELECT T4381")
}

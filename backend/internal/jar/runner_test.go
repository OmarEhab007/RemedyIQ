package jar

import (
	"context"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/OmarEhab007/RemedyIQ/backend/internal/domain"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ---------------------------------------------------------------------------
// BuildArgs tests (config.go)
// ---------------------------------------------------------------------------

func TestBuildArgs_Empty(t *testing.T) {
	args := BuildArgs(domain.JARFlags{}, "/tmp/logfile.log")
	assert.Equal(t, []string{"/tmp/logfile.log"}, args,
		"empty flags should produce only the file path")
}

func TestBuildArgs_AllFlags(t *testing.T) {
	flags := domain.JARFlags{
		TopN:         25,
		GroupBy:      []string{"user", "form"},
		SortBy:       "duration",
		UserFilter:   "Demo",
		ExcludeUsers: []string{"ARSystem", "FilterAPI"},
		BeginTime:    "2026-02-03 10:00:00",
		EndTime:      "2026-02-03 18:00:00",
		Locale:       "en_US",
		DateFormat:   "yyyy-MM-dd HH:mm:ss",
		SkipAPI:      true,
		SkipSQL:      true,
		SkipEsc:      true,
		SkipFltr:     true,
		IncludeFTS:   true,
	}

	args := BuildArgs(flags, "/data/arapi.log")

	// Verify all expected flags are present.
	assert.Contains(t, args, "-n")
	assert.Contains(t, args, "25")
	assert.Contains(t, args, "-g")
	assert.Contains(t, args, "-s")
	assert.Contains(t, args, "duration")
	assert.Contains(t, args, "-u")
	assert.Contains(t, args, "Demo")
	assert.Contains(t, args, "-xu")
	assert.Contains(t, args, "ARSystem")
	assert.Contains(t, args, "FilterAPI")
	assert.Contains(t, args, "-b")
	assert.Contains(t, args, "2026-02-03 10:00:00")
	assert.Contains(t, args, "-e")
	assert.Contains(t, args, "2026-02-03 18:00:00")
	assert.Contains(t, args, "-l")
	assert.Contains(t, args, "en_US")
	assert.Contains(t, args, "-ldf")
	assert.Contains(t, args, "yyyy-MM-dd HH:mm:ss")
	assert.Contains(t, args, "-noapi")
	assert.Contains(t, args, "-nosql")
	assert.Contains(t, args, "-noesc")
	assert.Contains(t, args, "-nofltr")
	assert.Contains(t, args, "-fts")

	// File path is always last.
	assert.Equal(t, "/data/arapi.log", args[len(args)-1])
}

func TestBuildArgs_PartialFlags(t *testing.T) {
	flags := domain.JARFlags{
		TopN:     50,
		SkipFltr: true,
	}

	args := BuildArgs(flags, "/tmp/test.log")

	assert.Contains(t, args, "-n")
	assert.Contains(t, args, "50")
	assert.Contains(t, args, "-nofltr")
	assert.NotContains(t, args, "-noapi")
	assert.NotContains(t, args, "-nosql")
	assert.NotContains(t, args, "-noesc")
	assert.NotContains(t, args, "-fts")
	assert.Equal(t, "/tmp/test.log", args[len(args)-1])
}

func TestBuildArgs_GroupByOrder(t *testing.T) {
	flags := domain.JARFlags{
		GroupBy: []string{"user", "form", "thread"},
	}
	args := BuildArgs(flags, "/tmp/x.log")

	// Each group-by value should be preceded by -g.
	expected := []string{"-g", "user", "-g", "form", "-g", "thread", "/tmp/x.log"}
	assert.Equal(t, expected, args)
}

func TestBuildArgs_TrimsWhitespace(t *testing.T) {
	flags := domain.JARFlags{
		GroupBy:      []string{"  user  ", " ", ""},
		ExcludeUsers: []string{"  Admin  ", "", " "},
	}
	args := BuildArgs(flags, "/tmp/x.log")

	// Empty / whitespace-only entries should be skipped.
	gCount := 0
	xuCount := 0
	for _, a := range args {
		if a == "-g" {
			gCount++
		}
		if a == "-xu" {
			xuCount++
		}
	}
	assert.Equal(t, 1, gCount, "only non-empty GroupBy values produce -g flags")
	assert.Equal(t, 1, xuCount, "only non-empty ExcludeUsers values produce -xu flags")
}

// ---------------------------------------------------------------------------
// Runner tests (runner.go)
// ---------------------------------------------------------------------------

func TestNewRunner_Defaults(t *testing.T) {
	r := NewRunner("/path/to/jar", 0, 0)
	assert.Equal(t, "/path/to/jar", r.jarPath)
	assert.Equal(t, 4096, r.defaultHeapMB, "should fall back to 4096 MB")
	assert.Equal(t, 1800, r.defaultTimeoutSec, "should fall back to 1800 seconds")
}

func TestNewRunner_CustomValues(t *testing.T) {
	r := NewRunner("/opt/analyzer.jar", 8192, 3600)
	assert.Equal(t, 8192, r.defaultHeapMB)
	assert.Equal(t, 3600, r.defaultTimeoutSec)
}

func TestRunner_Run_CapturesStdout(t *testing.T) {
	r := NewRunner("/unused.jar", 1024, 30)
	r.SetJavaCmd("echo")

	ctx := context.Background()
	result, err := r.Run(ctx, "/tmp/test.log", domain.JARFlags{}, 0, nil)

	require.NoError(t, err)
	assert.Equal(t, 0, result.ExitCode)
	assert.Contains(t, result.Stdout, "/tmp/test.log",
		"stdout should contain the file path argument passed to echo")
	assert.True(t, result.Duration > 0, "duration should be positive")
}

func TestRunner_Run_CapturesStdoutWithFlags(t *testing.T) {
	r := NewRunner("/unused.jar", 1024, 30)
	r.SetJavaCmd("echo")

	flags := domain.JARFlags{
		TopN:    10,
		SkipSQL: true,
	}

	ctx := context.Background()
	result, err := r.Run(ctx, "/tmp/test.log", flags, 0, nil)

	require.NoError(t, err)
	assert.Contains(t, result.Stdout, "-n")
	assert.Contains(t, result.Stdout, "10")
	assert.Contains(t, result.Stdout, "-nosql")
}

func TestRunner_Run_StreamsLines(t *testing.T) {
	r := NewRunner("/unused.jar", 1024, 30)
	// Use printf to produce multiple lines.
	r.SetJavaCmd("printf")

	ctx := context.Background()

	var mu sync.Mutex
	var lines []string
	callback := func(line string) {
		mu.Lock()
		defer mu.Unlock()
		lines = append(lines, line)
	}

	// printf receives the format string and arguments. We use a simple
	// multi-line format.
	result, err := r.Run(ctx, "line1\nline2\nline3\n", domain.JARFlags{}, 0, callback)

	require.NoError(t, err)
	assert.Equal(t, 0, result.ExitCode)

	mu.Lock()
	defer mu.Unlock()
	assert.GreaterOrEqual(t, len(lines), 1, "callback should have been invoked at least once")
}

func TestRunner_Run_Timeout(t *testing.T) {
	r := NewRunner("/unused.jar", 1024, 1)
	r.SetJavaCmd("sleep")

	// Set a very short timeout.
	ctx, cancel := context.WithTimeout(context.Background(), 200*time.Millisecond)
	defer cancel()

	result, err := r.Run(ctx, "60", domain.JARFlags{}, 0, nil)

	require.Error(t, err)
	assert.Contains(t, err.Error(), "timed out")
	// Result should still be populated (partial output).
	assert.NotNil(t, result)
}

func TestRunner_Run_Cancellation(t *testing.T) {
	r := NewRunner("/unused.jar", 1024, 60)
	r.SetJavaCmd("sleep")

	ctx, cancel := context.WithCancel(context.Background())

	// Cancel after a short delay.
	go func() {
		time.Sleep(100 * time.Millisecond)
		cancel()
	}()

	result, err := r.Run(ctx, "60", domain.JARFlags{}, 0, nil)

	require.Error(t, err)
	assert.NotNil(t, result)
}

func TestRunner_Run_NonZeroExit(t *testing.T) {
	r := NewRunner("/unused.jar", 1024, 30)
	// "false" is a Unix command that always exits with code 1.
	r.SetJavaCmd("false")

	ctx := context.Background()
	result, err := r.Run(ctx, "", domain.JARFlags{}, 0, nil)

	require.Error(t, err)
	assert.Contains(t, err.Error(), "non-zero exit code")
	assert.Equal(t, 1, result.ExitCode)
}

func TestRunner_Run_CapturesStderr(t *testing.T) {
	// Verify that stderr is captured (empty for a clean command).
	r := NewRunner("/unused.jar", 1024, 30)
	r.SetJavaCmd("echo")

	result, err := r.Run(context.Background(), "hello", domain.JARFlags{}, 0, nil)
	require.NoError(t, err)
	assert.Empty(t, result.Stderr, "echo should produce no stderr")
}

func TestRunner_Run_CustomHeap(t *testing.T) {
	r := NewRunner("/test.jar", 2048, 30)

	// Verify that when we use java mode, the -Xmx flag is set correctly.
	args := r.buildCommandArgs(8192, []string{"/tmp/log.log"})
	assert.Equal(t, "java", args[0])
	assert.Equal(t, "-Xmx8192m", args[1])
	assert.Equal(t, "-jar", args[2])
	assert.Equal(t, "/test.jar", args[3])
	assert.Equal(t, "/tmp/log.log", args[4])
}

func TestRunner_Run_DefaultHeapWhenZero(t *testing.T) {
	r := NewRunner("/test.jar", 4096, 30)

	args := r.buildCommandArgs(4096, []string{"/tmp/log.log"})
	assert.Equal(t, "-Xmx4096m", args[1])
}

func TestRunner_BuildCommandArgs_NonJava(t *testing.T) {
	r := NewRunner("/test.jar", 2048, 30)
	r.SetJavaCmd("echo")

	args := r.buildCommandArgs(2048, []string{"-n", "10", "/tmp/log.log"})
	// Non-java commands skip -Xmx, -jar, and jar path.
	assert.Equal(t, "echo", args[0])
	assert.Equal(t, "-n", args[1])
	assert.Equal(t, "10", args[2])
	assert.Equal(t, "/tmp/log.log", args[3])
}

// ---------------------------------------------------------------------------
// Parser tests (parser.go)
// ---------------------------------------------------------------------------

func TestParseOutput_EmptyInput(t *testing.T) {
	_, err := ParseOutput("")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "empty output")
}

func TestParseOutput_WhitespaceOnly(t *testing.T) {
	_, err := ParseOutput("   \n\n   \t\n  ")
	require.Error(t, err)
}

func TestParseOutput_GeneralStatistics(t *testing.T) {
	output := `
=== General Statistics ===
Total Lines Processed:  1234567
API Calls:              890123
SQL Operations:         234567
Filter Executions:      123456
Escalation Executions:  12345
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

	stats := data.GeneralStats
	assert.Equal(t, int64(1234567), stats.TotalLines)
	assert.Equal(t, int64(890123), stats.APICount)
	assert.Equal(t, int64(234567), stats.SQLCount)
	assert.Equal(t, int64(123456), stats.FilterCount)
	assert.Equal(t, int64(12345), stats.EscCount)
	assert.Equal(t, 42, stats.UniqueUsers)
	assert.Equal(t, 87, stats.UniqueForms)
	assert.Equal(t, 35, stats.UniqueTables)
	assert.Equal(t, "8h 30m 45s", stats.LogDuration)
	assert.False(t, stats.LogStart.IsZero(), "LogStart should be parsed")
	assert.False(t, stats.LogEnd.IsZero(), "LogEnd should be parsed")
}

func TestParseOutput_GeneralStatistics_WithCommas(t *testing.T) {
	output := `
=== General Statistics ===
Total Lines Processed:  1,234,567
API Calls:              890,123
`
	result, err := ParseOutput(output)
	require.NoError(t, err)
	data := result.Dashboard

	assert.Equal(t, int64(1234567), data.GeneralStats.TotalLines)
	assert.Equal(t, int64(890123), data.GeneralStats.APICount)
}

func TestParseOutput_TopNAPIPipeFormat(t *testing.T) {
	output := `
=== Top N API Calls ===
| Rank | Line# | File | Timestamp | Thread | RPC | Queue | Identifier | Form | User | Duration(ms) | Status |
|------|-------|------|-----------|--------|-----|-------|------------|------|------|--------------|--------|
| 1 | 4523 | 1 | 2026-02-03 10:00:05 | T00000027 | 398 | Fast | GE | HPD:Help Desk | TestUser | 5000 | Success |
| 2 | 1200 | 1 | 2026-02-03 10:00:01 | T00000025 | 392 | List | GE | CHG:Infrastructure Change | Admin | 2500 | Success |
| 3 | 8901 | 1 | 2026-02-03 10:00:09 | T00000031 | 404 | List | GE | PBM:Problem Investigation | Admin | 1800 | Success |
`
	result, err := ParseOutput(output)
	require.NoError(t, err)
	data := result.Dashboard

	require.Len(t, data.TopAPICalls, 3)

	first := data.TopAPICalls[0]
	assert.Equal(t, 1, first.Rank)
	assert.Equal(t, 4523, first.LineNumber)
	assert.Equal(t, 1, first.FileNumber)
	assert.Equal(t, "T00000027", first.TraceID)
	assert.Equal(t, "398", first.RPCID)
	assert.Equal(t, "Fast", first.Queue)
	assert.Equal(t, "GE", first.Identifier)
	assert.Equal(t, "HPD:Help Desk", first.Form)
	assert.Equal(t, "TestUser", first.User)
	assert.Equal(t, 5000, first.DurationMS)
	assert.True(t, first.Success)
}

func TestParseOutput_TopNSQLPipeFormat(t *testing.T) {
	output := `
=== Top N SQL Statements ===
| Rank | Line# | Identifier | Duration(ms) | Status |
|------|-------|------------|--------------|--------|
| 1 | 3012 | SELECT "EN1" FROM "T00082" | 310 | Success |
| 2 | 1530 | SELECT "EN1" FROM "T00045" | 220 | Success |
`
	result, err := ParseOutput(output)
	require.NoError(t, err)
	data := result.Dashboard
	require.Len(t, data.TopSQL, 2)

	assert.Equal(t, 1, data.TopSQL[0].Rank)
	assert.Equal(t, 310, data.TopSQL[0].DurationMS)
	assert.True(t, data.TopSQL[0].Success)
}

func TestParseOutput_TopNFilterAndEscalation(t *testing.T) {
	output := `
=== Top N Filters ===
| Rank | Line# | Identifier | Duration(ms) | Status |
|------|-------|------------|--------------|--------|
| 1 | 789 | CHG:Change_StatusHistory | 15 | Success |
| 2 | 456 | HPD:HelpDesk_Audit_Submit | 12 | Success |

=== Top N Escalations ===
| Rank | Line# | Identifier | Duration(ms) | Status |
|------|-------|------------|--------------|--------|
| 1 | 2345 | CHG:Esc-ChangeApproval | 1200 | Success |
| 2 | 1234 | HPD:Esc-SLA-Resolve | 500 | Success |
`
	result, err := ParseOutput(output)
	require.NoError(t, err)
	data := result.Dashboard

	require.Len(t, data.TopFilters, 2)
	assert.Equal(t, "CHG:Change_StatusHistory", data.TopFilters[0].Identifier)

	require.Len(t, data.TopEscalations, 2)
	assert.Equal(t, "CHG:Esc-ChangeApproval", data.TopEscalations[0].Identifier)
	assert.Equal(t, 1200, data.TopEscalations[0].DurationMS)
}

func TestParseOutput_ThreadDistribution(t *testing.T) {
	output := `
=== Thread Statistics ===
T00000024:  6
T00000025:  4
T00000027:  3
T00000026:  3
`
	result, err := ParseOutput(output)
	require.NoError(t, err)
	data := result.Dashboard

	threads, ok := data.Distribution["threads"]
	require.True(t, ok, "distribution should have a 'threads' key")
	assert.Equal(t, 6, threads["T00000024"])
	assert.Equal(t, 4, threads["T00000025"])
}

func TestParseOutput_ErrorDistribution(t *testing.T) {
	output := `
=== Exceptions ===
ARERR[302] Entry does not exist:  5
ARERR[9352] Permission denied:    2
ORA-00942 table or view:           1
`
	result, err := ParseOutput(output)
	require.NoError(t, err)
	data := result.Dashboard

	errors, ok := data.Distribution["errors"]
	require.True(t, ok)
	assert.Equal(t, 5, errors["ARERR[302] Entry does not exist"])
	assert.Equal(t, 2, errors["ARERR[9352] Permission denied"])
}

func TestParseOutput_UserDistribution(t *testing.T) {
	output := `
=== User Statistics ===
Demo:       8
Admin:      6
TestUser:   3
ARSystem:   2
`
	result, err := ParseOutput(output)
	require.NoError(t, err)
	data := result.Dashboard

	users, ok := data.Distribution["users"]
	require.True(t, ok)
	assert.Equal(t, 8, users["Demo"])
	assert.Equal(t, 6, users["Admin"])
}

func TestParseOutput_FormDistribution(t *testing.T) {
	output := `
=== Form Statistics ===
HPD:Help Desk:               10
CHG:Infrastructure Change:    4
CTM:People:                   3
`
	result, err := ParseOutput(output)
	require.NoError(t, err)
	data := result.Dashboard

	forms, ok := data.Distribution["forms"]
	require.True(t, ok, "distribution should have a 'forms' key")

	// The splitKeyValueNumeric function splits on the LAST colon with a
	// numeric right-hand side, so "HPD:Help Desk" is correctly preserved
	// as the key.
	assert.Equal(t, 10, forms["HPD:Help Desk"])
	assert.Equal(t, 4, forms["CHG:Infrastructure Change"])
	assert.Equal(t, 3, forms["CTM:People"])
}

func TestParseOutput_MultipleSections(t *testing.T) {
	output := `
=== General Statistics ===
Total Lines Processed:  50
API Calls:              20
SQL Operations:         15
Filter Executions:      10
Escalation Executions:  5
Unique Users:           4
Unique Forms:           6
Unique Tables:          3
Log Start:              Mon Feb 03 2026 10:00:00.123
Log End:                Mon Feb 03 2026 10:00:13.000
Log Duration:           12.877s

=== Top N API Calls ===
| Rank | Line# | Identifier | Form | User | Duration(ms) | Status |
|------|-------|------------|------|------|--------------|--------|
| 1 | 9 | GE | HPD:Help Desk | TestUser | 5000 | Success |
| 2 | 3 | GE | CHG:Infrastructure Change | Admin | 2500 | Success |

=== Top N SQL Statements ===
| Rank | Line# | Identifier | Duration(ms) | Status |
|------|-------|------------|--------------|--------|
| 1 | 13 | SELECT FROM T00082 | 310 | Success |

=== Thread Statistics ===
T00000024:  6
T00000025:  4
`
	result, err := ParseOutput(output)
	require.NoError(t, err)
	data := result.Dashboard

	// General stats.
	assert.Equal(t, int64(50), data.GeneralStats.TotalLines)
	assert.Equal(t, int64(20), data.GeneralStats.APICount)
	assert.Equal(t, "12.877s", data.GeneralStats.LogDuration)

	// Top-N sections.
	require.Len(t, data.TopAPICalls, 2)
	assert.Equal(t, 5000, data.TopAPICalls[0].DurationMS)

	require.Len(t, data.TopSQL, 1)
	assert.Equal(t, 310, data.TopSQL[0].DurationMS)

	// Thread distribution.
	threads := data.Distribution["threads"]
	require.NotNil(t, threads)
	assert.Equal(t, 6, threads["T00000024"])
}

func TestParseOutput_UnrecognizedSectionsSkipped(t *testing.T) {
	output := `
=== Some Unknown Section ===
This content should be ignored.
No crash should occur.

=== General Statistics ===
Total Lines Processed:  100
`
	result, err := ParseOutput(output)
	require.NoError(t, err)
	data := result.Dashboard
	assert.Equal(t, int64(100), data.GeneralStats.TotalLines)
}

// ---------------------------------------------------------------------------
// Utility function tests
// ---------------------------------------------------------------------------

func TestSplitKeyValue(t *testing.T) {
	tests := []struct {
		input       string
		expectKey   string
		expectValue string
		expectOk    bool
	}{
		{"Total Lines: 123", "Total Lines", "123", true},
		{"API Calls:  456", "API Calls", "456", true},
		{"no colon here", "", "", false},
		{":  missing key", "", "", false},
		{"key:", "key", "", true},
	}

	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			k, v, ok := splitKeyValue(tt.input)
			assert.Equal(t, tt.expectOk, ok)
			if ok {
				assert.Equal(t, tt.expectKey, k)
				assert.Equal(t, tt.expectValue, v)
			}
		})
	}
}

func TestSplitKeyValueNumeric(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		wantKey  string
		wantNum  int
		wantOk   bool
	}{
		{
			name:    "simple key-value",
			input:   "Demo:  8",
			wantKey: "Demo", wantNum: 8, wantOk: true,
		},
		{
			name:    "colon in key (form name)",
			input:   "HPD:Help Desk:  10",
			wantKey: "HPD:Help Desk", wantNum: 10, wantOk: true,
		},
		{
			name:    "colon in key with commas in number",
			input:   "HPD:Help Desk:  1,234",
			wantKey: "HPD:Help Desk", wantNum: 1234, wantOk: true,
		},
		{
			name:    "no colon at all",
			input:   "no colon here",
			wantKey: "", wantNum: 0, wantOk: false,
		},
		{
			name:    "colon but non-numeric value",
			input:   "key: not-a-number",
			wantKey: "", wantNum: 0, wantOk: false,
		},
		{
			name:    "multiple colons, last one numeric",
			input:   "A:B:C:  42",
			wantKey: "A:B:C", wantNum: 42, wantOk: true,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			key, num, ok := splitKeyValueNumeric(tt.input)
			assert.Equal(t, tt.wantOk, ok)
			if ok {
				assert.Equal(t, tt.wantKey, key)
				assert.Equal(t, tt.wantNum, num)
			}
		})
	}
}

func TestParseIntSafe(t *testing.T) {
	assert.Equal(t, int64(1234567), parseIntSafe("1,234,567"))
	assert.Equal(t, int64(42), parseIntSafe("  42  "))
	assert.Equal(t, int64(0), parseIntSafe("not a number"))
	assert.Equal(t, int64(0), parseIntSafe(""))
}

func TestParseTimestampSafe(t *testing.T) {
	ts := parseTimestampSafe("Mon Feb 03 2026 10:00:00.123")
	assert.False(t, ts.IsZero())
	assert.Equal(t, 2026, ts.Year())
	assert.Equal(t, time.February, ts.Month())
	assert.Equal(t, 3, ts.Day())

	ts2 := parseTimestampSafe("2026-02-03 10:00:05.000")
	assert.False(t, ts2.IsZero())

	zero := parseTimestampSafe("garbage")
	assert.True(t, zero.IsZero())
}

func TestSplitFields(t *testing.T) {
	fields := splitFields("1  4523  Mon Feb 03 2026  T00000027  Fast  GE")
	assert.True(t, len(fields) > 0)
	assert.Equal(t, "1", fields[0])
}

func TestIsSeparatorRow(t *testing.T) {
	assert.True(t, isSeparatorRow([]string{"---", "------", "---:"}))
	assert.False(t, isSeparatorRow([]string{"Rank", "Line#"}))
}

func TestSplitPipeCells(t *testing.T) {
	cells := splitPipeCells("| 1 | 4523 | Success |")
	require.Len(t, cells, 3)
	assert.Equal(t, "1", cells[0])
	assert.Equal(t, "4523", cells[1])
	assert.Equal(t, "Success", cells[2])
}

// ---------------------------------------------------------------------------
// Integration-style test: full report parsing
// ---------------------------------------------------------------------------

func TestParseOutput_FullReport(t *testing.T) {
	// Simulates a complete ARLogAnalyzer.jar text report.
	report := strings.Join([]string{
		"ARLogAnalyzer v3.0 Report",
		"Generated: 2026-02-03 18:45:00",
		"",
		"=== General Statistics ===",
		"Total Lines Processed:  51",
		"API Calls:              20",
		"SQL Operations:         15",
		"Filter Executions:      10",
		"Escalation Executions:  5",
		"Unique Users:           4",
		"Unique Forms:           6",
		"Unique Tables:          5",
		"Log Start:              Mon Feb 03 2026 10:00:00.123",
		"Log End:                Mon Feb 03 2026 10:00:13.000",
		"Log Duration:           12.877s",
		"",
		"=== Top N API Calls ===",
		"| Rank | Line# | File | Timestamp | Thread | RPC | Queue | Identifier | Form | User | Duration(ms) | Status |",
		"|------|-------|------|-----------|--------|-----|-------|------------|------|------|--------------|--------|",
		"| 1 | 9 | 1 | 2026-02-03 10:00:05 | T00000027 | 398 | Fast | GE | HPD:Help Desk | TestUser | 5000 | Success |",
		"| 2 | 3 | 1 | 2026-02-03 10:00:01 | T00000025 | 392 | List | GE | CHG:Infrastructure Change | Admin | 2500 | Success |",
		"| 3 | 15 | 1 | 2026-02-03 10:00:09 | T00000031 | 404 | List | GE | PBM:Problem Investigation | Admin | 1800 | Success |",
		"",
		"=== Top N SQL Statements ===",
		"| Rank | Line# | Identifier | Duration(ms) | Status |",
		"|------|-------|------------|--------------|--------|",
		"| 1 | 13 | SELECT FROM T00082 | 310 | Success |",
		"| 2 | 5 | SELECT FROM T00045 ORDER BY C6 | 220 | Success |",
		"",
		"=== Top N Filters ===",
		"| Rank | Line# | Identifier | Duration(ms) | Status |",
		"|------|-------|------------|--------------|--------|",
		"| 1 | 8 | CHG:Change_StatusHistory | 15 | Success |",
		"| 2 | 5 | HPD:HelpDesk_Audit_Submit | 12 | Success |",
		"",
		"=== Top N Escalations ===",
		"| Rank | Line# | Identifier | Duration(ms) | Status |",
		"|------|-------|------------|--------------|--------|",
		"| 1 | 3 | CHG:Esc-ChangeApproval | 1200 | Success |",
		"| 2 | 1 | HPD:Esc-SLA-Resolve | 500 | Success |",
		"",
		"=== Thread Statistics ===",
		"T00000024:  7",
		"T00000025:  5",
		"T00000027:  4",
		"T00000026:  4",
		"T00000030:  3",
		"",
		"=== User Statistics ===",
		"Demo:      8",
		"Admin:     7",
		"TestUser:  3",
		"ARSystem:  2",
		"",
		"=== Exceptions ===",
		"ARERR[302]:  2",
		"ARERR[9352]: 1",
		"ORA-00942:   1",
		"ORA-01400:   1",
		"",
	}, "\n")

	result, err := ParseOutput(report)
	require.NoError(t, err)
	data := result.Dashboard

	// General statistics.
	assert.Equal(t, int64(51), data.GeneralStats.TotalLines)
	assert.Equal(t, int64(20), data.GeneralStats.APICount)
	assert.Equal(t, int64(15), data.GeneralStats.SQLCount)
	assert.Equal(t, int64(10), data.GeneralStats.FilterCount)
	assert.Equal(t, int64(5), data.GeneralStats.EscCount)
	assert.Equal(t, 4, data.GeneralStats.UniqueUsers)
	assert.Equal(t, 6, data.GeneralStats.UniqueForms)
	assert.Equal(t, 5, data.GeneralStats.UniqueTables)
	assert.Equal(t, "12.877s", data.GeneralStats.LogDuration)

	// Top-N API calls.
	require.Len(t, data.TopAPICalls, 3)
	assert.Equal(t, 5000, data.TopAPICalls[0].DurationMS)
	assert.Equal(t, "TestUser", data.TopAPICalls[0].User)
	assert.Equal(t, "HPD:Help Desk", data.TopAPICalls[0].Form)

	// Top-N SQL.
	require.Len(t, data.TopSQL, 2)
	assert.Equal(t, 310, data.TopSQL[0].DurationMS)

	// Top-N Filters.
	require.Len(t, data.TopFilters, 2)
	assert.Equal(t, "CHG:Change_StatusHistory", data.TopFilters[0].Identifier)

	// Top-N Escalations.
	require.Len(t, data.TopEscalations, 2)
	assert.Equal(t, 1200, data.TopEscalations[0].DurationMS)

	// Thread distribution.
	threads := data.Distribution["threads"]
	require.NotNil(t, threads)
	assert.Equal(t, 7, threads["T00000024"])
	assert.Equal(t, 5, threads["T00000025"])

	// User distribution.
	users := data.Distribution["users"]
	require.NotNil(t, users)
	assert.Equal(t, 8, users["Demo"])
	assert.Equal(t, 7, users["Admin"])

	// Error distribution.
	errors := data.Distribution["errors"]
	require.NotNil(t, errors)
	assert.Equal(t, 2, errors["ARERR[302]"])
	assert.Equal(t, 1, errors["ARERR[9352]"])
}

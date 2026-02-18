package jar

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/OmarEhab007/RemedyIQ/backend/internal/domain"
)

// Section header patterns used by ARLogAnalyzer.jar plain-text output.
// The JAR produces a structured report with clearly delimited sections.
//
// v3 format: === Section Name ===
// v4 format: ###  SECTION: Name  ##### (major) or ### Subsection Name (sub)
var (
	sectionHeaderRe    = regexp.MustCompile(`^={3,}\s*(.+?)\s*={3,}$`)
	v4MajorSectionRe   = regexp.MustCompile(`^#{3,}\s+SECTION:\s*(.+?)\s*#{3,}`)
	v4SubsectionRe     = regexp.MustCompile(`^###\s+(.+)$`)
	dashSeparatorLineRe = regexp.MustCompile(`^[-\s]+$`)
	separatorRe        = regexp.MustCompile(`^-{3,}$`)
)

// Common timestamp layouts produced by the JAR.
var timestampLayouts = []string{
	"Mon Jan 02 2006 15:04:05.000",
	"Mon Jan 02 2006 15:04:05",
	"2006-01-02 15:04:05.000",
	"2006-01-02 15:04:05",
	"2006/01/02 15:04:05",
	"01/02/2006 15:04:05",
}

// ParseOutput parses the plain-text report produced by ARLogAnalyzer.jar
// into a structured ParseResult value containing the DashboardData.
//
// The JAR output is organized into sections separated by "===" header
// lines. Each section contains either key-value statistics or tabular
// top-N data. This parser is intentionally lenient: unrecognized lines
// and sections are silently skipped so that minor JAR version differences
// do not cause hard failures.
//
// The returned ParseResult.Dashboard is always populated. Section pointers
// (Aggregates, Exceptions, Gaps, ThreadStats, Filters) are nil until
// enhanced analysis populates them in later processing stages.
func ParseOutput(output string) (*domain.ParseResult, error) {
	if strings.TrimSpace(output) == "" {
		return nil, fmt.Errorf("jar parser: empty output")
	}

	data := &domain.DashboardData{
		Distribution: make(map[string]map[string]int),
	}

	result := &domain.ParseResult{Dashboard: data}

	sections := splitSections(output)

	for name, body := range sections {
		normalized := strings.ToLower(strings.TrimSpace(name))

		switch {
		// Preamble contains general stats in v4 format.
		case name == "_preamble":
			parseGeneralStatistics(body, &data.GeneralStats)

		// v3: "General Statistics"
		case strings.Contains(normalized, "general statistic"):
			parseGeneralStatistics(body, &data.GeneralStats)

		// --- GAP ANALYSIS ---
		case strings.Contains(normalized, "longest line gap"):
			entries := parseGapEntries(body)
			if len(entries) > 0 {
				if result.JARGaps == nil {
					result.JARGaps = &domain.JARGapsResponse{Source: "jar_parsed"}
				}
				result.JARGaps.LineGaps = entries
			}
		case strings.Contains(normalized, "longest thread gap"):
			entries := parseGapEntries(body)
			if len(entries) > 0 {
				if result.JARGaps == nil {
					result.JARGaps = &domain.JARGapsResponse{Source: "jar_parsed"}
				}
				result.JARGaps.ThreadGaps = entries
			}

		// --- ABBREVIATION LEGEND ---
		case strings.Contains(normalized, "abbreviation legend"):
			result.APIAbbreviations = parseAPIAbbreviationLegend(body)

		// --- API TOP-N ---
		case strings.Contains(normalized, "top") && strings.Contains(normalized, "api"):
			data.TopAPICalls = parseTopNSection(body)
		case strings.Contains(normalized, "longest") && strings.Contains(normalized, "running") && strings.Contains(normalized, "api"):
			data.TopAPICalls = parseTopNSection(body)

		// --- QUEUED API CALLS ---
		case strings.Contains(normalized, "queued") && strings.Contains(normalized, "api"):
			if !sectionContainsNoData(body) {
				result.QueuedAPICalls = parseTopNSection(body)
			}

		// --- API AGGREGATES ---
		case strings.Contains(normalized, "api call aggregates") && strings.Contains(normalized, "by form"):
			table := parseGroupedAggregateTable(body)
			if table != nil {
				if result.JARAggregates == nil {
					result.JARAggregates = &domain.JARAggregatesResponse{Source: "jar_parsed"}
				}
				if idx := strings.Index(normalized, "sorted by"); idx >= 0 {
					table.SortedBy = strings.TrimSpace(name[strings.Index(strings.ToLower(name), "sorted by")+10:])
				}
				result.JARAggregates.APIByForm = table
			}
		case strings.Contains(normalized, "api call aggregates") && strings.Contains(normalized, "by client ip"):
			table := parseGroupedAggregateTable(body)
			if table != nil {
				if result.JARAggregates == nil {
					result.JARAggregates = &domain.JARAggregatesResponse{Source: "jar_parsed"}
				}
				if idx := strings.Index(normalized, "sorted by"); idx >= 0 {
					table.SortedBy = strings.TrimSpace(name[strings.Index(strings.ToLower(name), "sorted by")+10:])
				}
				result.JARAggregates.APIByClientIP = table
			}
		case strings.Contains(normalized, "api call aggregates") && strings.Contains(normalized, "by client"):
			table := parseGroupedAggregateTable(body)
			if table != nil {
				if result.JARAggregates == nil {
					result.JARAggregates = &domain.JARAggregatesResponse{Source: "jar_parsed"}
				}
				if idx := strings.Index(normalized, "sorted by"); idx >= 0 {
					table.SortedBy = strings.TrimSpace(name[strings.Index(strings.ToLower(name), "sorted by")+10:])
				}
				result.JARAggregates.APIByClient = table
			}

		// --- API THREAD STATISTICS ---
		case strings.Contains(normalized, "api thread statistics"):
			entries := parseThreadStatsTable(body)
			if len(entries) > 0 {
				if result.JARThreadStats == nil {
					result.JARThreadStats = &domain.JARThreadStatsResponse{Source: "jar_parsed"}
				}
				result.JARThreadStats.APIThreads = entries
			}

		// --- API ERRORS ---
		case strings.Contains(normalized, "errored out"):
			entries := parseAPIErrors(body)
			if len(entries) > 0 {
				if result.JARExceptions == nil {
					result.JARExceptions = &domain.JARExceptionsResponse{Source: "jar_parsed"}
				}
				result.JARExceptions.APIErrors = entries
			}

		// --- API EXCEPTION REPORT ---
		case strings.Contains(normalized, "api exception report"):
			entries := parseExceptionReport(body)
			if len(entries) > 0 {
				if result.JARExceptions == nil {
					result.JARExceptions = &domain.JARExceptionsResponse{Source: "jar_parsed"}
				}
				result.JARExceptions.APIExceptions = entries
			}

		// --- SQL TOP-N ---
		case strings.Contains(normalized, "top") && strings.Contains(normalized, "sql"):
			data.TopSQL = parseTopNSection(body)
		case strings.Contains(normalized, "longest") && strings.Contains(normalized, "running") && strings.Contains(normalized, "sql"):
			data.TopSQL = parseTopNSection(body)

		// --- SQL AGGREGATES ---
		case strings.Contains(normalized, "sql call aggregates") && strings.Contains(normalized, "by table"):
			table := parseGroupedAggregateTable(body)
			if table != nil {
				if result.JARAggregates == nil {
					result.JARAggregates = &domain.JARAggregatesResponse{Source: "jar_parsed"}
				}
				if idx := strings.Index(normalized, "sorted by"); idx >= 0 {
					table.SortedBy = strings.TrimSpace(name[strings.Index(strings.ToLower(name), "sorted by")+10:])
				}
				result.JARAggregates.SQLByTable = table
			}

		// --- SQL THREAD STATISTICS ---
		case strings.Contains(normalized, "sql thread statistics"):
			entries := parseThreadStatsTable(body)
			if len(entries) > 0 {
				if result.JARThreadStats == nil {
					result.JARThreadStats = &domain.JARThreadStatsResponse{Source: "jar_parsed"}
				}
				result.JARThreadStats.SQLThreads = entries
			}

		// --- SQL EXCEPTION REPORT ---
		case strings.Contains(normalized, "sql exception report"):
			entries := parseExceptionReport(body)
			if len(entries) > 0 {
				if result.JARExceptions == nil {
					result.JARExceptions = &domain.JARExceptionsResponse{Source: "jar_parsed"}
				}
				result.JARExceptions.SQLExceptions = entries
			}

		// --- ESCALATION TOP-N ---
		case strings.Contains(normalized, "top") && strings.Contains(normalized, "escalation"):
			data.TopEscalations = parseTopNSection(body)
		case strings.Contains(normalized, "longest") && strings.Contains(normalized, "running") && (strings.Contains(normalized, "escl") || strings.Contains(normalized, "escalation")):
			data.TopEscalations = parseTopNSection(body)

		// --- ESCALATION AGGREGATES ---
		case strings.Contains(normalized, "escalation call aggregates") && strings.Contains(normalized, "by form"):
			table := parseGroupedAggregateTable(body)
			if table != nil {
				if result.JARAggregates == nil {
					result.JARAggregates = &domain.JARAggregatesResponse{Source: "jar_parsed"}
				}
				if idx := strings.Index(normalized, "sorted by"); idx >= 0 {
					table.SortedBy = strings.TrimSpace(name[strings.Index(strings.ToLower(name), "sorted by")+10:])
				}
				result.JARAggregates.EscByForm = table
			}
		case strings.Contains(normalized, "escalation call aggregates") && strings.Contains(normalized, "by pool"):
			table := parseGroupedAggregateTable(body)
			if table != nil {
				if result.JARAggregates == nil {
					result.JARAggregates = &domain.JARAggregatesResponse{Source: "jar_parsed"}
				}
				if idx := strings.Index(normalized, "sorted by"); idx >= 0 {
					table.SortedBy = strings.TrimSpace(name[strings.Index(strings.ToLower(name), "sorted by")+10:])
				}
				result.JARAggregates.EscByPool = table
			}

		// --- FILTER TOP-N (longest running) ---
		case strings.Contains(normalized, "top") && strings.Contains(normalized, "filter"):
			data.TopFilters = parseTopNSection(body)
		case strings.Contains(normalized, "longest") && strings.Contains(normalized, "running") && strings.Contains(normalized, "fltr"):
			data.TopFilters = parseTopNSection(body)

		// --- FILTER: MOST EXECUTED PER TRANSACTION (must match before "most executed fltr") ---
		case strings.Contains(normalized, "most executed fltr per transaction"):
			entries := parseFilterExecutedPerTxn(body)
			if len(entries) > 0 {
				if result.JARFilters == nil {
					result.JARFilters = &domain.JARFilterComplexityResponse{Source: "jar_parsed"}
				}
				result.JARFilters.ExecutedPerTxn = entries
			}

		// --- FILTER: MOST EXECUTED ---
		case strings.Contains(normalized, "most executed fltr"):
			entries := parseMostExecutedFilters(body)
			if len(entries) > 0 {
				if result.JARFilters == nil {
					result.JARFilters = &domain.JARFilterComplexityResponse{Source: "jar_parsed"}
				}
				result.JARFilters.MostExecuted = entries
			}

		// --- FILTER: MOST FILTERS PER TRANSACTION ---
		case strings.Contains(normalized, "most filters per transaction"):
			entries := parseFilterPerTransaction(body)
			if len(entries) > 0 {
				if result.JARFilters == nil {
					result.JARFilters = &domain.JARFilterComplexityResponse{Source: "jar_parsed"}
				}
				result.JARFilters.PerTransaction = entries
			}

		// --- FILTER: MOST FILTER LEVELS ---
		case strings.Contains(normalized, "most filter levels"):
			entries := parseFilterLevels(body)
			if len(entries) > 0 {
				if result.JARFilters == nil {
					result.JARFilters = &domain.JARFilterComplexityResponse{Source: "jar_parsed"}
				}
				result.JARFilters.FilterLevels = entries
			}

		// --- LOGGING ACTIVITY ---
		case strings.Contains(normalized, "logging activity"):
			activities := parseLoggingActivity(body)
			if len(activities) > 0 {
				result.LoggingActivities = activities
			}

		// --- FILE INFORMATION / INPUT FILENAMES ---
		case strings.Contains(normalized, "input filename") || strings.Contains(normalized, "file information"):
			files := parseFileMetadata(body)
			if len(files) > 0 {
				result.FileMetadataList = files
			}

		// --- GENERIC FALLBACKS (v3 compatibility) ---
		case strings.Contains(normalized, "thread") && !strings.Contains(normalized, "gap") && !strings.Contains(normalized, "api thread") && !strings.Contains(normalized, "sql thread"):
			parseDistribution(body, data, "threads")
		case (strings.Contains(normalized, "exception") || strings.Contains(normalized, "error")) &&
			!strings.Contains(normalized, "errored out") &&
			!strings.Contains(normalized, "api exception") &&
			!strings.Contains(normalized, "sql exception"):
			parseDistribution(body, data, "errors")
		case strings.Contains(normalized, "user") && !strings.Contains(normalized, "count"):
			parseDistribution(body, data, "users")
		case strings.Contains(normalized, "form") && !strings.Contains(normalized, "count") && !strings.Contains(normalized, "longest") && !strings.Contains(normalized, "aggregates"):
			parseDistribution(body, data, "forms")
		}
	}

	// Copy TopFilters to JARFilters.LongestRunning if available.
	if len(data.TopFilters) > 0 && result.JARFilters != nil {
		result.JARFilters.LongestRunning = data.TopFilters
	}

	return result, nil
}

// splitSections splits the JAR output into named sections.
//
// Supports two formats:
//   - v3: "=== Section Name ===" headers
//   - v4: "###  SECTION: Name  ###..." major headers and "### Subsection" sub-headers
//
// Lines before the first section header are collected into a special
// "_preamble" section so that v4 general statistics (which appear before
// any section) are not lost.
func splitSections(output string) map[string][]string {
	sections := make(map[string][]string)
	lines := strings.Split(output, "\n")

	currentSection := ""
	var currentBody []string
	hasSectionHeader := false

	for _, line := range lines {
		// v3 format: === Section Name ===
		if m := sectionHeaderRe.FindStringSubmatch(line); m != nil {
			if currentSection != "" || !hasSectionHeader {
				if currentSection != "" {
					sections[currentSection] = currentBody
				} else if len(currentBody) > 0 {
					sections["_preamble"] = currentBody
				}
			}
			currentSection = m[1]
			currentBody = nil
			hasSectionHeader = true
			continue
		}

		// v4 format: ###  SECTION: Name  #####...
		if m := v4MajorSectionRe.FindStringSubmatch(line); m != nil {
			if currentSection != "" {
				sections[currentSection] = currentBody
			} else if len(currentBody) > 0 {
				sections["_preamble"] = currentBody
			}
			currentSection = m[1]
			currentBody = nil
			hasSectionHeader = true
			continue
		}

		// v4 subsection: ### Subsection Name
		if m := v4SubsectionRe.FindStringSubmatch(line); m != nil {
			// Don't treat lines inside a non-### context as subsections
			// (e.g., markdown in other content). Only split on subsections
			// when we've already seen at least one ### or === header,
			// or we're still in the preamble.
			if currentSection != "" {
				sections[currentSection] = currentBody
			} else if len(currentBody) > 0 {
				sections["_preamble"] = currentBody
			}
			currentSection = m[1]
			currentBody = nil
			hasSectionHeader = true
			continue
		}

		if hasSectionHeader || currentSection != "" {
			currentBody = append(currentBody, line)
		} else {
			// Accumulate preamble lines before any header is found.
			currentBody = append(currentBody, line)
		}
	}

	// Save the last section.
	if currentSection != "" {
		sections[currentSection] = currentBody
	} else if len(currentBody) > 0 && !hasSectionHeader {
		sections["_preamble"] = currentBody
	}

	return sections
}

// parseGeneralStatistics extracts key-value pairs from the General
// Statistics section.
//
// Expected format (one key-value pair per line):
//
//	Total Lines Processed:  1234567
//	API Calls:              890123
//	SQL Operations:         234567
//	Filter Executions:      123456
//	Escalation Executions:  12345
//	Unique Users:           42
//	Unique Forms:           87
//	Unique Tables:          35
//	Log Start:              Mon Feb 03 2026 10:00:00.123
//	Log End:                Mon Feb 03 2026 18:30:45.678
//	Log Duration:           8h 30m 45s
func parseGeneralStatistics(lines []string, stats *domain.GeneralStatistics) {
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" || separatorRe.MatchString(line) {
			continue
		}

		key, value, ok := splitKeyValue(line)
		if !ok {
			continue
		}

		keyLower := strings.ToLower(key)

		switch {
		case strings.Contains(keyLower, "total line"):
			stats.TotalLines = parseIntSafe(value)

		// v3: "API Calls", v4: "API Count"
		case strings.Contains(keyLower, "api") && !strings.Contains(keyLower, "exception") && !strings.Contains(keyLower, "thread"):
			stats.APICount = parseIntSafe(value)

		// v3: "SQL Operations", v4: "SQL Count"
		case strings.Contains(keyLower, "sql") && !strings.Contains(keyLower, "exception") && !strings.Contains(keyLower, "thread"):
			stats.SQLCount = parseIntSafe(value)

		// v3: "Filter Executions", v4: not present in preamble
		case strings.Contains(keyLower, "filter") && !strings.Contains(keyLower, "thread"):
			stats.FilterCount = parseIntSafe(value)

		// v3: "Escalation Executions", v4: "ESC Count"
		case (strings.Contains(keyLower, "escalation") || keyLower == "esc count") && !strings.Contains(keyLower, "thread") && !strings.Contains(keyLower, "exception"):
			stats.EscCount = parseIntSafe(value)

		// v3: "Unique Users", v4: "User Count"
		case strings.Contains(keyLower, "unique user") || keyLower == "user count":
			stats.UniqueUsers = int(parseIntSafe(value))

		// v3: "Unique Forms", v4: "Form Count"
		case strings.Contains(keyLower, "unique form") || keyLower == "form count":
			stats.UniqueForms = int(parseIntSafe(value))

		// v3: "Unique Tables", v4: "Table Count"
		case strings.Contains(keyLower, "unique table") || keyLower == "table count":
			stats.UniqueTables = int(parseIntSafe(value))

		// v3: "Log Start", v4: "Start Time"
		case strings.Contains(keyLower, "log start") || keyLower == "start time":
			stats.LogStart = parseTimestampSafe(value)

		// v3: "Log End", v4: "End Time"
		case strings.Contains(keyLower, "log end") || keyLower == "end time":
			stats.LogEnd = parseTimestampSafe(value)

		// v3: "Log Duration", v4: "Elapsed Time"
		case strings.Contains(keyLower, "log duration") || strings.Contains(keyLower, "elapsed"):
			stats.LogDuration = value
		}
	}
}

// parseTopNSection parses a tabular top-N section into TopNEntry slices.
//
// The JAR can produce several table formats. This parser handles two
// common layouts:
//
// Layout A (pipe-delimited):
//
//	| Rank | Line# | File | Timestamp | Thread | RPC | Queue | Identifier | Form | User | Duration(ms) | Status |
//	|------|-------|------|-----------|--------|-----|-------|------------|------|------|--------------|--------|
//	| 1    | 4523  | 1    | 2026-...  | T024   | 398 | Fast  | GE         | HPD  | Demo | 5000         | OK     |
//
// Layout B (whitespace-aligned):
//
//	Rank  Line#  Timestamp               Thread  Queue  Identifier  Form              User      Duration(ms)  Status
//	1     4523   Mon Feb 03 2026 10:...  T024    Fast   GE          HPD:Help Desk     Demo      5000          Success
func parseTopNSection(lines []string) []domain.TopNEntry {
	var entries []domain.TopNEntry

	// Detect the table format by scanning lines.
	isPipeFormat := false
	isFixedWidth := false
	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, "|") && strings.Count(trimmed, "|") >= 3 {
			isPipeFormat = true
			break
		}
		if isDashSeparator(line) && strings.Contains(line, " ") {
			isFixedWidth = true
			break
		}
	}

	switch {
	case isPipeFormat:
		entries = parsePipeTable(lines)
	case isFixedWidth:
		entries = parseFixedWidthTable(lines)
	default:
		entries = parseWhitespaceTable(lines)
	}

	return entries
}

// parsePipeTable parses a pipe-delimited table.
func parsePipeTable(lines []string) []domain.TopNEntry {
	var entries []domain.TopNEntry
	var headers []string
	headerParsed := false

	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if trimmed == "" || separatorRe.MatchString(trimmed) {
			continue
		}
		if !strings.HasPrefix(trimmed, "|") {
			continue
		}

		// Split by pipe delimiter.
		cells := splitPipeCells(trimmed)

		// First pipe row is the header.
		if !headerParsed {
			// Check if this is a separator row (all dashes).
			if isSeparatorRow(cells) {
				continue
			}
			headers = cells
			headerParsed = true
			continue
		}

		// Skip separator rows after header.
		if isSeparatorRow(cells) {
			continue
		}

		entry := mapCellsToEntry(headers, cells)
		if entry.Rank > 0 || entry.Identifier != "" {
			entries = append(entries, entry)
		}
	}

	return entries
}

// parseWhitespaceTable parses a whitespace-aligned table where columns
// are separated by two or more consecutive spaces.
func parseWhitespaceTable(lines []string) []domain.TopNEntry {
	var entries []domain.TopNEntry

	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if trimmed == "" || separatorRe.MatchString(trimmed) {
			continue
		}

		// Try to parse a data row: starts with a rank number.
		entry, ok := parseTopNLine(trimmed)
		if ok {
			entries = append(entries, entry)
		}
	}

	return entries
}

// parseTopNLine attempts to parse a single whitespace-delimited top-N
// line. Returns the entry and true if successful.
//
// Expected pattern:
//
//	<rank>  <line#>  <file#>  <timestamp>  <threadID>  <rpcID>  <queue>  <identifier>  [form]  [user]  <duration_ms>  <status>  [details]
//
// Since exact column positions vary, we use a heuristic approach.
func parseTopNLine(line string) (domain.TopNEntry, bool) {
	// Split on two-or-more spaces to get fields.
	fields := splitFields(line)
	if len(fields) < 6 {
		return domain.TopNEntry{}, false
	}

	// First field must be a rank (integer).
	rank, err := strconv.Atoi(fields[0])
	if err != nil {
		return domain.TopNEntry{}, false
	}

	entry := domain.TopNEntry{
		Rank: rank,
	}

	// Walk through remaining fields. We use index-based parsing because
	// the timestamp field can contain spaces that our splitter does not
	// break on perfectly.
	idx := 1

	// Line number
	if idx < len(fields) {
		entry.LineNumber, _ = strconv.Atoi(fields[idx])
		idx++
	}

	// File number (may be absent)
	if idx < len(fields) {
		if fn, err := strconv.Atoi(fields[idx]); err == nil && fn >= 0 && fn < 1000 {
			entry.FileNumber = fn
			idx++
		}
	}

	// Try to find a timestamp by scanning forward.
	for i := idx; i < len(fields) && i < idx+6; i++ {
		candidate := fields[i]
		// Try combining adjacent fields for multi-word timestamps.
		for j := i + 1; j < len(fields) && j <= i+5; j++ {
			combined := strings.Join(fields[i:j+1], " ")
			if ts, ok := tryParseTimestamp(combined); ok {
				entry.Timestamp = ts
				idx = j + 1
				break
			}
		}
		if !entry.Timestamp.IsZero() {
			break
		}
		// Try the single field.
		if ts, ok := tryParseTimestamp(candidate); ok {
			entry.Timestamp = ts
			idx = i + 1
			break
		}
	}

	// Thread ID (starts with T)
	if idx < len(fields) && strings.HasPrefix(fields[idx], "T") {
		entry.TraceID = fields[idx]
		idx++
	}

	// RPC ID
	if idx < len(fields) {
		entry.RPCID = fields[idx]
		idx++
	}

	// Queue
	if idx < len(fields) {
		entry.Queue = fields[idx]
		idx++
	}

	// Identifier (API code, SQL statement start, filter name, etc.)
	if idx < len(fields) {
		entry.Identifier = fields[idx]
		idx++
	}

	// Remaining fields: try to extract duration and status.
	for i := idx; i < len(fields); i++ {
		f := fields[i]
		// Duration in ms.
		if d, err := strconv.Atoi(f); err == nil && d >= 0 {
			entry.DurationMS = d
			continue
		}
		// Status.
		switch strings.ToLower(f) {
		case "success", "ok":
			entry.Success = true
		case "fail", "failed", "error":
			entry.Success = false
		default:
			// Could be form, user, or details.
			if entry.Form == "" {
				entry.Form = f
			} else if entry.User == "" {
				entry.User = f
			} else {
				entry.Details += f + " "
			}
		}
	}

	entry.Details = strings.TrimSpace(entry.Details)
	return entry, true
}

// parseDistribution is a generic parser for key-value distribution
// sections (threads, users, errors, forms). It handles keys that may
// contain colons (e.g., "HPD:Help Desk") by splitting on the LAST
// colon whose right-hand side is a valid integer.
func parseDistribution(lines []string, data *domain.DashboardData, category string) {
	dist := make(map[string]int)
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" || separatorRe.MatchString(line) {
			continue
		}
		key, count, ok := splitKeyValueNumeric(line)
		if !ok {
			continue
		}
		if count > 0 {
			dist[key] = count
		}
	}
	if len(dist) > 0 {
		data.Distribution[category] = dist
	}
}

// parseFixedWidthTable parses a fixed-width (dash-aligned) table produced by
// JAR v4.0.0. Column boundaries are inferred from the dashed separator line.
//
// Example:
//
//	    Run Time First Line# Last Line#                           TrID Queue      API        Form
//	------------ ----------- ---------- ------------------------------ ---------- ---------- -----------------------------------------------------------
//	       0.122        8620      10031 ppvN52iaQZmnf3QKV41xnA:0009991 Prv:390680 SE         SRM:RequestApDetailSignature
func parseFixedWidthTable(lines []string) []domain.TopNEntry {
	// Step 1: Find the dashed separator line and the header line above it.
	sepIdx := -1
	for i, line := range lines {
		if isDashSeparator(line) {
			sepIdx = i
			break
		}
	}
	if sepIdx < 1 {
		return nil
	}

	headerLine := lines[sepIdx-1]
	sepLine := lines[sepIdx]

	// Step 2: Extract column boundaries from the separator.
	boundaries := extractColumnBoundaries(sepLine)
	if len(boundaries) < 2 {
		return nil
	}

	// Step 3: Extract header names using the boundaries.
	headers := extractColumnValues(headerLine, boundaries)

	// Step 4: Parse data rows.
	var entries []domain.TopNEntry
	rank := 0
	for i := sepIdx + 1; i < len(lines); i++ {
		line := lines[i]
		trimmed := strings.TrimSpace(line)
		if trimmed == "" {
			continue
		}
		// Stop at sub-total lines (====) or next subsection header.
		if strings.HasPrefix(trimmed, "===") || strings.HasPrefix(trimmed, "###") {
			break
		}
		// Skip lines that are purely dash separators (subtotals in aggregate tables).
		if isDashSeparator(line) {
			break
		}
		// Skip "No ..." lines (e.g. "No Queued API's").
		if strings.HasPrefix(trimmed, "No ") {
			continue
		}

		values := extractColumnValues(line, boundaries)
		entry := mapFixedWidthToEntry(headers, values)
		if entry.Identifier != "" || entry.DurationMS > 0 || entry.LineNumber > 0 {
			rank++
			entry.Rank = rank
			entries = append(entries, entry)
		}
	}

	return entries
}

// isDashSeparator returns true if the line consists of only dashes and spaces,
// with at least one run of 3+ dashes. This detects column separator lines like
// "------------ ----------- ---------- --------------------------"
func isDashSeparator(line string) bool {
	trimmed := strings.TrimSpace(line)
	if trimmed == "" {
		return false
	}
	hasDashes := false
	for _, ch := range trimmed {
		if ch == '-' {
			hasDashes = true
		} else if ch != ' ' {
			return false
		}
	}
	return hasDashes
}

// extractColumnBoundaries returns the start positions of each column
// by finding runs of dashes in the separator line.
// Returns pairs of [start, end) for each column.
func extractColumnBoundaries(sepLine string) [][2]int {
	var boundaries [][2]int
	i := 0
	for i < len(sepLine) {
		// Skip spaces.
		for i < len(sepLine) && sepLine[i] == ' ' {
			i++
		}
		if i >= len(sepLine) {
			break
		}
		// Mark start of dash run.
		start := i
		for i < len(sepLine) && sepLine[i] == '-' {
			i++
		}
		if i > start {
			boundaries = append(boundaries, [2]int{start, i})
		}
	}
	return boundaries
}

// extractColumnValues extracts trimmed string values from a line given
// column boundaries derived from the separator line.
func extractColumnValues(line string, boundaries [][2]int) []string {
	values := make([]string, len(boundaries))
	for i, b := range boundaries {
		start := b[0]
		end := b[1]
		// For the last column, take everything to end of line.
		if i == len(boundaries)-1 && end < len(line) {
			end = len(line)
		}
		if start >= len(line) {
			values[i] = ""
			continue
		}
		if end > len(line) {
			end = len(line)
		}
		values[i] = strings.TrimSpace(line[start:end])
	}
	return values
}

// mapFixedWidthToEntry maps column header names to TopNEntry fields.
// Handles both API and SQL table column names from JAR v4.0.0.
func mapFixedWidthToEntry(headers, values []string) domain.TopNEntry {
	entry := domain.TopNEntry{}
	for i, header := range headers {
		if i >= len(values) || values[i] == "" {
			continue
		}
		h := strings.ToLower(strings.TrimSpace(header))
		v := values[i]

		switch {
		case h == "run time":
			entry.DurationMS = parseFloatSecondsToMS(v)
		case h == "first line#" || h == "line#":
			entry.LineNumber, _ = strconv.Atoi(v)
		case h == "last line#":
			// Store in Details for reference.
			if entry.Details != "" {
				entry.Details += "; "
			}
			entry.Details += "last_line=" + v
		case h == "trid":
			entry.TraceID = v
		case h == "queue":
			entry.Queue = v
		case h == "api":
			entry.Identifier = v
		case h == "sql statement":
			entry.Identifier = v
		case h == "filter":
			entry.Identifier = v
		case h == "escalation":
			entry.Identifier = v
		case h == "form":
			entry.Form = v
		case h == "table":
			entry.Form = v // Reuse Form field for table name
		case h == "pool":
			entry.Queue = v // Reuse Queue field for escalation pool
		case h == "start time" || h == "date/time":
			entry.Timestamp = parseTimestampSafe(v)
		case h == "q time":
			entry.QueueTimeMS = parseFloatSecondsToMS(v)
		case h == "success":
			entry.Success = strings.EqualFold(v, "true")
		case h == "thread":
			entry.TraceID = v
		case h == "line gap" || h == "thread gap":
			entry.DurationMS = parseFloatSecondsToMS(v)
		case h == "details" || h == "error":
			entry.Details = v
		case h == "identifier" || h == "name":
			entry.Identifier = v
		case strings.Contains(h, "duration"):
			entry.DurationMS, _ = strconv.Atoi(v)
		case h == "status":
			entry.Success = strings.EqualFold(v, "success") || strings.EqualFold(v, "ok") || strings.EqualFold(v, "true")
		case h == "user":
			entry.User = v
		case h == "file" || h == "file#":
			entry.FileNumber, _ = strconv.Atoi(v)
		}
	}
	return entry
}

// parseFloatSecondsToMS converts a float-seconds string (e.g., "0.122") to
// integer milliseconds (e.g., 122). Returns 0 on failure.
func parseFloatSecondsToMS(s string) int {
	s = strings.TrimSpace(s)
	f, err := strconv.ParseFloat(s, 64)
	if err != nil {
		return 0
	}
	return int(f*1000 + 0.5) // Round to nearest ms.
}

// --- Utility functions ---

// splitKeyValue splits "Key: Value" or "Key:  Value" lines on the
// FIRST colon. Suitable for sections where keys never contain colons
// (e.g., General Statistics).
func splitKeyValue(line string) (key, value string, ok bool) {
	idx := strings.Index(line, ":")
	if idx < 0 {
		return "", "", false
	}
	key = strings.TrimSpace(line[:idx])
	value = strings.TrimSpace(line[idx+1:])
	if key == "" {
		return "", "", false
	}
	return key, value, true
}

// splitKeyValueNumeric splits a "Key: <number>" line by finding the
// LAST colon whose right-hand side, after trimming whitespace, is a
// valid integer. This correctly handles keys that contain colons, such
// as AR form names ("HPD:Help Desk:  10").
//
// Fallback: if no colon yields a numeric right-hand side, it tries
// tab-separated format.
func splitKeyValueNumeric(line string) (key string, count int, ok bool) {
	// Walk backwards through colons to find one where the remainder
	// is a valid integer.
	for i := len(line) - 1; i >= 0; i-- {
		if line[i] == ':' {
			candidate := strings.TrimSpace(line[i+1:])
			candidate = strings.ReplaceAll(candidate, ",", "")
			if n, err := strconv.Atoi(candidate); err == nil {
				k := strings.TrimSpace(line[:i])
				if k != "" {
					return k, n, true
				}
			}
		}
	}

	// Fallback: try tab-separated.
	parts := strings.SplitN(line, "\t", 2)
	if len(parts) == 2 {
		k := strings.TrimSpace(parts[0])
		v := strings.TrimSpace(parts[1])
		v = strings.ReplaceAll(v, ",", "")
		if n, err := strconv.Atoi(v); err == nil && k != "" {
			return k, n, true
		}
	}

	return "", 0, false
}

// splitPipeCells splits a pipe-delimited row into trimmed cell values.
func splitPipeCells(line string) []string {
	// Remove leading/trailing pipes and split.
	line = strings.TrimSpace(line)
	line = strings.Trim(line, "|")
	parts := strings.Split(line, "|")

	cells := make([]string, 0, len(parts))
	for _, p := range parts {
		cells = append(cells, strings.TrimSpace(p))
	}
	return cells
}

// isSeparatorRow checks if all cells are only dashes (table separator).
func isSeparatorRow(cells []string) bool {
	for _, c := range cells {
		cleaned := strings.ReplaceAll(c, "-", "")
		cleaned = strings.ReplaceAll(cleaned, ":", "")
		cleaned = strings.TrimSpace(cleaned)
		if cleaned != "" {
			return false
		}
	}
	return true
}

// mapCellsToEntry maps named header columns to a TopNEntry.
func mapCellsToEntry(headers []string, cells []string) domain.TopNEntry {
	entry := domain.TopNEntry{}
	for i, header := range headers {
		if i >= len(cells) {
			break
		}
		h := strings.ToLower(strings.TrimSpace(header))
		v := strings.TrimSpace(cells[i])

		switch {
		case h == "rank" || h == "#":
			entry.Rank, _ = strconv.Atoi(v)
		case strings.Contains(h, "line"):
			entry.LineNumber, _ = strconv.Atoi(v)
		case h == "file" || h == "file#":
			entry.FileNumber, _ = strconv.Atoi(v)
		case strings.Contains(h, "time") && !strings.Contains(h, "duration") && !strings.Contains(h, "queue"):
			entry.Timestamp = parseTimestampSafe(v)
		case strings.Contains(h, "thread") || strings.Contains(h, "trace"):
			entry.TraceID = v
		case h == "rpc" || h == "rpcid" || h == "rpc id":
			entry.RPCID = v
		case h == "queue":
			entry.Queue = v
		case strings.Contains(h, "identifier") || strings.Contains(h, "name") || strings.Contains(h, "api") || strings.Contains(h, "statement"):
			entry.Identifier = v
		case h == "form":
			entry.Form = v
		case h == "user":
			entry.User = v
		case strings.Contains(h, "duration"):
			entry.DurationMS, _ = strconv.Atoi(v)
		case strings.Contains(h, "queue") && strings.Contains(h, "time"):
			entry.QueueTimeMS, _ = strconv.Atoi(v)
		case h == "status":
			entry.Success = strings.EqualFold(v, "success") || strings.EqualFold(v, "ok")
		case h == "details" || h == "error":
			entry.Details = v
		}
	}
	return entry
}

// splitFields splits a line on runs of two or more whitespace characters.
func splitFields(line string) []string {
	re := regexp.MustCompile(`\s{2,}`)
	parts := re.Split(line, -1)
	var fields []string
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			fields = append(fields, p)
		}
	}
	return fields
}

// parseIntSafe parses a string as int64, stripping commas and whitespace.
// Returns 0 on failure.
func parseIntSafe(s string) int64 {
	s = strings.TrimSpace(s)
	s = strings.ReplaceAll(s, ",", "")
	v, _ := strconv.ParseInt(s, 10, 64)
	return v
}

// parseTimestampSafe attempts to parse a timestamp string using known
// layouts. Returns the zero time on failure.
func parseTimestampSafe(s string) time.Time {
	ts, _ := tryParseTimestamp(s)
	return ts
}

// tryParseTimestamp attempts to parse a timestamp string against all
// known layouts. Returns the parsed time and true if any layout matches.
func tryParseTimestamp(s string) (time.Time, bool) {
	s = strings.TrimSpace(s)
	if s == "" {
		return time.Time{}, false
	}
	for _, layout := range timestampLayouts {
		if t, err := time.Parse(layout, s); err == nil {
			return t, true
		}
	}
	return time.Time{}, false
}

// --- JAR-Native Section Parsers ---

// isEqualsSeparator returns true if the line consists of only equals signs and spaces.
func isEqualsSeparator(line string) bool {
	trimmed := strings.TrimSpace(line)
	if trimmed == "" {
		return false
	}
	hasEquals := false
	for _, ch := range trimmed {
		if ch == '=' {
			hasEquals = true
		} else if ch != ' ' {
			return false
		}
	}
	return hasEquals
}

// parseFloatSafe parses a float string, returning 0 on failure. Handles "NaN".
func parseFloatSafe(s string) float64 {
	s = strings.TrimSpace(s)
	if s == "" || strings.EqualFold(s, "nan") {
		return 0
	}
	f, _ := strconv.ParseFloat(s, 64)
	return f
}

// parseGapEntries parses a gap table (line gaps or thread gaps) into JARGapEntry slices.
func parseGapEntries(lines []string) []domain.JARGapEntry {
	sepIdx := -1
	for i, line := range lines {
		if isDashSeparator(line) {
			sepIdx = i
			break
		}
	}
	if sepIdx < 1 {
		return nil
	}

	headerLine := lines[sepIdx-1]
	sepLine := lines[sepIdx]
	boundaries := extractColumnBoundaries(sepLine)
	headers := extractColumnValues(headerLine, boundaries)

	gapCol, lineCol, tridCol, dateCol, detailsCol := -1, -1, -1, -1, -1
	for i, h := range headers {
		hl := strings.ToLower(strings.TrimSpace(h))
		switch {
		case strings.Contains(hl, "gap"):
			gapCol = i
		case hl == "line#":
			lineCol = i
		case hl == "trid":
			tridCol = i
		case strings.Contains(hl, "date") || hl == "date/time":
			dateCol = i
		case hl == "details":
			detailsCol = i
		}
	}

	var entries []domain.JARGapEntry
	for i := sepIdx + 1; i < len(lines); i++ {
		trimmed := strings.TrimSpace(lines[i])
		if trimmed == "" {
			continue
		}
		if isDashSeparator(lines[i]) || isEqualsSeparator(lines[i]) || strings.HasPrefix(trimmed, "###") {
			break
		}

		values := extractColumnValues(lines[i], boundaries)
		entry := domain.JARGapEntry{}
		if gapCol >= 0 && gapCol < len(values) {
			entry.GapDuration = parseFloatSafe(values[gapCol])
		}
		if lineCol >= 0 && lineCol < len(values) {
			entry.LineNumber = int(parseIntSafe(values[lineCol]))
		}
		if tridCol >= 0 && tridCol < len(values) {
			entry.TraceID = values[tridCol]
		}
		if dateCol >= 0 && dateCol < len(values) {
			entry.Timestamp = parseTimestampSafe(values[dateCol])
		}
		if detailsCol >= 0 && detailsCol < len(values) {
			entry.Details = values[detailsCol]
		}
		if entry.GapDuration > 0 || entry.TraceID != "" {
			entries = append(entries, entry)
		}
	}
	return entries
}

// parseGroupedAggregateTable parses a grouped aggregate table (API/SQL/Escalation aggregates).
// Handles the two-pass grouped pattern: entity → operation rows → subtotal (------) → grand total (======).
func parseGroupedAggregateTable(lines []string) *domain.JARAggregateTable {
	sepIdx := -1
	for i, line := range lines {
		if isDashSeparator(line) {
			sepIdx = i
			break
		}
	}
	if sepIdx < 1 {
		return nil
	}

	headerLine := lines[sepIdx-1]
	sepLine := lines[sepIdx]
	boundaries := extractColumnBoundaries(sepLine)
	headers := extractColumnValues(headerLine, boundaries)

	// Map column roles.
	opCol, okCol, failCol, totalCol, countCol := -1, -1, -1, -1, -1
	minTimeCol, minLineCol, maxTimeCol, maxLineCol, avgTimeCol, sumTimeCol := -1, -1, -1, -1, -1, -1
	for i, h := range headers {
		hl := strings.ToLower(strings.TrimSpace(h))
		switch hl {
		case "api", "sql", "escalation":
			opCol = i
		case "ok":
			okCol = i
		case "fail":
			failCol = i
		case "total":
			totalCol = i
		case "count":
			countCol = i
		case "min time":
			minTimeCol = i
		case "min line":
			minLineCol = i
		case "max time":
			maxTimeCol = i
		case "max line":
			maxLineCol = i
		case "avg time":
			avgTimeCol = i
		case "sum time":
			sumTimeCol = i
		}
	}

	table := &domain.JARAggregateTable{
		GroupedBy: strings.TrimSpace(headers[0]),
	}

	getVal := func(values []string, col int) string {
		if col >= 0 && col < len(values) {
			return values[col]
		}
		return ""
	}

	buildRow := func(values []string) domain.JARAggregateRow {
		row := domain.JARAggregateRow{
			OperationType: getVal(values, opCol),
			OK:            int(parseIntSafe(getVal(values, okCol))),
			Fail:          int(parseIntSafe(getVal(values, failCol))),
			MinTime:       parseFloatSafe(getVal(values, minTimeCol)),
			MinLine:       int(parseIntSafe(getVal(values, minLineCol))),
			MaxTime:       parseFloatSafe(getVal(values, maxTimeCol)),
			MaxLine:       int(parseIntSafe(getVal(values, maxLineCol))),
			AvgTime:       parseFloatSafe(getVal(values, avgTimeCol)),
			SumTime:       parseFloatSafe(getVal(values, sumTimeCol)),
		}
		if totalCol >= 0 {
			row.Total = int(parseIntSafe(getVal(values, totalCol)))
		} else if countCol >= 0 {
			row.Total = int(parseIntSafe(getVal(values, countCol)))
		}
		return row
	}

	var currentGroup *domain.JARAggregateGroup
	expectSubtotal := false
	expectGrandTotal := false

	for i := sepIdx + 1; i < len(lines); i++ {
		line := lines[i]
		trimmed := strings.TrimSpace(line)
		if trimmed == "" {
			continue
		}
		if strings.HasPrefix(trimmed, "###") {
			break
		}

		if isEqualsSeparator(line) {
			if currentGroup != nil {
				table.Groups = append(table.Groups, *currentGroup)
				currentGroup = nil
			}
			expectGrandTotal = true
			continue
		}
		if isDashSeparator(line) {
			expectSubtotal = true
			continue
		}

		values := extractColumnValues(line, boundaries)

		if expectGrandTotal {
			row := buildRow(values)
			table.GrandTotal = &row
			expectGrandTotal = false
			continue
		}
		if expectSubtotal {
			row := buildRow(values)
			if currentGroup != nil {
				currentGroup.Subtotal = &row
				table.Groups = append(table.Groups, *currentGroup)
				currentGroup = nil
			}
			expectSubtotal = false
			continue
		}

		entityName := ""
		if len(values) > 0 {
			entityName = values[0]
		}
		if entityName != "" {
			if currentGroup != nil {
				table.Groups = append(table.Groups, *currentGroup)
			}
			currentGroup = &domain.JARAggregateGroup{EntityName: entityName}
		}

		if currentGroup != nil {
			row := buildRow(values)
			if row.Total > 0 || row.OK > 0 || row.OperationType != "" {
				currentGroup.Rows = append(currentGroup.Rows, row)
			}
		}
	}
	if currentGroup != nil {
		table.Groups = append(table.Groups, *currentGroup)
	}
	return table
}

// parseThreadStatsTable parses thread statistics into JARThreadStat slices.
// Handles API (with QCount/QTime columns) and SQL (without) variants.
func parseThreadStatsTable(lines []string) []domain.JARThreadStat {
	sepIdx := -1
	for i, line := range lines {
		if isDashSeparator(line) {
			sepIdx = i
			break
		}
	}
	if sepIdx < 1 {
		return nil
	}

	headerLine := lines[sepIdx-1]
	sepLine := lines[sepIdx]
	boundaries := extractColumnBoundaries(sepLine)
	headers := extractColumnValues(headerLine, boundaries)

	queueCol, threadCol, firstCol, lastCol := -1, -1, -1, -1
	countCol, qCountCol, qTimeCol, totalTimeCol, busyCol := -1, -1, -1, -1, -1
	for i, h := range headers {
		hl := strings.ToLower(strings.TrimSpace(h))
		switch {
		case hl == "queue":
			queueCol = i
		case hl == "thread":
			threadCol = i
		case strings.Contains(hl, "first"):
			firstCol = i
		case strings.Contains(hl, "last"):
			lastCol = i
		case hl == "count":
			countCol = i
		case hl == "q count":
			qCountCol = i
		case hl == "q time":
			qTimeCol = i
		case hl == "total time":
			totalTimeCol = i
		case strings.Contains(hl, "busy"):
			busyCol = i
		}
	}

	var entries []domain.JARThreadStat
	currentQueue := ""
	for i := sepIdx + 1; i < len(lines); i++ {
		trimmed := strings.TrimSpace(lines[i])
		if trimmed == "" {
			continue
		}
		if isDashSeparator(lines[i]) || isEqualsSeparator(lines[i]) || strings.HasPrefix(trimmed, "###") {
			break
		}

		values := extractColumnValues(lines[i], boundaries)
		if queueCol >= 0 && queueCol < len(values) && values[queueCol] != "" {
			currentQueue = values[queueCol]
		}

		stat := domain.JARThreadStat{Queue: currentQueue}
		if threadCol >= 0 && threadCol < len(values) {
			stat.ThreadID = values[threadCol]
		}
		if firstCol >= 0 && firstCol < len(values) {
			stat.FirstTime = parseTimestampSafe(values[firstCol])
		}
		if lastCol >= 0 && lastCol < len(values) {
			stat.LastTime = parseTimestampSafe(values[lastCol])
		}
		if countCol >= 0 && countCol < len(values) {
			stat.Count = int(parseIntSafe(values[countCol]))
		}
		if qCountCol >= 0 && qCountCol < len(values) {
			stat.QCount = int(parseIntSafe(values[qCountCol]))
		}
		if qTimeCol >= 0 && qTimeCol < len(values) {
			stat.QTime = parseFloatSafe(values[qTimeCol])
		}
		if totalTimeCol >= 0 && totalTimeCol < len(values) {
			stat.TotalTime = parseFloatSafe(values[totalTimeCol])
		}
		if busyCol >= 0 && busyCol < len(values) {
			s := strings.TrimSuffix(strings.TrimSpace(values[busyCol]), "%")
			stat.BusyPct = parseFloatSafe(s)
		}

		if stat.ThreadID != "" {
			entries = append(entries, stat)
		}
	}
	return entries
}

// parseAPIErrors parses "API CALLS THAT ERRORED OUT" section.
func parseAPIErrors(lines []string) []domain.JARAPIError {
	sepIdx := -1
	for i, line := range lines {
		if isDashSeparator(line) {
			sepIdx = i
			break
		}
	}
	if sepIdx < 1 {
		return nil
	}

	headerLine := lines[sepIdx-1]
	sepLine := lines[sepIdx]
	boundaries := extractColumnBoundaries(sepLine)
	headers := extractColumnValues(headerLine, boundaries)

	endLineCol, tridCol, queueCol, apiCol, formCol, userCol, startCol, errCol := -1, -1, -1, -1, -1, -1, -1, -1
	for i, h := range headers {
		hl := strings.ToLower(strings.TrimSpace(h))
		switch {
		case strings.Contains(hl, "end line"):
			endLineCol = i
		case hl == "trid":
			tridCol = i
		case hl == "queue":
			queueCol = i
		case hl == "api":
			apiCol = i
		case hl == "form":
			formCol = i
		case hl == "user":
			userCol = i
		case strings.Contains(hl, "start time"):
			startCol = i
		case strings.Contains(hl, "error"):
			errCol = i
		}
	}

	var entries []domain.JARAPIError
	for i := sepIdx + 1; i < len(lines); i++ {
		trimmed := strings.TrimSpace(lines[i])
		if trimmed == "" {
			continue
		}
		if isDashSeparator(lines[i]) || isEqualsSeparator(lines[i]) || strings.HasPrefix(trimmed, "###") {
			break
		}

		values := extractColumnValues(lines[i], boundaries)
		entry := domain.JARAPIError{}
		if endLineCol >= 0 && endLineCol < len(values) {
			entry.EndLine = int(parseIntSafe(values[endLineCol]))
		}
		if tridCol >= 0 && tridCol < len(values) {
			entry.TraceID = values[tridCol]
		}
		if queueCol >= 0 && queueCol < len(values) {
			entry.Queue = values[queueCol]
		}
		if apiCol >= 0 && apiCol < len(values) {
			entry.API = values[apiCol]
		}
		if formCol >= 0 && formCol < len(values) {
			entry.Form = values[formCol]
		}
		if userCol >= 0 && userCol < len(values) {
			entry.User = values[userCol]
		}
		if startCol >= 0 && startCol < len(values) {
			entry.StartTime = parseTimestampSafe(values[startCol])
		}
		if errCol >= 0 && errCol < len(values) {
			entry.ErrorMessage = values[errCol]
		}
		if entry.TraceID != "" || entry.EndLine > 0 {
			entries = append(entries, entry)
		}
	}
	return entries
}

// parseExceptionReport parses an API or SQL exception report.
// API variant columns: Line#, TrID, Type, Message
// SQL variant columns: Line#, TrID, Message, SQL Statement
func parseExceptionReport(lines []string) []domain.JARExceptionEntry {
	sepIdx := -1
	for i, line := range lines {
		if isDashSeparator(line) {
			sepIdx = i
			break
		}
	}
	if sepIdx < 1 {
		return nil
	}

	headerLine := lines[sepIdx-1]
	sepLine := lines[sepIdx]
	boundaries := extractColumnBoundaries(sepLine)
	headers := extractColumnValues(headerLine, boundaries)

	lineCol, tridCol, typeCol, msgCol, sqlCol := -1, -1, -1, -1, -1
	for i, h := range headers {
		hl := strings.ToLower(strings.TrimSpace(h))
		switch {
		case hl == "line#":
			lineCol = i
		case hl == "trid":
			tridCol = i
		case hl == "type":
			typeCol = i
		case hl == "message":
			msgCol = i
		case strings.Contains(hl, "sql statement"):
			sqlCol = i
		}
	}

	var entries []domain.JARExceptionEntry
	for i := sepIdx + 1; i < len(lines); i++ {
		trimmed := strings.TrimSpace(lines[i])
		if trimmed == "" {
			continue
		}
		if isDashSeparator(lines[i]) || isEqualsSeparator(lines[i]) || strings.HasPrefix(trimmed, "###") {
			break
		}

		values := extractColumnValues(lines[i], boundaries)
		entry := domain.JARExceptionEntry{}
		if lineCol >= 0 && lineCol < len(values) {
			entry.LineNumber = int(parseIntSafe(values[lineCol]))
		}
		if tridCol >= 0 && tridCol < len(values) {
			entry.TraceID = values[tridCol]
		}
		if typeCol >= 0 && typeCol < len(values) {
			entry.Type = values[typeCol]
		}
		if msgCol >= 0 && msgCol < len(values) {
			entry.Message = values[msgCol]
		}
		if sqlCol >= 0 && sqlCol < len(values) {
			entry.SQLStatement = values[sqlCol]
		}
		if entry.LineNumber > 0 || entry.TraceID != "" {
			entries = append(entries, entry)
		}
	}
	return entries
}

// parseMostExecutedFilters parses "50 MOST EXECUTED FLTR" section.
func parseMostExecutedFilters(lines []string) []domain.JARFilterMostExecuted {
	sepIdx := -1
	for i, line := range lines {
		if isDashSeparator(line) {
			sepIdx = i
			break
		}
	}
	if sepIdx < 1 {
		return nil
	}

	headerLine := lines[sepIdx-1]
	sepLine := lines[sepIdx]
	boundaries := extractColumnBoundaries(sepLine)
	headers := extractColumnValues(headerLine, boundaries)

	filterCol, passCol, failCol := -1, -1, -1
	for i, h := range headers {
		hl := strings.ToLower(strings.TrimSpace(h))
		switch {
		case hl == "filter":
			filterCol = i
		case strings.Contains(hl, "pass"):
			passCol = i
		case strings.Contains(hl, "fail"):
			failCol = i
		}
	}

	var entries []domain.JARFilterMostExecuted
	for i := sepIdx + 1; i < len(lines); i++ {
		trimmed := strings.TrimSpace(lines[i])
		if trimmed == "" {
			continue
		}
		if isDashSeparator(lines[i]) || isEqualsSeparator(lines[i]) || strings.HasPrefix(trimmed, "###") {
			break
		}

		values := extractColumnValues(lines[i], boundaries)
		entry := domain.JARFilterMostExecuted{}
		if filterCol >= 0 && filterCol < len(values) {
			entry.FilterName = values[filterCol]
		}
		if passCol >= 0 && passCol < len(values) {
			entry.PassCount = int(parseIntSafe(values[passCol]))
		}
		if failCol >= 0 && failCol < len(values) {
			entry.FailCount = int(parseIntSafe(values[failCol]))
		}
		if entry.FilterName != "" {
			entries = append(entries, entry)
		}
	}
	return entries
}

// parseFilterPerTransaction parses "50 MOST FILTERS PER TRANSACTION" section.
func parseFilterPerTransaction(lines []string) []domain.JARFilterPerTransaction {
	sepIdx := -1
	for i, line := range lines {
		if isDashSeparator(line) {
			sepIdx = i
			break
		}
	}
	if sepIdx < 1 {
		return nil
	}

	headerLine := lines[sepIdx-1]
	sepLine := lines[sepIdx]
	boundaries := extractColumnBoundaries(sepLine)
	headers := extractColumnValues(headerLine, boundaries)

	lineCol, tridCol, countCol, opCol, formCol, reqCol, rateCol := -1, -1, -1, -1, -1, -1, -1
	for i, h := range headers {
		hl := strings.ToLower(strings.TrimSpace(h))
		switch {
		case hl == "line#":
			lineCol = i
		case hl == "trid":
			tridCol = i
		case strings.Contains(hl, "filter count"):
			countCol = i
		case hl == "operation":
			opCol = i
		case hl == "form":
			formCol = i
		case strings.Contains(hl, "request"):
			reqCol = i
		case strings.Contains(hl, "filters/sec") || strings.Contains(hl, "filters/"):
			rateCol = i
		}
	}

	var entries []domain.JARFilterPerTransaction
	for i := sepIdx + 1; i < len(lines); i++ {
		trimmed := strings.TrimSpace(lines[i])
		if trimmed == "" {
			continue
		}
		if isDashSeparator(lines[i]) || isEqualsSeparator(lines[i]) || strings.HasPrefix(trimmed, "###") {
			break
		}

		values := extractColumnValues(lines[i], boundaries)
		entry := domain.JARFilterPerTransaction{}
		if lineCol >= 0 && lineCol < len(values) {
			entry.LineNumber = int(parseIntSafe(values[lineCol]))
		}
		if tridCol >= 0 && tridCol < len(values) {
			entry.TraceID = values[tridCol]
		}
		if countCol >= 0 && countCol < len(values) {
			entry.FilterCount = int(parseIntSafe(values[countCol]))
		}
		if opCol >= 0 && opCol < len(values) {
			entry.Operation = values[opCol]
		}
		if formCol >= 0 && formCol < len(values) {
			entry.Form = values[formCol]
		}
		if reqCol >= 0 && reqCol < len(values) {
			entry.RequestID = values[reqCol]
		}
		if rateCol >= 0 && rateCol < len(values) {
			entry.FiltersPerSec = parseFloatSafe(values[rateCol]) // handles NaN → 0
		}
		if entry.LineNumber > 0 || entry.TraceID != "" {
			entries = append(entries, entry)
		}
	}
	return entries
}

// parseFilterExecutedPerTxn parses "50 MOST EXECUTED FLTR PER TRANSACTION" section.
func parseFilterExecutedPerTxn(lines []string) []domain.JARFilterExecutedPerTxn {
	sepIdx := -1
	for i, line := range lines {
		if isDashSeparator(line) {
			sepIdx = i
			break
		}
	}
	if sepIdx < 1 {
		return nil
	}

	headerLine := lines[sepIdx-1]
	sepLine := lines[sepIdx]
	boundaries := extractColumnBoundaries(sepLine)
	headers := extractColumnValues(headerLine, boundaries)

	lineCol, tridCol, filterCol, passCol, failCol := -1, -1, -1, -1, -1
	for i, h := range headers {
		hl := strings.ToLower(strings.TrimSpace(h))
		switch {
		case hl == "line#":
			lineCol = i
		case hl == "trid":
			tridCol = i
		case hl == "filter":
			filterCol = i
		case strings.Contains(hl, "pass"):
			passCol = i
		case strings.Contains(hl, "fail"):
			failCol = i
		}
	}

	var entries []domain.JARFilterExecutedPerTxn
	for i := sepIdx + 1; i < len(lines); i++ {
		trimmed := strings.TrimSpace(lines[i])
		if trimmed == "" {
			continue
		}
		if isDashSeparator(lines[i]) || isEqualsSeparator(lines[i]) || strings.HasPrefix(trimmed, "###") {
			break
		}

		values := extractColumnValues(lines[i], boundaries)
		entry := domain.JARFilterExecutedPerTxn{}
		if lineCol >= 0 && lineCol < len(values) {
			entry.LineNumber = int(parseIntSafe(values[lineCol]))
		}
		if tridCol >= 0 && tridCol < len(values) {
			entry.TraceID = values[tridCol]
		}
		if filterCol >= 0 && filterCol < len(values) {
			entry.FilterName = values[filterCol]
		}
		if passCol >= 0 && passCol < len(values) {
			entry.PassCount = int(parseIntSafe(values[passCol]))
		}
		if failCol >= 0 && failCol < len(values) {
			entry.FailCount = int(parseIntSafe(values[failCol]))
		}
		if entry.LineNumber > 0 || entry.TraceID != "" {
			entries = append(entries, entry)
		}
	}
	return entries
}

// parseFilterLevels parses "50 MOST FILTER LEVELS IN TRANSACTIONS" section.
func parseFilterLevels(lines []string) []domain.JARFilterLevel {
	sepIdx := -1
	for i, line := range lines {
		if isDashSeparator(line) {
			sepIdx = i
			break
		}
	}
	if sepIdx < 1 {
		return nil
	}

	headerLine := lines[sepIdx-1]
	sepLine := lines[sepIdx]
	boundaries := extractColumnBoundaries(sepLine)
	headers := extractColumnValues(headerLine, boundaries)

	lineCol, tridCol, levelCol, opCol, formCol, reqCol := -1, -1, -1, -1, -1, -1
	for i, h := range headers {
		hl := strings.ToLower(strings.TrimSpace(h))
		switch {
		case hl == "line#":
			lineCol = i
		case hl == "trid":
			tridCol = i
		case strings.Contains(hl, "filter level"):
			levelCol = i
		case hl == "operation":
			opCol = i
		case hl == "form":
			formCol = i
		case strings.Contains(hl, "request"):
			reqCol = i
		}
	}

	var entries []domain.JARFilterLevel
	for i := sepIdx + 1; i < len(lines); i++ {
		trimmed := strings.TrimSpace(lines[i])
		if trimmed == "" {
			continue
		}
		if isDashSeparator(lines[i]) || isEqualsSeparator(lines[i]) || strings.HasPrefix(trimmed, "###") {
			break
		}

		values := extractColumnValues(lines[i], boundaries)
		entry := domain.JARFilterLevel{}
		if lineCol >= 0 && lineCol < len(values) {
			entry.LineNumber = int(parseIntSafe(values[lineCol]))
		}
		if tridCol >= 0 && tridCol < len(values) {
			entry.TraceID = values[tridCol]
		}
		if levelCol >= 0 && levelCol < len(values) {
			entry.FilterLevel = int(parseIntSafe(values[levelCol]))
		}
		if opCol >= 0 && opCol < len(values) {
			entry.Operation = values[opCol]
		}
		if formCol >= 0 && formCol < len(values) {
			entry.Form = values[formCol]
		}
		if reqCol >= 0 && reqCol < len(values) {
			entry.RequestID = values[reqCol]
		}
		if entry.LineNumber > 0 || entry.TraceID != "" {
			entries = append(entries, entry)
		}
	}
	return entries
}

// parseAPIAbbreviationLegend parses the "API Call Abbreviation Legend" section.
func parseAPIAbbreviationLegend(lines []string) []domain.JARAPIAbbreviation {
	var entries []domain.JARAPIAbbreviation
	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if trimmed == "" {
			continue
		}
		parts := strings.SplitN(trimmed, "=", 2)
		if len(parts) != 2 {
			continue
		}
		abbr := strings.TrimSpace(parts[0])
		full := strings.TrimSpace(parts[1])
		if abbr != "" && full != "" {
			entries = append(entries, domain.JARAPIAbbreviation{
				Abbreviation: abbr,
				FullName:     full,
			})
		}
	}
	return entries
}

// parseDurationToMS converts a human-readable duration string (e.g., "8h 30m 45s") to milliseconds.
func parseDurationToMS(s string) int64 {
	s = strings.TrimSpace(s)
	if s == "" {
		return 0
	}

	var totalMS int64
	re := regexp.MustCompile(`(\d+)\s*(h|m|s|ms)`)
	matches := re.FindAllStringSubmatch(s, -1)
	for _, m := range matches {
		val := parseIntSafe(m[1])
		switch m[2] {
		case "h":
			totalMS += val * 3600000
		case "m":
			totalMS += val * 60000
		case "s":
			totalMS += val * 1000
		case "ms":
			totalMS += val
		}
	}
	return totalMS
}

// parseLoggingActivity parses the "Logging Activity" section.
// Expected table format:
//
//	Type    First                         Last                          Duration
//	----    -----                         ----                          --------
//	API     Mon Feb 03 2026 10:00:00.123  Mon Feb 03 2026 18:30:45.678  8h 30m 45s
func parseLoggingActivity(lines []string) []domain.LoggingActivity {
	sepIdx := -1
	for i, line := range lines {
		if isDashSeparator(line) {
			sepIdx = i
			break
		}
	}
	if sepIdx < 1 {
		return nil
	}

	headerLine := lines[sepIdx-1]
	sepLine := lines[sepIdx]
	boundaries := extractColumnBoundaries(sepLine)
	headers := extractColumnValues(headerLine, boundaries)

	typeCol, firstCol, lastCol, durCol := -1, -1, -1, -1
	for i, h := range headers {
		hl := strings.ToLower(strings.TrimSpace(h))
		switch {
		case hl == "type":
			typeCol = i
		case hl == "first":
			firstCol = i
		case hl == "last":
			lastCol = i
		case strings.Contains(hl, "duration"):
			durCol = i
		}
	}

	var entries []domain.LoggingActivity
	for i := sepIdx + 1; i < len(lines); i++ {
		trimmed := strings.TrimSpace(lines[i])
		if trimmed == "" {
			continue
		}
		if isDashSeparator(lines[i]) || isEqualsSeparator(lines[i]) || strings.HasPrefix(trimmed, "###") {
			break
		}

		values := extractColumnValues(lines[i], boundaries)
		entry := domain.LoggingActivity{}
		if typeCol >= 0 && typeCol < len(values) {
			entry.LogType = strings.TrimSpace(values[typeCol])
		}
		if firstCol >= 0 && firstCol < len(values) {
			entry.FirstTimestamp = parseTimestampSafe(strings.TrimSpace(values[firstCol]))
		}
		if lastCol >= 0 && lastCol < len(values) {
			entry.LastTimestamp = parseTimestampSafe(strings.TrimSpace(values[lastCol]))
		}
		if durCol >= 0 && durCol < len(values) {
			entry.DurationMS = parseDurationToMS(strings.TrimSpace(values[durCol]))
		}
		if entry.LogType != "" {
			entries = append(entries, entry)
		}
	}
	return entries
}

// parseFileMetadata parses the "Input filenames" / "File Information" section.
// Expected table format:
//
//	Name                    File#  File Start                     File End                       Duration
//	----                    -----  ----------                     --------                       --------
//	arserver_20260203.log   1      Mon Feb 03 2026 10:00:00.123   Mon Feb 03 2026 14:00:00.456   4h 0m 0s
func parseFileMetadata(lines []string) []domain.FileMetadata {
	sepIdx := -1
	for i, line := range lines {
		if isDashSeparator(line) {
			sepIdx = i
			break
		}
	}
	if sepIdx < 1 {
		return nil
	}

	headerLine := lines[sepIdx-1]
	sepLine := lines[sepIdx]
	boundaries := extractColumnBoundaries(sepLine)
	headers := extractColumnValues(headerLine, boundaries)

	nameCol, numCol, startCol, endCol, durCol := -1, -1, -1, -1, -1
	for i, h := range headers {
		hl := strings.ToLower(strings.TrimSpace(h))
		switch {
		case hl == "name" || strings.Contains(hl, "filename"):
			nameCol = i
		case hl == "file#" || strings.Contains(hl, "number"):
			numCol = i
		case strings.Contains(hl, "file start") || (strings.Contains(hl, "start") && !strings.Contains(hl, "name")):
			startCol = i
		case strings.Contains(hl, "file end") || (strings.Contains(hl, "end") && !strings.Contains(hl, "name")):
			endCol = i
		case strings.Contains(hl, "duration"):
			durCol = i
		}
	}

	var entries []domain.FileMetadata
	for i := sepIdx + 1; i < len(lines); i++ {
		trimmed := strings.TrimSpace(lines[i])
		if trimmed == "" {
			continue
		}
		if isDashSeparator(lines[i]) || isEqualsSeparator(lines[i]) || strings.HasPrefix(trimmed, "###") {
			break
		}

		values := extractColumnValues(lines[i], boundaries)
		entry := domain.FileMetadata{}
		if nameCol >= 0 && nameCol < len(values) {
			entry.FileName = strings.TrimSpace(values[nameCol])
		}
		if numCol >= 0 && numCol < len(values) {
			entry.FileNumber = int(parseIntSafe(values[numCol]))
		}
		if startCol >= 0 && startCol < len(values) {
			entry.StartTime = parseTimestampSafe(strings.TrimSpace(values[startCol]))
		}
		if endCol >= 0 && endCol < len(values) {
			entry.EndTime = parseTimestampSafe(strings.TrimSpace(values[endCol]))
		}
		if durCol >= 0 && durCol < len(values) {
			entry.DurationMS = parseDurationToMS(strings.TrimSpace(values[durCol]))
		}
		if entry.FileName != "" || entry.FileNumber > 0 {
			entries = append(entries, entry)
		}
	}
	return entries
}

// sectionContainsNoData checks if a section body indicates no data (e.g., "No Queued API's").
func sectionContainsNoData(lines []string) bool {
	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if trimmed == "" {
			continue
		}
		if strings.HasPrefix(trimmed, "No ") || strings.HasPrefix(trimmed, "None") {
			return true
		}
		// If we find a non-empty, non-"No" line, there's data.
		return false
	}
	return true
}

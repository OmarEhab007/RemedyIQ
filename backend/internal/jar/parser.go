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
var (
	sectionHeaderRe = regexp.MustCompile(`^={3,}\s*(.+?)\s*={3,}$`)
	separatorRe     = regexp.MustCompile(`^-{3,}$`)
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
// into a structured DashboardData value.
//
// The JAR output is organized into sections separated by "===" header
// lines. Each section contains either key-value statistics or tabular
// top-N data. This parser is intentionally lenient: unrecognized lines
// and sections are silently skipped so that minor JAR version differences
// do not cause hard failures.
func ParseOutput(output string) (*domain.DashboardData, error) {
	if strings.TrimSpace(output) == "" {
		return nil, fmt.Errorf("jar parser: empty output")
	}

	data := &domain.DashboardData{
		Distribution: make(map[string]map[string]int),
	}

	sections := splitSections(output)

	for name, body := range sections {
		normalized := strings.ToLower(strings.TrimSpace(name))

		switch {
		case strings.Contains(normalized, "general statistic"):
			parseGeneralStatistics(body, &data.GeneralStats)

		case strings.Contains(normalized, "top") && strings.Contains(normalized, "api"):
			data.TopAPICalls = parseTopNSection(body)

		case strings.Contains(normalized, "top") && strings.Contains(normalized, "sql"):
			data.TopSQL = parseTopNSection(body)

		case strings.Contains(normalized, "top") && strings.Contains(normalized, "filter"):
			data.TopFilters = parseTopNSection(body)

		case strings.Contains(normalized, "top") && strings.Contains(normalized, "escalation"):
			data.TopEscalations = parseTopNSection(body)

		case strings.Contains(normalized, "thread"):
			parseDistribution(body, data, "threads")

		case strings.Contains(normalized, "exception") || strings.Contains(normalized, "error"):
			parseDistribution(body, data, "errors")

		case strings.Contains(normalized, "user"):
			parseDistribution(body, data, "users")

		case strings.Contains(normalized, "form"):
			parseDistribution(body, data, "forms")
		}
	}

	return data, nil
}

// splitSections splits the JAR output into named sections.
// A section starts with a line matching "=== Section Name ===" and
// continues until the next section header or end of input.
func splitSections(output string) map[string][]string {
	sections := make(map[string][]string)
	lines := strings.Split(output, "\n")

	currentSection := ""
	var currentBody []string

	for _, line := range lines {
		if m := sectionHeaderRe.FindStringSubmatch(line); m != nil {
			// Save previous section.
			if currentSection != "" {
				sections[currentSection] = currentBody
			}
			currentSection = m[1]
			currentBody = nil
			continue
		}

		if currentSection != "" {
			currentBody = append(currentBody, line)
		}
	}

	// Save the last section.
	if currentSection != "" {
		sections[currentSection] = currentBody
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
		case strings.Contains(keyLower, "api"):
			stats.APICount = parseIntSafe(value)
		case strings.Contains(keyLower, "sql"):
			stats.SQLCount = parseIntSafe(value)
		case strings.Contains(keyLower, "filter"):
			stats.FilterCount = parseIntSafe(value)
		case strings.Contains(keyLower, "escalation"):
			stats.EscCount = parseIntSafe(value)
		case strings.Contains(keyLower, "unique user"):
			stats.UniqueUsers = int(parseIntSafe(value))
		case strings.Contains(keyLower, "unique form"):
			stats.UniqueForms = int(parseIntSafe(value))
		case strings.Contains(keyLower, "unique table"):
			stats.UniqueTables = int(parseIntSafe(value))
		case strings.Contains(keyLower, "log start"):
			stats.LogStart = parseTimestampSafe(value)
		case strings.Contains(keyLower, "log end"):
			stats.LogEnd = parseTimestampSafe(value)
		case strings.Contains(keyLower, "log duration") || strings.Contains(keyLower, "duration"):
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

	// Detect pipe-delimited format.
	isPipeFormat := false
	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, "|") && strings.Count(trimmed, "|") >= 3 {
			isPipeFormat = true
			break
		}
	}

	if isPipeFormat {
		entries = parsePipeTable(lines)
	} else {
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

package logparser

import (
	"bufio"
	"context"
	"fmt"
	"math"
	"os"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/OmarEhab007/RemedyIQ/backend/internal/domain"
	"github.com/google/uuid"
)

// lineRegex matches the angle-bracket AR Server log format:
// <TYPE> <TrID: V> <TID: V> <RPC ID: V> <Queue: V> <Client-RPC: V> <USER: V> <Overlay-Group: V> /* timestamp */ content
var lineRegex = regexp.MustCompile(
	`^<(\w{3,4})\s*>\s*` +
		`<TrID:\s*([^>]+?)>\s*` +
		`<TID:\s*(\d+)\s*>\s*` +
		`<RPC ID:\s*(\d+)\s*>\s*` +
		`<Queue:\s*([^>]+?)>\s*` +
		`<Client-RPC:\s*([^>]+?)>\s*` +
		`<USER:\s*([^>]+?)>\s*` +
		`<Overlay-Group:\s*([^>]+?)>\s*` +
		`/\*\s*(.+?)\s*\*/\s*` +
		`(.*)$`,
)

// arTimestampLayout is the Go time layout for AR Server log timestamps.
// Example: "Mon Nov 24 2025 14:46:58.5050"
const arTimestampLayout = "Mon Jan 02 2006 15:04:05.0000"

// sqlTableRegex extracts table names from common SQL patterns.
var sqlTableRegex = regexp.MustCompile(`(?i)\b(?:FROM|INTO|UPDATE|DELETE\s+FROM)\s+(\w+)`)

// filterNameRegex extracts filter name from content like:
// "Checking "FilterName" ..." or "Run If ... Filter: FilterName ..."
var filterNameRegex = regexp.MustCompile(`(?:Checking\s+"([^"]+)"|Filter:\s*(\S+))`)

// filterOperationRegex extracts operation and form from "Operation - SET on FormName".
var filterOperationRegex = regexp.MustCompile(`Operation\s*-\s*(\w+)\s+on\s+(\S+)`)

// durationSecsRegex extracts timing in seconds from content like "run time 0.123 secs" or "(0.456 secs)".
var durationSecsRegex = regexp.MustCompile(`(\d+\.?\d*)\s*secs?\b`)

// durationMSRegex extracts timing in milliseconds.
var durationMSRegex = regexp.MustCompile(`(\d+\.?\d*)\s*ms\b`)

// elapsedRegex extracts "elapsed N.NNN" patterns.
var elapsedRegex = regexp.MustCompile(`(?i)elapsed\s*[:=]?\s*(\d+\.?\d*)`)

// sqlRowsTimeRegex extracts SQL result timing like "OK (nnn rows nn.nnn secs)".
var sqlRowsTimeRegex = regexp.MustCompile(`(?i)OK\s*\(\s*\d+\s*rows?\s+(\d+\.?\d*)\s*secs?\s*\)`)

// ParseLine parses a single angle-bracket formatted AR Server log line into a LogEntry.
// Returns nil, error if the line doesn't match the expected format.
func ParseLine(line string, lineNum uint32, tenantID, jobID string) (*domain.LogEntry, error) {
	matches := lineRegex.FindStringSubmatch(line)
	if matches == nil {
		return nil, fmt.Errorf("line does not match expected format")
	}

	logType := normalizeLogType(strings.TrimSpace(matches[1]))
	if logType == "" {
		return nil, fmt.Errorf("unknown log type: %q", matches[1])
	}

	tsStr := strings.TrimSpace(matches[9])
	ts, err := time.Parse(arTimestampLayout, tsStr)
	if err != nil {
		return nil, fmt.Errorf("parse timestamp %q: %w", tsStr, err)
	}

	content := strings.TrimSpace(matches[10])

	entry := &domain.LogEntry{
		TenantID:   tenantID,
		JobID:      jobID,
		EntryID:    uuid.New().String(),
		LineNumber: lineNum,
		FileNumber: 1,
		Timestamp:  ts,
		IngestedAt: time.Now().UTC(),
		LogType:    logType,
		TraceID:    strings.TrimSpace(matches[2]),
		RPCID:      strings.TrimSpace(matches[4]),
		ThreadID:   strings.TrimSpace(matches[3]),
		Queue:      strings.TrimSpace(matches[5]),
		User:       cleanUser(strings.TrimSpace(matches[7])),
		Success:    true,
		RawText:    content,
	}

	switch logType {
	case domain.LogTypeSQL:
		parseSQL(entry, content)
	case domain.LogTypeFilter:
		parseFilter(entry, content)
	case domain.LogTypeEscalation:
		parseEscalation(entry, content)
	case domain.LogTypeAPI:
		parseAPI(entry, content)
	}

	return entry, nil
}

// ParseFile reads a log file line-by-line and calls the callback with batches of parsed entries.
// Lines that don't match the expected format are silently skipped.
// Returns the total number of successfully parsed entries.
func ParseFile(ctx context.Context, filePath string, tenantID, jobID string, batchSize int, callback func([]domain.LogEntry) error) (int64, error) {
	f, err := os.Open(filePath)
	if err != nil {
		return 0, fmt.Errorf("open file: %w", err)
	}
	defer f.Close()

	scanner := bufio.NewScanner(f)
	scanner.Buffer(make([]byte, 0, 1024*1024), 1024*1024) // 1MB line buffer

	batch := make([]domain.LogEntry, 0, batchSize)
	var lineNum uint32
	var totalParsed int64

	for scanner.Scan() {
		if err := ctx.Err(); err != nil {
			// Flush remaining batch before returning.
			if len(batch) > 0 {
				if flushErr := callback(batch); flushErr != nil {
					return totalParsed, fmt.Errorf("flush on cancel: %w", flushErr)
				}
				totalParsed += int64(len(batch))
			}
			return totalParsed, err
		}

		lineNum++
		line := scanner.Text()
		if line == "" {
			continue
		}

		entry, err := ParseLine(line, lineNum, tenantID, jobID)
		if err != nil {
			// Skip malformed lines (continuation lines, headers, etc.)
			continue
		}

		batch = append(batch, *entry)

		if len(batch) >= batchSize {
			if err := callback(batch); err != nil {
				return totalParsed, fmt.Errorf("batch insert at line %d: %w", lineNum, err)
			}
			totalParsed += int64(len(batch))
			batch = batch[:0]
		}
	}

	if err := scanner.Err(); err != nil {
		return totalParsed, fmt.Errorf("scan file: %w", err)
	}

	// Flush remaining entries.
	if len(batch) > 0 {
		if err := callback(batch); err != nil {
			return totalParsed, fmt.Errorf("flush final batch: %w", err)
		}
		totalParsed += int64(len(batch))
	}

	return totalParsed, nil
}

// normalizeLogType converts a raw log type string to the domain LogType constant.
func normalizeLogType(raw string) domain.LogType {
	switch strings.ToUpper(raw) {
	case "API":
		return domain.LogTypeAPI
	case "SQL":
		return domain.LogTypeSQL
	case "FLTR":
		return domain.LogTypeFilter
	case "ESCL":
		return domain.LogTypeEscalation
	default:
		return ""
	}
}

// cleanUser removes pool annotations like "(Pool 3)" from user names.
func cleanUser(user string) string {
	if idx := strings.Index(user, "(Pool"); idx > 0 {
		return strings.TrimSpace(user[:idx])
	}
	return user
}

// extractDuration tries to find timing information in log content and sets DurationMS.
// Returns true if a duration was extracted.
func extractDuration(entry *domain.LogEntry, content string) bool {
	// Try SQL result pattern first: "OK (123 rows 0.456 secs)"
	if m := sqlRowsTimeRegex.FindStringSubmatch(content); m != nil {
		if secs, err := strconv.ParseFloat(m[1], 64); err == nil {
			entry.DurationMS = uint32(math.Round(secs * 1000))
			return true
		}
	}
	// Try generic seconds pattern: "0.123 secs"
	if m := durationSecsRegex.FindStringSubmatch(content); m != nil {
		if secs, err := strconv.ParseFloat(m[1], 64); err == nil {
			entry.DurationMS = uint32(math.Round(secs * 1000))
			return true
		}
	}
	// Try milliseconds pattern: "123 ms"
	if m := durationMSRegex.FindStringSubmatch(content); m != nil {
		if ms, err := strconv.ParseFloat(m[1], 64); err == nil {
			entry.DurationMS = uint32(math.Round(ms))
			return true
		}
	}
	// Try elapsed pattern: "elapsed 0.123"
	if m := elapsedRegex.FindStringSubmatch(content); m != nil {
		if secs, err := strconv.ParseFloat(m[1], 64); err == nil {
			entry.DurationMS = uint32(math.Round(secs * 1000))
			return true
		}
	}
	return false
}

// parseSQL extracts SQL-specific fields from the log content.
func parseSQL(entry *domain.LogEntry, content string) {
	entry.SQLStatement = content

	upper := strings.ToUpper(content)
	if strings.HasPrefix(upper, "OK") || strings.HasPrefix(upper, "COMMIT") ||
		strings.HasPrefix(upper, "BEGIN") || strings.HasPrefix(upper, "NO.") {
		extractDuration(entry, content)
		return
	}

	if m := sqlTableRegex.FindStringSubmatch(content); m != nil {
		entry.SQLTable = m[1]
	}
	extractDuration(entry, content)
}

// parseFilter extracts filter-specific fields from the log content.
func parseFilter(entry *domain.LogEntry, content string) {
	if m := filterNameRegex.FindStringSubmatch(content); m != nil {
		if m[1] != "" {
			entry.FilterName = m[1]
		} else if m[2] != "" {
			entry.FilterName = m[2]
		}
	}

	if m := filterOperationRegex.FindStringSubmatch(content); m != nil {
		entry.Operation = m[1]
		entry.Form = m[2]
	}

	extractDuration(entry, content)
}

// parseEscalation extracts escalation-specific fields from the log content.
func parseEscalation(entry *domain.LogEntry, content string) {
	if idx := strings.Index(content, "("); idx > 0 {
		entry.EscName = strings.TrimSpace(content[:idx])
	}
	extractDuration(entry, content)
}

// parseAPI extracts API-specific fields from the log content.
func parseAPI(entry *domain.LogEntry, content string) {
	// API entries contain operation codes and form names.
	// Example content: "GE HPD:Help Desk ..."
	parts := strings.Fields(content)
	if len(parts) >= 1 {
		entry.APICode = parts[0]
	}
	if len(parts) >= 2 {
		entry.Form = parts[1]
	}
	extractDuration(entry, content)
}

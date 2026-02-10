package jar

import (
	"fmt"
	"strings"

	"github.com/OmarEhab007/RemedyIQ/backend/internal/domain"
)

// BuildArgs constructs the command-line arguments for ARLogAnalyzer.jar
// from a JARFlags struct and an input file path. The returned slice is
// intended to be appended after the "-jar <path>" portion of the java
// command.
//
// Flag mapping (JAR CLI flag -> JARFlags field):
//
//	-n   -> TopN          (top-N count for ranked reports)
//	-g   -> GroupBy       (grouping dimensions, repeatable)
//	-s   -> SortBy        (sort column for ranked output)
//	-u   -> UserFilter    (include only this user)
//	-xu  -> ExcludeUsers  (exclude these users, repeatable)
//	-b   -> BeginTime     (start of time window)
//	-e   -> EndTime       (end of time window)
//	-l   -> Locale        (locale for date parsing)
//	-ldf -> DateFormat    (custom date format string)
//	-noapi  -> SkipAPI    (skip API log analysis)
//	-nosql  -> SkipSQL    (skip SQL log analysis)
//	-noesc  -> SkipEsc    (skip escalation log analysis)
//	-nofltr -> SkipFltr   (skip filter log analysis)
//	-fts    -> IncludeFTS (include full-text search data)
func BuildArgs(flags domain.JARFlags, filePath string) []string {
	var args []string

	// Numeric flags
	if flags.TopN > 0 {
		args = append(args, "-n", fmt.Sprintf("%d", flags.TopN))
	}

	// Repeatable string flags
	for _, g := range flags.GroupBy {
		g = strings.TrimSpace(g)
		if g != "" {
			args = append(args, "-g", g)
		}
	}

	// Single-value string flags
	if flags.SortBy != "" {
		args = append(args, "-s", flags.SortBy)
	}
	if flags.UserFilter != "" {
		args = append(args, "-u", flags.UserFilter)
	}
	for _, xu := range flags.ExcludeUsers {
		xu = strings.TrimSpace(xu)
		if xu != "" {
			args = append(args, "-xu", xu)
		}
	}

	// Time window flags
	if flags.BeginTime != "" {
		args = append(args, "-b", flags.BeginTime)
	}
	if flags.EndTime != "" {
		args = append(args, "-e", flags.EndTime)
	}

	// Locale / date format
	if flags.Locale != "" {
		args = append(args, "-l", flags.Locale)
	}
	if flags.DateFormat != "" {
		args = append(args, "-ldf", flags.DateFormat)
	}

	// Boolean skip flags (presence means "skip")
	if flags.SkipAPI {
		args = append(args, "-noapi")
	}
	if flags.SkipSQL {
		args = append(args, "-nosql")
	}
	if flags.SkipEsc {
		args = append(args, "-noesc")
	}
	if flags.SkipFltr {
		args = append(args, "-nofltr")
	}

	// Boolean include flags
	if flags.IncludeFTS {
		args = append(args, "-fts")
	}

	// The input file path is always the last argument.
	args = append(args, filePath)

	return args
}

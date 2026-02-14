package handlers

import (
	"bytes"
	"fmt"
	"html/template"
	"strings"
	"time"

	"github.com/OmarEhab007/RemedyIQ/backend/internal/domain"
)

// generateHTMLReport produces a standalone HTML page from the report data.
func generateHTMLReport(data *reportData) (string, error) {
	tmpl, err := template.New("report").Funcs(template.FuncMap{
		"fmtDuration": func(ms int) string {
			if ms < 1000 {
				return fmt.Sprintf("%d ms", ms)
			}
			return fmt.Sprintf("%.2f s", float64(ms)/1000)
		},
		"fmtFloat": func(f float64) string {
			return fmt.Sprintf("%.2f", f)
		},
		"fmtFloatMS": func(f float64) string {
			if f < 1000 {
				return fmt.Sprintf("%.1f ms", f)
			}
			return fmt.Sprintf("%.2f s", f/1000)
		},
		"fmtTime": func(t time.Time) string {
			if t.IsZero() {
				return "-"
			}
			return t.Format("2006-01-02 15:04:05")
		},
		"fmtPct": func(f float64) string {
			return fmt.Sprintf("%.1f%%", f)
		},
		"successClass": func(ok bool) string {
			if ok {
				return "status-ok"
			}
			return "status-fail"
		},
		"successText": func(ok bool) string {
			if ok {
				return "OK"
			}
			return "FAIL"
		},
		"add": func(a, b int) int { return a + b },
		"truncate": func(s string, n int) string {
			if len(s) <= n {
				return s
			}
			return s[:n] + "..."
		},
	}).Parse(reportTemplate)
	if err != nil {
		return "", fmt.Errorf("parse report template: %w", err)
	}

	// Build the template context.
	ctx := buildTemplateContext(data)

	var buf bytes.Buffer
	if err := tmpl.Execute(&buf, ctx); err != nil {
		return "", fmt.Errorf("execute report template: %w", err)
	}
	return buf.String(), nil
}

// templateContext is the data passed to the HTML template.
type templateContext struct {
	JobID       string
	GeneratedAt string
	Stats       domain.GeneralStatistics
	TopAPI      []domain.TopNEntry
	TopSQL      []domain.TopNEntry
	TopFilters  []domain.TopNEntry
	TopEsc      []domain.TopNEntry

	// JAR-native aggregates (if available)
	HasJARAggregates bool
	JARAPIByForm     *domain.JARAggregateTable
	JARAPIByClient   *domain.JARAggregateTable
	JARSQLByTable    *domain.JARAggregateTable
	JAREscByForm     *domain.JARAggregateTable

	// Computed aggregates fallback
	HasComputedAggregates bool
	ComputedAggregates    *domain.AggregatesResponse

	// JAR-native exceptions
	HasJARExceptions bool
	JARAPIErrors     []domain.JARAPIError
	JARAPIExceptions []domain.JARExceptionEntry
	JARSQLExceptions []domain.JARExceptionEntry

	// Computed exceptions fallback
	HasComputedExceptions bool
	ComputedExceptions    *domain.ExceptionsResponse

	// JAR-native gaps
	HasJARGaps     bool
	JARLineGaps    []domain.JARGapEntry
	JARThreadGaps  []domain.JARGapEntry
	QueueHealth    []domain.QueueHealthSummary

	// Computed gaps fallback
	HasComputedGaps bool
	ComputedGaps    *domain.GapsResponse

	// JAR-native threads
	HasJARThreads bool
	JARAPIThreads []domain.JARThreadStat
	JARSQLThreads []domain.JARThreadStat

	// Computed threads fallback
	HasComputedThreads bool
	ComputedThreads    *domain.ThreadStatsResponse

	// JAR-native filters
	HasJARFilters          bool
	JARMostExecuted        []domain.JARFilterMostExecuted
	JARPerTransaction      []domain.JARFilterPerTransaction
	JARFilterLevels        []domain.JARFilterLevel
	JARLongestRunning      []domain.TopNEntry

	// Computed filters fallback
	HasComputedFilters bool
	ComputedFilters    *domain.FilterComplexityResponse
}

func buildTemplateContext(data *reportData) *templateContext {
	ctx := &templateContext{
		JobID:       data.JobID,
		GeneratedAt: data.GeneratedAt.Format("2006-01-02 15:04:05 UTC"),
		Stats:       data.Dashboard.GeneralStats,
		TopAPI:      data.Dashboard.TopAPICalls,
		TopSQL:      data.Dashboard.TopSQL,
		TopFilters:  data.Dashboard.TopFilters,
		TopEsc:      data.Dashboard.TopEscalations,
	}

	// Resolve aggregates type.
	if data.Aggregates != nil {
		switch v := data.Aggregates.(type) {
		case *domain.JARAggregatesResponse:
			ctx.HasJARAggregates = true
			ctx.JARAPIByForm = v.APIByForm
			ctx.JARAPIByClient = v.APIByClient
			ctx.JARSQLByTable = v.SQLByTable
			ctx.JAREscByForm = v.EscByForm
		case *domain.AggregatesResponse:
			ctx.HasComputedAggregates = true
			ctx.ComputedAggregates = v
		}
	}

	// Resolve exceptions type.
	if data.Exceptions != nil {
		switch v := data.Exceptions.(type) {
		case *domain.JARExceptionsResponse:
			ctx.HasJARExceptions = true
			ctx.JARAPIErrors = v.APIErrors
			ctx.JARAPIExceptions = v.APIExceptions
			ctx.JARSQLExceptions = v.SQLExceptions
		case *domain.ExceptionsResponse:
			ctx.HasComputedExceptions = true
			ctx.ComputedExceptions = v
		}
	}

	// Resolve gaps type.
	if data.Gaps != nil {
		switch v := data.Gaps.(type) {
		case *domain.JARGapsResponse:
			ctx.HasJARGaps = true
			ctx.JARLineGaps = v.LineGaps
			ctx.JARThreadGaps = v.ThreadGaps
			ctx.QueueHealth = v.QueueHealth
		case *domain.GapsResponse:
			ctx.HasComputedGaps = true
			ctx.ComputedGaps = v
		}
	}

	// Resolve threads type.
	if data.Threads != nil {
		switch v := data.Threads.(type) {
		case *domain.JARThreadStatsResponse:
			ctx.HasJARThreads = true
			ctx.JARAPIThreads = v.APIThreads
			ctx.JARSQLThreads = v.SQLThreads
		case *domain.ThreadStatsResponse:
			ctx.HasComputedThreads = true
			ctx.ComputedThreads = v
		}
	}

	// Resolve filters type.
	if data.Filters != nil {
		switch v := data.Filters.(type) {
		case *domain.JARFilterComplexityResponse:
			ctx.HasJARFilters = true
			ctx.JARMostExecuted = v.MostExecuted
			ctx.JARPerTransaction = v.PerTransaction
			ctx.JARFilterLevels = v.FilterLevels
			ctx.JARLongestRunning = v.LongestRunning
		case *domain.FilterComplexityResponse:
			ctx.HasComputedFilters = true
			ctx.ComputedFilters = v
		}
	}

	return ctx
}

// reportTemplate is the Go html/template for the full report HTML page.
var reportTemplate = strings.TrimSpace(`
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>RemedyIQ Log Analysis Report</title>
<style>
  :root {
    --bg: #0f1117;
    --bg-card: #1a1d27;
    --bg-table-head: #242836;
    --bg-table-row: #1e2230;
    --bg-table-alt: #171b26;
    --text: #e4e6eb;
    --text-dim: #9ca3af;
    --accent: #6366f1;
    --accent-light: #818cf8;
    --green: #22c55e;
    --red: #ef4444;
    --orange: #f59e0b;
    --border: #2d3348;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: var(--bg);
    color: var(--text);
    line-height: 1.6;
    padding: 24px;
  }
  .container { max-width: 1200px; margin: 0 auto; }
  .header {
    text-align: center;
    padding: 32px 0;
    border-bottom: 2px solid var(--accent);
    margin-bottom: 32px;
  }
  .header h1 {
    font-size: 28px;
    font-weight: 700;
    color: var(--accent-light);
    margin-bottom: 8px;
  }
  .header .meta {
    font-size: 14px;
    color: var(--text-dim);
  }
  .header .meta code {
    background: var(--bg-card);
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 12px;
  }
  .section {
    background: var(--bg-card);
    border-radius: 8px;
    border: 1px solid var(--border);
    margin-bottom: 24px;
    overflow: hidden;
  }
  .section-title {
    background: var(--bg-table-head);
    padding: 14px 20px;
    font-size: 16px;
    font-weight: 600;
    color: var(--accent-light);
    border-bottom: 1px solid var(--border);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .section-body { padding: 20px; }
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 16px;
  }
  .stat-card {
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 16px;
    text-align: center;
  }
  .stat-card .label {
    font-size: 12px;
    color: var(--text-dim);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 4px;
  }
  .stat-card .value {
    font-size: 24px;
    font-weight: 700;
    color: var(--accent-light);
  }
  .stat-card .sub {
    font-size: 11px;
    color: var(--text-dim);
    margin-top: 2px;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }
  th {
    background: var(--bg-table-head);
    padding: 10px 12px;
    text-align: left;
    font-weight: 600;
    color: var(--text-dim);
    text-transform: uppercase;
    font-size: 11px;
    letter-spacing: 0.5px;
    border-bottom: 1px solid var(--border);
    white-space: nowrap;
  }
  td {
    padding: 8px 12px;
    border-bottom: 1px solid var(--border);
    color: var(--text);
    max-width: 300px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  tr:nth-child(even) td { background: var(--bg-table-alt); }
  tr:hover td { background: var(--bg-table-head); }
  .subtotal td {
    font-weight: 600;
    background: var(--bg-table-head) !important;
    border-top: 2px solid var(--border);
  }
  .grand-total td {
    font-weight: 700;
    background: var(--bg) !important;
    border-top: 3px solid var(--accent);
    color: var(--accent-light);
  }
  .status-ok { color: var(--green); font-weight: 600; }
  .status-fail { color: var(--red); font-weight: 600; }
  .group-header td {
    background: var(--bg) !important;
    font-weight: 700;
    color: var(--accent-light);
    padding: 12px;
    font-size: 14px;
    border-top: 2px solid var(--border);
  }
  .empty-state {
    text-align: center;
    padding: 32px;
    color: var(--text-dim);
    font-style: italic;
  }
  .footer {
    text-align: center;
    padding: 24px 0;
    color: var(--text-dim);
    font-size: 12px;
    border-top: 1px solid var(--border);
    margin-top: 16px;
  }
  @media print {
    body { background: #fff; color: #111; padding: 12px; }
    .section { border-color: #ddd; page-break-inside: avoid; }
    .section-title { background: #f3f4f6; color: #111; }
    th { background: #f3f4f6; color: #333; }
    td { color: #111; }
    tr:nth-child(even) td { background: #f9fafb; }
    .stat-card { border-color: #ddd; }
    .stat-card .value { color: #4f46e5; }
    .header h1 { color: #4f46e5; }
    :root { --border: #ddd; --bg: #f9fafb; --bg-card: #fff; --bg-table-head: #f3f4f6; }
  }
</style>
</head>
<body>
<div class="container">

<!-- Header -->
<div class="header">
  <h1>RemedyIQ Log Analysis Report</h1>
  <div class="meta">
    Job ID: <code>{{.JobID}}</code> &nbsp;|&nbsp; Generated: {{.GeneratedAt}}
  </div>
</div>

<!-- General Statistics -->
<div class="section">
  <div class="section-title">General Statistics</div>
  <div class="section-body">
    <div class="stats-grid">
      <div class="stat-card">
        <div class="label">Total Lines</div>
        <div class="value">{{.Stats.TotalLines}}</div>
      </div>
      <div class="stat-card">
        <div class="label">API Calls</div>
        <div class="value">{{.Stats.APICount}}</div>
      </div>
      <div class="stat-card">
        <div class="label">SQL Queries</div>
        <div class="value">{{.Stats.SQLCount}}</div>
      </div>
      <div class="stat-card">
        <div class="label">Filters</div>
        <div class="value">{{.Stats.FilterCount}}</div>
      </div>
      <div class="stat-card">
        <div class="label">Escalations</div>
        <div class="value">{{.Stats.EscCount}}</div>
      </div>
      <div class="stat-card">
        <div class="label">Unique Users</div>
        <div class="value">{{.Stats.UniqueUsers}}</div>
      </div>
      <div class="stat-card">
        <div class="label">Unique Forms</div>
        <div class="value">{{.Stats.UniqueForms}}</div>
      </div>
      <div class="stat-card">
        <div class="label">Log Duration</div>
        <div class="value" style="font-size:16px">{{.Stats.LogDuration}}</div>
        <div class="sub">{{fmtTime .Stats.LogStart}} &mdash; {{fmtTime .Stats.LogEnd}}</div>
      </div>
    </div>
  </div>
</div>

<!-- Top API Calls -->
{{if .TopAPI}}
<div class="section">
  <div class="section-title">Top API Calls ({{len .TopAPI}} Longest)</div>
  <div class="section-body">
    <table>
      <thead><tr>
        <th>#</th><th>API</th><th>Form</th><th>Duration</th><th>Queue</th><th>User</th><th>Status</th>
      </tr></thead>
      <tbody>
      {{range .TopAPI}}
        <tr>
          <td>{{.Rank}}</td>
          <td title="{{.Identifier}}">{{truncate .Identifier 50}}</td>
          <td>{{.Form}}</td>
          <td>{{fmtDuration .DurationMS}}</td>
          <td>{{.Queue}}</td>
          <td>{{.User}}</td>
          <td class="{{successClass .Success}}">{{successText .Success}}</td>
        </tr>
      {{end}}
      </tbody>
    </table>
  </div>
</div>
{{end}}

<!-- Top SQL Queries -->
{{if .TopSQL}}
<div class="section">
  <div class="section-title">Top SQL Queries ({{len .TopSQL}} Longest)</div>
  <div class="section-body">
    <table>
      <thead><tr>
        <th>#</th><th>Query</th><th>Duration</th><th>Queue</th><th>Status</th>
      </tr></thead>
      <tbody>
      {{range .TopSQL}}
        <tr>
          <td>{{.Rank}}</td>
          <td title="{{.Identifier}}">{{truncate .Identifier 60}}</td>
          <td>{{fmtDuration .DurationMS}}</td>
          <td>{{.Queue}}</td>
          <td class="{{successClass .Success}}">{{successText .Success}}</td>
        </tr>
      {{end}}
      </tbody>
    </table>
  </div>
</div>
{{end}}

<!-- Top Filters -->
{{if .TopFilters}}
<div class="section">
  <div class="section-title">Top Filters ({{len .TopFilters}} Longest)</div>
  <div class="section-body">
    <table>
      <thead><tr>
        <th>#</th><th>Filter</th><th>Duration</th><th>Queue</th><th>Status</th>
      </tr></thead>
      <tbody>
      {{range .TopFilters}}
        <tr>
          <td>{{.Rank}}</td>
          <td title="{{.Identifier}}">{{truncate .Identifier 60}}</td>
          <td>{{fmtDuration .DurationMS}}</td>
          <td>{{.Queue}}</td>
          <td class="{{successClass .Success}}">{{successText .Success}}</td>
        </tr>
      {{end}}
      </tbody>
    </table>
  </div>
</div>
{{end}}

<!-- Top Escalations -->
{{if .TopEsc}}
<div class="section">
  <div class="section-title">Top Escalations ({{len .TopEsc}} Longest)</div>
  <div class="section-body">
    <table>
      <thead><tr>
        <th>#</th><th>Escalation</th><th>Form</th><th>Duration</th><th>Queue</th><th>Status</th>
      </tr></thead>
      <tbody>
      {{range .TopEsc}}
        <tr>
          <td>{{.Rank}}</td>
          <td title="{{.Identifier}}">{{truncate .Identifier 50}}</td>
          <td>{{.Form}}</td>
          <td>{{fmtDuration .DurationMS}}</td>
          <td>{{.Queue}}</td>
          <td class="{{successClass .Success}}">{{successText .Success}}</td>
        </tr>
      {{end}}
      </tbody>
    </table>
  </div>
</div>
{{end}}

<!-- ===== AGGREGATES ===== -->
{{if .HasJARAggregates}}

  {{if .JARAPIByForm}}
  <div class="section">
    <div class="section-title">API Aggregates by {{.JARAPIByForm.GroupedBy}} (sorted by {{.JARAPIByForm.SortedBy}})</div>
    <div class="section-body">
      <table>
        <thead><tr>
          <th>Operation</th><th>OK</th><th>Fail</th><th>Total</th><th>Min</th><th>Max</th><th>Avg</th><th>Sum</th>
        </tr></thead>
        <tbody>
        {{range .JARAPIByForm.Groups}}
          <tr class="group-header"><td colspan="8">{{.EntityName}}</td></tr>
          {{range .Rows}}
          <tr>
            <td>{{.OperationType}}</td><td>{{.OK}}</td><td>{{.Fail}}</td><td>{{.Total}}</td>
            <td>{{fmtFloatMS .MinTime}}</td><td>{{fmtFloatMS .MaxTime}}</td><td>{{fmtFloatMS .AvgTime}}</td><td>{{fmtFloatMS .SumTime}}</td>
          </tr>
          {{end}}
          {{if .Subtotal}}
          <tr class="subtotal">
            <td>Subtotal</td><td>{{.Subtotal.OK}}</td><td>{{.Subtotal.Fail}}</td><td>{{.Subtotal.Total}}</td>
            <td>{{fmtFloatMS .Subtotal.MinTime}}</td><td>{{fmtFloatMS .Subtotal.MaxTime}}</td><td>{{fmtFloatMS .Subtotal.AvgTime}}</td><td>{{fmtFloatMS .Subtotal.SumTime}}</td>
          </tr>
          {{end}}
        {{end}}
        {{if .JARAPIByForm.GrandTotal}}
        <tr class="grand-total">
          <td>Grand Total</td><td>{{.JARAPIByForm.GrandTotal.OK}}</td><td>{{.JARAPIByForm.GrandTotal.Fail}}</td><td>{{.JARAPIByForm.GrandTotal.Total}}</td>
          <td>{{fmtFloatMS .JARAPIByForm.GrandTotal.MinTime}}</td><td>{{fmtFloatMS .JARAPIByForm.GrandTotal.MaxTime}}</td><td>{{fmtFloatMS .JARAPIByForm.GrandTotal.AvgTime}}</td><td>{{fmtFloatMS .JARAPIByForm.GrandTotal.SumTime}}</td>
        </tr>
        {{end}}
        </tbody>
      </table>
    </div>
  </div>
  {{end}}

  {{if .JARSQLByTable}}
  <div class="section">
    <div class="section-title">SQL Aggregates by {{.JARSQLByTable.GroupedBy}} (sorted by {{.JARSQLByTable.SortedBy}})</div>
    <div class="section-body">
      <table>
        <thead><tr>
          <th>Operation</th><th>OK</th><th>Fail</th><th>Total</th><th>Min</th><th>Max</th><th>Avg</th><th>Sum</th>
        </tr></thead>
        <tbody>
        {{range .JARSQLByTable.Groups}}
          <tr class="group-header"><td colspan="8">{{.EntityName}}</td></tr>
          {{range .Rows}}
          <tr>
            <td>{{.OperationType}}</td><td>{{.OK}}</td><td>{{.Fail}}</td><td>{{.Total}}</td>
            <td>{{fmtFloatMS .MinTime}}</td><td>{{fmtFloatMS .MaxTime}}</td><td>{{fmtFloatMS .AvgTime}}</td><td>{{fmtFloatMS .SumTime}}</td>
          </tr>
          {{end}}
          {{if .Subtotal}}
          <tr class="subtotal">
            <td>Subtotal</td><td>{{.Subtotal.OK}}</td><td>{{.Subtotal.Fail}}</td><td>{{.Subtotal.Total}}</td>
            <td>{{fmtFloatMS .Subtotal.MinTime}}</td><td>{{fmtFloatMS .Subtotal.MaxTime}}</td><td>{{fmtFloatMS .Subtotal.AvgTime}}</td><td>{{fmtFloatMS .Subtotal.SumTime}}</td>
          </tr>
          {{end}}
        {{end}}
        {{if .JARSQLByTable.GrandTotal}}
        <tr class="grand-total">
          <td>Grand Total</td><td>{{.JARSQLByTable.GrandTotal.OK}}</td><td>{{.JARSQLByTable.GrandTotal.Fail}}</td><td>{{.JARSQLByTable.GrandTotal.Total}}</td>
          <td>{{fmtFloatMS .JARSQLByTable.GrandTotal.MinTime}}</td><td>{{fmtFloatMS .JARSQLByTable.GrandTotal.MaxTime}}</td><td>{{fmtFloatMS .JARSQLByTable.GrandTotal.AvgTime}}</td><td>{{fmtFloatMS .JARSQLByTable.GrandTotal.SumTime}}</td>
        </tr>
        {{end}}
        </tbody>
      </table>
    </div>
  </div>
  {{end}}

{{else if .HasComputedAggregates}}
  {{if .ComputedAggregates.API}}
  <div class="section">
    <div class="section-title">API Aggregates</div>
    <div class="section-body">
      <table>
        <thead><tr>
          <th>Name</th><th>Count</th><th>Total MS</th><th>Avg MS</th><th>Min MS</th><th>Max MS</th><th>Errors</th><th>Error Rate</th>
        </tr></thead>
        <tbody>
        {{range .ComputedAggregates.API.Groups}}
        <tr>
          <td>{{.Name}}</td><td>{{.Count}}</td><td>{{.TotalMS}}</td><td>{{fmtFloat .AvgMS}}</td>
          <td>{{.MinMS}}</td><td>{{.MaxMS}}</td><td>{{.ErrorCount}}</td><td>{{fmtPct .ErrorRate}}</td>
        </tr>
        {{end}}
        </tbody>
      </table>
    </div>
  </div>
  {{end}}
  {{if .ComputedAggregates.SQL}}
  <div class="section">
    <div class="section-title">SQL Aggregates</div>
    <div class="section-body">
      <table>
        <thead><tr>
          <th>Name</th><th>Count</th><th>Total MS</th><th>Avg MS</th><th>Min MS</th><th>Max MS</th><th>Errors</th><th>Error Rate</th>
        </tr></thead>
        <tbody>
        {{range .ComputedAggregates.SQL.Groups}}
        <tr>
          <td>{{.Name}}</td><td>{{.Count}}</td><td>{{.TotalMS}}</td><td>{{fmtFloat .AvgMS}}</td>
          <td>{{.MinMS}}</td><td>{{.MaxMS}}</td><td>{{.ErrorCount}}</td><td>{{fmtPct .ErrorRate}}</td>
        </tr>
        {{end}}
        </tbody>
      </table>
    </div>
  </div>
  {{end}}
{{end}}

<!-- ===== EXCEPTIONS ===== -->
{{if .HasJARExceptions}}

  {{if .JARAPIErrors}}
  <div class="section">
    <div class="section-title">API Errors ({{len .JARAPIErrors}})</div>
    <div class="section-body">
      <table>
        <thead><tr>
          <th>Line</th><th>API</th><th>Form</th><th>User</th><th>Queue</th><th>Time</th><th>Error</th>
        </tr></thead>
        <tbody>
        {{range .JARAPIErrors}}
        <tr>
          <td>{{.EndLine}}</td>
          <td title="{{.API}}">{{truncate .API 40}}</td>
          <td>{{.Form}}</td><td>{{.User}}</td><td>{{.Queue}}</td>
          <td>{{fmtTime .StartTime}}</td>
          <td class="status-fail" title="{{.ErrorMessage}}">{{truncate .ErrorMessage 50}}</td>
        </tr>
        {{end}}
        </tbody>
      </table>
    </div>
  </div>
  {{end}}

  {{if .JARAPIExceptions}}
  <div class="section">
    <div class="section-title">API Exceptions ({{len .JARAPIExceptions}})</div>
    <div class="section-body">
      <table>
        <thead><tr>
          <th>Line</th><th>Type</th><th>Message</th>
        </tr></thead>
        <tbody>
        {{range .JARAPIExceptions}}
        <tr>
          <td>{{.LineNumber}}</td>
          <td>{{.Type}}</td>
          <td title="{{.Message}}">{{truncate .Message 80}}</td>
        </tr>
        {{end}}
        </tbody>
      </table>
    </div>
  </div>
  {{end}}

  {{if .JARSQLExceptions}}
  <div class="section">
    <div class="section-title">SQL Exceptions ({{len .JARSQLExceptions}})</div>
    <div class="section-body">
      <table>
        <thead><tr>
          <th>Line</th><th>Type</th><th>Message</th>
        </tr></thead>
        <tbody>
        {{range .JARSQLExceptions}}
        <tr>
          <td>{{.LineNumber}}</td>
          <td>{{.Type}}</td>
          <td title="{{.Message}}">{{truncate .Message 80}}</td>
        </tr>
        {{end}}
        </tbody>
      </table>
    </div>
  </div>
  {{end}}

{{else if .HasComputedExceptions}}
  {{if .ComputedExceptions.Exceptions}}
  <div class="section">
    <div class="section-title">Exceptions ({{.ComputedExceptions.TotalCount}})</div>
    <div class="section-body">
      <table>
        <thead><tr>
          <th>Code</th><th>Message</th><th>Count</th><th>Log Type</th><th>First Seen</th><th>Last Seen</th>
        </tr></thead>
        <tbody>
        {{range .ComputedExceptions.Exceptions}}
        <tr>
          <td>{{.ErrorCode}}</td>
          <td title="{{.Message}}">{{truncate .Message 60}}</td>
          <td>{{.Count}}</td><td>{{.LogType}}</td>
          <td>{{fmtTime .FirstSeen}}</td><td>{{fmtTime .LastSeen}}</td>
        </tr>
        {{end}}
        </tbody>
      </table>
    </div>
  </div>
  {{end}}
{{end}}

<!-- ===== GAP ANALYSIS ===== -->
{{if .HasJARGaps}}

  {{if .JARLineGaps}}
  <div class="section">
    <div class="section-title">Line Gaps ({{len .JARLineGaps}})</div>
    <div class="section-body">
      <table>
        <thead><tr>
          <th>Line</th><th>Gap Duration</th><th>Timestamp</th><th>Details</th>
        </tr></thead>
        <tbody>
        {{range .JARLineGaps}}
        <tr>
          <td>{{.LineNumber}}</td>
          <td>{{fmtFloatMS .GapDuration}}</td>
          <td>{{fmtTime .Timestamp}}</td>
          <td title="{{.Details}}">{{truncate .Details 60}}</td>
        </tr>
        {{end}}
        </tbody>
      </table>
    </div>
  </div>
  {{end}}

  {{if .JARThreadGaps}}
  <div class="section">
    <div class="section-title">Thread Gaps ({{len .JARThreadGaps}})</div>
    <div class="section-body">
      <table>
        <thead><tr>
          <th>Line</th><th>Gap Duration</th><th>Trace</th><th>Timestamp</th><th>Details</th>
        </tr></thead>
        <tbody>
        {{range .JARThreadGaps}}
        <tr>
          <td>{{.LineNumber}}</td>
          <td>{{fmtFloatMS .GapDuration}}</td>
          <td>{{.TraceID}}</td>
          <td>{{fmtTime .Timestamp}}</td>
          <td title="{{.Details}}">{{truncate .Details 50}}</td>
        </tr>
        {{end}}
        </tbody>
      </table>
    </div>
  </div>
  {{end}}

{{else if .HasComputedGaps}}
  {{if .ComputedGaps.Gaps}}
  <div class="section">
    <div class="section-title">Gaps ({{len .ComputedGaps.Gaps}})</div>
    <div class="section-body">
      <table>
        <thead><tr>
          <th>Start</th><th>End</th><th>Duration MS</th><th>Before Line</th><th>After Line</th><th>Log Type</th>
        </tr></thead>
        <tbody>
        {{range .ComputedGaps.Gaps}}
        <tr>
          <td>{{fmtTime .StartTime}}</td><td>{{fmtTime .EndTime}}</td>
          <td>{{.DurationMS}}</td><td>{{.BeforeLine}}</td><td>{{.AfterLine}}</td><td>{{.LogType}}</td>
        </tr>
        {{end}}
        </tbody>
      </table>
    </div>
  </div>
  {{end}}
{{end}}

<!-- Queue Health (shared between JAR and computed gaps) -->
{{if .QueueHealth}}
<div class="section">
  <div class="section-title">Queue Health</div>
  <div class="section-body">
    <table>
      <thead><tr>
        <th>Queue</th><th>Total Calls</th><th>Avg MS</th><th>P95 MS</th><th>Error Rate</th>
      </tr></thead>
      <tbody>
      {{range .QueueHealth}}
      <tr>
        <td>{{.Queue}}</td><td>{{.TotalCalls}}</td><td>{{fmtFloat .AvgMS}}</td>
        <td>{{.P95MS}}</td><td>{{fmtPct .ErrorRate}}</td>
      </tr>
      {{end}}
      </tbody>
    </table>
  </div>
</div>
{{end}}

<!-- ===== THREAD STATISTICS ===== -->
{{if .HasJARThreads}}

  {{if .JARAPIThreads}}
  <div class="section">
    <div class="section-title">API Thread Statistics ({{len .JARAPIThreads}})</div>
    <div class="section-body">
      <table>
        <thead><tr>
          <th>Queue</th><th>Thread</th><th>Count</th><th>Q Count</th><th>Q Time</th><th>Total Time</th><th>Busy%</th><th>First</th><th>Last</th>
        </tr></thead>
        <tbody>
        {{range .JARAPIThreads}}
        <tr>
          <td>{{.Queue}}</td><td>{{.ThreadID}}</td><td>{{.Count}}</td>
          <td>{{.QCount}}</td><td>{{fmtFloatMS .QTime}}</td><td>{{fmtFloatMS .TotalTime}}</td>
          <td>{{fmtPct .BusyPct}}</td>
          <td>{{fmtTime .FirstTime}}</td><td>{{fmtTime .LastTime}}</td>
        </tr>
        {{end}}
        </tbody>
      </table>
    </div>
  </div>
  {{end}}

  {{if .JARSQLThreads}}
  <div class="section">
    <div class="section-title">SQL Thread Statistics ({{len .JARSQLThreads}})</div>
    <div class="section-body">
      <table>
        <thead><tr>
          <th>Queue</th><th>Thread</th><th>Count</th><th>Q Count</th><th>Q Time</th><th>Total Time</th><th>Busy%</th><th>First</th><th>Last</th>
        </tr></thead>
        <tbody>
        {{range .JARSQLThreads}}
        <tr>
          <td>{{.Queue}}</td><td>{{.ThreadID}}</td><td>{{.Count}}</td>
          <td>{{.QCount}}</td><td>{{fmtFloatMS .QTime}}</td><td>{{fmtFloatMS .TotalTime}}</td>
          <td>{{fmtPct .BusyPct}}</td>
          <td>{{fmtTime .FirstTime}}</td><td>{{fmtTime .LastTime}}</td>
        </tr>
        {{end}}
        </tbody>
      </table>
    </div>
  </div>
  {{end}}

{{else if .HasComputedThreads}}
  {{if .ComputedThreads.Threads}}
  <div class="section">
    <div class="section-title">Thread Statistics ({{.ComputedThreads.TotalThreads}} threads)</div>
    <div class="section-body">
      <table>
        <thead><tr>
          <th>Thread</th><th>Total Calls</th><th>Total MS</th><th>Avg MS</th><th>Max MS</th><th>Errors</th><th>Busy%</th>
        </tr></thead>
        <tbody>
        {{range .ComputedThreads.Threads}}
        <tr>
          <td>{{.ThreadID}}</td><td>{{.TotalCalls}}</td><td>{{.TotalMS}}</td>
          <td>{{fmtFloat .AvgMS}}</td><td>{{.MaxMS}}</td><td>{{.ErrorCount}}</td><td>{{fmtPct .BusyPct}}</td>
        </tr>
        {{end}}
        </tbody>
      </table>
    </div>
  </div>
  {{end}}
{{end}}

<!-- ===== FILTER ANALYSIS ===== -->
{{if .HasJARFilters}}

  {{if .JARLongestRunning}}
  <div class="section">
    <div class="section-title">Longest Running Filters ({{len .JARLongestRunning}})</div>
    <div class="section-body">
      <table>
        <thead><tr>
          <th>#</th><th>Filter</th><th>Duration</th><th>Queue</th><th>Status</th>
        </tr></thead>
        <tbody>
        {{range .JARLongestRunning}}
        <tr>
          <td>{{.Rank}}</td>
          <td title="{{.Identifier}}">{{truncate .Identifier 60}}</td>
          <td>{{fmtDuration .DurationMS}}</td>
          <td>{{.Queue}}</td>
          <td class="{{successClass .Success}}">{{successText .Success}}</td>
        </tr>
        {{end}}
        </tbody>
      </table>
    </div>
  </div>
  {{end}}

  {{if .JARMostExecuted}}
  <div class="section">
    <div class="section-title">Most Executed Filters ({{len .JARMostExecuted}})</div>
    <div class="section-body">
      <table>
        <thead><tr>
          <th>Filter</th><th>Pass</th><th>Fail</th>
        </tr></thead>
        <tbody>
        {{range .JARMostExecuted}}
        <tr>
          <td>{{.FilterName}}</td>
          <td class="status-ok">{{.PassCount}}</td>
          <td class="status-fail">{{.FailCount}}</td>
        </tr>
        {{end}}
        </tbody>
      </table>
    </div>
  </div>
  {{end}}

  {{if .JARPerTransaction}}
  <div class="section">
    <div class="section-title">Filters Per Transaction ({{len .JARPerTransaction}})</div>
    <div class="section-body">
      <table>
        <thead><tr>
          <th>Line</th><th>Operation</th><th>Form</th><th>Filter Count</th><th>Filters/sec</th>
        </tr></thead>
        <tbody>
        {{range .JARPerTransaction}}
        <tr>
          <td>{{.LineNumber}}</td>
          <td>{{.Operation}}</td><td>{{.Form}}</td>
          <td>{{.FilterCount}}</td><td>{{fmtFloat .FiltersPerSec}}</td>
        </tr>
        {{end}}
        </tbody>
      </table>
    </div>
  </div>
  {{end}}

  {{if .JARFilterLevels}}
  <div class="section">
    <div class="section-title">Filter Levels ({{len .JARFilterLevels}})</div>
    <div class="section-body">
      <table>
        <thead><tr>
          <th>Line</th><th>Level</th><th>Operation</th><th>Form</th>
        </tr></thead>
        <tbody>
        {{range .JARFilterLevels}}
        <tr>
          <td>{{.LineNumber}}</td><td>{{.FilterLevel}}</td>
          <td>{{.Operation}}</td><td>{{.Form}}</td>
        </tr>
        {{end}}
        </tbody>
      </table>
    </div>
  </div>
  {{end}}

{{else if .HasComputedFilters}}
  {{if .ComputedFilters.MostExecuted}}
  <div class="section">
    <div class="section-title">Most Executed Filters</div>
    <div class="section-body">
      <table>
        <thead><tr>
          <th>Name</th><th>Count</th><th>Total MS</th>
        </tr></thead>
        <tbody>
        {{range .ComputedFilters.MostExecuted}}
        <tr>
          <td>{{.Name}}</td><td>{{.Count}}</td><td>{{.TotalMS}}</td>
        </tr>
        {{end}}
        </tbody>
      </table>
    </div>
  </div>
  {{end}}
{{end}}

<!-- Footer -->
<div class="footer">
  Generated by RemedyIQ &mdash; Log Analysis Platform for BMC Remedy AR Server
</div>

</div>
</body>
</html>
`)

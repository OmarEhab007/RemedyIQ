package skills

import (
	"context"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"github.com/OmarEhab007/RemedyIQ/backend/internal/ai"
	"github.com/OmarEhab007/RemedyIQ/backend/internal/storage"
)

// SummarizerSkill generates executive summary reports.
type SummarizerSkill struct {
	client *ai.Client
	ch     *storage.ClickHouseClient
	logger *slog.Logger
}

func NewSummarizerSkill(client *ai.Client, ch *storage.ClickHouseClient) *SummarizerSkill {
	return &SummarizerSkill{
		client: client,
		ch:     ch,
		logger: slog.Default().With("skill", "summarizer"),
	}
}

func (s *SummarizerSkill) Name() string        { return "summarizer" }
func (s *SummarizerSkill) Description() string { return "Generate executive summary reports of log analysis" }
func (s *SummarizerSkill) Examples() []string {
	return []string{
		"Generate an executive summary",
		"Create a health report for this analysis",
		"What are the key findings?",
	}
}

func (s *SummarizerSkill) Execute(ctx context.Context, input ai.SkillInput) (*ai.SkillOutput, error) {
	if err := validateInput(input); err != nil {
		return nil, err
	}

	if s.client == nil || !s.client.IsAvailable() {
		s.logger.Warn("AI client unavailable, returning fallback",
			"job_id", input.JobID, "tenant_id", input.TenantID)
		return fallbackOutput(s.Name()), nil
	}

	// Fetch comprehensive data from ClickHouse for the summary.
	logContext := s.fetchLogContext(ctx, input.TenantID, input.JobID)

	systemPrompt := `You are RemedyIQ, generating an executive summary report for AR Server log analysis.

Structure your report as follows:

## Health Score: X/100
Brief justification of the score.

## Key Findings
- Finding 1 with specific numbers
- Finding 2 with specific numbers
- Finding 3 with specific numbers

## Performance Summary
Summarize API, SQL, Filter, and Escalation performance.

## Top Issues
1. Most critical issue with impact assessment
2. Second critical issue
3. Third issue

## Recommendations
1. Actionable recommendation with expected impact
2. Second recommendation
3. Third recommendation

## Trends
Note any notable patterns or trends.

Use specific numbers and percentages. Be concise but thorough.`

	userContent := fmt.Sprintf("Generate an executive summary for job %s (tenant %s).\n\n%s\n\nAdditional context: %s",
		input.JobID, input.TenantID, logContext, input.Query)

	messages := []ai.Message{
		{Role: "user", Content: userContent},
	}

	queryCtx, cancel := context.WithTimeout(ctx, 90*time.Second)
	defer cancel()

	resp, err := s.client.Query(queryCtx, systemPrompt, messages, 4096)
	if err != nil {
		s.logger.Error("AI query failed, returning fallback",
			"error", err, "job_id", input.JobID, "tenant_id", input.TenantID)
		return fallbackOutput(s.Name()), nil
	}

	return &ai.SkillOutput{
		Answer:     resp.Content,
		Confidence: 0.85,
		SkillName:  s.Name(),
		TokensUsed: resp.TokensUsed,
		LatencyMS:  resp.LatencyMS,
	}, nil
}

// fetchLogContext retrieves dashboard data, exceptions, and health score from
// ClickHouse to give the summarizer rich context. Failures are logged but do
// not prevent execution -- the AI will receive whatever data is available.
func (s *SummarizerSkill) fetchLogContext(ctx context.Context, tenantID, jobID string) string {
	if s.ch == nil {
		return "(No log data available -- ClickHouse not configured.)"
	}

	queryCtx, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()

	var b strings.Builder

	// Dashboard data (general stats + top-N + time series)
	dash, err := s.ch.GetDashboardData(queryCtx, tenantID, jobID, 10)
	if err != nil {
		s.logger.Warn("failed to fetch dashboard data for summarizer",
			"error", err, "job_id", jobID, "tenant_id", tenantID)
		b.WriteString("(Dashboard data could not be retrieved.)\n")
	} else {
		stats := dash.GeneralStats
		b.WriteString("## Log Statistics\n")
		fmt.Fprintf(&b, "- Total log lines: %d\n", stats.TotalLines)
		fmt.Fprintf(&b, "- API calls: %d | SQL queries: %d | Filters: %d | Escalations: %d\n",
			stats.APICount, stats.SQLCount, stats.FilterCount, stats.EscCount)
		fmt.Fprintf(&b, "- Unique users: %d | Unique forms: %d | Unique tables: %d\n",
			stats.UniqueUsers, stats.UniqueForms, stats.UniqueTables)
		fmt.Fprintf(&b, "- Time range: %s to %s (%s)\n",
			stats.LogStart.Format(time.RFC3339), stats.LogEnd.Format(time.RFC3339), stats.LogDuration)

		if len(dash.TopAPICalls) > 0 {
			b.WriteString("\n### Slowest API Calls\n")
			for _, e := range dash.TopAPICalls {
				fmt.Fprintf(&b, "- %s on %s: %dms (user: %s, success: %t)\n",
					e.Identifier, e.Form, e.DurationMS, e.User, e.Success)
			}
		}
		if len(dash.TopSQL) > 0 {
			b.WriteString("\n### Slowest SQL Queries\n")
			for _, e := range dash.TopSQL {
				fmt.Fprintf(&b, "- table %s: %dms (success: %t)\n", e.Identifier, e.DurationMS, e.Success)
			}
		}
		if len(dash.TopFilters) > 0 {
			b.WriteString("\n### Slowest Filters\n")
			for _, e := range dash.TopFilters {
				fmt.Fprintf(&b, "- %s: %dms\n", e.Identifier, e.DurationMS)
			}
		}
	}

	// Exceptions summary
	exceptions, err := s.ch.GetExceptions(queryCtx, tenantID, jobID)
	if err != nil {
		s.logger.Warn("failed to fetch exceptions for summarizer",
			"error", err, "job_id", jobID, "tenant_id", tenantID)
	} else if exceptions.TotalCount > 0 {
		fmt.Fprintf(&b, "\n## Exceptions Summary\n")
		fmt.Fprintf(&b, "- Total error occurrences: %d\n", exceptions.TotalCount)
		for lt, rate := range exceptions.ErrorRates {
			fmt.Fprintf(&b, "- %s error rate: %.2f%%\n", lt, rate*100)
		}
		for i, ex := range exceptions.Exceptions {
			if i >= 5 {
				break
			}
			fmt.Fprintf(&b, "- [%s] %s (count: %d)\n", ex.ErrorCode, ex.Message, ex.Count)
		}
	}

	// Health score
	health, err := s.ch.ComputeHealthScore(queryCtx, tenantID, jobID)
	if err != nil {
		s.logger.Warn("failed to compute health score for summarizer",
			"error", err, "job_id", jobID, "tenant_id", tenantID)
	} else {
		fmt.Fprintf(&b, "\n## Computed Health Score: %d/100 (status: %s)\n", health.Score, health.Status)
		for _, f := range health.Factors {
			fmt.Fprintf(&b, "- %s: %d/100 (weight: %.0f%%) -- %s\n",
				f.Name, f.Score, f.Weight*100, f.Description)
		}
	}

	return b.String()
}

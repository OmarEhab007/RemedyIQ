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

// AnomalyNarratorSkill describes detected anomalies in natural language.
type AnomalyNarratorSkill struct {
	client *ai.Client
	ch     *storage.ClickHouseClient
	logger *slog.Logger
}

func NewAnomalyNarratorSkill(client *ai.Client, ch *storage.ClickHouseClient) *AnomalyNarratorSkill {
	return &AnomalyNarratorSkill{
		client: client,
		ch:     ch,
		logger: slog.Default().With("skill", "anomaly_narrator"),
	}
}

func (s *AnomalyNarratorSkill) Name() string        { return "anomaly_narrator" }
func (s *AnomalyNarratorSkill) Description() string { return "Explain detected anomalies in plain language" }
func (s *AnomalyNarratorSkill) Examples() []string {
	return []string{
		"Explain the anomalies",
		"What caused the performance spikes?",
		"Why are there error rate anomalies?",
	}
}

func (s *AnomalyNarratorSkill) Execute(ctx context.Context, input ai.SkillInput) (*ai.SkillOutput, error) {
	if err := validateInput(input); err != nil {
		return nil, err
	}

	if s.client == nil || !s.client.IsAvailable() {
		s.logger.Warn("AI client unavailable, returning fallback",
			"job_id", input.JobID, "tenant_id", input.TenantID)
		return fallbackOutput(s.Name()), nil
	}

	// Fetch anomaly-relevant data from ClickHouse.
	logContext := s.fetchAnomalyContext(ctx, input.TenantID, input.JobID)

	systemPrompt := `You are RemedyIQ, explaining performance anomalies detected in AR Server logs.

When explaining anomalies:
1. Describe what happened in plain language
2. Explain the statistical significance (how far from normal)
3. Suggest possible root causes based on AR Server expertise
4. Recommend investigation steps
5. Indicate urgency level

Format your response in markdown. Be specific with numbers and actionable.`

	userContent := fmt.Sprintf("Job ID: %s\nTenant ID: %s\n\n%s\n\nUser question: %s",
		input.JobID, input.TenantID, logContext, input.Query)

	messages := []ai.Message{
		{Role: "user", Content: userContent},
	}

	queryCtx, cancel := context.WithTimeout(ctx, 60*time.Second)
	defer cancel()

	resp, err := s.client.Query(queryCtx, systemPrompt, messages, 2048)
	if err != nil {
		s.logger.Error("AI query failed, returning fallback",
			"error", err, "job_id", input.JobID, "tenant_id", input.TenantID)
		return fallbackOutput(s.Name()), nil
	}

	return &ai.SkillOutput{
		Answer:     resp.Content,
		FollowUps:  []string{"What is the root cause?", "Show me the affected operations", "How can I prevent this?"},
		Confidence: 0.8,
		SkillName:  s.Name(),
		TokensUsed: resp.TokensUsed,
		LatencyMS:  resp.LatencyMS,
	}, nil
}

// fetchAnomalyContext collects time-series data, gaps, and exception data from
// ClickHouse to help the AI identify and explain anomalies.
func (s *AnomalyNarratorSkill) fetchAnomalyContext(ctx context.Context, tenantID, jobID string) string {
	if s.ch == nil {
		return "(No log data available -- ClickHouse not configured.)"
	}

	queryCtx, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()

	var b strings.Builder

	// Time series data (for spotting spikes)
	dash, err := s.ch.GetDashboardData(queryCtx, tenantID, jobID, 5)
	if err != nil {
		s.logger.Warn("failed to fetch dashboard data for anomaly analysis",
			"error", err, "job_id", jobID, "tenant_id", tenantID)
		b.WriteString("(Time series data could not be retrieved.)\n")
	} else {
		stats := dash.GeneralStats
		b.WriteString("## Log Overview\n")
		fmt.Fprintf(&b, "- Total entries: %d | API: %d | SQL: %d | Filter: %d | Esc: %d\n",
			stats.TotalLines, stats.APICount, stats.SQLCount, stats.FilterCount, stats.EscCount)
		fmt.Fprintf(&b, "- Time range: %s to %s\n",
			stats.LogStart.Format(time.RFC3339), stats.LogEnd.Format(time.RFC3339))

		if len(dash.TimeSeries) > 0 {
			b.WriteString("\n## Time Series (per-minute buckets)\n")
			for _, p := range dash.TimeSeries {
				fmt.Fprintf(&b, "- %s: API=%d SQL=%d Filter=%d Esc=%d AvgDur=%.0fms Errors=%d\n",
					p.Timestamp.Format("15:04"), p.APICount, p.SQLCount, p.FilterCount,
					p.EscCount, p.AvgDurationMS, p.ErrorCount)
			}
		}
	}

	// Gaps (idle periods / potential hangs)
	gaps, err := s.ch.GetGaps(queryCtx, tenantID, jobID)
	if err != nil {
		s.logger.Warn("failed to fetch gaps for anomaly analysis",
			"error", err, "job_id", jobID, "tenant_id", tenantID)
	} else if len(gaps.Gaps) > 0 {
		b.WriteString("\n## Detected Gaps (idle periods)\n")
		limit := 10
		if len(gaps.Gaps) < limit {
			limit = len(gaps.Gaps)
		}
		for _, g := range gaps.Gaps[:limit] {
			fmt.Fprintf(&b, "- %s to %s: %dms gap (lines %d-%d, type: %s)\n",
				g.StartTime.Format("15:04:05"), g.EndTime.Format("15:04:05"),
				g.DurationMS, g.BeforeLine, g.AfterLine, g.LogType)
		}
	}

	// Exceptions
	exceptions, err := s.ch.GetExceptions(queryCtx, tenantID, jobID)
	if err != nil {
		s.logger.Warn("failed to fetch exceptions for anomaly analysis",
			"error", err, "job_id", jobID, "tenant_id", tenantID)
	} else if exceptions.TotalCount > 0 {
		b.WriteString("\n## Error Anomalies\n")
		fmt.Fprintf(&b, "- Total error occurrences: %d\n", exceptions.TotalCount)
		for lt, rate := range exceptions.ErrorRates {
			fmt.Fprintf(&b, "- %s error rate: %.2f%%\n", lt, rate*100)
		}
	}

	return b.String()
}

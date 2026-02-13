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

// RootCauseSkill analyzes correlated anomalies to find root causes.
type RootCauseSkill struct {
	client *ai.Client
	ch     storage.ClickHouseStore
	logger *slog.Logger
}

func NewRootCauseSkill(client *ai.Client, ch storage.ClickHouseStore) *RootCauseSkill {
	return &RootCauseSkill{
		client: client,
		ch:     ch,
		logger: slog.Default().With("skill", "root_cause"),
	}
}

func (s *RootCauseSkill) Name() string        { return "root_cause" }
func (s *RootCauseSkill) Description() string { return "Analyze correlated anomalies to find root causes" }
func (s *RootCauseSkill) Examples() []string {
	return []string{
		"What is the root cause of these anomalies?",
		"Why are multiple operations slow at the same time?",
		"Correlate the errors with performance issues",
	}
}

func (s *RootCauseSkill) Execute(ctx context.Context, input ai.SkillInput) (*ai.SkillOutput, error) {
	if err := validateInput(input); err != nil {
		return nil, err
	}

	if s.client == nil || !s.client.IsAvailable() {
		s.logger.Warn("AI client unavailable, returning fallback",
			"job_id", input.JobID, "tenant_id", input.TenantID)
		return fallbackOutput(s.Name()), nil
	}

	// Fetch correlated data from ClickHouse for root cause analysis.
	logContext := s.fetchRootCauseContext(ctx, input.TenantID, input.JobID)

	systemPrompt := `You are RemedyIQ, a root cause analysis expert for BMC Remedy AR Server.

When performing root cause analysis:
1. Look for temporal correlations between anomalies
2. Identify cascading failure patterns (e.g., slow SQL -> slow API -> filter timeouts)
3. Consider AR Server architecture (threads, queues, database connections)
4. Reference specific log entries and timestamps
5. Provide a confidence level for each proposed root cause

Common root cause patterns in AR Server:
- Database lock contention causing cascading slowness
- Filter chain loops triggering excessive SQL operations
- Escalation schedule storms during maintenance windows
- Thread pool exhaustion from concurrent API calls
- Memory pressure from large form operations

Format your response in markdown with a clear root cause hierarchy.`

	userContent := fmt.Sprintf("Analyze root cause for job %s (tenant %s).\n\n%s\n\nUser question: %s",
		input.JobID, input.TenantID, logContext, input.Query)

	messages := []ai.Message{
		{Role: "user", Content: userContent},
	}

	queryCtx, cancel := context.WithTimeout(ctx, 90*time.Second)
	defer cancel()

	resp, err := s.client.Query(queryCtx, systemPrompt, messages, 2048)
	if err != nil {
		s.logger.Error("AI query failed, returning fallback",
			"error", err, "job_id", input.JobID, "tenant_id", input.TenantID)
		return fallbackOutput(s.Name()), nil
	}

	return &ai.SkillOutput{
		Answer:     resp.Content,
		FollowUps:  []string{"How do I fix the root cause?", "Show me the correlated events", "What preventive measures should I take?"},
		Confidence: 0.75,
		SkillName:  s.Name(),
		TokensUsed: resp.TokensUsed,
		LatencyMS:  resp.LatencyMS,
	}, nil
}

// fetchRootCauseContext gathers multiple data dimensions from ClickHouse to
// enable the AI to identify correlations: dashboard data, thread stats, gaps,
// exceptions, and aggregates.
func (s *RootCauseSkill) fetchRootCauseContext(ctx context.Context, tenantID, jobID string) string {
	if s.ch == nil {
		return "(No log data available -- ClickHouse not configured.)"
	}

	queryCtx, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()

	var b strings.Builder

	// Dashboard overview and time series
	dash, err := s.ch.GetDashboardData(queryCtx, tenantID, jobID, 5)
	if err != nil {
		s.logger.Warn("failed to fetch dashboard data for root cause analysis",
			"error", err, "job_id", jobID, "tenant_id", tenantID)
		b.WriteString("(Dashboard data could not be retrieved.)\n")
	} else {
		stats := dash.GeneralStats
		b.WriteString("## Log Overview\n")
		fmt.Fprintf(&b, "- Total: %d | API: %d | SQL: %d | Filter: %d | Esc: %d\n",
			stats.TotalLines, stats.APICount, stats.SQLCount, stats.FilterCount, stats.EscCount)
		fmt.Fprintf(&b, "- Time: %s to %s (%s)\n",
			stats.LogStart.Format(time.RFC3339), stats.LogEnd.Format(time.RFC3339), stats.LogDuration)

		if len(dash.TimeSeries) > 0 {
			b.WriteString("\n### Time Series\n")
			for _, p := range dash.TimeSeries {
				fmt.Fprintf(&b, "- %s: API=%d SQL=%d Filter=%d Esc=%d AvgDur=%.0fms Errors=%d\n",
					p.Timestamp.Format("15:04"), p.APICount, p.SQLCount, p.FilterCount,
					p.EscCount, p.AvgDurationMS, p.ErrorCount)
			}
		}

		if len(dash.TopAPICalls) > 0 {
			b.WriteString("\n### Slowest API Calls\n")
			for _, e := range dash.TopAPICalls {
				fmt.Fprintf(&b, "- %s on %s: %dms (trace: %s)\n",
					e.Identifier, e.Form, e.DurationMS, e.TraceID)
			}
		}
	}

	// Thread statistics (thread saturation is often a root cause)
	threadStats, err := s.ch.GetThreadStats(queryCtx, tenantID, jobID)
	if err != nil {
		s.logger.Warn("failed to fetch thread stats for root cause analysis",
			"error", err, "job_id", jobID, "tenant_id", tenantID)
	} else if threadStats.TotalThreads > 0 {
		b.WriteString("\n## Thread Statistics\n")
		fmt.Fprintf(&b, "- Total threads: %d\n", threadStats.TotalThreads)
		limit := 10
		if len(threadStats.Threads) < limit {
			limit = len(threadStats.Threads)
		}
		for _, t := range threadStats.Threads[:limit] {
			fmt.Fprintf(&b, "- Thread %s: %d calls, %.1f%% busy, avg %.0fms, max %dms, errors %d\n",
				t.ThreadID, t.TotalCalls, t.BusyPct, t.AvgMS, t.MaxMS, t.ErrorCount)
		}
	}

	// Gaps
	gaps, err := s.ch.GetGaps(queryCtx, tenantID, jobID)
	if err != nil {
		s.logger.Warn("failed to fetch gaps for root cause analysis",
			"error", err, "job_id", jobID, "tenant_id", tenantID)
	} else if len(gaps.Gaps) > 0 {
		b.WriteString("\n## Top Gaps\n")
		limit := 5
		if len(gaps.Gaps) < limit {
			limit = len(gaps.Gaps)
		}
		for _, g := range gaps.Gaps[:limit] {
			fmt.Fprintf(&b, "- %s to %s: %dms gap (type: %s)\n",
				g.StartTime.Format("15:04:05"), g.EndTime.Format("15:04:05"),
				g.DurationMS, g.LogType)
		}
	}

	// Exceptions
	exceptions, err := s.ch.GetExceptions(queryCtx, tenantID, jobID)
	if err != nil {
		s.logger.Warn("failed to fetch exceptions for root cause analysis",
			"error", err, "job_id", jobID, "tenant_id", tenantID)
	} else if exceptions.TotalCount > 0 {
		b.WriteString("\n## Error Summary\n")
		fmt.Fprintf(&b, "- Total errors: %d\n", exceptions.TotalCount)
		for lt, rate := range exceptions.ErrorRates {
			fmt.Fprintf(&b, "- %s error rate: %.2f%%\n", lt, rate*100)
		}
		for i, ex := range exceptions.Exceptions {
			if i >= 5 {
				break
			}
			fmt.Fprintf(&b, "- %s: count=%d, first=%s, last=%s\n",
				ex.ErrorCode, ex.Count,
				ex.FirstSeen.Format("15:04:05"), ex.LastSeen.Format("15:04:05"))
		}
	}

	return b.String()
}

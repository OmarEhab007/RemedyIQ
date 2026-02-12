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

// PerformanceSkill analyzes slow operations and suggests tuning.
type PerformanceSkill struct {
	client *ai.Client
	ch     *storage.ClickHouseClient
	logger *slog.Logger
}

func NewPerformanceSkill(client *ai.Client, ch *storage.ClickHouseClient) *PerformanceSkill {
	return &PerformanceSkill{
		client: client,
		ch:     ch,
		logger: slog.Default().With("skill", "performance"),
	}
}

func (s *PerformanceSkill) Name() string        { return "performance" }
func (s *PerformanceSkill) Description() string { return "Analyze slow operations and suggest performance tuning" }
func (s *PerformanceSkill) Examples() []string {
	return []string{
		"Why are API calls slow?",
		"How can I optimize SQL performance?",
		"What is causing filter delays?",
	}
}

func (s *PerformanceSkill) Execute(ctx context.Context, input ai.SkillInput) (*ai.SkillOutput, error) {
	if err := validateInput(input); err != nil {
		return nil, err
	}

	if s.client == nil || !s.client.IsAvailable() {
		s.logger.Warn("AI client unavailable, returning fallback",
			"job_id", input.JobID, "tenant_id", input.TenantID)
		return fallbackOutput(s.Name()), nil
	}

	// Fetch performance-specific data from ClickHouse.
	perfContext := s.fetchPerformanceContext(ctx, input.TenantID, input.JobID)

	systemPrompt := `You are RemedyIQ, a performance analysis expert for BMC Remedy AR Server.

When analyzing performance:
1. Identify the specific slow operations (API calls, SQL queries, filters, escalations)
2. Explain WHY they are slow (long-running queries, lock contention, configuration issues)
3. Provide specific tuning recommendations for AR Server
4. Reference relevant AR Server configuration parameters
5. Prioritize recommendations by expected impact

Common AR Server performance areas:
- API: GET_ENTRY, SET_ENTRY, QUERY operations on forms with many fields
- SQL: Long-running SELECT/UPDATE queries, missing indexes on custom tables
- Filter: Complex filter conditions, cascading filter chains, workflow triggers
- Escalation: Schedule conflicts, overlapping pools, database cleanup escalations

Format your response in markdown with specific values and recommendations.`

	userContent := fmt.Sprintf("Job ID: %s\nTenant ID: %s\n\n%s\n\nUser question: %s",
		input.JobID, input.TenantID, perfContext, input.Query)

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
		FollowUps:  []string{"Show me the slow queries", "What configuration changes would help?", "Are there any quick wins?"},
		Confidence: 0.8,
		SkillName:  s.Name(),
		TokensUsed: resp.TokensUsed,
		LatencyMS:  resp.LatencyMS,
	}, nil
}

// fetchPerformanceContext queries ClickHouse for performance-related data
// including top-N slow operations, aggregates by form/table/filter, and
// thread utilization.
func (s *PerformanceSkill) fetchPerformanceContext(ctx context.Context, tenantID, jobID string) string {
	if s.ch == nil {
		return "(No log data available -- ClickHouse not configured.)"
	}

	queryCtx, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()

	var b strings.Builder

	// Dashboard data for top-N slow operations
	dash, err := s.ch.GetDashboardData(queryCtx, tenantID, jobID, 10)
	if err != nil {
		s.logger.Warn("failed to fetch dashboard data for performance analysis",
			"error", err, "job_id", jobID, "tenant_id", tenantID)
		b.WriteString("(Dashboard data could not be retrieved.)\n")
	} else {
		stats := dash.GeneralStats
		b.WriteString("## Log Overview\n")
		fmt.Fprintf(&b, "- Total: %d | API: %d | SQL: %d | Filter: %d | Esc: %d\n",
			stats.TotalLines, stats.APICount, stats.SQLCount, stats.FilterCount, stats.EscCount)
		fmt.Fprintf(&b, "- Time range: %s\n", stats.LogDuration)

		if len(dash.TopAPICalls) > 0 {
			b.WriteString("\n### Top 10 Slowest API Calls\n")
			for _, e := range dash.TopAPICalls {
				fmt.Fprintf(&b, "- %s on form %s: %dms (user: %s, queue: %s, success: %t)\n",
					e.Identifier, e.Form, e.DurationMS, e.User, e.Queue, e.Success)
			}
		}
		if len(dash.TopSQL) > 0 {
			b.WriteString("\n### Top 10 Slowest SQL Queries\n")
			for _, e := range dash.TopSQL {
				fmt.Fprintf(&b, "- table %s: %dms (success: %t)\n", e.Identifier, e.DurationMS, e.Success)
			}
		}
		if len(dash.TopFilters) > 0 {
			b.WriteString("\n### Top 10 Slowest Filters\n")
			for _, e := range dash.TopFilters {
				fmt.Fprintf(&b, "- %s: %dms (success: %t)\n", e.Identifier, e.DurationMS, e.Success)
			}
		}
		if len(dash.TopEscalations) > 0 {
			b.WriteString("\n### Top 10 Slowest Escalations\n")
			for _, e := range dash.TopEscalations {
				fmt.Fprintf(&b, "- %s: %dms (success: %t)\n", e.Identifier, e.DurationMS, e.Success)
			}
		}
	}

	// Aggregates (by form, table, filter name)
	aggregates, err := s.ch.GetAggregates(queryCtx, tenantID, jobID)
	if err != nil {
		s.logger.Warn("failed to fetch aggregates for performance analysis",
			"error", err, "job_id", jobID, "tenant_id", tenantID)
	} else {
		if aggregates.API != nil && len(aggregates.API.Groups) > 0 {
			b.WriteString("\n### API Performance by Form\n")
			limit := 10
			if len(aggregates.API.Groups) < limit {
				limit = len(aggregates.API.Groups)
			}
			for _, g := range aggregates.API.Groups[:limit] {
				fmt.Fprintf(&b, "- %s: count=%d, avg=%.0fms, max=%dms, errors=%d (%.1f%%)\n",
					g.Name, g.Count, g.AvgMS, g.MaxMS, g.ErrorCount, g.ErrorRate*100)
			}
		}
		if aggregates.SQL != nil && len(aggregates.SQL.Groups) > 0 {
			b.WriteString("\n### SQL Performance by Table\n")
			limit := 10
			if len(aggregates.SQL.Groups) < limit {
				limit = len(aggregates.SQL.Groups)
			}
			for _, g := range aggregates.SQL.Groups[:limit] {
				fmt.Fprintf(&b, "- %s: count=%d, avg=%.0fms, max=%dms, errors=%d (%.1f%%)\n",
					g.Name, g.Count, g.AvgMS, g.MaxMS, g.ErrorCount, g.ErrorRate*100)
			}
		}
		if aggregates.Filter != nil && len(aggregates.Filter.Groups) > 0 {
			b.WriteString("\n### Filter Performance by Name\n")
			limit := 10
			if len(aggregates.Filter.Groups) < limit {
				limit = len(aggregates.Filter.Groups)
			}
			for _, g := range aggregates.Filter.Groups[:limit] {
				fmt.Fprintf(&b, "- %s: count=%d, avg=%.0fms, max=%dms, errors=%d (%.1f%%)\n",
					g.Name, g.Count, g.AvgMS, g.MaxMS, g.ErrorCount, g.ErrorRate*100)
			}
		}
	}

	// Thread utilization
	threadStats, err := s.ch.GetThreadStats(queryCtx, tenantID, jobID)
	if err != nil {
		s.logger.Warn("failed to fetch thread stats for performance analysis",
			"error", err, "job_id", jobID, "tenant_id", tenantID)
	} else if threadStats.TotalThreads > 0 {
		b.WriteString("\n### Thread Utilization (top by busy %)\n")
		fmt.Fprintf(&b, "- Total threads: %d\n", threadStats.TotalThreads)
		limit := 5
		if len(threadStats.Threads) < limit {
			limit = len(threadStats.Threads)
		}
		for _, t := range threadStats.Threads[:limit] {
			fmt.Fprintf(&b, "- Thread %s: %.1f%% busy, %d calls, avg %.0fms, max %dms\n",
				t.ThreadID, t.BusyPct, t.TotalCalls, t.AvgMS, t.MaxMS)
		}
	}

	// Health score for overall context
	health, err := s.ch.ComputeHealthScore(queryCtx, tenantID, jobID)
	if err != nil {
		s.logger.Warn("failed to compute health score for performance analysis",
			"error", err, "job_id", jobID, "tenant_id", tenantID)
	} else {
		fmt.Fprintf(&b, "\n### Health Score: %d/100 (%s)\n", health.Score, health.Status)
		for _, f := range health.Factors {
			fmt.Fprintf(&b, "- %s: %d/100 -- %s\n", f.Name, f.Score, f.Description)
		}
	}

	return b.String()
}

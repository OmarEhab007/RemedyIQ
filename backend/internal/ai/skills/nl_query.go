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

// NLQuerySkill converts natural language to KQL and searches logs.
type NLQuerySkill struct {
	client *ai.Client
	ch     storage.ClickHouseStore
	logger *slog.Logger
}

// NewNLQuerySkill creates a new natural language query skill.
func NewNLQuerySkill(client *ai.Client, ch storage.ClickHouseStore) *NLQuerySkill {
	return &NLQuerySkill{
		client: client,
		ch:     ch,
		logger: slog.Default().With("skill", "nl_query"),
	}
}

func (s *NLQuerySkill) Name() string        { return "nl_query" }
func (s *NLQuerySkill) Description() string { return "Search logs using natural language questions" }
func (s *NLQuerySkill) Examples() []string {
	return []string{
		"What were the slowest API calls?",
		"Show me all failed SQL queries",
		"Which users had the most errors?",
		"Find all GET_ENTRY operations taking more than 5 seconds",
	}
}

func (s *NLQuerySkill) Execute(ctx context.Context, input ai.SkillInput) (*ai.SkillOutput, error) {
	if err := validateInput(input); err != nil {
		return nil, err
	}

	if s.client == nil || !s.client.IsAvailable() {
		s.logger.Warn("AI client unavailable, returning fallback",
			"job_id", input.JobID, "tenant_id", input.TenantID)
		return fallbackOutput(s.Name()), nil
	}

	// Fetch contextual data from ClickHouse to enrich the AI prompt.
	logContext := s.fetchLogContext(ctx, input.TenantID, input.JobID)

	systemPrompt := `You are RemedyIQ, an AI assistant that helps AR Server administrators analyze log files.
You convert natural language questions about AR Server logs into structured analysis.

When answering questions about logs, you should:
1. Identify what the user is looking for (API calls, SQL queries, filters, escalations)
2. Consider relevant fields: type, duration, user, form, queue, status, error
3. Provide specific, actionable answers with references to log entries
4. Suggest follow-up questions

If you can't determine the exact answer from context, explain what additional information would help.

Format your response in markdown. Use **bold** for important values and inline code for technical identifiers.`

	userContent := fmt.Sprintf("Job ID: %s\nTenant ID: %s\n\n%s\n\nQuestion: %s",
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
		FollowUps:  []string{"Show me more details", "What caused these issues?", "How can I optimize this?"},
		Confidence: 0.8,
		SkillName:  s.Name(),
		TokensUsed: resp.TokensUsed,
		LatencyMS:  resp.LatencyMS,
	}, nil
}

// fetchLogContext queries ClickHouse for summary statistics to include in the
// AI prompt. If the query fails, it returns a note indicating that data could
// not be fetched so the AI can still attempt to answer.
func (s *NLQuerySkill) fetchLogContext(ctx context.Context, tenantID, jobID string) string {
	if s.ch == nil {
		return "(No log data available -- ClickHouse not configured.)"
	}

	queryCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	dash, err := s.ch.GetDashboardData(queryCtx, tenantID, jobID, 10)
	if err != nil {
		s.logger.Warn("failed to fetch log context from ClickHouse",
			"error", err, "job_id", jobID, "tenant_id", tenantID)
		return "(Log data could not be retrieved. Please answer based on general AR Server knowledge.)"
	}

	stats := dash.GeneralStats
	var b strings.Builder
	b.WriteString("## Log Summary Data\n")
	fmt.Fprintf(&b, "- Total log lines: %d\n", stats.TotalLines)
	fmt.Fprintf(&b, "- API calls: %d\n", stats.APICount)
	fmt.Fprintf(&b, "- SQL queries: %d\n", stats.SQLCount)
	fmt.Fprintf(&b, "- Filter executions: %d\n", stats.FilterCount)
	fmt.Fprintf(&b, "- Escalations: %d\n", stats.EscCount)
	fmt.Fprintf(&b, "- Unique users: %d\n", stats.UniqueUsers)
	fmt.Fprintf(&b, "- Unique forms: %d\n", stats.UniqueForms)
	fmt.Fprintf(&b, "- Log time range: %s to %s (%s)\n",
		stats.LogStart.Format(time.RFC3339), stats.LogEnd.Format(time.RFC3339), stats.LogDuration)

	if len(dash.TopAPICalls) > 0 {
		b.WriteString("\n### Top API Calls (by duration)\n")
		for _, e := range dash.TopAPICalls {
			fmt.Fprintf(&b, "- %s on form %s: %dms (user: %s, queue: %s)\n",
				e.Identifier, e.Form, e.DurationMS, e.User, e.Queue)
		}
	}
	if len(dash.TopSQL) > 0 {
		b.WriteString("\n### Top SQL Queries (by duration)\n")
		for _, e := range dash.TopSQL {
			fmt.Fprintf(&b, "- table %s: %dms\n", e.Identifier, e.DurationMS)
		}
	}

	return b.String()
}

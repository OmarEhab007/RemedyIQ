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

// ErrorExplainerSkill analyzes error log entries and suggests remediation.
type ErrorExplainerSkill struct {
	client *ai.Client
	ch     storage.ClickHouseStore
	logger *slog.Logger
}

// NewErrorExplainerSkill creates a new error explainer skill.
func NewErrorExplainerSkill(client *ai.Client, ch storage.ClickHouseStore) *ErrorExplainerSkill {
	return &ErrorExplainerSkill{
		client: client,
		ch:     ch,
		logger: slog.Default().With("skill", "error_explainer"),
	}
}

func (s *ErrorExplainerSkill) Name() string        { return "error_explainer" }
func (s *ErrorExplainerSkill) Description() string { return "Explain error codes and suggest fixes for BMC Remedy errors" }
func (s *ErrorExplainerSkill) Examples() []string {
	return []string{
		"Explain ARERR 302",
		"What does error 8745 mean?",
		"Why am I getting authentication failures?",
		"Help me understand these filter errors",
	}
}

func (s *ErrorExplainerSkill) Execute(ctx context.Context, input ai.SkillInput) (*ai.SkillOutput, error) {
	if err := validateInput(input); err != nil {
		return nil, err
	}

	if s.client == nil || !s.client.IsAvailable() {
		s.logger.Warn("AI client unavailable, returning fallback",
			"job_id", input.JobID, "tenant_id", input.TenantID)
		return fallbackOutput(s.Name()), nil
	}

	// Fetch error/exception data from ClickHouse.
	errorContext := s.fetchErrorContext(ctx, input.TenantID, input.JobID)

	systemPrompt := `You are RemedyIQ, an expert on BMC Remedy AR System error codes and troubleshooting.

When explaining errors:
1. Identify the specific ARERR code if present
2. Explain what the error means in the context of AR Server operations
3. List the most common causes
4. Provide specific remediation steps
5. Reference relevant BMC documentation where applicable

Common ARERR codes:
- ARERR 302: Entry does not exist in database
- ARERR 622: Authentication failed
- ARERR 8745: Operation not permitted (license/permission)
- ARERR 2000: Filter execution error
- ARERR 9225: Escalation schedule conflict

Format your response in markdown.`

	userContent := fmt.Sprintf("Job ID: %s\nTenant ID: %s\n\n%s\n\nUser question: %s",
		input.JobID, input.TenantID, errorContext, input.Query)

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
		FollowUps:  []string{"Show me related errors", "What other issues might be connected?", "How do I prevent this in the future?"},
		Confidence: 0.85,
		SkillName:  s.Name(),
		TokensUsed: resp.TokensUsed,
		LatencyMS:  resp.LatencyMS,
	}, nil
}

// fetchErrorContext queries ClickHouse for exception data scoped to the target
// job, giving the AI concrete error statistics to reason about.
func (s *ErrorExplainerSkill) fetchErrorContext(ctx context.Context, tenantID, jobID string) string {
	if s.ch == nil {
		return "(No log data available -- ClickHouse not configured.)"
	}

	queryCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	var b strings.Builder

	exceptions, err := s.ch.GetExceptions(queryCtx, tenantID, jobID)
	if err != nil {
		s.logger.Warn("failed to fetch exceptions for error explainer",
			"error", err, "job_id", jobID, "tenant_id", tenantID)
		return "(Error data could not be retrieved from ClickHouse.)"
	}

	if exceptions.TotalCount == 0 {
		return "(No errors were found in this job's log data.)"
	}

	b.WriteString("## Errors Found in This Job\n")
	fmt.Fprintf(&b, "- Total error occurrences: %d\n\n", exceptions.TotalCount)

	b.WriteString("### Error Rate by Log Type\n")
	for lt, rate := range exceptions.ErrorRates {
		fmt.Fprintf(&b, "- %s: %.2f%%\n", lt, rate*100)
	}

	b.WriteString("\n### Top Errors\n")
	for i, ex := range exceptions.Exceptions {
		if i >= 10 {
			break
		}
		fmt.Fprintf(&b, "- **%s**: %s (count: %d, first: %s, last: %s, type: %s)\n",
			ex.ErrorCode, ex.Message, ex.Count,
			ex.FirstSeen.Format(time.RFC3339), ex.LastSeen.Format(time.RFC3339),
			ex.LogType)
	}

	return b.String()
}

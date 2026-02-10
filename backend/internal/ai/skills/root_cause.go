package skills

import (
	"context"
	"fmt"

	"github.com/OmarEhab007/RemedyIQ/backend/internal/ai"
)

// RootCauseSkill analyzes correlated anomalies to find root causes.
type RootCauseSkill struct {
	client *ai.Client
}

func NewRootCauseSkill(client *ai.Client) *RootCauseSkill {
	return &RootCauseSkill{client: client}
}

func (s *RootCauseSkill) Name() string       { return "root_cause" }
func (s *RootCauseSkill) Description() string { return "Analyze correlated anomalies to find root causes" }
func (s *RootCauseSkill) Examples() []string {
	return []string{
		"What is the root cause of these anomalies?",
		"Why are multiple operations slow at the same time?",
		"Correlate the errors with performance issues",
	}
}

func (s *RootCauseSkill) Execute(ctx context.Context, input ai.SkillInput) (*ai.SkillOutput, error) {
	if s.client == nil || !s.client.IsAvailable() {
		return s.fallback(input), nil
	}

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

	messages := []ai.Message{
		{Role: "user", Content: fmt.Sprintf("Analyze root cause for job %s: %s", input.JobID, input.Query)},
	}

	resp, err := s.client.Query(ctx, systemPrompt, messages, 2048)
	if err != nil {
		return s.fallback(input), nil
	}

	return &ai.SkillOutput{
		Answer:     resp.Content,
		Confidence: 0.75,
		SkillName:  s.Name(),
		TokensUsed: resp.TokensUsed,
		LatencyMS:  resp.LatencyMS,
	}, nil
}

func (s *RootCauseSkill) fallback(input ai.SkillInput) *ai.SkillOutput {
	return &ai.SkillOutput{
		Answer:     "Root cause analysis requires AI. Manually check for temporal correlations between anomalies.",
		Confidence: 0.0,
		SkillName:  s.Name(),
	}
}

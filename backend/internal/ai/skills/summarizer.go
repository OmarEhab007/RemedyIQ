package skills

import (
	"context"
	"fmt"

	"github.com/OmarEhab007/RemedyIQ/backend/internal/ai"
)

// SummarizerSkill generates executive summary reports.
type SummarizerSkill struct {
	client *ai.Client
}

func NewSummarizerSkill(client *ai.Client) *SummarizerSkill {
	return &SummarizerSkill{client: client}
}

func (s *SummarizerSkill) Name() string       { return "summarizer" }
func (s *SummarizerSkill) Description() string { return "Generate executive summary reports of log analysis" }
func (s *SummarizerSkill) Examples() []string {
	return []string{
		"Generate an executive summary",
		"Create a health report for this analysis",
		"What are the key findings?",
	}
}

func (s *SummarizerSkill) Execute(ctx context.Context, input ai.SkillInput) (*ai.SkillOutput, error) {
	if s.client == nil || !s.client.IsAvailable() {
		return s.fallback(input), nil
	}

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

	messages := []ai.Message{
		{Role: "user", Content: fmt.Sprintf("Generate an executive summary for job %s.\n\nContext: %s", input.JobID, input.Query)},
	}

	resp, err := s.client.Query(ctx, systemPrompt, messages, 4096)
	if err != nil {
		return s.fallback(input), nil
	}

	return &ai.SkillOutput{
		Answer:     resp.Content,
		Confidence: 0.85,
		SkillName:  s.Name(),
		TokensUsed: resp.TokensUsed,
		LatencyMS:  resp.LatencyMS,
	}, nil
}

func (s *SummarizerSkill) fallback(input ai.SkillInput) *ai.SkillOutput {
	return &ai.SkillOutput{
		Answer:     "Executive summary generation requires AI. Please ensure the Claude API key is configured.",
		Confidence: 0.0,
		SkillName:  s.Name(),
	}
}

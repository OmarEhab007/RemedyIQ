package skills

import (
	"context"

	"github.com/OmarEhab007/RemedyIQ/backend/internal/ai"
)

// PerformanceSkill analyzes slow operations and suggests tuning.
type PerformanceSkill struct {
	client *ai.Client
}

func NewPerformanceSkill(client *ai.Client) *PerformanceSkill {
	return &PerformanceSkill{client: client}
}

func (s *PerformanceSkill) Name() string       { return "performance" }
func (s *PerformanceSkill) Description() string { return "Analyze slow operations and suggest performance tuning" }
func (s *PerformanceSkill) Examples() []string {
	return []string{
		"Why are API calls slow?",
		"How can I optimize SQL performance?",
		"What is causing filter delays?",
	}
}

func (s *PerformanceSkill) Execute(ctx context.Context, input ai.SkillInput) (*ai.SkillOutput, error) {
	if s.client == nil || !s.client.IsAvailable() {
		return s.fallback(input), nil
	}

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

	messages := []ai.Message{
		{Role: "user", Content: input.Query},
	}

	resp, err := s.client.Query(ctx, systemPrompt, messages, 2048)
	if err != nil {
		return s.fallback(input), nil
	}

	return &ai.SkillOutput{
		Answer:     resp.Content,
		FollowUps:  []string{"Show me the slow queries", "What configuration changes would help?"},
		Confidence: 0.8,
		SkillName:  s.Name(),
		TokensUsed: resp.TokensUsed,
		LatencyMS:  resp.LatencyMS,
	}, nil
}

func (s *PerformanceSkill) fallback(input ai.SkillInput) *ai.SkillOutput {
	return &ai.SkillOutput{
		Answer:     "Performance analysis requires AI. Check the API documentation for manual analysis steps.",
		Confidence: 0.0,
		SkillName:  s.Name(),
	}
}

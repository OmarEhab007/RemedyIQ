package skills

import (
	"context"
	"fmt"

	"github.com/OmarEhab007/RemedyIQ/backend/internal/ai"
)

// NLQuerySkill converts natural language to KQL and searches logs.
type NLQuerySkill struct {
	client *ai.Client
}

// NewNLQuerySkill creates a new natural language query skill.
func NewNLQuerySkill(client *ai.Client) *NLQuerySkill {
	return &NLQuerySkill{client: client}
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
	if s.client == nil || !s.client.IsAvailable() {
		return s.fallback(input), nil
	}

	systemPrompt := `You are RemedyIQ, an AI assistant that helps AR Server administrators analyze log files.
You convert natural language questions about AR Server logs into structured analysis.

When answering questions about logs, you should:
1. Identify what the user is looking for (API calls, SQL queries, filters, escalations)
2. Consider relevant fields: type, duration, user, form, queue, status, error
3. Provide specific, actionable answers with references to log entries
4. Suggest follow-up questions

If you can't determine the exact answer from context, explain what additional information would help.

Format your response in markdown. Use **bold** for important values and inline code for technical identifiers.`

	messages := []ai.Message{
		{Role: "user", Content: fmt.Sprintf("Job ID: %s\n\nQuestion: %s", input.JobID, input.Query)},
	}

	resp, err := s.client.Query(ctx, systemPrompt, messages, 2048)
	if err != nil {
		return s.fallback(input), nil
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

func (s *NLQuerySkill) fallback(input ai.SkillInput) *ai.SkillOutput {
	return &ai.SkillOutput{
		Answer:     fmt.Sprintf("AI service is currently unavailable. Try searching manually using KQL: `%s`", input.Query),
		Confidence: 0.0,
		SkillName:  s.Name(),
	}
}

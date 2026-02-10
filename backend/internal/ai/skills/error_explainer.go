package skills

import (
	"context"

	"github.com/OmarEhab007/RemedyIQ/backend/internal/ai"
)

// ErrorExplainerSkill analyzes error log entries and suggests remediation.
type ErrorExplainerSkill struct {
	client *ai.Client
}

// NewErrorExplainerSkill creates a new error explainer skill.
func NewErrorExplainerSkill(client *ai.Client) *ErrorExplainerSkill {
	return &ErrorExplainerSkill{client: client}
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
	if s.client == nil || !s.client.IsAvailable() {
		return s.fallback(input), nil
	}

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

	messages := []ai.Message{
		{Role: "user", Content: input.Query},
	}

	resp, err := s.client.Query(ctx, systemPrompt, messages, 2048)
	if err != nil {
		return s.fallback(input), nil
	}

	return &ai.SkillOutput{
		Answer:     resp.Content,
		FollowUps:  []string{"Show me related errors", "What other issues might be connected?"},
		Confidence: 0.85,
		SkillName:  s.Name(),
		TokensUsed: resp.TokensUsed,
		LatencyMS:  resp.LatencyMS,
	}, nil
}

func (s *ErrorExplainerSkill) fallback(input ai.SkillInput) *ai.SkillOutput {
	return &ai.SkillOutput{
		Answer:     "AI error analysis is currently unavailable. Please refer to the BMC Remedy documentation for error code explanations.",
		Confidence: 0.0,
		SkillName:  s.Name(),
	}
}

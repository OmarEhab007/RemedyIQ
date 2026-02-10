package skills

import (
	"context"

	"github.com/OmarEhab007/RemedyIQ/backend/internal/ai"
)

// AnomalyNarratorSkill describes detected anomalies in natural language.
type AnomalyNarratorSkill struct {
	client *ai.Client
}

func NewAnomalyNarratorSkill(client *ai.Client) *AnomalyNarratorSkill {
	return &AnomalyNarratorSkill{client: client}
}

func (s *AnomalyNarratorSkill) Name() string       { return "anomaly_narrator" }
func (s *AnomalyNarratorSkill) Description() string { return "Explain detected anomalies in plain language" }
func (s *AnomalyNarratorSkill) Examples() []string {
	return []string{
		"Explain the anomalies",
		"What caused the performance spikes?",
		"Why are there error rate anomalies?",
	}
}

func (s *AnomalyNarratorSkill) Execute(ctx context.Context, input ai.SkillInput) (*ai.SkillOutput, error) {
	if s.client == nil || !s.client.IsAvailable() {
		return s.fallback(input), nil
	}

	systemPrompt := `You are RemedyIQ, explaining performance anomalies detected in AR Server logs.

When explaining anomalies:
1. Describe what happened in plain language
2. Explain the statistical significance (how far from normal)
3. Suggest possible root causes based on AR Server expertise
4. Recommend investigation steps
5. Indicate urgency level

Format your response in markdown. Be specific with numbers and actionable.`

	messages := []ai.Message{
		{Role: "user", Content: input.Query},
	}

	resp, err := s.client.Query(ctx, systemPrompt, messages, 2048)
	if err != nil {
		return s.fallback(input), nil
	}

	return &ai.SkillOutput{
		Answer:     resp.Content,
		Confidence: 0.8,
		SkillName:  s.Name(),
		TokensUsed: resp.TokensUsed,
		LatencyMS:  resp.LatencyMS,
	}, nil
}

func (s *AnomalyNarratorSkill) fallback(input ai.SkillInput) *ai.SkillOutput {
	return &ai.SkillOutput{
		Answer:     "Anomaly explanation requires AI. Review the anomaly metrics manually for investigation.",
		Confidence: 0.0,
		SkillName:  s.Name(),
	}
}

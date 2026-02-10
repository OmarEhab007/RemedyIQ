package skills

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/OmarEhab007/RemedyIQ/backend/internal/ai"
)

func TestSummarizerSkill_Name(t *testing.T) {
	skill := NewSummarizerSkill(nil)
	assert.Equal(t, "summarizer", skill.Name())
}

func TestSummarizerSkill_Description(t *testing.T) {
	skill := NewSummarizerSkill(nil)
	desc := skill.Description()
	assert.NotEmpty(t, desc, "description should not be empty")
}

func TestSummarizerSkill_Examples(t *testing.T) {
	skill := NewSummarizerSkill(nil)
	examples := skill.Examples()
	assert.NotEmpty(t, examples, "examples should not be empty")
	for _, ex := range examples {
		assert.NotEmpty(t, ex, "each example should be a non-empty string")
	}
}

func TestSummarizerSkill_Fallback_NilClient(t *testing.T) {
	skill := NewSummarizerSkill(nil)

	input := ai.SkillInput{
		Query:    "Generate an executive summary",
		JobID:    "test-job-id",
		TenantID: "test-tenant-id",
	}

	output, err := skill.Execute(context.Background(), input)
	require.NoError(t, err, "Execute should not return an error for nil client fallback")
	require.NotNil(t, output, "output should not be nil")

	assert.Equal(t, 0.0, output.Confidence, "fallback confidence should be 0.0")
	assert.Equal(t, "summarizer", output.SkillName)
	assert.NotEmpty(t, output.Answer, "fallback answer should not be empty")
}

func TestSummarizerSkill_Fallback_UnavailableClient(t *testing.T) {
	// Create a client with no API key. NewClient returns an error when
	// apiKey is empty, so we cannot construct a real unavailable client
	// without reaching into internals. Instead, we verify that a nil
	// client triggers the fallback path, which covers the same code path
	// as an unavailable client (the condition is: client == nil || !client.IsAvailable()).
	//
	// We test the IsAvailable check by confirming that a nil *ai.Client
	// returns false for IsAvailable.
	var client *ai.Client
	assert.False(t, client.IsAvailable(), "nil client should not be available")

	skill := NewSummarizerSkill(client)

	input := ai.SkillInput{
		Query:    "Generate a health report",
		JobID:    "test-job-id",
		TenantID: "test-tenant-id",
	}

	output, err := skill.Execute(context.Background(), input)
	require.NoError(t, err, "Execute should not return an error for unavailable client fallback")
	require.NotNil(t, output, "output should not be nil")

	assert.Equal(t, 0.0, output.Confidence, "fallback confidence should be 0.0")
	assert.Equal(t, "summarizer", output.SkillName)
	assert.NotEmpty(t, output.Answer, "fallback answer should not be empty")
}

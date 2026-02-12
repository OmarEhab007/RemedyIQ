package skills

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/OmarEhab007/RemedyIQ/backend/internal/ai"
)

func TestSummarizerSkill_Name(t *testing.T) {
	skill := NewSummarizerSkill(nil, nil)
	assert.Equal(t, "summarizer", skill.Name())
}

func TestSummarizerSkill_Description(t *testing.T) {
	skill := NewSummarizerSkill(nil, nil)
	desc := skill.Description()
	assert.NotEmpty(t, desc, "description should not be empty")
}

func TestSummarizerSkill_Examples(t *testing.T) {
	skill := NewSummarizerSkill(nil, nil)
	examples := skill.Examples()
	assert.NotEmpty(t, examples, "examples should not be empty")
	for _, ex := range examples {
		assert.NotEmpty(t, ex, "each example should be a non-empty string")
	}
}

func TestSummarizerSkill_Fallback_NilClient(t *testing.T) {
	skill := NewSummarizerSkill(nil, nil)

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
	assert.Equal(t, FallbackMessage, output.Answer, "fallback should use the standard message")
}

func TestSummarizerSkill_Fallback_UnavailableClient(t *testing.T) {
	var client *ai.Client
	assert.False(t, client.IsAvailable(), "nil client should not be available")

	skill := NewSummarizerSkill(client, nil)

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
	assert.Equal(t, FallbackMessage, output.Answer, "fallback should use the standard message")
}

func TestSummarizerSkill_ValidationError_MissingTenantID(t *testing.T) {
	skill := NewSummarizerSkill(nil, nil)

	input := ai.SkillInput{
		Query: "Generate a summary",
		JobID: "test-job-id",
		// TenantID intentionally omitted
	}

	output, err := skill.Execute(context.Background(), input)
	assert.Error(t, err, "should return error for missing tenant_id")
	assert.Nil(t, output)
	assert.Contains(t, err.Error(), "tenant_id is required")
}

func TestSummarizerSkill_ValidationError_MissingJobID(t *testing.T) {
	skill := NewSummarizerSkill(nil, nil)

	input := ai.SkillInput{
		Query:    "Generate a summary",
		TenantID: "test-tenant-id",
		// JobID intentionally omitted
	}

	output, err := skill.Execute(context.Background(), input)
	assert.Error(t, err, "should return error for missing job_id")
	assert.Nil(t, output)
	assert.Contains(t, err.Error(), "job_id is required")
}

func TestSummarizerSkill_ValidationError_MissingQuery(t *testing.T) {
	skill := NewSummarizerSkill(nil, nil)

	input := ai.SkillInput{
		JobID:    "test-job-id",
		TenantID: "test-tenant-id",
		// Query intentionally omitted
	}

	output, err := skill.Execute(context.Background(), input)
	assert.Error(t, err, "should return error for missing query")
	assert.Nil(t, output)
	assert.Contains(t, err.Error(), "query is required")
}

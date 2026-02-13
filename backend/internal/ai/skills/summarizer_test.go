package skills

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/OmarEhab007/RemedyIQ/backend/internal/ai"
)

func TestNewSummarizerSkill(t *testing.T) {
	skill := NewSummarizerSkill(nil, nil)
	require.NotNil(t, skill)
	assert.Nil(t, skill.client)
	assert.Nil(t, skill.ch)
	assert.NotNil(t, skill.logger)
}

func TestSummarizerSkill_Name(t *testing.T) {
	skill := NewSummarizerSkill(nil, nil)
	assert.Equal(t, "summarizer", skill.Name())
}

func TestSummarizerSkill_Description(t *testing.T) {
	skill := NewSummarizerSkill(nil, nil)
	desc := skill.Description()
	assert.NotEmpty(t, desc)
	assert.Contains(t, desc, "summary")
}

func TestSummarizerSkill_Examples(t *testing.T) {
	skill := NewSummarizerSkill(nil, nil)
	examples := skill.Examples()
	assert.NotEmpty(t, examples)
	assert.GreaterOrEqual(t, len(examples), 2, "should have at least 2 examples")
	for i, ex := range examples {
		assert.NotEmpty(t, ex, "example at index %d should not be empty", i)
	}
}

func TestSummarizerSkill_ImplementsSkillInterface(t *testing.T) {
	skill := NewSummarizerSkill(nil, nil)
	var _ ai.Skill = skill
}

func TestSummarizerSkill_Execute_Validation(t *testing.T) {
	skill := NewSummarizerSkill(nil, nil)

	tests := []struct {
		name   string
		input  ai.SkillInput
		errMsg string
	}{
		{
			name: "missing tenant_id",
			input: ai.SkillInput{
				Query: "Generate a summary",
				JobID: "job-1",
			},
			errMsg: "tenant_id is required",
		},
		{
			name: "missing job_id",
			input: ai.SkillInput{
				Query:    "Generate a summary",
				TenantID: "tenant-1",
			},
			errMsg: "job_id is required",
		},
		{
			name: "missing query",
			input: ai.SkillInput{
				JobID:    "job-1",
				TenantID: "tenant-1",
			},
			errMsg: "query is required",
		},
		{
			name:   "all fields empty",
			input:  ai.SkillInput{},
			errMsg: "tenant_id is required",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			output, err := skill.Execute(context.Background(), tt.input)
			require.Error(t, err)
			assert.Nil(t, output)
			assert.Contains(t, err.Error(), tt.errMsg)
		})
	}
}

func TestSummarizerSkill_Execute_FallbackNilClient(t *testing.T) {
	skill := NewSummarizerSkill(nil, nil)

	input := ai.SkillInput{
		Query:    "Generate an executive summary",
		JobID:    "test-job-id",
		TenantID: "test-tenant-id",
	}

	output, err := skill.Execute(context.Background(), input)
	require.NoError(t, err)
	require.NotNil(t, output)

	assert.Equal(t, FallbackMessage, output.Answer)
	assert.Equal(t, 0.0, output.Confidence)
	assert.Equal(t, "summarizer", output.SkillName)
	assert.Zero(t, output.TokensUsed)
	assert.Zero(t, output.LatencyMS)
}

func TestSummarizerSkill_Execute_FallbackUnavailableClient(t *testing.T) {
	var nilClient *ai.Client
	assert.False(t, nilClient.IsAvailable())

	skill := NewSummarizerSkill(nilClient, nil)

	input := ai.SkillInput{
		Query:    "Generate a health report",
		JobID:    "test-job-id",
		TenantID: "test-tenant-id",
	}

	output, err := skill.Execute(context.Background(), input)
	require.NoError(t, err)
	require.NotNil(t, output)

	assert.Equal(t, FallbackMessage, output.Answer)
	assert.Equal(t, 0.0, output.Confidence)
	assert.Equal(t, "summarizer", output.SkillName)
}

func TestSummarizerSkill_FetchLogContext_NilClickHouse(t *testing.T) {
	skill := NewSummarizerSkill(nil, nil)
	ctx := context.Background()

	result := skill.fetchLogContext(ctx, "tenant-1", "job-1")
	assert.Contains(t, result, "ClickHouse not configured")
}

func TestSummarizerSkill_Execute_AIQueryError_ReturnsFallback(t *testing.T) {
	// Use a real client with an invalid key -- the query will fail and the
	// skill should gracefully return a fallback output rather than an error.
	client, err := ai.NewClient("sk-ant-test-invalid-key", "test-model")
	require.NoError(t, err)
	require.True(t, client.IsAvailable())

	skill := NewSummarizerSkill(client, nil)

	ctx, cancel := context.WithCancel(context.Background())
	cancel() // cancel immediately to make the API call fail fast

	input := ai.SkillInput{
		Query:    "Generate a summary",
		JobID:    "job-1",
		TenantID: "tenant-1",
	}

	output, err := skill.Execute(ctx, input)
	require.NoError(t, err, "skill should return fallback, not an error")
	require.NotNil(t, output)
	assert.Equal(t, FallbackMessage, output.Answer)
	assert.Equal(t, 0.0, output.Confidence)
	assert.Equal(t, "summarizer", output.SkillName)
}

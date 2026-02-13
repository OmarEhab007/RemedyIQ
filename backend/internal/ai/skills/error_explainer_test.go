package skills

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/OmarEhab007/RemedyIQ/backend/internal/ai"
)

func TestNewErrorExplainerSkill(t *testing.T) {
	skill := NewErrorExplainerSkill(nil, nil)
	require.NotNil(t, skill)
	assert.Nil(t, skill.client)
	assert.Nil(t, skill.ch)
	assert.NotNil(t, skill.logger)
}

func TestErrorExplainerSkill_Name(t *testing.T) {
	skill := NewErrorExplainerSkill(nil, nil)
	assert.Equal(t, "error_explainer", skill.Name())
}

func TestErrorExplainerSkill_Description(t *testing.T) {
	skill := NewErrorExplainerSkill(nil, nil)
	desc := skill.Description()
	assert.NotEmpty(t, desc)
	assert.Contains(t, desc, "error")
}

func TestErrorExplainerSkill_Examples(t *testing.T) {
	skill := NewErrorExplainerSkill(nil, nil)
	examples := skill.Examples()
	assert.NotEmpty(t, examples)
	assert.GreaterOrEqual(t, len(examples), 2, "should have at least 2 examples")
	for i, ex := range examples {
		assert.NotEmpty(t, ex, "example at index %d should not be empty", i)
	}
}

func TestErrorExplainerSkill_ImplementsSkillInterface(t *testing.T) {
	skill := NewErrorExplainerSkill(nil, nil)
	var _ ai.Skill = skill
}

func TestErrorExplainerSkill_Execute_Validation(t *testing.T) {
	skill := NewErrorExplainerSkill(nil, nil)

	tests := []struct {
		name   string
		input  ai.SkillInput
		errMsg string
	}{
		{
			name: "missing tenant_id",
			input: ai.SkillInput{
				Query: "Explain ARERR 302",
				JobID: "job-1",
			},
			errMsg: "tenant_id is required",
		},
		{
			name: "missing job_id",
			input: ai.SkillInput{
				Query:    "Explain ARERR 302",
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

func TestErrorExplainerSkill_Execute_FallbackNilClient(t *testing.T) {
	skill := NewErrorExplainerSkill(nil, nil)

	input := ai.SkillInput{
		Query:    "Explain ARERR 302",
		JobID:    "test-job-id",
		TenantID: "test-tenant-id",
	}

	output, err := skill.Execute(context.Background(), input)
	require.NoError(t, err)
	require.NotNil(t, output)

	assert.Equal(t, FallbackMessage, output.Answer)
	assert.Equal(t, 0.0, output.Confidence)
	assert.Equal(t, "error_explainer", output.SkillName)
	assert.Zero(t, output.TokensUsed)
	assert.Zero(t, output.LatencyMS)
}

func TestErrorExplainerSkill_Execute_FallbackUnavailableClient(t *testing.T) {
	var nilClient *ai.Client
	skill := NewErrorExplainerSkill(nilClient, nil)

	input := ai.SkillInput{
		Query:    "What does error 8745 mean?",
		JobID:    "test-job-id",
		TenantID: "test-tenant-id",
	}

	output, err := skill.Execute(context.Background(), input)
	require.NoError(t, err)
	require.NotNil(t, output)

	assert.Equal(t, FallbackMessage, output.Answer)
	assert.Equal(t, 0.0, output.Confidence)
	assert.Equal(t, "error_explainer", output.SkillName)
}

func TestErrorExplainerSkill_FetchErrorContext_NilClickHouse(t *testing.T) {
	skill := NewErrorExplainerSkill(nil, nil)
	ctx := context.Background()

	result := skill.fetchErrorContext(ctx, "tenant-1", "job-1")
	assert.Contains(t, result, "ClickHouse not configured")
}

func TestErrorExplainerSkill_Execute_AIQueryError_ReturnsFallback(t *testing.T) {
	client, err := ai.NewClient("sk-ant-test-invalid-key", "test-model")
	require.NoError(t, err)
	require.True(t, client.IsAvailable())

	skill := NewErrorExplainerSkill(client, nil)

	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	input := ai.SkillInput{
		Query:    "Explain ARERR 302",
		JobID:    "job-1",
		TenantID: "tenant-1",
	}

	output, err := skill.Execute(ctx, input)
	require.NoError(t, err, "skill should return fallback, not an error")
	require.NotNil(t, output)
	assert.Equal(t, FallbackMessage, output.Answer)
	assert.Equal(t, 0.0, output.Confidence)
	assert.Equal(t, "error_explainer", output.SkillName)
}

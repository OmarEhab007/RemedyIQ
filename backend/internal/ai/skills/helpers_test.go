package skills

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/OmarEhab007/RemedyIQ/backend/internal/ai"
)

func TestValidateInput(t *testing.T) {
	tests := []struct {
		name    string
		input   ai.SkillInput
		wantErr bool
		errMsg  string
	}{
		{
			name: "valid input passes validation",
			input: ai.SkillInput{
				TenantID: "tenant-1",
				JobID:    "job-1",
				Query:    "test query",
			},
			wantErr: false,
		},
		{
			name: "missing tenant_id returns error",
			input: ai.SkillInput{
				TenantID: "",
				JobID:    "job-1",
				Query:    "test query",
			},
			wantErr: true,
			errMsg:  "tenant_id is required",
		},
		{
			name: "missing job_id returns error",
			input: ai.SkillInput{
				TenantID: "tenant-1",
				JobID:    "",
				Query:    "test query",
			},
			wantErr: true,
			errMsg:  "job_id is required",
		},
		{
			name: "missing query returns error",
			input: ai.SkillInput{
				TenantID: "tenant-1",
				JobID:    "job-1",
				Query:    "",
			},
			wantErr: true,
			errMsg:  "query is required",
		},
		{
			name: "all fields empty - tenant_id checked first",
			input: ai.SkillInput{
				TenantID: "",
				JobID:    "",
				Query:    "",
			},
			wantErr: true,
			errMsg:  "tenant_id is required",
		},
		{
			name: "tenant and query present but job_id empty",
			input: ai.SkillInput{
				TenantID: "tenant-1",
				JobID:    "",
				Query:    "hello",
			},
			wantErr: true,
			errMsg:  "job_id is required",
		},
		{
			name: "context field is optional",
			input: ai.SkillInput{
				TenantID: "tenant-1",
				JobID:    "job-1",
				Query:    "query",
				Context:  nil,
			},
			wantErr: false,
		},
		{
			name: "context field with data is valid",
			input: ai.SkillInput{
				TenantID: "tenant-1",
				JobID:    "job-1",
				Query:    "query",
				Context:  map[string]interface{}{"extra": "data"},
			},
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validateInput(tt.input)

			if tt.wantErr {
				assert.Error(t, err)
				if tt.errMsg != "" {
					assert.Contains(t, err.Error(), tt.errMsg)
				}
				return
			}

			assert.NoError(t, err)
		})
	}
}

func TestFallbackOutput(t *testing.T) {
	tests := []struct {
		name      string
		skillName string
	}{
		{name: "summarizer", skillName: "summarizer"},
		{name: "error_explainer", skillName: "error_explainer"},
		{name: "nl_query", skillName: "nl_query"},
		{name: "performance", skillName: "performance"},
		{name: "root_cause", skillName: "root_cause"},
		{name: "anomaly_narrator", skillName: "anomaly_narrator"},
		{name: "empty string", skillName: ""},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			output := fallbackOutput(tt.skillName)

			assert.NotNil(t, output)
			assert.Equal(t, FallbackMessage, output.Answer)
			assert.Equal(t, 0.0, output.Confidence)
			assert.Equal(t, tt.skillName, output.SkillName)
			assert.Empty(t, output.References)
			assert.Empty(t, output.FollowUps)
			assert.Zero(t, output.TokensUsed)
			assert.Zero(t, output.LatencyMS)
		})
	}
}

func TestFallbackMessage_IsNotEmpty(t *testing.T) {
	assert.NotEmpty(t, FallbackMessage)
	assert.Contains(t, FallbackMessage, "unavailable")
}

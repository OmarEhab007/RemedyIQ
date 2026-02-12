package skills

import (
	"fmt"

	"github.com/OmarEhab007/RemedyIQ/backend/internal/ai"
)

// FallbackMessage is the standard user-facing message returned when the AI
// service is unavailable or encounters an error.
const FallbackMessage = "AI service is temporarily unavailable. Please try again later."

// validateInput checks that the required fields in a SkillInput are present.
// It returns a user-friendly error if validation fails.
func validateInput(input ai.SkillInput) error {
	if input.TenantID == "" {
		return fmt.Errorf("tenant_id is required")
	}
	if input.JobID == "" {
		return fmt.Errorf("job_id is required")
	}
	if input.Query == "" {
		return fmt.Errorf("query is required")
	}
	return nil
}

// fallbackOutput returns a standard SkillOutput indicating the AI service is
// unavailable. Every skill should use this rather than crafting its own fallback
// message, to ensure consistency.
func fallbackOutput(skillName string) *ai.SkillOutput {
	return &ai.SkillOutput{
		Answer:     FallbackMessage,
		Confidence: 0.0,
		SkillName:  skillName,
	}
}

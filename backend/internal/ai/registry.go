package ai

import (
	"context"
	"fmt"
	"sync"
)

// Skill defines the interface for an AI skill.
type Skill interface {
	// Name returns the unique identifier for this skill.
	Name() string
	// Description returns a human-readable description.
	Description() string
	// Execute runs the skill with the given input and context.
	Execute(ctx context.Context, input SkillInput) (*SkillOutput, error)
	// Examples returns example prompts for this skill.
	Examples() []string
}

// SkillInput contains the input for a skill execution.
type SkillInput struct {
	Query    string                 `json:"query"`
	JobID    string                 `json:"job_id"`
	TenantID string                `json:"tenant_id"`
	Context  map[string]interface{} `json:"context,omitempty"`
}

// SkillOutput contains the result of a skill execution.
type SkillOutput struct {
	Answer     string         `json:"answer"`
	References []LogReference `json:"references,omitempty"`
	FollowUps  []string       `json:"follow_ups,omitempty"`
	Confidence float64        `json:"confidence"`
	SkillName  string         `json:"skill_name"`
	TokensUsed int            `json:"tokens_used"`
	LatencyMS  int            `json:"latency_ms"`
}

// LogReference points to a specific log entry.
type LogReference struct {
	EntryID    string `json:"entry_id"`
	LineNumber int    `json:"line_number"`
	LogType    string `json:"log_type"`
	Summary    string `json:"summary"`
}

// Registry manages registered AI skills.
type Registry struct {
	skills map[string]Skill
	mu     sync.RWMutex
}

// NewRegistry creates a new skill registry.
func NewRegistry() *Registry {
	return &Registry{
		skills: make(map[string]Skill),
	}
}

// Register adds a skill to the registry.
func (r *Registry) Register(skill Skill) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	name := skill.Name()
	if name == "" {
		return fmt.Errorf("ai registry: skill name cannot be empty")
	}
	if _, exists := r.skills[name]; exists {
		return fmt.Errorf("ai registry: skill %q already registered", name)
	}
	r.skills[name] = skill
	return nil
}

// Get returns a skill by name.
func (r *Registry) Get(name string) (Skill, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	skill, ok := r.skills[name]
	if !ok {
		return nil, fmt.Errorf("ai registry: skill %q not found", name)
	}
	return skill, nil
}

// List returns all registered skill names and descriptions.
func (r *Registry) List() []SkillInfo {
	r.mu.RLock()
	defer r.mu.RUnlock()

	infos := make([]SkillInfo, 0, len(r.skills))
	for _, skill := range r.skills {
		infos = append(infos, SkillInfo{
			Name:        skill.Name(),
			Description: skill.Description(),
			Examples:    skill.Examples(),
		})
	}
	return infos
}

// SkillInfo provides metadata about a registered skill.
type SkillInfo struct {
	Name        string   `json:"name"`
	Description string   `json:"description"`
	Examples    []string `json:"examples"`
}

// Execute runs a skill by name with the given input.
func (r *Registry) Execute(ctx context.Context, skillName string, input SkillInput) (*SkillOutput, error) {
	skill, err := r.Get(skillName)
	if err != nil {
		return nil, err
	}
	return skill.Execute(ctx, input)
}

package ai

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type mockSkill struct {
	name string
	desc string
}

func (s *mockSkill) Name() string        { return s.name }
func (s *mockSkill) Description() string { return s.desc }
func (s *mockSkill) Examples() []string  { return []string{"test"} }
func (s *mockSkill) Execute(ctx context.Context, input SkillInput) (*SkillOutput, error) {
	return &SkillOutput{
		Answer:    "mock answer for: " + input.Query,
		SkillName: s.name,
	}, nil
}

func TestRegistry_RegisterAndGet(t *testing.T) {
	r := NewRegistry()
	err := r.Register(&mockSkill{name: "test", desc: "Test skill"})
	require.NoError(t, err)

	skill, err := r.Get("test")
	require.NoError(t, err)
	assert.Equal(t, "test", skill.Name())
}

func TestRegistry_RegisterDuplicate(t *testing.T) {
	r := NewRegistry()
	_ = r.Register(&mockSkill{name: "test", desc: "first"})
	err := r.Register(&mockSkill{name: "test", desc: "second"})
	assert.Error(t, err)
}

func TestRegistry_RegisterEmptyName(t *testing.T) {
	r := NewRegistry()
	err := r.Register(&mockSkill{name: "", desc: "no name"})
	assert.Error(t, err)
}

func TestRegistry_GetNotFound(t *testing.T) {
	r := NewRegistry()
	_, err := r.Get("nonexistent")
	assert.Error(t, err)
}

func TestRegistry_List(t *testing.T) {
	r := NewRegistry()
	_ = r.Register(&mockSkill{name: "a", desc: "Skill A"})
	_ = r.Register(&mockSkill{name: "b", desc: "Skill B"})

	infos := r.List()
	assert.Len(t, infos, 2)
}

func TestRegistry_Execute(t *testing.T) {
	r := NewRegistry()
	_ = r.Register(&mockSkill{name: "test", desc: "Test"})

	output, err := r.Execute(context.Background(), "test", SkillInput{Query: "hello"})
	require.NoError(t, err)
	assert.Equal(t, "mock answer for: hello", output.Answer)
	assert.Equal(t, "test", output.SkillName)
}

func TestRegistry_ExecuteNotFound(t *testing.T) {
	r := NewRegistry()
	_, err := r.Execute(context.Background(), "nope", SkillInput{})
	assert.Error(t, err)
}

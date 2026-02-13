package ai

import (
	"context"
	"fmt"
	"sync"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// mockSkill implements the Skill interface for testing.
type mockSkill struct {
	name     string
	desc     string
	examples []string
	execFn   func(ctx context.Context, input SkillInput) (*SkillOutput, error)
}

func (s *mockSkill) Name() string        { return s.name }
func (s *mockSkill) Description() string { return s.desc }
func (s *mockSkill) Examples() []string {
	if s.examples != nil {
		return s.examples
	}
	return []string{"test example"}
}
func (s *mockSkill) Execute(ctx context.Context, input SkillInput) (*SkillOutput, error) {
	if s.execFn != nil {
		return s.execFn(ctx, input)
	}
	return &SkillOutput{
		Answer:    "mock answer for: " + input.Query,
		SkillName: s.name,
	}, nil
}

func TestNewRegistry(t *testing.T) {
	r := NewRegistry()
	require.NotNil(t, r)
	assert.NotNil(t, r.skills)
	assert.Empty(t, r.skills)
}

func TestRegistry_Register(t *testing.T) {
	tests := []struct {
		name    string
		skill   Skill
		wantErr bool
		errMsg  string
	}{
		{
			name:    "valid skill registers successfully",
			skill:   &mockSkill{name: "test_skill", desc: "Test skill"},
			wantErr: false,
		},
		{
			name:    "empty name returns error",
			skill:   &mockSkill{name: "", desc: "no name"},
			wantErr: true,
			errMsg:  "skill name cannot be empty",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			r := NewRegistry()
			err := r.Register(tt.skill)

			if tt.wantErr {
				require.Error(t, err)
				if tt.errMsg != "" {
					assert.Contains(t, err.Error(), tt.errMsg)
				}
				return
			}

			require.NoError(t, err)
			// Verify the skill was stored.
			skill, getErr := r.Get(tt.skill.Name())
			require.NoError(t, getErr)
			assert.Equal(t, tt.skill.Name(), skill.Name())
		})
	}
}

func TestRegistry_RegisterDuplicate(t *testing.T) {
	r := NewRegistry()

	err := r.Register(&mockSkill{name: "dup", desc: "first"})
	require.NoError(t, err)

	err = r.Register(&mockSkill{name: "dup", desc: "second"})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "already registered")
	assert.Contains(t, err.Error(), "dup")
}

func TestRegistry_RegisterMultipleDistinctSkills(t *testing.T) {
	r := NewRegistry()

	skills := []string{"summarizer", "error_explainer", "nl_query", "performance", "root_cause"}
	for _, name := range skills {
		err := r.Register(&mockSkill{name: name, desc: "Skill " + name})
		require.NoError(t, err, "registering %s should succeed", name)
	}

	infos := r.List()
	assert.Len(t, infos, len(skills))
}

func TestRegistry_Get(t *testing.T) {
	r := NewRegistry()
	_ = r.Register(&mockSkill{name: "finder", desc: "Finder skill"})

	tests := []struct {
		name    string
		lookup  string
		wantErr bool
		errMsg  string
	}{
		{
			name:    "existing skill is returned",
			lookup:  "finder",
			wantErr: false,
		},
		{
			name:    "non-existent skill returns error",
			lookup:  "ghost",
			wantErr: true,
			errMsg:  "not found",
		},
		{
			name:    "empty name returns error",
			lookup:  "",
			wantErr: true,
			errMsg:  "not found",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			skill, err := r.Get(tt.lookup)

			if tt.wantErr {
				require.Error(t, err)
				assert.Nil(t, skill)
				if tt.errMsg != "" {
					assert.Contains(t, err.Error(), tt.errMsg)
				}
				return
			}

			require.NoError(t, err)
			require.NotNil(t, skill)
			assert.Equal(t, tt.lookup, skill.Name())
		})
	}
}

func TestRegistry_List(t *testing.T) {
	t.Run("empty registry returns empty slice", func(t *testing.T) {
		r := NewRegistry()
		infos := r.List()
		assert.NotNil(t, infos)
		assert.Empty(t, infos)
	})

	t.Run("returns all registered skills with metadata", func(t *testing.T) {
		r := NewRegistry()
		_ = r.Register(&mockSkill{
			name:     "alpha",
			desc:     "Alpha skill",
			examples: []string{"do alpha"},
		})
		_ = r.Register(&mockSkill{
			name:     "beta",
			desc:     "Beta skill",
			examples: []string{"do beta", "try beta"},
		})

		infos := r.List()
		assert.Len(t, infos, 2)

		// Build a map for order-independent assertions.
		byName := make(map[string]SkillInfo)
		for _, info := range infos {
			byName[info.Name] = info
		}

		alphaInfo, ok := byName["alpha"]
		require.True(t, ok, "alpha should be in list")
		assert.Equal(t, "Alpha skill", alphaInfo.Description)
		assert.Equal(t, []string{"do alpha"}, alphaInfo.Examples)

		betaInfo, ok := byName["beta"]
		require.True(t, ok, "beta should be in list")
		assert.Equal(t, "Beta skill", betaInfo.Description)
		assert.Equal(t, []string{"do beta", "try beta"}, betaInfo.Examples)
	})
}

func TestRegistry_Execute(t *testing.T) {
	t.Run("executes existing skill and returns output", func(t *testing.T) {
		r := NewRegistry()
		_ = r.Register(&mockSkill{name: "exec_test", desc: "Exec test"})

		input := SkillInput{
			Query:    "test query",
			JobID:    "job-1",
			TenantID: "tenant-1",
		}

		output, err := r.Execute(context.Background(), "exec_test", input)
		require.NoError(t, err)
		require.NotNil(t, output)
		assert.Equal(t, "mock answer for: test query", output.Answer)
		assert.Equal(t, "exec_test", output.SkillName)
	})

	t.Run("returns error for non-existent skill", func(t *testing.T) {
		r := NewRegistry()

		output, err := r.Execute(context.Background(), "missing", SkillInput{})
		require.Error(t, err)
		assert.Nil(t, output)
		assert.Contains(t, err.Error(), "not found")
	})

	t.Run("propagates skill execution error", func(t *testing.T) {
		r := NewRegistry()
		_ = r.Register(&mockSkill{
			name: "failing",
			desc: "Always fails",
			execFn: func(ctx context.Context, input SkillInput) (*SkillOutput, error) {
				return nil, fmt.Errorf("skill execution failed: %s", input.Query)
			},
		})

		output, err := r.Execute(context.Background(), "failing", SkillInput{Query: "boom"})
		require.Error(t, err)
		assert.Nil(t, output)
		assert.Contains(t, err.Error(), "skill execution failed: boom")
	})

	t.Run("passes context to skill", func(t *testing.T) {
		r := NewRegistry()
		type ctxKey string
		var captured context.Context

		_ = r.Register(&mockSkill{
			name: "ctx_test",
			desc: "Captures context",
			execFn: func(ctx context.Context, input SkillInput) (*SkillOutput, error) {
				captured = ctx
				return &SkillOutput{Answer: "ok", SkillName: "ctx_test"}, nil
			},
		})

		ctx := context.WithValue(context.Background(), ctxKey("key"), "value")
		_, err := r.Execute(ctx, "ctx_test", SkillInput{Query: "q", JobID: "j", TenantID: "t"})
		require.NoError(t, err)
		assert.Equal(t, "value", captured.Value(ctxKey("key")))
	})
}

func TestRegistry_ConcurrentAccess(t *testing.T) {
	r := NewRegistry()

	// Pre-register some skills.
	for i := 0; i < 10; i++ {
		err := r.Register(&mockSkill{
			name: fmt.Sprintf("pre_%d", i),
			desc: fmt.Sprintf("Pre-registered skill %d", i),
		})
		require.NoError(t, err)
	}

	const goroutines = 50
	var wg sync.WaitGroup
	wg.Add(goroutines)

	errCh := make(chan error, goroutines*3)

	for i := 0; i < goroutines; i++ {
		go func(id int) {
			defer wg.Done()

			// Each goroutine tries to register a unique skill.
			name := fmt.Sprintf("concurrent_%d", id)
			if err := r.Register(&mockSkill{name: name, desc: "concurrent"}); err != nil {
				errCh <- fmt.Errorf("register %s: %w", name, err)
			}

			// Read from a pre-registered skill.
			readIdx := id % 10
			if _, err := r.Get(fmt.Sprintf("pre_%d", readIdx)); err != nil {
				errCh <- fmt.Errorf("get pre_%d: %w", readIdx, err)
			}

			// List all skills.
			infos := r.List()
			if len(infos) == 0 {
				errCh <- fmt.Errorf("list returned empty from goroutine %d", id)
			}

			// Execute a pre-registered skill.
			if _, err := r.Execute(context.Background(), fmt.Sprintf("pre_%d", readIdx), SkillInput{
				Query:    "concurrent query",
				JobID:    "job-1",
				TenantID: "tenant-1",
			}); err != nil {
				errCh <- fmt.Errorf("execute pre_%d: %w", readIdx, err)
			}
		}(i)
	}

	wg.Wait()
	close(errCh)

	for err := range errCh {
		t.Errorf("concurrent operation failed: %v", err)
	}

	// After all goroutines complete, verify state is consistent.
	infos := r.List()
	assert.Equal(t, 10+goroutines, len(infos), "should have pre-registered + concurrent skills")
}

func TestSkillInfo_Fields(t *testing.T) {
	info := SkillInfo{
		Name:        "test_info",
		Description: "A test info struct",
		Examples:    []string{"example one", "example two"},
	}
	assert.Equal(t, "test_info", info.Name)
	assert.Equal(t, "A test info struct", info.Description)
	assert.Len(t, info.Examples, 2)
}

func TestSkillInput_Fields(t *testing.T) {
	input := SkillInput{
		Query:    "test query",
		JobID:    "job-123",
		TenantID: "tenant-456",
		Context:  map[string]interface{}{"key": "value"},
	}
	assert.Equal(t, "test query", input.Query)
	assert.Equal(t, "job-123", input.JobID)
	assert.Equal(t, "tenant-456", input.TenantID)
	assert.Equal(t, "value", input.Context["key"])
}

func TestSkillOutput_Fields(t *testing.T) {
	output := SkillOutput{
		Answer: "the answer",
		References: []LogReference{
			{EntryID: "e1", LineNumber: 42, LogType: "api", Summary: "slow call"},
		},
		FollowUps:  []string{"follow up 1"},
		Confidence: 0.95,
		SkillName:  "test_skill",
		TokensUsed: 200,
		LatencyMS:  50,
	}
	assert.Equal(t, "the answer", output.Answer)
	assert.Len(t, output.References, 1)
	assert.Equal(t, "e1", output.References[0].EntryID)
	assert.Equal(t, 42, output.References[0].LineNumber)
	assert.Equal(t, "api", output.References[0].LogType)
	assert.Equal(t, "slow call", output.References[0].Summary)
	assert.Len(t, output.FollowUps, 1)
	assert.Equal(t, 0.95, output.Confidence)
	assert.Equal(t, "test_skill", output.SkillName)
	assert.Equal(t, 200, output.TokensUsed)
	assert.Equal(t, 50, output.LatencyMS)
}

func TestLogReference_Fields(t *testing.T) {
	ref := LogReference{
		EntryID:    "entry-abc",
		LineNumber: 100,
		LogType:    "sql",
		Summary:    "long running query",
	}
	assert.Equal(t, "entry-abc", ref.EntryID)
	assert.Equal(t, 100, ref.LineNumber)
	assert.Equal(t, "sql", ref.LogType)
	assert.Equal(t, "long running query", ref.Summary)
}

package skills

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/OmarEhab007/RemedyIQ/backend/internal/ai"
	"github.com/OmarEhab007/RemedyIQ/backend/internal/domain"
	"github.com/OmarEhab007/RemedyIQ/backend/internal/testutil"
)

func TestNewAnomalyNarratorSkill(t *testing.T) {
	skill := NewAnomalyNarratorSkill(nil, nil)
	require.NotNil(t, skill)
	assert.Nil(t, skill.client)
	assert.Nil(t, skill.ch)
	assert.NotNil(t, skill.logger)
}

func TestNewAnomalyNarratorSkill_WithMockStore(t *testing.T) {
	ch := &testutil.MockClickHouseStore{}
	skill := NewAnomalyNarratorSkill(nil, ch)
	require.NotNil(t, skill)
	assert.NotNil(t, skill.ch)
}

func TestAnomalyNarratorSkill_Name(t *testing.T) {
	skill := NewAnomalyNarratorSkill(nil, nil)
	assert.Equal(t, "anomaly_narrator", skill.Name())
}

func TestAnomalyNarratorSkill_Description(t *testing.T) {
	skill := NewAnomalyNarratorSkill(nil, nil)
	desc := skill.Description()
	assert.NotEmpty(t, desc)
	assert.Contains(t, desc, "anomal")
}

func TestAnomalyNarratorSkill_Examples(t *testing.T) {
	skill := NewAnomalyNarratorSkill(nil, nil)
	examples := skill.Examples()
	assert.NotEmpty(t, examples)
	assert.GreaterOrEqual(t, len(examples), 2, "should have at least 2 examples")
	for i, ex := range examples {
		assert.NotEmpty(t, ex, "example at index %d should not be empty", i)
	}
}

func TestAnomalyNarratorSkill_ImplementsSkillInterface(t *testing.T) {
	skill := NewAnomalyNarratorSkill(nil, nil)
	var _ ai.Skill = skill
}

func TestAnomalyNarratorSkill_Execute_Validation(t *testing.T) {
	skill := NewAnomalyNarratorSkill(nil, nil)

	tests := []struct {
		name   string
		input  ai.SkillInput
		errMsg string
	}{
		{
			name: "missing tenant_id",
			input: ai.SkillInput{
				Query: "Explain the anomalies",
				JobID: "job-1",
			},
			errMsg: "tenant_id is required",
		},
		{
			name: "missing job_id",
			input: ai.SkillInput{
				Query:    "What caused the performance spikes?",
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

func TestAnomalyNarratorSkill_Execute_FallbackNilClient(t *testing.T) {
	skill := NewAnomalyNarratorSkill(nil, nil)

	input := ai.SkillInput{
		Query:    "Explain the anomalies",
		JobID:    "test-job-id",
		TenantID: "test-tenant-id",
	}

	output, err := skill.Execute(context.Background(), input)
	require.NoError(t, err)
	require.NotNil(t, output)

	assert.Equal(t, FallbackMessage, output.Answer)
	assert.Equal(t, 0.0, output.Confidence)
	assert.Equal(t, "anomaly_narrator", output.SkillName)
	assert.Zero(t, output.TokensUsed)
	assert.Zero(t, output.LatencyMS)
}

func TestAnomalyNarratorSkill_Execute_FallbackUnavailableClient(t *testing.T) {
	var nilClient *ai.Client
	skill := NewAnomalyNarratorSkill(nilClient, nil)

	input := ai.SkillInput{
		Query:    "Why are there error rate anomalies?",
		JobID:    "test-job-id",
		TenantID: "test-tenant-id",
	}

	output, err := skill.Execute(context.Background(), input)
	require.NoError(t, err)
	require.NotNil(t, output)

	assert.Equal(t, FallbackMessage, output.Answer)
	assert.Equal(t, 0.0, output.Confidence)
	assert.Equal(t, "anomaly_narrator", output.SkillName)
}

func TestAnomalyNarratorSkill_FetchAnomalyContext_NilClickHouse(t *testing.T) {
	skill := NewAnomalyNarratorSkill(nil, nil)
	ctx := context.Background()

	result := skill.fetchAnomalyContext(ctx, "tenant-1", "job-1")
	assert.Contains(t, result, "ClickHouse not configured")
}

func TestAnomalyNarratorSkill_Execute_AIQueryError_ReturnsFallback(t *testing.T) {
	client, err := ai.NewClient("sk-ant-test-invalid-key", "test-model")
	require.NoError(t, err)
	require.True(t, client.IsAvailable())

	skill := NewAnomalyNarratorSkill(client, nil)

	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	input := ai.SkillInput{
		Query:    "Explain the anomalies",
		JobID:    "job-1",
		TenantID: "tenant-1",
	}

	output, err := skill.Execute(ctx, input)
	require.NoError(t, err, "skill should return fallback, not an error")
	require.NotNil(t, output)
	assert.Equal(t, FallbackMessage, output.Answer)
	assert.Equal(t, 0.0, output.Confidence)
	assert.Equal(t, "anomaly_narrator", output.SkillName)
}

// --- Tests exercising fetchAnomalyContext with MockClickHouseStore ---

func TestAnomalyNarratorSkill_FetchAnomalyContext_AllDataPresent(t *testing.T) {
	ch := &testutil.MockClickHouseStore{}
	skill := NewAnomalyNarratorSkill(nil, ch)

	now := time.Date(2025, 6, 15, 10, 0, 0, 0, time.UTC)

	dashData := &domain.DashboardData{
		GeneralStats: domain.GeneralStatistics{
			TotalLines:  5000,
			APICount:    2000,
			SQLCount:    1500,
			FilterCount: 1000,
			EscCount:    500,
			LogStart:    now,
			LogEnd:      now.Add(2 * time.Hour),
		},
		TimeSeries: []domain.TimeSeriesPoint{
			{
				Timestamp:     now,
				APICount:      100,
				SQLCount:      80,
				FilterCount:   50,
				EscCount:      20,
				AvgDurationMS: 150.5,
				ErrorCount:    5,
			},
			{
				Timestamp:     now.Add(time.Minute),
				APICount:      120,
				SQLCount:      90,
				FilterCount:   60,
				EscCount:      25,
				AvgDurationMS: 200.0,
				ErrorCount:    12,
			},
		},
	}

	gapsData := &domain.GapsResponse{
		Gaps: []domain.GapEntry{
			{
				StartTime:  now.Add(30 * time.Minute),
				EndTime:    now.Add(35 * time.Minute),
				DurationMS: 300000,
				BeforeLine: 1000,
				AfterLine:  1001,
				LogType:    domain.LogTypeAPI,
			},
		},
	}

	exceptionsData := &domain.ExceptionsResponse{
		TotalCount: 42,
		ErrorRates: map[string]float64{
			"API":  0.05,
			"SQL":  0.02,
			"FLTR": 0.01,
		},
	}

	ch.On("GetDashboardData", mock.Anything, "tenant-1", "job-1", 5).Return(dashData, nil)
	ch.On("GetGaps", mock.Anything, "tenant-1", "job-1").Return(gapsData, nil)
	ch.On("GetExceptions", mock.Anything, "tenant-1", "job-1").Return(exceptionsData, nil)

	result := skill.fetchAnomalyContext(context.Background(), "tenant-1", "job-1")

	// Verify dashboard overview section
	assert.Contains(t, result, "## Log Overview")
	assert.Contains(t, result, "Total entries: 5000")
	assert.Contains(t, result, "API: 2000")
	assert.Contains(t, result, "SQL: 1500")
	assert.Contains(t, result, "Filter: 1000")
	assert.Contains(t, result, "Esc: 500")

	// Verify time series section
	assert.Contains(t, result, "## Time Series")
	assert.Contains(t, result, "10:00")
	assert.Contains(t, result, "10:01")
	assert.Contains(t, result, "API=100")
	assert.Contains(t, result, "Errors=5")
	assert.Contains(t, result, "API=120")
	assert.Contains(t, result, "Errors=12")

	// Verify gaps section
	assert.Contains(t, result, "## Detected Gaps")
	assert.Contains(t, result, "300000ms gap")
	assert.Contains(t, result, "lines 1000-1001")

	// Verify exceptions section
	assert.Contains(t, result, "## Error Anomalies")
	assert.Contains(t, result, "Total error occurrences: 42")
	assert.Contains(t, result, "error rate:")

	ch.AssertExpectations(t)
}

func TestAnomalyNarratorSkill_FetchAnomalyContext_DashboardError(t *testing.T) {
	ch := &testutil.MockClickHouseStore{}
	skill := NewAnomalyNarratorSkill(nil, ch)

	ch.On("GetDashboardData", mock.Anything, "t1", "j1", 5).Return(nil, fmt.Errorf("connection refused"))
	ch.On("GetGaps", mock.Anything, "t1", "j1").Return(&domain.GapsResponse{}, nil)
	ch.On("GetExceptions", mock.Anything, "t1", "j1").Return(&domain.ExceptionsResponse{TotalCount: 0}, nil)

	result := skill.fetchAnomalyContext(context.Background(), "t1", "j1")

	assert.Contains(t, result, "Time series data could not be retrieved")
	assert.NotContains(t, result, "## Log Overview")

	ch.AssertExpectations(t)
}

func TestAnomalyNarratorSkill_FetchAnomalyContext_GapsError(t *testing.T) {
	ch := &testutil.MockClickHouseStore{}
	skill := NewAnomalyNarratorSkill(nil, ch)

	now := time.Date(2025, 6, 15, 10, 0, 0, 0, time.UTC)
	dashData := &domain.DashboardData{
		GeneralStats: domain.GeneralStatistics{
			TotalLines: 100,
			LogStart:   now,
			LogEnd:     now.Add(time.Hour),
		},
	}

	ch.On("GetDashboardData", mock.Anything, "t1", "j1", 5).Return(dashData, nil)
	ch.On("GetGaps", mock.Anything, "t1", "j1").Return(nil, fmt.Errorf("timeout"))
	ch.On("GetExceptions", mock.Anything, "t1", "j1").Return(&domain.ExceptionsResponse{TotalCount: 0}, nil)

	result := skill.fetchAnomalyContext(context.Background(), "t1", "j1")

	assert.Contains(t, result, "## Log Overview")
	assert.NotContains(t, result, "## Detected Gaps")

	ch.AssertExpectations(t)
}

func TestAnomalyNarratorSkill_FetchAnomalyContext_ExceptionsError(t *testing.T) {
	ch := &testutil.MockClickHouseStore{}
	skill := NewAnomalyNarratorSkill(nil, ch)

	now := time.Date(2025, 6, 15, 10, 0, 0, 0, time.UTC)
	dashData := &domain.DashboardData{
		GeneralStats: domain.GeneralStatistics{
			TotalLines: 100,
			LogStart:   now,
			LogEnd:     now.Add(time.Hour),
		},
	}

	ch.On("GetDashboardData", mock.Anything, "t1", "j1", 5).Return(dashData, nil)
	ch.On("GetGaps", mock.Anything, "t1", "j1").Return(&domain.GapsResponse{}, nil)
	ch.On("GetExceptions", mock.Anything, "t1", "j1").Return(nil, fmt.Errorf("disk error"))

	result := skill.fetchAnomalyContext(context.Background(), "t1", "j1")

	assert.Contains(t, result, "## Log Overview")
	assert.NotContains(t, result, "## Error Anomalies")

	ch.AssertExpectations(t)
}

func TestAnomalyNarratorSkill_FetchAnomalyContext_AllErrors(t *testing.T) {
	ch := &testutil.MockClickHouseStore{}
	skill := NewAnomalyNarratorSkill(nil, ch)

	ch.On("GetDashboardData", mock.Anything, "t1", "j1", 5).Return(nil, fmt.Errorf("err1"))
	ch.On("GetGaps", mock.Anything, "t1", "j1").Return(nil, fmt.Errorf("err2"))
	ch.On("GetExceptions", mock.Anything, "t1", "j1").Return(nil, fmt.Errorf("err3"))

	result := skill.fetchAnomalyContext(context.Background(), "t1", "j1")

	assert.Contains(t, result, "Time series data could not be retrieved")
	assert.NotContains(t, result, "## Detected Gaps")
	assert.NotContains(t, result, "## Error Anomalies")

	ch.AssertExpectations(t)
}

func TestAnomalyNarratorSkill_FetchAnomalyContext_EmptyGapsAndExceptions(t *testing.T) {
	ch := &testutil.MockClickHouseStore{}
	skill := NewAnomalyNarratorSkill(nil, ch)

	now := time.Date(2025, 6, 15, 10, 0, 0, 0, time.UTC)
	dashData := &domain.DashboardData{
		GeneralStats: domain.GeneralStatistics{
			TotalLines: 100,
			LogStart:   now,
			LogEnd:     now.Add(time.Hour),
		},
	}

	ch.On("GetDashboardData", mock.Anything, "t1", "j1", 5).Return(dashData, nil)
	ch.On("GetGaps", mock.Anything, "t1", "j1").Return(&domain.GapsResponse{}, nil)
	ch.On("GetExceptions", mock.Anything, "t1", "j1").Return(&domain.ExceptionsResponse{TotalCount: 0}, nil)

	result := skill.fetchAnomalyContext(context.Background(), "t1", "j1")

	assert.Contains(t, result, "## Log Overview")
	assert.NotContains(t, result, "## Detected Gaps")
	assert.NotContains(t, result, "## Error Anomalies")

	ch.AssertExpectations(t)
}

func TestAnomalyNarratorSkill_FetchAnomalyContext_NoTimeSeries(t *testing.T) {
	ch := &testutil.MockClickHouseStore{}
	skill := NewAnomalyNarratorSkill(nil, ch)

	now := time.Date(2025, 6, 15, 10, 0, 0, 0, time.UTC)
	dashData := &domain.DashboardData{
		GeneralStats: domain.GeneralStatistics{
			TotalLines: 200,
			APICount:   100,
			LogStart:   now,
			LogEnd:     now.Add(time.Hour),
		},
		TimeSeries: []domain.TimeSeriesPoint{}, // empty
	}

	ch.On("GetDashboardData", mock.Anything, "t1", "j1", 5).Return(dashData, nil)
	ch.On("GetGaps", mock.Anything, "t1", "j1").Return(&domain.GapsResponse{}, nil)
	ch.On("GetExceptions", mock.Anything, "t1", "j1").Return(&domain.ExceptionsResponse{TotalCount: 0}, nil)

	result := skill.fetchAnomalyContext(context.Background(), "t1", "j1")

	assert.Contains(t, result, "## Log Overview")
	assert.NotContains(t, result, "## Time Series")

	ch.AssertExpectations(t)
}

func TestAnomalyNarratorSkill_FetchAnomalyContext_ManyGapsTruncated(t *testing.T) {
	ch := &testutil.MockClickHouseStore{}
	skill := NewAnomalyNarratorSkill(nil, ch)

	now := time.Date(2025, 6, 15, 10, 0, 0, 0, time.UTC)
	dashData := &domain.DashboardData{
		GeneralStats: domain.GeneralStatistics{
			TotalLines: 100,
			LogStart:   now,
			LogEnd:     now.Add(time.Hour),
		},
	}

	// Create 15 gaps -- only first 10 should appear
	gaps := make([]domain.GapEntry, 15)
	for i := range gaps {
		gaps[i] = domain.GapEntry{
			StartTime:  now.Add(time.Duration(i) * time.Minute),
			EndTime:    now.Add(time.Duration(i)*time.Minute + 30*time.Second),
			DurationMS: 30000,
			BeforeLine: i * 100,
			AfterLine:  i*100 + 1,
			LogType:    domain.LogTypeAPI,
		}
	}

	ch.On("GetDashboardData", mock.Anything, "t1", "j1", 5).Return(dashData, nil)
	ch.On("GetGaps", mock.Anything, "t1", "j1").Return(&domain.GapsResponse{Gaps: gaps}, nil)
	ch.On("GetExceptions", mock.Anything, "t1", "j1").Return(&domain.ExceptionsResponse{TotalCount: 0}, nil)

	result := skill.fetchAnomalyContext(context.Background(), "t1", "j1")

	assert.Contains(t, result, "## Detected Gaps")
	// The 10th gap (index 9) uses lines 900-901
	assert.Contains(t, result, "lines 900-901")
	// The 11th gap (index 10) uses lines 1000-1001 -- should NOT be present
	assert.NotContains(t, result, "lines 1000-1001")

	ch.AssertExpectations(t)
}

func TestAnomalyNarratorSkill_Execute_WithMockClickHouse_FallbackNoAI(t *testing.T) {
	ch := &testutil.MockClickHouseStore{}
	skill := NewAnomalyNarratorSkill(nil, ch)

	now := time.Date(2025, 6, 15, 10, 0, 0, 0, time.UTC)
	ch.On("GetDashboardData", mock.Anything, "tenant-1", "job-1", 5).Return(&domain.DashboardData{
		GeneralStats: domain.GeneralStatistics{TotalLines: 100, LogStart: now, LogEnd: now.Add(time.Hour)},
	}, nil)
	ch.On("GetGaps", mock.Anything, "tenant-1", "job-1").Return(&domain.GapsResponse{}, nil)
	ch.On("GetExceptions", mock.Anything, "tenant-1", "job-1").Return(&domain.ExceptionsResponse{TotalCount: 0}, nil)

	input := ai.SkillInput{
		Query:    "Explain the anomalies",
		JobID:    "job-1",
		TenantID: "tenant-1",
	}

	// AI client is nil, so we get fallback, but the ClickHouse mock should still be called
	// during fetchAnomalyContext (which runs before the AI client check for nil).
	// Actually -- looking at the code, the AI client nil check happens before fetchAnomalyContext.
	// So the mock won't be called. Let me verify the code flow.
	// Execute: validateInput -> check client nil -> fallback.
	// fetchAnomalyContext is only called after the client check passes. So with nil client,
	// the mock is NOT called.
	output, err := skill.Execute(context.Background(), input)
	require.NoError(t, err)
	require.NotNil(t, output)
	assert.Equal(t, FallbackMessage, output.Answer)
}

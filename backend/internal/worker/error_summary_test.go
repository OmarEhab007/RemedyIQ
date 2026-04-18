package worker

import (
	"testing"
	"time"

	"github.com/OmarEhab007/RemedyIQ/backend/internal/domain"
	"github.com/stretchr/testify/require"
)

func TestBuildErrorSummary_JARPrimary(t *testing.T) {
	pr := &domain.ParseResult{
		JARExceptions: &domain.JARExceptionsResponse{
			APIErrors: []domain.JARAPIError{
				{Queue: "Q1", ErrorMessage: "timeout", TraceID: "t1"},
				{Queue: "Q1", ErrorMessage: "timeout", TraceID: "t2"},
				{Queue: "Q2", ErrorMessage: "boom", TraceID: "t3"},
			},
			APIExceptions: []domain.JARExceptionEntry{
				{Type: "NPE", Message: "x", TraceID: "t4"},
			},
			SQLExceptions: nil,
			Source:        "jar_parsed",
		},
	}
	dash := &domain.DashboardData{
		TimeSeries: []domain.TimeSeriesPoint{
			{Timestamp: time.Now(), ErrorCount: 2},
			{Timestamp: time.Now(), ErrorCount: 1},
		},
	}

	s := BuildErrorSummary(pr, dash)
	require.NotNil(t, s)
	require.Equal(t, "jar_plus_timeseries", s.Source)
	require.Equal(t, int64(4), s.JarEventTotal)
	require.Equal(t, int64(3), s.TimeseriesErrorEvents)
	require.Equal(t, 3, s.UniqueMessages)

	var q1, q2 int64
	for _, q := range s.TopErrorQueues {
		switch q.Queue {
		case "Q1":
			q1 = q.Errors
		case "Q2":
			q2 = q.Errors
		}
	}
	require.Equal(t, int64(2), q1)
	require.Equal(t, int64(1), q2)
}

func TestBuildErrorSummary_DerivedTopN(t *testing.T) {
	dash := &domain.DashboardData{
		TopAPICalls: []domain.TopNEntry{
			{Success: false},
			{Success: true},
		},
		TopSQL: []domain.TopNEntry{
			{Success: false},
		},
		Distribution: map[string]map[string]int{
			"errors": {"E123": 5, "E999": 1},
		},
	}

	s := BuildErrorSummary(&domain.ParseResult{}, dash)
	require.NotNil(t, s)
	require.Equal(t, "derived_topn", s.Source)
	require.Equal(t, int64(2), s.JarEventTotal)
	require.Equal(t, 2, s.UniqueMessages)
}

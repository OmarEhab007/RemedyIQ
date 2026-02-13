package worker

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/OmarEhab007/RemedyIQ/backend/internal/domain"
)

func TestComputeEnhancedSections_NilDashboard(t *testing.T) {
	result := ComputeEnhancedSections(nil)
	assert.NotNil(t, result)
	assert.Nil(t, result.Dashboard)
}

func TestComputeEnhancedSections_EmptyDashboard(t *testing.T) {
	dashboard := &domain.DashboardData{
		Distribution: make(map[string]map[string]int),
	}
	result := ComputeEnhancedSections(dashboard)

	assert.NotNil(t, result)
	assert.NotNil(t, result.Aggregates)
	assert.NotNil(t, result.Exceptions)
	assert.NotNil(t, result.ThreadStats)
	assert.NotNil(t, result.Filters)
	assert.NotNil(t, result.Gaps)
}

func TestComputeAggregates(t *testing.T) {
	dashboard := &domain.DashboardData{
		TopAPICalls: []domain.TopNEntry{
			{Rank: 1, Form: "HPD:Help Desk", DurationMS: 100, Success: true, TraceID: "T001"},
			{Rank: 2, Form: "HPD:Help Desk", DurationMS: 200, Success: true, TraceID: "T002"},
			{Rank: 3, Form: "SRM:Request", DurationMS: 150, Success: false, TraceID: "T003"},
		},
		TopSQL: []domain.TopNEntry{
			{Rank: 1, Identifier: "SELECT * FROM User", DurationMS: 50, Success: true},
			{Rank: 2, Identifier: "SELECT * FROM User", DurationMS: 75, Success: true},
		},
		TopFilters: []domain.TopNEntry{
			{Rank: 1, Identifier: "Filter1", DurationMS: 10, Success: true},
		},
		Distribution: make(map[string]map[string]int),
	}

	agg := computeAggregates(dashboard)

	assert.NotNil(t, agg)
	assert.NotNil(t, agg.API)
	assert.Len(t, agg.API.Groups, 2)

	hpdGroup := findGroupByName(agg.API.Groups, "HPD:Help Desk")
	assert.NotNil(t, hpdGroup)
	assert.Equal(t, int64(2), hpdGroup.Count)
	assert.Equal(t, int64(300), hpdGroup.TotalMS)
	assert.Equal(t, 150.0, hpdGroup.AvgMS)
	assert.Equal(t, int64(0), hpdGroup.ErrorCount)

	srmGroup := findGroupByName(agg.API.Groups, "SRM:Request")
	assert.NotNil(t, srmGroup)
	assert.Equal(t, int64(1), srmGroup.Count)
	assert.Equal(t, int64(1), srmGroup.ErrorCount)

	assert.NotNil(t, agg.SQL)
	assert.Len(t, agg.SQL.Groups, 1)

	assert.NotNil(t, agg.Filter)
	assert.Len(t, agg.Filter.Groups, 1)
}

func TestComputeExceptions(t *testing.T) {
	dashboard := &domain.DashboardData{
		GeneralStats: domain.GeneralStatistics{
			APICount: 100,
		},
		Distribution: map[string]map[string]int{
			"errors": {
				"ARERR 1234": 10,
				"ARERR 5678": 5,
			},
		},
	}

	exc := computeExceptions(dashboard)

	assert.NotNil(t, exc)
	assert.Len(t, exc.Exceptions, 2)
	assert.Equal(t, int64(15), exc.TotalCount)
	assert.Contains(t, exc.TopCodes, "ARERR 1234")
	assert.Contains(t, exc.TopCodes, "ARERR 5678")
	assert.InDelta(t, 15.0, exc.ErrorRates["api"], 0.01)
}

func TestComputeExceptions_NoErrors(t *testing.T) {
	dashboard := &domain.DashboardData{
		GeneralStats: domain.GeneralStatistics{
			APICount: 100,
		},
		Distribution: make(map[string]map[string]int),
	}

	exc := computeExceptions(dashboard)

	assert.NotNil(t, exc)
	assert.Empty(t, exc.Exceptions)
	assert.Equal(t, int64(0), exc.TotalCount)
}

func TestComputeThreadStats(t *testing.T) {
	dashboard := &domain.DashboardData{
		Distribution: map[string]map[string]int{
			"threads": {
				"T001": 50,
				"T002": 30,
			},
		},
		TopAPICalls: []domain.TopNEntry{
			{TraceID: "T001", DurationMS: 100, Success: true},
			{TraceID: "T001", DurationMS: 150, Success: true},
			{TraceID: "T002", DurationMS: 200, Success: false},
		},
	}

	ts := computeThreadStats(dashboard)

	assert.NotNil(t, ts)
	assert.Len(t, ts.Threads, 2)
	assert.Equal(t, 2, ts.TotalThreads)

	t001 := findThreadByID(ts.Threads, "T001")
	assert.NotNil(t, t001)
	assert.Equal(t, int64(2), t001.TotalCalls)
	assert.Equal(t, int64(250), t001.TotalMS)
	assert.Equal(t, int64(0), t001.ErrorCount)

	t002 := findThreadByID(ts.Threads, "T002")
	assert.NotNil(t, t002)
	assert.Equal(t, int64(1), t002.TotalCalls)
	assert.Equal(t, int64(1), t002.ErrorCount)
}

func TestComputeFilters(t *testing.T) {
	dashboard := &domain.DashboardData{
		TopFilters: []domain.TopNEntry{
			{Identifier: "FilterA", DurationMS: 10, RPCID: "R001", Queue: "Fast", Form: "HPD:Help Desk"},
			{Identifier: "FilterA", DurationMS: 20, RPCID: "R002"},
			{Identifier: "FilterB", DurationMS: 15, RPCID: "R003"},
		},
	}

	fc := computeFilters(dashboard)

	assert.NotNil(t, fc)
	assert.Len(t, fc.MostExecuted, 2)
	assert.Equal(t, int64(45), fc.TotalFilterTimeMS)

	filterA := findMostExecutedByName(fc.MostExecuted, "FilterA")
	assert.NotNil(t, filterA)
	assert.Equal(t, int64(2), filterA.Count)
	assert.Equal(t, int64(30), filterA.TotalMS)

	assert.Len(t, fc.PerTransaction, 3)
}

func TestComputeGaps(t *testing.T) {
	dashboard := &domain.DashboardData{
		TimeSeries: []domain.TimeSeriesPoint{
			{},
			{},
		},
		TopAPICalls: []domain.TopNEntry{
			{Queue: "Fast", DurationMS: 100, Success: true},
			{Queue: "Fast", DurationMS: 150, Success: false},
			{Queue: "Fast", DurationMS: 200, Success: true},
			{Queue: "Slow", DurationMS: 500, Success: true},
		},
	}

	gaps := computeGaps(dashboard)

	assert.NotNil(t, gaps)
	assert.Len(t, gaps.QueueHealth, 2)

	fastQueue := findQueueHealth(gaps.QueueHealth, "Fast")
	assert.NotNil(t, fastQueue)
	assert.Equal(t, int64(3), fastQueue.TotalCalls)
	assert.InDelta(t, 33.33, fastQueue.ErrorRate, 0.5)

	slowQueue := findQueueHealth(gaps.QueueHealth, "Slow")
	assert.NotNil(t, slowQueue)
	assert.Equal(t, int64(1), slowQueue.TotalCalls)
}

func findGroupByName(groups []domain.AggregateGroup, name string) *domain.AggregateGroup {
	for i := range groups {
		if groups[i].Name == name {
			return &groups[i]
		}
	}
	return nil
}

func findThreadByID(threads []domain.ThreadStatsEntry, id string) *domain.ThreadStatsEntry {
	for i := range threads {
		if threads[i].ThreadID == id {
			return &threads[i]
		}
	}
	return nil
}

func findMostExecutedByName(filters []domain.MostExecutedFilter, name string) *domain.MostExecutedFilter {
	for i := range filters {
		if filters[i].Name == name {
			return &filters[i]
		}
	}
	return nil
}

func findQueueHealth(health []domain.QueueHealthSummary, queue string) *domain.QueueHealthSummary {
	for i := range health {
		if health[i].Queue == queue {
			return &health[i]
		}
	}
	return nil
}

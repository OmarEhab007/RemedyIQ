package worker

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

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

// --- T048: Time Series Minute Buckets ---

func TestGenerateTimeSeries_MinuteBuckets(t *testing.T) {
	base := time.Date(2024, 1, 15, 10, 0, 0, 0, time.UTC)

	dashboard := &domain.DashboardData{
		TopAPICalls: []domain.TopNEntry{
			{Timestamp: base, DurationMS: 100, Success: true},
			{Timestamp: base.Add(30 * time.Second), DurationMS: 200, Success: true},
			{Timestamp: base.Add(1 * time.Minute), DurationMS: 150, Success: false},
			{Timestamp: base.Add(1*time.Minute + 45*time.Second), DurationMS: 50, Success: true},
			{Timestamp: base.Add(3 * time.Minute), DurationMS: 300, Success: true},
		},
		TopSQL: []domain.TopNEntry{
			{Timestamp: base.Add(10 * time.Second), DurationMS: 80, Success: true},
			{Timestamp: base.Add(2 * time.Minute), DurationMS: 120, Success: true},
		},
		TopFilters: []domain.TopNEntry{
			{Timestamp: base, DurationMS: 10, Success: true},
		},
		TopEscalations: []domain.TopNEntry{
			{Timestamp: base.Add(3 * time.Minute), DurationMS: 500, Success: true},
		},
	}

	ts := generateTimeSeries(dashboard)

	require.NotNil(t, ts)
	// Entries span 3 minutes, so should bucket by minute.
	// Buckets: 10:00, 10:01, 10:02, 10:03
	assert.Len(t, ts, 4)

	// Verify sorted order.
	for i := 1; i < len(ts); i++ {
		assert.True(t, ts[i].Timestamp.After(ts[i-1].Timestamp) || ts[i].Timestamp.Equal(ts[i-1].Timestamp))
	}

	// Bucket at 10:00: 2 API + 1 SQL + 1 filter = 4 entries.
	b0 := ts[0]
	assert.Equal(t, base.Truncate(time.Minute), b0.Timestamp)
	assert.Equal(t, 2, b0.APICount)
	assert.Equal(t, 1, b0.SQLCount)
	assert.Equal(t, 1, b0.FilterCount)
	assert.Equal(t, 0, b0.EscCount)
	assert.Equal(t, 0, b0.ErrorCount)

	// Bucket at 10:01: 2 API entries (one failure).
	b1 := ts[1]
	assert.Equal(t, 2, b1.APICount)
	assert.Equal(t, 1, b1.ErrorCount)

	// Bucket at 10:03: 1 API + 1 Esc.
	b3 := ts[3]
	assert.Equal(t, 1, b3.APICount)
	assert.Equal(t, 1, b3.EscCount)
}

// --- T049: Time Series Second Buckets ---

func TestGenerateTimeSeries_SecondBuckets(t *testing.T) {
	base := time.Date(2024, 1, 15, 10, 0, 0, 0, time.UTC)

	// Entries span <1 minute → should bucket by second.
	dashboard := &domain.DashboardData{
		TopAPICalls: []domain.TopNEntry{
			{Timestamp: base, DurationMS: 100, Success: true},
			{Timestamp: base.Add(500 * time.Millisecond), DurationMS: 200, Success: true},
			{Timestamp: base.Add(1 * time.Second), DurationMS: 150, Success: false},
			{Timestamp: base.Add(30 * time.Second), DurationMS: 300, Success: true},
		},
	}

	ts := generateTimeSeries(dashboard)

	require.NotNil(t, ts)
	// Span is 30 seconds < 1 minute, so second-level buckets.
	// Buckets: :00, :01, :30
	assert.Len(t, ts, 3)

	// Bucket at :00: 2 entries.
	assert.Equal(t, 2, ts[0].APICount)
	assert.Equal(t, 0, ts[0].ErrorCount)

	// Bucket at :01: 1 entry (failure).
	assert.Equal(t, 1, ts[1].APICount)
	assert.Equal(t, 1, ts[1].ErrorCount)

	// Bucket at :30: 1 entry.
	assert.Equal(t, 1, ts[2].APICount)
}

func TestGenerateTimeSeries_NilDashboard(t *testing.T) {
	assert.Nil(t, generateTimeSeries(nil))
}

func TestGenerateTimeSeries_NoTimestamps(t *testing.T) {
	dashboard := &domain.DashboardData{
		TopAPICalls: []domain.TopNEntry{
			{DurationMS: 100, Success: true}, // Zero timestamp.
		},
	}
	assert.Nil(t, generateTimeSeries(dashboard))
}

// --- T053: Distribution Generation ---

func TestGenerateDistribution(t *testing.T) {
	dashboard := &domain.DashboardData{
		GeneralStats: domain.GeneralStatistics{
			APICount:    500,
			SQLCount:    300,
			FilterCount: 200,
			EscCount:    100,
		},
		TopAPICalls: []domain.TopNEntry{
			{Form: "HPD:Help Desk", Queue: "Fast", User: "alice"},
			{Form: "HPD:Help Desk", Queue: "Fast", User: "bob"},
			{Form: "SRM:Request", Queue: "Slow", User: "alice"},
		},
		TopSQL: []domain.TopNEntry{
			{Identifier: "SELECT * FROM User"},
			{Identifier: "INSERT INTO Log"},
		},
		Distribution: map[string]map[string]int{
			"threads": {"T001": 10, "T002": 5},
		},
	}

	parseResult := &domain.ParseResult{
		Dashboard: dashboard,
		JARAggregates: &domain.JARAggregatesResponse{
			APIByForm: &domain.JARAggregateTable{
				Groups: []domain.JARAggregateGroup{
					{
						EntityName: "HPD:Help Desk",
						Subtotal:   &domain.JARAggregateRow{Total: 80},
					},
					{
						EntityName: "SRM:Request",
						Subtotal:   &domain.JARAggregateRow{Total: 44},
					},
				},
			},
			SQLByTable: &domain.JARAggregateTable{
				Groups: []domain.JARAggregateGroup{
					{
						EntityName: "User",
						Rows:       []domain.JARAggregateRow{{Total: 1500}},
					},
					{
						EntityName: "Log",
						Rows:       []domain.JARAggregateRow{{Total: 684}},
					},
				},
			},
			Source: "jar_parsed",
		},
		JARThreadStats: &domain.JARThreadStatsResponse{
			APIThreads: []domain.JARThreadStat{
				{Queue: "Fast", Count: 100},
				{Queue: "Slow", Count: 50},
			},
			SQLThreads: []domain.JARThreadStat{
				{Queue: "SQLQueue", Count: 200},
			},
			Source: "jar_parsed",
		},
	}

	dist := generateDistribution(dashboard, parseResult)

	require.NotNil(t, dist)

	// by_type from GeneralStats.
	assert.Equal(t, 500, dist["by_type"]["API"])
	assert.Equal(t, 300, dist["by_type"]["SQL"])
	assert.Equal(t, 200, dist["by_type"]["Filter"])
	assert.Equal(t, 100, dist["by_type"]["Escalation"])

	// by_form from JAR aggregates (not TopN).
	assert.Equal(t, 80, dist["by_form"]["HPD:Help Desk"])
	assert.Equal(t, 44, dist["by_form"]["SRM:Request"])

	// by_table from JAR aggregates (rows sum since no subtotal for one).
	assert.Equal(t, 1500, dist["by_table"]["User"])
	assert.Equal(t, 684, dist["by_table"]["Log"])

	// by_queue from JAR thread stats.
	assert.Equal(t, 100, dist["by_queue"]["Fast"])
	assert.Equal(t, 50, dist["by_queue"]["Slow"])
	assert.Equal(t, 200, dist["by_queue"]["SQLQueue"])

	// by_user from TopN entries.
	assert.Equal(t, 2, dist["by_user"]["alice"])
	assert.Equal(t, 1, dist["by_user"]["bob"])

	// Preserved existing distribution keys.
	assert.Equal(t, 10, dist["threads"]["T001"])
	assert.Equal(t, 5, dist["threads"]["T002"])
}

func TestGenerateDistribution_NoJAR(t *testing.T) {
	dashboard := &domain.DashboardData{
		GeneralStats: domain.GeneralStatistics{
			APICount: 100,
		},
		TopAPICalls: []domain.TopNEntry{
			{Form: "HPD:Help Desk", Queue: "Fast", User: "alice"},
			{Form: "HPD:Help Desk", Queue: "Fast", User: "alice"},
		},
		TopSQL: []domain.TopNEntry{
			{Identifier: "SELECT * FROM User"},
		},
	}

	// No JAR data — should fall back to TopN entries.
	dist := generateDistribution(dashboard, nil)

	require.NotNil(t, dist)
	assert.Equal(t, 100, dist["by_type"]["API"])
	assert.Equal(t, 2, dist["by_form"]["HPD:Help Desk"])
	assert.Equal(t, 1, dist["by_table"]["SELECT * FROM User"])
	assert.Equal(t, 2, dist["by_queue"]["Fast"])
	assert.Equal(t, 2, dist["by_user"]["alice"])
}

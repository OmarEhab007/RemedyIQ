package worker

import (
	"sort"
	"time"

	"github.com/OmarEhab007/RemedyIQ/backend/internal/domain"
)

func ComputeEnhancedSections(dashboard *domain.DashboardData) *domain.ParseResult {
	if dashboard == nil {
		return &domain.ParseResult{}
	}

	result := &domain.ParseResult{
		Dashboard:   dashboard,
		Aggregates:  computeAggregates(dashboard),
		Exceptions:  computeExceptions(dashboard),
		ThreadStats: computeThreadStats(dashboard),
		Filters:     computeFilters(dashboard),
		Gaps:        computeGaps(dashboard),
	}

	return result
}

func computeAggregates(dashboard *domain.DashboardData) *domain.AggregatesResponse {
	resp := &domain.AggregatesResponse{}

	if len(dashboard.TopAPICalls) > 0 {
		resp.API = computeAggregateSection(dashboard.TopAPICalls, "form")
	}
	if len(dashboard.TopSQL) > 0 {
		resp.SQL = computeAggregateSection(dashboard.TopSQL, "identifier")
	}
	if len(dashboard.TopFilters) > 0 {
		resp.Filter = computeAggregateSection(dashboard.TopFilters, "identifier")
	}

	return resp
}

func computeAggregateSection(entries []domain.TopNEntry, groupByField string) *domain.AggregateSection {
	groups := make(map[string]*aggregateAccumulator)

	for _, e := range entries {
		key := getGroupKey(e, groupByField)
		if key == "" {
			key = "Unknown"
		}

		acc, ok := groups[key]
		if !ok {
			acc = &aggregateAccumulator{
				minMS:  int64(e.DurationMS),
				traces: make(map[string]bool),
			}
			groups[key] = acc
		}

		acc.count++
		acc.totalMS += int64(e.DurationMS)
		if int64(e.DurationMS) < acc.minMS {
			acc.minMS = int64(e.DurationMS)
		}
		if int64(e.DurationMS) > acc.maxMS {
			acc.maxMS = int64(e.DurationMS)
		}
		if !e.Success {
			acc.errorCount++
		}
		if e.TraceID != "" {
			acc.traces[e.TraceID] = true
		}
	}

	var resultGroups []domain.AggregateGroup
	var grandTotal aggregateAccumulator
	grandTotal.minMS = -1
	grandTotal.traces = make(map[string]bool)

	for name, acc := range groups {
		avgMS := float64(0)
		if acc.count > 0 {
			avgMS = float64(acc.totalMS) / float64(acc.count)
		}
		errorRate := float64(0)
		if acc.count > 0 {
			errorRate = float64(acc.errorCount) / float64(acc.count) * 100
		}

		resultGroups = append(resultGroups, domain.AggregateGroup{
			Name:         name,
			Count:        acc.count,
			TotalMS:      acc.totalMS,
			AvgMS:        avgMS,
			MinMS:        acc.minMS,
			MaxMS:        acc.maxMS,
			ErrorCount:   acc.errorCount,
			ErrorRate:    errorRate,
			UniqueTraces: len(acc.traces),
		})

		grandTotal.count += acc.count
		grandTotal.totalMS += acc.totalMS
		grandTotal.errorCount += acc.errorCount
		if grandTotal.minMS < 0 || acc.minMS < grandTotal.minMS {
			grandTotal.minMS = acc.minMS
		}
		if acc.maxMS > grandTotal.maxMS {
			grandTotal.maxMS = acc.maxMS
		}
		for t := range acc.traces {
			grandTotal.traces[t] = true
		}
	}

	sort.Slice(resultGroups, func(i, j int) bool {
		return resultGroups[i].Count > resultGroups[j].Count
	})

	section := &domain.AggregateSection{Groups: resultGroups}

	if grandTotal.count > 0 {
		avgMS := float64(grandTotal.totalMS) / float64(grandTotal.count)
		errorRate := float64(grandTotal.errorCount) / float64(grandTotal.count) * 100
		section.GrandTotal = &domain.AggregateGroup{
			Name:         "Grand Total",
			Count:        grandTotal.count,
			TotalMS:      grandTotal.totalMS,
			AvgMS:        avgMS,
			MinMS:        grandTotal.minMS,
			MaxMS:        grandTotal.maxMS,
			ErrorCount:   grandTotal.errorCount,
			ErrorRate:    errorRate,
			UniqueTraces: len(grandTotal.traces),
		}
	}

	return section
}

type aggregateAccumulator struct {
	count      int64
	totalMS    int64
	minMS      int64
	maxMS      int64
	errorCount int64
	traces     map[string]bool
}

func getGroupKey(e domain.TopNEntry, field string) string {
	switch field {
	case "form":
		return e.Form
	case "identifier":
		return e.Identifier
	default:
		return e.Identifier
	}
}

func computeExceptions(dashboard *domain.DashboardData) *domain.ExceptionsResponse {
	resp := &domain.ExceptionsResponse{
		Exceptions: []domain.ExceptionEntry{},
		ErrorRates: make(map[string]float64),
		TopCodes:   []string{},
	}

	errorDist, ok := dashboard.Distribution["errors"]
	if !ok {
		return resp
	}

	var totalCount int64
	now := time.Now()

	for code, count := range errorDist {
		totalCount += int64(count)
		resp.Exceptions = append(resp.Exceptions, domain.ExceptionEntry{
			ErrorCode: code,
			Message:   code,
			Count:     int64(count),
			FirstSeen: now,
			LastSeen:  now,
			LogType:   domain.LogTypeAPI,
		})
	}

	sort.Slice(resp.Exceptions, func(i, j int) bool {
		return resp.Exceptions[i].Count > resp.Exceptions[j].Count
	})

	for _, exc := range resp.Exceptions {
		resp.TopCodes = append(resp.TopCodes, exc.ErrorCode)
		if len(resp.TopCodes) >= 10 {
			break
		}
	}

	if dashboard.GeneralStats.APICount > 0 {
		resp.ErrorRates["api"] = float64(totalCount) / float64(dashboard.GeneralStats.APICount) * 100
	}

	resp.TotalCount = totalCount

	return resp
}

func computeThreadStats(dashboard *domain.DashboardData) *domain.ThreadStatsResponse {
	resp := &domain.ThreadStatsResponse{
		Threads:      []domain.ThreadStatsEntry{},
		TotalThreads: 0,
	}

	threadDist, ok := dashboard.Distribution["threads"]
	if !ok {
		return resp
	}

	threadDurations := make(map[string]int64)
	threadCounts := make(map[string]int64)
	threadMaxMS := make(map[string]int64)
	threadErrors := make(map[string]int64)

	for _, entry := range dashboard.TopAPICalls {
		if entry.TraceID == "" {
			continue
		}
		tid := entry.TraceID
		threadDurations[tid] += int64(entry.DurationMS)
		threadCounts[tid]++
		if int64(entry.DurationMS) > threadMaxMS[tid] {
			threadMaxMS[tid] = int64(entry.DurationMS)
		}
		if !entry.Success {
			threadErrors[tid]++
		}
	}

	for _, entry := range dashboard.TopSQL {
		if entry.TraceID == "" {
			continue
		}
		tid := entry.TraceID
		threadDurations[tid] += int64(entry.DurationMS)
		threadCounts[tid]++
		if int64(entry.DurationMS) > threadMaxMS[tid] {
			threadMaxMS[tid] = int64(entry.DurationMS)
		}
		if !entry.Success {
			threadErrors[tid]++
		}
	}

	for tid, count := range threadDist {
		totalMS := threadDurations[tid]
		calls := threadCounts[tid]
		if calls == 0 {
			calls = int64(count)
		}
		maxMS := threadMaxMS[tid]

		avgMS := float64(0)
		if calls > 0 {
			avgMS = float64(totalMS) / float64(calls)
		}

		resp.Threads = append(resp.Threads, domain.ThreadStatsEntry{
			ThreadID:   tid,
			TotalCalls: calls,
			TotalMS:    totalMS,
			AvgMS:      avgMS,
			MaxMS:      maxMS,
			ErrorCount: threadErrors[tid],
			BusyPct:    0,
		})
	}

	sort.Slice(resp.Threads, func(i, j int) bool {
		return resp.Threads[i].TotalCalls > resp.Threads[j].TotalCalls
	})

	resp.TotalThreads = len(resp.Threads)

	return resp
}

func computeFilters(dashboard *domain.DashboardData) *domain.FilterComplexityResponse {
	resp := &domain.FilterComplexityResponse{
		MostExecuted:      []domain.MostExecutedFilter{},
		PerTransaction:    []domain.FilterPerTransaction{},
		TotalFilterTimeMS: 0,
	}

	filterAggregates := make(map[string]*filterAccumulator)

	for _, entry := range dashboard.TopFilters {
		name := entry.Identifier
		if name == "" {
			continue
		}

		acc, ok := filterAggregates[name]
		if !ok {
			acc = &filterAccumulator{}
			filterAggregates[name] = acc
		}

		acc.count++
		acc.totalMS += int64(entry.DurationMS)

		if entry.RPCID != "" {
			resp.PerTransaction = append(resp.PerTransaction, domain.FilterPerTransaction{
				TransactionID:  entry.RPCID,
				FilterName:     name,
				ExecutionCount: 1,
				TotalMS:        int64(entry.DurationMS),
				AvgMS:          float64(entry.DurationMS),
				MaxMS:          int64(entry.DurationMS),
				Queue:          entry.Queue,
				Form:           entry.Form,
			})
		}
	}

	for name, acc := range filterAggregates {
		resp.MostExecuted = append(resp.MostExecuted, domain.MostExecutedFilter{
			Name:    name,
			Count:   acc.count,
			TotalMS: acc.totalMS,
		})
		resp.TotalFilterTimeMS += acc.totalMS
	}

	sort.Slice(resp.MostExecuted, func(i, j int) bool {
		return resp.MostExecuted[i].Count > resp.MostExecuted[j].Count
	})

	sort.Slice(resp.PerTransaction, func(i, j int) bool {
		return resp.PerTransaction[i].TotalMS > resp.PerTransaction[j].TotalMS
	})

	if len(resp.PerTransaction) > 100 {
		resp.PerTransaction = resp.PerTransaction[:100]
	}

	return resp
}

type filterAccumulator struct {
	count   int64
	totalMS int64
}

func computeGaps(dashboard *domain.DashboardData) *domain.GapsResponse {
	resp := &domain.GapsResponse{
		Gaps:        []domain.GapEntry{},
		QueueHealth: []domain.QueueHealthSummary{},
	}

	if len(dashboard.TimeSeries) < 2 {
		return resp
	}

	sort.Slice(dashboard.TimeSeries, func(i, j int) bool {
		return dashboard.TimeSeries[i].Timestamp.Before(dashboard.TimeSeries[j].Timestamp)
	})

	queueStats := make(map[string]*queueAccumulator)

	for _, entry := range dashboard.TopAPICalls {
		if entry.Queue == "" {
			continue
		}
		acc, ok := queueStats[entry.Queue]
		if !ok {
			acc = &queueAccumulator{}
			queueStats[entry.Queue] = acc
		}
		acc.totalCalls++
		acc.totalMS += int64(entry.DurationMS)
		if !entry.Success {
			acc.errorCount++
		}
		acc.durations = append(acc.durations, int64(entry.DurationMS))
	}

	for queue, acc := range queueStats {
		avgMS := float64(0)
		if acc.totalCalls > 0 {
			avgMS = float64(acc.totalMS) / float64(acc.totalCalls)
		}
		errorRate := float64(0)
		if acc.totalCalls > 0 {
			errorRate = float64(acc.errorCount) / float64(acc.totalCalls) * 100
		}
		p95 := int64(0)
		if len(acc.durations) > 0 {
			sort.Slice(acc.durations, func(i, j int) bool {
				return acc.durations[i] < acc.durations[j]
			})
			p95Idx := int(float64(len(acc.durations)) * 0.95)
			if p95Idx >= len(acc.durations) {
				p95Idx = len(acc.durations) - 1
			}
			p95 = acc.durations[p95Idx]
		}

		resp.QueueHealth = append(resp.QueueHealth, domain.QueueHealthSummary{
			Queue:      queue,
			TotalCalls: acc.totalCalls,
			AvgMS:      avgMS,
			ErrorRate:  errorRate,
			P95MS:      p95,
		})
	}

	sort.Slice(resp.QueueHealth, func(i, j int) bool {
		return resp.QueueHealth[i].TotalCalls > resp.QueueHealth[j].TotalCalls
	})

	return resp
}

type queueAccumulator struct {
	totalCalls int64
	totalMS    int64
	errorCount int64
	durations  []int64
}

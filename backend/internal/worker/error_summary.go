package worker

import (
	"sort"
	"strings"

	"github.com/OmarEhab007/RemedyIQ/backend/internal/domain"
)

type msgAgg struct {
	count       int64
	sampleTrace string
}

// BuildErrorSummary merges JAR-native exception rows (primary) with derived time-series error totals.
func BuildErrorSummary(pr *domain.ParseResult, dash *domain.DashboardData) *domain.ErrorSummary {
	if dash == nil {
		return nil
	}

	var tsErrors int64
	for _, p := range dash.TimeSeries {
		tsErrors += int64(p.ErrorCount)
	}

	out := &domain.ErrorSummary{
		TimeseriesErrorEvents: tsErrors,
	}

	if pr != nil && pr.JARExceptions != nil && jarExceptionRows(pr.JARExceptions) > 0 {
		if tsErrors > 0 {
			out.Source = "jar_plus_timeseries"
		} else {
			out.Source = "jar_primary"
		}
		out.JarEventTotal = int64(jarExceptionRows(pr.JARExceptions))
		fillFromJARExceptions(out, pr.JARExceptions)
	} else {
		out.Source = "derived_topn"
		out.JarEventTotal = countFailedTopN(dash)
		fillFromDistributionErrors(out, dash)
	}

	sort.Slice(out.TopMessages, func(i, j int) bool {
		if out.TopMessages[i].Count == out.TopMessages[j].Count {
			return out.TopMessages[i].Message < out.TopMessages[j].Message
		}
		return out.TopMessages[i].Count > out.TopMessages[j].Count
	})
	if len(out.TopMessages) > 8 {
		out.TopMessages = out.TopMessages[:8]
	}

	sort.Slice(out.TopErrorQueues, func(i, j int) bool {
		if out.TopErrorQueues[i].Errors == out.TopErrorQueues[j].Errors {
			return out.TopErrorQueues[i].Queue < out.TopErrorQueues[j].Queue
		}
		return out.TopErrorQueues[i].Errors > out.TopErrorQueues[j].Errors
	})
	if len(out.TopErrorQueues) > 8 {
		out.TopErrorQueues = out.TopErrorQueues[:8]
	}

	return out
}

func jarExceptionRows(j *domain.JARExceptionsResponse) int {
	if j == nil {
		return 0
	}
	return len(j.APIErrors) + len(j.APIExceptions) + len(j.SQLExceptions)
}

func fillFromJARExceptions(out *domain.ErrorSummary, j *domain.JARExceptionsResponse) {
	msgs := make(map[string]*msgAgg)
	queues := make(map[string]int64)

	for _, e := range j.APIErrors {
		msg := strings.TrimSpace(e.ErrorMessage)
		if msg == "" {
			msg = "(empty API error message)"
		}
		agg := msgs[msg]
		if agg == nil {
			agg = &msgAgg{}
			msgs[msg] = agg
		}
		agg.count++
		if agg.sampleTrace == "" && e.TraceID != "" {
			agg.sampleTrace = e.TraceID
		}
		q := strings.TrimSpace(e.Queue)
		if q == "" {
			q = "(unknown queue)"
		}
		queues[q]++
	}

	for _, e := range j.APIExceptions {
		msg := strings.TrimSpace(strings.TrimSpace(e.Type) + ": " + strings.TrimSpace(e.Message))
		if msg == ":" || msg == "" {
			msg = "(API exception)"
		}
		agg := msgs[msg]
		if agg == nil {
			agg = &msgAgg{}
			msgs[msg] = agg
		}
		agg.count++
		if agg.sampleTrace == "" && e.TraceID != "" {
			agg.sampleTrace = e.TraceID
		}
	}

	for _, e := range j.SQLExceptions {
		msg := strings.TrimSpace(strings.TrimSpace(e.Type) + ": " + strings.TrimSpace(e.Message))
		if msg == ":" || msg == "" {
			msg = "(SQL exception)"
		}
		agg := msgs[msg]
		if agg == nil {
			agg = &msgAgg{}
			msgs[msg] = agg
		}
		agg.count++
		if agg.sampleTrace == "" && e.TraceID != "" {
			agg.sampleTrace = e.TraceID
		}
	}

	out.UniqueMessages = len(msgs)

	for m, a := range msgs {
		out.TopMessages = append(out.TopMessages, domain.ErrorSummaryMessage{
			Message:     m,
			Count:       a.count,
			SampleTrace: a.sampleTrace,
		})
	}
	for q, n := range queues {
		out.TopErrorQueues = append(out.TopErrorQueues, domain.ErrorSummaryQueue{
			Queue:  q,
			Errors: n,
		})
	}
}

func countFailedTopN(d *domain.DashboardData) int64 {
	var n int64
	for _, e := range d.TopAPICalls {
		if !e.Success {
			n++
		}
	}
	for _, e := range d.TopSQL {
		if !e.Success {
			n++
		}
	}
	for _, e := range d.TopFilters {
		if !e.Success {
			n++
		}
	}
	for _, e := range d.TopEscalations {
		if !e.Success {
			n++
		}
	}
	return n
}

func fillFromDistributionErrors(out *domain.ErrorSummary, dash *domain.DashboardData) {
	if dash.Distribution == nil {
		return
	}
	errs, ok := dash.Distribution["errors"]
	if !ok || len(errs) == 0 {
		return
	}
	for code, c := range errs {
		if strings.TrimSpace(code) == "" {
			continue
		}
		out.TopMessages = append(out.TopMessages, domain.ErrorSummaryMessage{
			Message: code,
			Count:   int64(c),
		})
	}
	out.UniqueMessages = len(out.TopMessages)
}

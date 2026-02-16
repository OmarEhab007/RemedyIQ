package trace

import (
	"testing"
	"time"

	"github.com/OmarEhab007/RemedyIQ/backend/internal/domain"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestBuildHierarchy_SingleAPIRoot(t *testing.T) {
	base := time.Now()
	entries := []domain.LogEntry{
		{
			EntryID:    "api-1",
			Timestamp:  base,
			LogType:    domain.LogTypeAPI,
			DurationMS: 100,
			ThreadID:   "t1",
			TraceID:    "trace-1",
			APICode:    "GET_RECORD",
			Form:       "HPD:Help Desk",
			Success:    true,
		},
		{
			EntryID:     "filter-1",
			Timestamp:   base.Add(5 * time.Millisecond),
			LogType:     domain.LogTypeFilter,
			DurationMS:  20,
			ThreadID:    "t1",
			TraceID:     "trace-1",
			FilterName:  "Check Status",
			FilterLevel: 1,
			Success:     true,
		},
		{
			EntryID:    "sql-1",
			Timestamp:  base.Add(10 * time.Millisecond),
			LogType:    domain.LogTypeSQL,
			DurationMS: 5,
			ThreadID:   "t1",
			TraceID:    "trace-1",
			SQLTable:   "T123",
			Success:    true,
		},
	}

	roots := BuildHierarchy(entries)

	require.Len(t, roots, 1, "should have one root")
	assert.Equal(t, "api-1", roots[0].ID)
	assert.Equal(t, domain.LogTypeAPI, roots[0].LogType)
	assert.Equal(t, 0, roots[0].Depth)
	assert.Len(t, roots[0].Children, 1, "API should have filter child")

	filter := roots[0].Children[0]
	assert.Equal(t, "filter-1", filter.ID)
	assert.Equal(t, domain.LogTypeFilter, filter.LogType)
	assert.Equal(t, "api-1", filter.ParentID)
}

func TestBuildHierarchy_3LevelFilterDepth(t *testing.T) {
	base := time.Now()
	entries := []domain.LogEntry{
		{
			EntryID:    "api-1",
			Timestamp:  base,
			LogType:    domain.LogTypeAPI,
			DurationMS: 500,
			ThreadID:   "t1",
			TraceID:    "trace-1",
			Success:    true,
		},
		{
			EntryID:     "filter-1",
			Timestamp:   base.Add(10 * time.Millisecond),
			LogType:     domain.LogTypeFilter,
			DurationMS:  200,
			ThreadID:    "t1",
			TraceID:     "trace-1",
			FilterLevel: 1,
			Success:     true,
		},
		{
			EntryID:     "filter-2",
			Timestamp:   base.Add(20 * time.Millisecond),
			LogType:     domain.LogTypeFilter,
			DurationMS:  100,
			ThreadID:    "t1",
			TraceID:     "trace-1",
			FilterLevel: 2,
			Success:     true,
		},
		{
			EntryID:     "filter-3",
			Timestamp:   base.Add(30 * time.Millisecond),
			LogType:     domain.LogTypeFilter,
			DurationMS:  50,
			ThreadID:    "t1",
			TraceID:     "trace-1",
			FilterLevel: 3,
			Success:     true,
		},
	}

	roots := BuildHierarchy(entries)

	require.Len(t, roots, 1)
	flat := FlattenSpans(roots)
	assert.Len(t, flat, 4, "should have 4 total spans")
}

func TestBuildHierarchy_FlatTrace(t *testing.T) {
	base := time.Now()
	entries := []domain.LogEntry{
		{
			EntryID:    "api-1",
			Timestamp:  base,
			LogType:    domain.LogTypeAPI,
			DurationMS: 10,
			ThreadID:   "t1",
			TraceID:    "trace-1",
			Success:    true,
		},
		{
			EntryID:    "api-2",
			Timestamp:  base.Add(20 * time.Millisecond),
			LogType:    domain.LogTypeAPI,
			DurationMS: 10,
			ThreadID:   "t1",
			TraceID:    "trace-1",
			Success:    true,
		},
		{
			EntryID:    "api-3",
			Timestamp:  base.Add(40 * time.Millisecond),
			LogType:    domain.LogTypeAPI,
			DurationMS: 10,
			ThreadID:   "t1",
			TraceID:    "trace-1",
			Success:    true,
		},
	}

	roots := BuildHierarchy(entries)

	assert.Len(t, roots, 3, "should have 3 separate root spans (siblings)")
}

func TestBuildHierarchy_ConcurrentSiblings(t *testing.T) {
	base := time.Now()
	entries := []domain.LogEntry{
		{
			EntryID:    "api-1",
			Timestamp:  base,
			LogType:    domain.LogTypeAPI,
			DurationMS: 100,
			ThreadID:   "t1",
			TraceID:    "trace-1",
			Success:    true,
		},
		{
			EntryID:    "api-2",
			Timestamp:  base.Add(5 * time.Millisecond),
			LogType:    domain.LogTypeAPI,
			DurationMS: 50,
			ThreadID:   "t2",
			TraceID:    "trace-1",
			Success:    true,
		},
	}

	roots := BuildHierarchy(entries)

	assert.Len(t, roots, 2, "different threads should be siblings")
}

func TestBuildHierarchy_EmptyTrace(t *testing.T) {
	entries := []domain.LogEntry{}
	roots := BuildHierarchy(entries)
	assert.Empty(t, roots)
}

func TestBuildHierarchy_SingleLogType(t *testing.T) {
	base := time.Now()
	entries := []domain.LogEntry{
		{
			EntryID:    "sql-1",
			Timestamp:  base,
			LogType:    domain.LogTypeSQL,
			DurationMS: 10,
			ThreadID:   "t1",
			TraceID:    "trace-1",
			SQLTable:   "T123",
			Success:    true,
		},
		{
			EntryID:    "sql-2",
			Timestamp:  base.Add(20 * time.Millisecond),
			LogType:    domain.LogTypeSQL,
			DurationMS: 10,
			ThreadID:   "t1",
			TraceID:    "trace-1",
			SQLTable:   "T456",
			Success:    true,
		},
	}

	roots := BuildHierarchy(entries)
	assert.Len(t, roots, 2, "SQL-only traces should be siblings")
}

func TestBuildHierarchy_RPCIDFallback(t *testing.T) {
	base := time.Now()
	entries := []domain.LogEntry{
		{
			EntryID:    "api-1",
			Timestamp:  base,
			LogType:    domain.LogTypeAPI,
			DurationMS: 100,
			ThreadID:   "t1",
			TraceID:    "",
			RPCID:      "rpc-123",
			Success:    true,
		},
		{
			EntryID:    "sql-1",
			Timestamp:  base.Add(10 * time.Millisecond),
			LogType:    domain.LogTypeSQL,
			DurationMS: 20,
			ThreadID:   "t1",
			TraceID:    "",
			RPCID:      "rpc-123",
			Success:    true,
		},
	}

	roots := BuildHierarchy(entries)
	require.Len(t, roots, 1)

	corrType := DetermineCorrelationType(entries)
	assert.Equal(t, "rpc_id", corrType, "should use rpc_id when trace_id is empty")
}

func TestFlattenSpans(t *testing.T) {
	spans := []domain.SpanNode{
		{
			ID: "root",
			Children: []domain.SpanNode{
				{ID: "child1", Children: []domain.SpanNode{}},
				{ID: "child2", Children: []domain.SpanNode{}},
			},
		},
	}

	flat := FlattenSpans(spans)
	assert.Len(t, flat, 3)
	assert.Equal(t, "root", flat[0].ID)
}

func TestComputeTypeBreakdown(t *testing.T) {
	spans := []domain.SpanNode{
		{ID: "1", LogType: domain.LogTypeAPI},
		{ID: "2", LogType: domain.LogTypeAPI},
		{ID: "3", LogType: domain.LogTypeSQL},
		{ID: "4", LogType: domain.LogTypeFilter},
	}

	breakdown := ComputeTypeBreakdown(spans)
	assert.Equal(t, 2, breakdown["API"])
	assert.Equal(t, 1, breakdown["SQL"])
	assert.Equal(t, 1, breakdown["FLTR"])
}

func TestCountErrors(t *testing.T) {
	spans := []domain.SpanNode{
		{ID: "1", Success: true},
		{ID: "2", Success: false},
		{ID: "3", Success: true, ErrorMessage: "something failed"},
		{ID: "4", Success: true},
	}

	count := CountErrors(spans)
	assert.Equal(t, 2, count)
}

func TestFindPrimaryUser(t *testing.T) {
	spans := []domain.SpanNode{
		{ID: "1", User: "alice"},
		{ID: "2", User: "bob"},
		{ID: "3", User: "alice"},
		{ID: "4", User: "alice"},
	}

	user := FindPrimaryUser(spans)
	assert.Equal(t, "alice", user)
}

func TestFindPrimaryQueue(t *testing.T) {
	spans := []domain.SpanNode{
		{ID: "1", Queue: "q1"},
		{ID: "2", Queue: "q2"},
		{ID: "3", Queue: "q1"},
	}

	queue := FindPrimaryQueue(spans)
	assert.Equal(t, "q1", queue)
}

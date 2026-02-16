package trace

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestComputeCriticalPath_Empty(t *testing.T) {
	spans := []SpanNode{}
	result := ComputeCriticalPath(spans)
	assert.Empty(t, result)
}

func TestComputeCriticalPath_SingleSpan(t *testing.T) {
	spans := []SpanNode{
		{ID: "span-1", DurationMS: 100, StartOffsetMS: 0},
	}
	result := ComputeCriticalPath(spans)
	require.Len(t, result, 1)
	assert.Equal(t, "span-1", result[0])
}

func TestComputeCriticalPath_LinearChain(t *testing.T) {
	spans := []SpanNode{
		{
			ID:            "root",
			DurationMS:    300,
			StartOffsetMS: 0,
			Children: []SpanNode{
				{
					ID:            "child-1",
					DurationMS:    200,
					StartOffsetMS: 0,
					Children: []SpanNode{
						{ID: "grandchild-1", DurationMS: 100, StartOffsetMS: 0},
					},
				},
			},
		},
	}

	result := ComputeCriticalPath(spans)
	require.Len(t, result, 3)
	assert.Equal(t, "root", result[0])
	assert.Equal(t, "child-1", result[1])
	assert.Equal(t, "grandchild-1", result[2])
}

func TestComputeCriticalPath_ParallelBranches(t *testing.T) {
	spans := []SpanNode{
		{
			ID:            "root",
			DurationMS:    300,
			StartOffsetMS: 0,
			Children: []SpanNode{
				{
					ID:            "short-branch",
					DurationMS:    50,
					StartOffsetMS: 0,
					Children: []SpanNode{
						{ID: "short-child", DurationMS: 30, StartOffsetMS: 0},
					},
				},
				{
					ID:            "long-branch",
					DurationMS:    250,
					StartOffsetMS: 0,
					Children: []SpanNode{
						{ID: "long-child", DurationMS: 200, StartOffsetMS: 0},
					},
				},
			},
		},
	}

	result := ComputeCriticalPath(spans)
	require.Len(t, result, 3)
	assert.Equal(t, "root", result[0])
	assert.Equal(t, "long-branch", result[1])
	assert.Equal(t, "long-child", result[2])
}

func TestComputeCriticalPath_MultipleRoots(t *testing.T) {
	spans := []SpanNode{
		{
			ID:            "root-1",
			DurationMS:    100,
			StartOffsetMS: 0,
			Children: []SpanNode{
				{ID: "child-1", DurationMS: 50, StartOffsetMS: 0},
			},
		},
		{
			ID:            "root-2",
			DurationMS:    200,
			StartOffsetMS: 150,
			Children: []SpanNode{
				{ID: "child-2", DurationMS: 150, StartOffsetMS: 150},
			},
		},
	}

	result := ComputeCriticalPath(spans)
	require.Len(t, result, 4)
	assert.Equal(t, "root-1", result[0])
	assert.Equal(t, "child-1", result[1])
	assert.Equal(t, "root-2", result[2])
	assert.Equal(t, "child-2", result[3])
}

func TestMarkCriticalPath(t *testing.T) {
	spans := []SpanNode{
		{
			ID:             "root",
			DurationMS:     100,
			StartOffsetMS:  0,
			OnCriticalPath: false,
			Children: []SpanNode{
				{ID: "child-1", DurationMS: 50, OnCriticalPath: false},
				{ID: "child-2", DurationMS: 30, OnCriticalPath: false},
			},
		},
	}

	criticalPath := []string{"root", "child-1"}
	MarkCriticalPath(spans, criticalPath)

	assert.True(t, spans[0].OnCriticalPath)
	assert.True(t, spans[0].Children[0].OnCriticalPath)
	assert.False(t, spans[0].Children[1].OnCriticalPath)
}

func TestComputeCriticalPathContribution(t *testing.T) {
	node := &SpanNode{DurationMS: 500}
	totalDuration := int64(2000)

	contribution := ComputeCriticalPathContribution(node, totalDuration)
	assert.InDelta(t, 25.0, contribution, 0.01)
}

func TestComputeCriticalPathContribution_ZeroTotal(t *testing.T) {
	node := &SpanNode{DurationMS: 500}
	totalDuration := int64(0)

	contribution := ComputeCriticalPathContribution(node, totalDuration)
	assert.Equal(t, 0.0, contribution)
}

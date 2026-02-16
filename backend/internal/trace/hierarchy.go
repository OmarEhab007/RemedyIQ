package trace

import (
	"sort"
	"time"

	"github.com/OmarEhab007/RemedyIQ/backend/internal/domain"
)

type SpanNode = domain.SpanNode

type LogEntry = domain.LogEntry

type LogType = domain.LogType

const (
	LogTypeAPI        = domain.LogTypeAPI
	LogTypeSQL        = domain.LogTypeSQL
	LogTypeFilter     = domain.LogTypeFilter
	LogTypeEscalation = domain.LogTypeEscalation
)

type HierarchyBuilder struct {
	entries []LogEntry
}

func NewHierarchyBuilder(entries []LogEntry) *HierarchyBuilder {
	return &HierarchyBuilder{entries: entries}
}

func (b *HierarchyBuilder) Build() []SpanNode {
	if len(b.entries) == 0 {
		return []SpanNode{}
	}

	sorted := make([]LogEntry, len(b.entries))
	copy(sorted, b.entries)
	sort.Slice(sorted, func(i, j int) bool {
		if sorted[i].Timestamp.Equal(sorted[j].Timestamp) {
			if sorted[i].ThreadID == sorted[j].ThreadID {
				return sorted[i].LineNumber < sorted[j].LineNumber
			}
			return sorted[i].ThreadID < sorted[j].ThreadID
		}
		return sorted[i].Timestamp.Before(sorted[j].Timestamp)
	})

	traceStart := sorted[0].Timestamp
	nodes := make([]SpanNode, 0, len(sorted))
	for _, e := range sorted {
		node := entryToSpanNode(e, traceStart)
		nodes = append(nodes, node)
	}

	threadRoots := make(map[string][]*SpanNode)
	for i := range nodes {
		node := &nodes[i]
		threadID := node.ThreadID
		if threadID == "" {
			threadID = "unknown"
		}

		inserted := false
		roots := threadRoots[threadID]
		for _, root := range roots {
			if insertIntoTree(root, node) {
				inserted = true
				break
			}
		}

		if !inserted {
			threadRoots[threadID] = append(threadRoots[threadID], node)
		}
	}

	roots := make([]SpanNode, 0)
	for _, threadRootList := range threadRoots {
		for _, root := range threadRootList {
			resolveChildren(root, &nodes)
			roots = append(roots, *root)
		}
	}

	sort.Slice(roots, func(i, j int) bool {
		return roots[i].StartOffsetMS < roots[j].StartOffsetMS
	})

	return roots
}

func insertIntoTree(root *SpanNode, child *SpanNode) bool {
	if !temporalContains(root, child) {
		return false
	}

	if child.Depth <= root.Depth {
		return false
	}

	inserted := false
	for i := range root.Children {
		if insertIntoTree(&root.Children[i], child) {
			inserted = true
			break
		}
	}

	if !inserted {
		child.ParentID = root.ID
		root.Children = append(root.Children, *child)
	}
	return true
}

func temporalContains(parent *SpanNode, child *SpanNode) bool {
	parentEnd := parent.StartOffsetMS + int64(parent.DurationMS)
	childEnd := child.StartOffsetMS + int64(child.DurationMS)
	return child.StartOffsetMS >= parent.StartOffsetMS && childEnd <= parentEnd
}

func resolveChildren(root *SpanNode, allNodes *[]SpanNode) {
	children := make([]SpanNode, 0)
	for i := range *allNodes {
		node := &(*allNodes)[i]
		if node.ParentID == root.ID && node.ID != root.ID {
			resolveChildren(node, allNodes)
			children = append(children, *node)
		}
	}
	sort.Slice(children, func(i, j int) bool {
		return children[i].StartOffsetMS < children[j].StartOffsetMS
	})
	root.Children = children
}

func entryToSpanNode(e LogEntry, traceStart time.Time) SpanNode {
	startOffset := e.Timestamp.Sub(traceStart).Milliseconds()

	node := SpanNode{
		ID:             e.EntryID,
		ParentID:       "",
		Depth:          computeDepth(e),
		LogType:        e.LogType,
		StartOffsetMS:  startOffset,
		DurationMS:     int(e.DurationMS),
		Fields:         entryToFields(e),
		Children:       []SpanNode{},
		OnCriticalPath: false,
		HasError:       !e.Success,
		Timestamp:      e.Timestamp,
		ThreadID:       e.ThreadID,
		TraceID:        e.TraceID,
		RPCID:          e.RPCID,
		User:           e.User,
		Queue:          e.Queue,
		Form:           e.Form,
		Operation:      e.Operation,
		LineNumber:     int(e.LineNumber),
		FileNumber:     int(e.FileNumber),
		Success:        e.Success,
		ErrorMessage:   e.ErrorMessage,
	}

	return node
}

func computeDepth(e LogEntry) int {
	switch e.LogType {
	case LogTypeAPI:
		return 0
	case LogTypeEscalation:
		return 0
	case LogTypeFilter:
		return int(e.FilterLevel)
	case LogTypeSQL:
		return 10
	default:
		return 5
	}
}

func entryToFields(e LogEntry) map[string]interface{} {
	fields := make(map[string]interface{})

	if e.APICode != "" {
		fields["api_code"] = e.APICode
	}
	if e.Form != "" {
		fields["form"] = e.Form
	}
	if e.SQLTable != "" {
		fields["sql_table"] = e.SQLTable
	}
	if e.SQLStatement != "" {
		fields["sql_statement"] = e.SQLStatement
	}
	if e.FilterName != "" {
		fields["filter_name"] = e.FilterName
	}
	if e.FilterLevel > 0 {
		fields["filter_level"] = e.FilterLevel
	}
	if e.Operation != "" {
		fields["operation"] = e.Operation
	}
	if e.RequestID != "" {
		fields["request_id"] = e.RequestID
	}
	if e.EscName != "" {
		fields["esc_name"] = e.EscName
	}
	if e.EscPool != "" {
		fields["esc_pool"] = e.EscPool
	}
	if e.ScheduledTime != nil {
		fields["scheduled_time"] = e.ScheduledTime.Format(time.RFC3339)
	}
	if e.DelayMS > 0 {
		fields["delay_ms"] = e.DelayMS
	}
	if e.ErrorEncountered {
		fields["error_encountered"] = true
	}
	if e.QueueTimeMS > 0 {
		fields["queue_time_ms"] = e.QueueTimeMS
	}

	return fields
}

func BuildHierarchy(entries []LogEntry) []SpanNode {
	builder := NewHierarchyBuilder(entries)
	return builder.Build()
}

func FlattenSpans(spans []SpanNode) []SpanNode {
	var result []SpanNode
	flattenDFS(spans, &result)
	return result
}

func flattenDFS(spans []SpanNode, result *[]SpanNode) {
	for i := range spans {
		*result = append(*result, spans[i])
		if len(spans[i].Children) > 0 {
			flattenDFS(spans[i].Children, result)
		}
	}
}

func ComputeTypeBreakdown(spans []SpanNode) map[string]int {
	breakdown := make(map[string]int)
	flat := FlattenSpans(spans)
	for _, s := range flat {
		key := string(s.LogType)
		breakdown[key]++
	}
	return breakdown
}

func CountErrors(spans []SpanNode) int {
	count := 0
	flat := FlattenSpans(spans)
	for _, s := range flat {
		if !s.Success || s.ErrorMessage != "" {
			count++
		}
	}
	return count
}

func FindPrimaryUser(spans []SpanNode) string {
	userCounts := make(map[string]int)
	flat := FlattenSpans(spans)
	for _, s := range flat {
		if s.User != "" {
			userCounts[s.User]++
		}
	}
	maxUser := ""
	maxCount := 0
	for user, count := range userCounts {
		if count > maxCount {
			maxCount = count
			maxUser = user
		}
	}
	return maxUser
}

func FindPrimaryQueue(spans []SpanNode) string {
	queueCounts := make(map[string]int)
	flat := FlattenSpans(spans)
	for _, s := range flat {
		if s.Queue != "" {
			queueCounts[s.Queue]++
		}
	}
	maxQueue := ""
	maxCount := 0
	for queue, count := range queueCounts {
		if count > maxCount {
			maxCount = count
			maxQueue = queue
		}
	}
	return maxQueue
}

func DetermineCorrelationType(entries []LogEntry) string {
	for _, e := range entries {
		if e.TraceID != "" {
			return "trace_id"
		}
	}
	for _, e := range entries {
		if e.RPCID != "" {
			return "rpc_id"
		}
	}
	return "none"
}

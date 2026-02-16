package trace

func ComputeCriticalPath(spans []SpanNode) []string {
	if len(spans) == 0 {
		return []string{}
	}

	criticalPath := make([]string, 0)
	for i := range spans {
		findCriticalPathInTree(&spans[i], &criticalPath)
	}

	return criticalPath
}

func findCriticalPathInTree(root *SpanNode, criticalPath *[]string) {
	if root == nil {
		return
	}

	root.OnCriticalPath = true
	*criticalPath = append(*criticalPath, root.ID)

	longestChild := findLongestChild(root)
	if longestChild != nil {
		findCriticalPathInTree(longestChild, criticalPath)
	}
}

func findLongestChild(node *SpanNode) *SpanNode {
	if len(node.Children) == 0 {
		return nil
	}

	var longest *SpanNode
	maxEnd := int64(0)

	nodeEnd := node.StartOffsetMS + int64(node.DurationMS)

	for i := range node.Children {
		child := &node.Children[i]
		childEnd := child.StartOffsetMS + int64(child.DurationMS)

		if childEnd > maxEnd && childEnd <= nodeEnd {
			maxEnd = childEnd
			longest = child
		}
	}

	if longest == nil && len(node.Children) > 0 {
		longest = &node.Children[0]
	}

	return longest
}

func MarkCriticalPath(spans []SpanNode, criticalPathIDs []string) {
	pathSet := make(map[string]bool)
	for _, id := range criticalPathIDs {
		pathSet[id] = true
	}

	markCriticalRecursive(spans, pathSet)
}

func markCriticalRecursive(spans []SpanNode, pathSet map[string]bool) {
	for i := range spans {
		if pathSet[spans[i].ID] {
			spans[i].OnCriticalPath = true
		}
		if len(spans[i].Children) > 0 {
			markCriticalRecursive(spans[i].Children, pathSet)
		}
	}
}

func ComputeCriticalPathContribution(node *SpanNode, totalDuration int64) float64 {
	if totalDuration == 0 {
		return 0
	}
	return float64(node.DurationMS) / float64(totalDuration) * 100
}

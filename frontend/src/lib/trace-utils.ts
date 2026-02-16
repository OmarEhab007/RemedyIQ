import { SpanNode } from "@/lib/api";

export function flattenSpanTree(spans: SpanNode[]): SpanNode[] {
  const result: SpanNode[] = [];
  
  function dfs(nodes: SpanNode[]) {
    for (const node of nodes) {
      result.push(node);
      if (node.children && node.children.length > 0) {
        dfs(node.children);
      }
    }
  }
  
  dfs(spans);
  return result;
}

export function filterSpansWithAncestors(
  spans: SpanNode[],
  predicate: (span: SpanNode) => boolean
): SpanNode[] {
  const flat = flattenSpanTree(spans);
  const matchingIds = new Set<string>();
  
  for (const span of flat) {
    if (predicate(span)) {
      matchingIds.add(span.id);
    }
  }
  
  const result: SpanNode[] = [];
  for (const span of flat) {
    if (matchingIds.has(span.id) || hasMatchingDescendant(span, matchingIds)) {
      result.push(span);
    }
  }
  
  return result;
}

function hasMatchingDescendant(span: SpanNode, ids: Set<string>): boolean {
  if (!span.children) return false;
  for (const child of span.children) {
    if (ids.has(child.id) || hasMatchingDescendant(child, ids)) {
      return true;
    }
  }
  return false;
}

export type SpanColorScheme = {
  bg: string;
  border: string;
  text: string;
};

export function getSpanColor(logType: string): SpanColorScheme {
  switch (logType) {
    case "API":
      return { bg: "bg-blue-100", border: "border-blue-500", text: "text-blue-700" };
    case "SQL":
      return { bg: "bg-green-100", border: "border-green-500", text: "text-green-700" };
    case "FLTR":
      return { bg: "bg-purple-100", border: "border-purple-500", text: "text-purple-700" };
    case "ESCL":
      return { bg: "bg-orange-100", border: "border-orange-500", text: "text-orange-700" };
    default:
      return { bg: "bg-gray-100", border: "border-gray-500", text: "text-gray-700" };
  }
}

export function formatDuration(ms: number): string {
  if (ms < 1) {
    return `${(ms * 1000).toFixed(0)}µs`;
  } else if (ms < 1000) {
    return `${ms.toFixed(0)}ms`;
  } else if (ms < 60000) {
    return `${(ms / 1000).toFixed(2)}s`;
  } else {
    const minutes = Math.floor(ms / 60000);
    const seconds = ((ms % 60000) / 1000).toFixed(1);
    return `${minutes}m ${seconds}s`;
  }
}

export function calculateStartOffset(
  spanTimestamp: string,
  traceStart: string
): number {
  const start = new Date(traceStart).getTime();
  const span = new Date(spanTimestamp).getTime();
  return span - start;
}

export interface AlignedSpan {
  spanA: SpanNode | null;
  spanB: SpanNode | null;
  durationDelta: number;
  isAnomalous: boolean;
}

export function buildComparisonAlignment(
  traceA: SpanNode[],
  traceB: SpanNode[]
): AlignedSpan[] {
  const flatA = flattenSpanTree(traceA);
  const flatB = flattenSpanTree(traceB);
  
  const alignment: AlignedSpan[] = [];
  const usedB = new Set<string>();
  
  for (const spanA of flatA) {
    const keyA = buildAlignmentKey(spanA);
    let bestMatch: SpanNode | null = null;
    
    for (let i = 0; i < flatB.length; i++) {
      if (usedB.has(flatB[i].id)) continue;
      const keyB = buildAlignmentKey(flatB[i]);
      if (keyA === keyB) {
        bestMatch = flatB[i];
        break;
      }
    }
    
    if (bestMatch) {
      usedB.add(bestMatch.id);
      const delta = bestMatch.duration_ms - spanA.duration_ms;
      alignment.push({
        spanA,
        spanB: bestMatch,
        durationDelta: delta,
        isAnomalous: Math.abs(delta) > spanA.duration_ms * 0.5,
      });
    } else {
      alignment.push({
        spanA,
        spanB: null,
        durationDelta: -spanA.duration_ms,
        isAnomalous: true,
      });
    }
  }
  
  for (const spanB of flatB) {
    if (!usedB.has(spanB.id)) {
      alignment.push({
        spanA: null,
        spanB,
        durationDelta: spanB.duration_ms,
        isAnomalous: true,
      });
    }
  }
  
  return alignment;
}

function buildAlignmentKey(span: SpanNode): string {
  const parts = [
    span.log_type,
    span.depth,
    span.form || "",
    span.operation || "",
    span.fields?.filter_name || "",
    span.fields?.api_code || "",
  ];
  return parts.join("|");
}

export function getSpanLabel(span: SpanNode): string {
  switch (span.log_type) {
    case "API":
      return span.fields?.api_code as string || span.operation || "API Call";
    case "SQL":
      return (span.fields?.sql_table as string) || "SQL Query";
    case "FLTR":
      return (span.fields?.filter_name as string) || "Filter";
    case "ESCL":
      return (span.fields?.esc_name as string) || "Escalation";
    default:
      return "Unknown";
  }
}

export function hasErrorChildren(span: SpanNode): boolean {
  if (!span.children) return false;
  for (const child of span.children) {
    if (!child.success || child.has_error) return true;
    if (hasErrorChildren(child)) return true;
  }
  return false;
}

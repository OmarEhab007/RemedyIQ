"use client";

interface TraceEntry {
  id: string;
  log_type: string;
  timestamp: string;
  duration_ms: number;
  identifier: string;
  user?: string;
  form?: string;
  success: boolean;
  details?: string;
}

interface TimelineProps {
  entries: TraceEntry[];
  onEntryClick?: (entry: TraceEntry) => void;
}

const typeColors: Record<string, { bg: string; border: string; dot: string }> = {
  API:  { bg: "bg-blue-50", border: "border-blue-200", dot: "bg-blue-500" },
  SQL:  { bg: "bg-green-50", border: "border-green-200", dot: "bg-green-500" },
  FLTR: { bg: "bg-purple-50", border: "border-purple-200", dot: "bg-purple-500" },
  ESCL: { bg: "bg-orange-50", border: "border-orange-200", dot: "bg-orange-500" },
};

export function Timeline({ entries, onEntryClick }: TimelineProps) {
  if (entries.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        No trace entries found
      </div>
    );
  }

  const maxDuration = Math.max(...entries.map((e) => e.duration_ms || 1));

  return (
    <div className="relative pl-8">
      {/* Vertical line */}
      <div className="absolute left-3 top-0 bottom-0 w-px bg-border" />

      {entries.map((entry, i) => {
        const colors = typeColors[entry.log_type] || typeColors.API;
        const widthPct = Math.max((entry.duration_ms / maxDuration) * 100, 5);

        return (
          <div
            key={entry.id || i}
            className={`relative mb-3 cursor-pointer group`}
            onClick={() => onEntryClick?.(entry)}
          >
            {/* Dot */}
            <div className={`absolute -left-5 top-3 w-2.5 h-2.5 rounded-full ${colors.dot} ring-2 ring-background`} />

            {/* Card */}
            <div className={`${colors.bg} ${colors.border} border rounded-lg p-3 hover:shadow-sm transition-shadow`}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${colors.dot} text-white`}>
                    {entry.log_type}
                  </span>
                  <span className="text-sm font-medium">{entry.identifier}</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString() : ""}
                </span>
              </div>

              {/* Duration bar */}
              <div className="mt-2 h-1.5 bg-black/5 rounded-full overflow-hidden">
                <div
                  className={`h-full ${colors.dot} rounded-full`}
                  style={{ width: `${widthPct}%` }}
                />
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs text-muted-foreground">
                  {entry.user && `User: ${entry.user}`}
                  {entry.form && ` | Form: ${entry.form}`}
                </span>
                <span className="text-xs font-mono">
                  {entry.duration_ms}ms
                  {!entry.success && (
                    <span className="ml-1 text-red-500">FAIL</span>
                  )}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

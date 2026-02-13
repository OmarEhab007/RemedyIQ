"use client";

interface ProgressTrackerProps {
  status: string;
  progressPct: number;
  message?: string;
}

const statusLabels: Record<string, string> = {
  uploading: "Uploading file...",
  uploaded: "Upload complete",
  queued: "Queued for analysis",
  parsing: "Parsing log file",
  analyzing: "Analyzing results",
  storing: "Storing results",
  complete: "Analysis complete",
  failed: "Analysis failed",
};

export function ProgressTracker({ status, progressPct, message }: ProgressTrackerProps) {
  const label = statusLabels[status] || status;
  const isComplete = status === "complete" || status === "uploaded";
  const isFailed = status === "failed";

  return (
    <div className="space-y-3">
      <div className="flex justify-between text-sm">
        <span className={isFailed ? "text-destructive font-medium" : "font-medium"}>
          {label}
        </span>
        <span className="text-muted-foreground">{progressPct}%</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-500 rounded-full ${
            isFailed
              ? "bg-destructive"
              : isComplete
                ? "bg-green-500"
                : "bg-primary"
          }`}
          style={{ width: `${Math.min(progressPct, 100)}%` }}
        />
      </div>
      {message && (
        <p className="text-xs text-muted-foreground">{message}</p>
      )}
    </div>
  );
}

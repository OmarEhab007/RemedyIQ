"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Calendar, Clock } from "lucide-react";

export interface TimeRange {
  type: "relative" | "absolute" | "all";
  value?: string;
  start?: Date;
  end?: Date;
}

interface TimeRangePickerProps {
  value: TimeRange;
  onChange: (range: TimeRange) => void;
  logStart?: Date;
  logEnd?: Date;
}

const RELATIVE_RANGES = [
  { label: "Last 15 minutes", value: "15m" },
  { label: "Last 1 hour", value: "1h" },
  { label: "Last 6 hours", value: "6h" },
  { label: "Last 24 hours", value: "24h" },
  { label: "Last 7 days", value: "7d" },
];

export function TimeRangePicker({ value, onChange, logStart, logEnd }: TimeRangePickerProps) {
  const [showCustom, setShowCustom] = useState(false);
  const [customStart, setCustomStart] = useState(
    value.start ? formatDateForInput(value.start) : ""
  );
  const [customEnd, setCustomEnd] = useState(
    value.end ? formatDateForInput(value.end) : ""
  );

  const getDisplayLabel = useCallback(() => {
    if (value.type === "all") return "All time";
    if (value.type === "relative") {
      const preset = RELATIVE_RANGES.find((r) => r.value === value.value);
      return preset?.label || value.value || "";
    }
    if (value.type === "absolute" && value.start && value.end) {
      return `${formatDateShort(value.start)} - ${formatDateShort(value.end)}`;
    }
    return "Select time range";
  }, [value]);

  const handleRelativeSelect = useCallback(
    (rangeValue: string) => {
      onChange({ type: "relative", value: rangeValue });
      setShowCustom(false);
    },
    [onChange]
  );

  const handleAllTime = useCallback(() => {
    onChange({ type: "all" });
    setShowCustom(false);
  }, [onChange]);

  const handleCustomApply = useCallback(() => {
    if (customStart && customEnd) {
      const start = new Date(customStart);
      const end = new Date(customEnd);
      if (start <= end) {
        onChange({ type: "absolute", start, end });
        setShowCustom(false);
      }
    }
  }, [customStart, customEnd, onChange]);

  const handleClear = useCallback(() => {
    onChange({ type: "all" });
    setCustomStart("");
    setCustomEnd("");
    setShowCustom(false);
  }, [onChange]);

  return (
    <DropdownMenu open={showCustom ? true : undefined} onOpenChange={setShowCustom}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Clock className="h-4 w-4" />
          {getDisplayLabel()}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel>Time Range</DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={handleAllTime}>
          <Calendar className="h-4 w-4 mr-2" />
          All time
          {value.type === "all" && <span className="ml-auto text-primary">✓</span>}
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {RELATIVE_RANGES.map((range) => (
          <DropdownMenuItem
            key={range.value}
            onClick={() => handleRelativeSelect(range.value)}
          >
            <Clock className="h-4 w-4 mr-2" />
            {range.label}
            {value.type === "relative" && value.value === range.value && (
              <span className="ml-auto text-primary">✓</span>
            )}
          </DropdownMenuItem>
        ))}

        <DropdownMenuSeparator />

        <div className="p-2">
          <p className="text-xs font-medium text-muted-foreground mb-2">Custom Range</p>

          {logStart && logEnd && (
            <p className="text-xs text-muted-foreground mb-2">
              Data range: {formatDateShort(logStart)} to {formatDateShort(logEnd)}
            </p>
          )}

          <div className="space-y-2">
            <div>
              <label className="text-xs text-muted-foreground">Start</label>
              <input
                type="datetime-local"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                min={logStart ? formatDateForInput(logStart) : undefined}
                max={logEnd ? formatDateForInput(logEnd) : undefined}
                className="w-full text-xs border rounded px-2 py-1 mt-1"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">End</label>
              <input
                type="datetime-local"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                min={logStart ? formatDateForInput(logStart) : undefined}
                max={logEnd ? formatDateForInput(logEnd) : undefined}
                className="w-full text-xs border rounded px-2 py-1 mt-1"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                size="sm"
                onClick={handleCustomApply}
                disabled={!customStart || !customEnd}
                className="flex-1"
              >
                Apply
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleClear}
                className="flex-1"
              >
                Clear
              </Button>
            </div>
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function formatDateForInput(date: Date): string {
  // Use local time components to match datetime-local input expectations
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${d}T${h}:${min}`;
}

function formatDateShort(date: Date): string {
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Convert a TimeRange to query params. For relative ranges, uses `anchor`
 * (typically the job's logEnd timestamp) instead of wall-clock time, since
 * log data is historical.
 */
export function timeRangeToQueryParams(
  range: TimeRange,
  anchor?: Date
): {
  time_from?: string;
  time_to?: string;
} {
  if (range.type === "all") {
    return {};
  }

  if (range.type === "absolute" && range.start && range.end) {
    return {
      time_from: range.start.toISOString(),
      time_to: range.end.toISOString(),
    };
  }

  if (range.type === "relative" && range.value) {
    const end = anchor || new Date();
    let from: Date;

    switch (range.value) {
      case "15m":
        from = new Date(end.getTime() - 15 * 60 * 1000);
        break;
      case "1h":
        from = new Date(end.getTime() - 60 * 60 * 1000);
        break;
      case "6h":
        from = new Date(end.getTime() - 6 * 60 * 60 * 1000);
        break;
      case "24h":
        from = new Date(end.getTime() - 24 * 60 * 60 * 1000);
        break;
      case "7d":
        from = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      default:
        return {};
    }

    return {
      time_from: from.toISOString(),
      time_to: end.toISOString(),
    };
  }

  return {};
}

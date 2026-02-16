"use client";

import { useMemo } from "react";
import { scaleLinear } from "d3-scale";
import { formatDuration } from "@/lib/trace-utils";

interface TimestampRulerProps {
  traceStart: string;
  traceEnd: string;
  totalDurationMs: number;
  width: number;
  zoomLevel?: number;
}

export function TimestampRuler({
  totalDurationMs,
  width,
  zoomLevel = 1,
}: TimestampRulerProps) {
  const ticks = useMemo(() => {
    if (totalDurationMs <= 0) return [];
    
    const scaledWidth = width * zoomLevel;
    const xScale = scaleLinear()
      .domain([0, totalDurationMs])
      .range([0, scaledWidth]);
    
    const tickCount = Math.min(Math.max(Math.floor(scaledWidth / 100), 4), 20);
    const tickInterval = totalDurationMs / tickCount;
    
    const result: { position: number; label: string; isMajor: boolean }[] = [];
    
    for (let i = 0; i <= tickCount; i++) {
      const ms = i * tickInterval;
      const position = xScale(ms);
      result.push({
        position,
        label: formatDuration(ms),
        isMajor: i % 2 === 0,
      });
    }
    
    return result;
  }, [totalDurationMs, width, zoomLevel]);
  
  if (totalDurationMs <= 0) {
    return (
      <div className="h-6 border-b bg-muted/30 flex items-center px-4">
        <span className="text-xs text-muted-foreground">No duration data</span>
      </div>
    );
  }

  return (
    <div 
      className="h-6 border-b bg-muted/30 relative overflow-hidden"
      style={{ width: "100%" }}
    >
      <div 
        className="absolute top-0 left-0 h-full"
        style={{ width: `${Math.max(width * zoomLevel, width)}px` }}
      >
        {ticks.map((tick, i) => (
          <div
            key={i}
            className="absolute top-0 h-full flex flex-col items-center"
            style={{ left: `${tick.position}px` }}
          >
            <div 
              className={`w-px ${tick.isMajor ? "h-3 bg-border" : "h-2 bg-border/50"}`} 
            />
            {tick.isMajor && (
              <span className="text-[10px] text-muted-foreground mt-0.5 whitespace-nowrap">
                {tick.label}
              </span>
            )}
          </div>
        ))}
      </div>
      
      <div className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
        {formatDuration(totalDurationMs)} total
      </div>
    </div>
  );
}

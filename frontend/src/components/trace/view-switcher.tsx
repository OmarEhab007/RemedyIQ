"use client";

import { TraceView } from "@/hooks/use-trace";
import { Layers, List, BarChart3 } from "lucide-react";

interface ViewSwitcherProps {
  activeView: TraceView;
  onViewChange: (view: TraceView) => void;
}

const views: { id: TraceView; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "waterfall", label: "Waterfall", icon: BarChart3 },
  { id: "flamegraph", label: "Flame Graph", icon: Layers },
  { id: "spanlist", label: "Span List", icon: List },
];

export function ViewSwitcher({ activeView, onViewChange }: ViewSwitcherProps) {
  return (
    <div className="flex items-center border rounded-lg p-0.5 bg-muted/30">
      {views.map((view) => {
        const Icon = view.icon;
        const isActive = activeView === view.id;
        return (
          <button
            key={view.id}
            onClick={() => onViewChange(view.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              isActive
                ? "bg-background shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="w-4 h-4" />
            {view.label}
          </button>
        );
      })}
    </div>
  );
}

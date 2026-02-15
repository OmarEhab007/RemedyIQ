"use client";

import type { FacetEntry } from "@/hooks/use-search";

interface FilterPanelProps {
  facets: Record<string, FacetEntry[]>;
  activeFilters: Record<string, string[]>;
  onFilterChange: (filters: Record<string, string[]>) => void;
}

const facetLabels: Record<string, string> = {
  log_type: "Log Type",
  user: "User",
  queue: "Queue",
};

/** Map raw ClickHouse log_type codes to human-readable labels. */
const logTypeDisplayNames: Record<string, string> = {
  API: "API",
  SQL: "SQL",
  FLTR: "Filter",
  ESCL: "Escalation",
};

export function FilterPanel({ facets, activeFilters, onFilterChange }: FilterPanelProps) {
  const toggleFilter = (facetKey: string, value: string) => {
    const current = activeFilters[facetKey] || [];
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];

    onFilterChange({
      ...activeFilters,
      [facetKey]: next,
    });
  };

  const facetKeys = Object.keys(facets);

  if (facetKeys.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">
        Filters will appear after searching
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide">Filters</h3>
      {facetKeys.map((key) => (
        <div key={key}>
          <h4 className="text-[10px] font-medium text-muted-foreground uppercase mb-1">
            {facetLabels[key] || key}
          </h4>
          <div className="space-y-0">
            {facets[key].map((entry) => {
              const isActive = (activeFilters[key] || []).includes(entry.value);
              return (
                <label
                  key={entry.value}
                  className="flex items-center gap-1.5 text-xs cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5"
                >
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={() => toggleFilter(key, entry.value)}
                    className="rounded border-muted-foreground/30 h-3 w-3"
                  />
                  <span className="flex-1 truncate">
                    {key === "log_type" ? (logTypeDisplayNames[entry.value] || entry.value) : entry.value}
                  </span>
                  <span className="text-[10px] text-muted-foreground tabular-nums">
                    {entry.count.toLocaleString()}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

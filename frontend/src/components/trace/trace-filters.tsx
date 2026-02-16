"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Search, X, Filter, ChevronDown, ChevronUp, Zap } from "lucide-react";

export interface TraceFilterState {
  searchText: string;
  logTypes: Set<string>;
  errorsOnly: boolean;
  minDurationMs: number | null;
}

interface TraceFiltersProps {
  filters: TraceFilterState;
  onFiltersChange: (filters: Partial<TraceFilterState>) => void;
  onClearFilters: () => void;
  totalSpans: number;
  filteredCount: number;
  showCriticalPath: boolean;
  onToggleCriticalPath: () => void;
  compact?: boolean;
}

const LOG_TYPES = [
  { id: "API", label: "API", color: "bg-blue-100 text-blue-700 border-blue-300" },
  { id: "SQL", label: "SQL", color: "bg-green-100 text-green-700 border-green-300" },
  { id: "FLTR", label: "Filter", color: "bg-purple-100 text-purple-700 border-purple-300" },
  { id: "ESCL", label: "Escalation", color: "bg-orange-100 text-orange-700 border-orange-300" },
];

export function TraceFilters({
  filters,
  onFiltersChange,
  onClearFilters,
  totalSpans,
  filteredCount,
  showCriticalPath,
  onToggleCriticalPath,
  compact = false,
}: TraceFiltersProps) {
  const [searchInput, setSearchInput] = useState(filters.searchText);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  // Sync local input with external filter changes (e.g., clear filters)
  useEffect(() => {
    setSearchInput(filters.searchText);
  }, [filters.searchText]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== filters.searchText) {
        onFiltersChange({ searchText: searchInput });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput, filters.searchText, onFiltersChange]);

  useEffect(() => {
    if (!moreOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [moreOpen]);

  const handleLogTypeToggle = useCallback((type: string) => {
    const newLogTypes = new Set(filters.logTypes);
    if (newLogTypes.has(type)) {
      newLogTypes.delete(type);
    } else {
      newLogTypes.add(type);
    }
    onFiltersChange({ logTypes: newLogTypes });
  }, [filters.logTypes, onFiltersChange]);

  const handleErrorsOnlyToggle = useCallback(() => {
    onFiltersChange({ errorsOnly: !filters.errorsOnly });
  }, [filters.errorsOnly, onFiltersChange]);

  const handleMinDurationChange = useCallback((value: string) => {
    const num = parseInt(value, 10);
    onFiltersChange({ minDurationMs: isNaN(num) || num <= 0 ? null : num });
  }, [onFiltersChange]);

  const activeFilterCount =
    (filters.searchText ? 1 : 0) +
    (filters.logTypes.size < LOG_TYPES.length ? LOG_TYPES.length - filters.logTypes.size : 0) +
    (filters.errorsOnly ? 1 : 0) +
    (filters.minDurationMs !== null ? 1 : 0);

  const isFiltered = activeFilterCount > 0;

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search spans..."
            className="w-36 pl-7 pr-2 py-1 border rounded text-xs bg-background focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
          {searchInput && (
            <button
              onClick={() => setSearchInput("")}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 hover:bg-muted rounded"
            >
              <X className="w-2.5 h-2.5 text-muted-foreground" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-0.5">
          {LOG_TYPES.map((type) => {
            const isActive = filters.logTypes.has(type.id);
            return (
              <button
                key={type.id}
                onClick={() => handleLogTypeToggle(type.id)}
                className={`px-1.5 py-0.5 text-[10px] font-medium rounded border transition-colors ${
                  isActive ? type.color : "bg-muted/50 text-muted-foreground border-muted"
                }`}
              >
                {type.label}
              </button>
            );
          })}
        </div>

        <button
          onClick={handleErrorsOnlyToggle}
          className={`px-1.5 py-0.5 text-[10px] font-medium rounded border transition-colors ${
            filters.errorsOnly
              ? "bg-red-100 text-red-700 border-red-300"
              : "bg-muted/50 text-muted-foreground border-muted"
          }`}
        >
          Errors
        </button>

        {isFiltered && (
          <>
            <span className="text-[10px] text-muted-foreground">
              {filteredCount}/{totalSpans}
            </span>
            <button
              onClick={onClearFilters}
              className="flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] text-red-600 hover:bg-red-50 rounded"
            >
              <X className="w-2.5 h-2.5" />
              Clear
            </button>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="border-b bg-card">
      <div className="flex items-center gap-3 p-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search spans..."
            className="w-full pl-8 pr-3 py-1.5 border rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          {searchInput && (
            <button
              onClick={() => setSearchInput("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 hover:bg-muted rounded"
            >
              <X className="w-3 h-3 text-muted-foreground" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1">
          {LOG_TYPES.map((type) => {
            const isActive = filters.logTypes.has(type.id);
            return (
              <button
                key={type.id}
                onClick={() => handleLogTypeToggle(type.id)}
                className={`px-2 py-1 text-xs font-medium rounded border transition-colors ${
                  isActive ? type.color : "bg-muted/50 text-muted-foreground border-muted"
                }`}
              >
                {type.label}
              </button>
            );
          })}
        </div>

        <button
          onClick={handleErrorsOnlyToggle}
          className={`px-2 py-1 text-xs font-medium rounded border transition-colors ${
            filters.errorsOnly
              ? "bg-red-100 text-red-700 border-red-300"
              : "bg-muted/50 text-muted-foreground border-muted"
          }`}
        >
          Errors Only
        </button>

        <button
          onClick={onToggleCriticalPath}
          className={`flex items-center gap-1 px-2 py-1 text-xs font-medium rounded border transition-colors ${
            showCriticalPath
              ? "bg-amber-100 text-amber-700 border-amber-300"
              : "bg-muted/50 text-muted-foreground border-muted"
          }`}
        >
          <Zap className="w-3 h-3" />
          Critical Path
        </button>

        <div className="relative" ref={moreRef}>
          <button
            onClick={() => setMoreOpen(!moreOpen)}
            className="flex items-center gap-1 px-2 py-1 text-xs border rounded hover:bg-muted"
          >
            <Filter className="w-3 h-3" />
            More
            {moreOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
          {moreOpen && (
            <div className="absolute top-full left-0 mt-1 p-3 bg-card border rounded-md shadow-lg z-50 w-56">
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground">Min Duration:</label>
                <input
                  type="number"
                  value={filters.minDurationMs ?? ""}
                  onChange={(e) => handleMinDurationChange(e.target.value)}
                  placeholder="ms"
                  className="w-20 px-2 py-1 border rounded text-sm"
                  min="0"
                />
                <span className="text-xs text-muted-foreground">ms</span>
              </div>
            </div>
          )}
        </div>

        {isFiltered && (
          <>
            <span className="text-xs text-muted-foreground">
              {filteredCount} of {totalSpans}
            </span>
            <button
              onClick={onClearFilters}
              className="flex items-center gap-1 px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded"
            >
              <X className="w-3 h-3" />
              Clear
            </button>
          </>
        )}
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect, useRef } from "react";
import { TransactionSummary } from "@/lib/api";
import { formatDuration } from "@/lib/trace-utils";
import { Search, Clock, Loader2, X } from "lucide-react";

interface TraceSearchProps {
  jobId: string;
  recentTraces: TransactionSummary[];
  onTraceSelected: (traceId: string, jobId: string) => void;
  onSearch: (params: SearchParams) => Promise<TransactionSummary[]>;
}

export interface SearchParams {
  user?: string;
  thread_id?: string;
  trace_id?: string;
}

export function TraceSearch({
  jobId,
  recentTraces,
  onTraceSelected,
  onSearch,
}: TraceSearchProps) {
  const [inputValue, setInputValue] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<TransactionSummary[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const detectInputType = (value: string): SearchParams => {
    const trimmed = value.trim();
    if (!trimmed) return {};

    // UUID format (e.g., 128f7767-e1dc-4af1-8afc-0c00f30203a1)
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidPattern.test(trimmed)) {
      return { trace_id: trimmed };
    }

    // AR Server trace ID format (e.g., NM1Qa_9DTJar1BNKSafi7Q:0000001)
    // Base64url-like prefix + colon + numeric suffix
    if (/^[A-Za-z0-9_-]+:\d+$/.test(trimmed)) {
      return { trace_id: trimmed };
    }

    // Pure digits up to 10 chars — thread ID or RPC ID (e.g., 0000000419)
    if (/^\d+$/.test(trimmed) && trimmed.length <= 10) {
      return { thread_id: trimmed };
    }

    return { user: trimmed };
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    setSelectedIndex(-1);
  };

  const handleFocus = () => {
    setShowDropdown(true);
  };

  const handleSearch = async () => {
    if (!inputValue.trim()) return;

    setIsSearching(true);
    setShowDropdown(true);
    setSearchResults([]);

    try {
      const params = detectInputType(inputValue);
      const results = await onSearch(params);
      setSearchResults(results || []);
    } catch (error) {
      console.error("Search failed:", error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const items = searchResults.length > 0 ? searchResults : recentTraces;
    
    switch (e.key) {
      case "Enter":
        e.preventDefault();
        if (selectedIndex >= 0 && items[selectedIndex]) {
          handleSelectTrace(items[selectedIndex]);
        } else if (inputValue.trim()) {
          handleSearch();
        }
        break;
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, items.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, -1));
        break;
      case "Escape":
        setShowDropdown(false);
        inputRef.current?.blur();
        break;
    }
  };

  const handleSelectTrace = (trace: TransactionSummary) => {
    setInputValue(trace.trace_id);
    setShowDropdown(false);
    setSearchResults([]);
    setSelectedIndex(-1);
    onTraceSelected(trace.trace_id, jobId);
  };

  const renderDropdownItem = (trace: TransactionSummary, index: number, isRecent: boolean) => {
    const isSelected = index === selectedIndex;
    
    return (
      <button
        key={`${trace.trace_id}-${index}`}
        onClick={() => handleSelectTrace(trace)}
        className={`w-full px-3 py-2 text-left hover:bg-muted flex items-center gap-3 ${
          isSelected ? "bg-muted" : ""
        }`}
      >
        {isRecent && (
          <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs truncate">
              {trace.trace_id.slice(0, 16)}...
            </span>
            {trace.error_count > 0 && (
              <span className="px-1 py-0.5 text-[10px] bg-red-100 text-red-700 rounded">
                {trace.error_count} errors
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
            {trace.primary_user && (
              <>
                <span>{trace.primary_user}</span>
                <span>•</span>
              </>
            )}
            <span>{formatDuration(trace.total_duration_ms)}</span>
            <span>•</span>
            <span>{trace.span_count} spans</span>
          </div>
        </div>
      </button>
    );
  };

  const showRecent = inputValue === "" && recentTraces.length > 0;
  const showResults = searchResults.length > 0;
  const showEmpty = !isSearching && inputValue && !showResults && searchResults.length === 0;

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          placeholder="Enter Trace ID, RPC ID, Thread ID, or User..."
          className="w-full pl-10 pr-10 py-2 border rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
        {inputValue && (
          <button
            onClick={() => {
              setInputValue("");
              setSearchResults([]);
              inputRef.current?.focus();
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 hover:bg-muted rounded"
          >
            <X className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        )}
      </div>

      {showDropdown && (showRecent || showResults || showEmpty || isSearching) && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-card border rounded-md shadow-lg z-50 max-h-80 overflow-auto">
          {isSearching && (
            <div className="flex items-center justify-center gap-2 px-4 py-3 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Searching...
            </div>
          )}

          {!isSearching && showRecent && (
            <>
              <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground bg-muted/50 border-b">
                Recent Traces
              </div>
              {recentTraces.map((trace, index) => 
                renderDropdownItem(trace, index, true)
              )}
            </>
          )}

          {!isSearching && showResults && (
            <>
              <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground bg-muted/50 border-b">
                Search Results ({searchResults.length})
              </div>
              {searchResults.map((trace, index) => 
                renderDropdownItem(trace, index, false)
              )}
            </>
          )}

          {!isSearching && showEmpty && (
            <div className="px-4 py-3 text-sm text-muted-foreground text-center">
              No transactions found
            </div>
          )}
        </div>
      )}
    </div>
  );
}

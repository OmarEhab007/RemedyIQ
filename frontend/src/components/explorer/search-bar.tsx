"use client";

import { useState, useRef, useEffect, useCallback, useMemo, RefObject } from "react";
import { getApiHeaders } from "@/lib/api";
import { highlightKQL, TokenType } from "@/lib/kql-tokenizer";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api/v1";

interface AutocompleteField {
  name: string;
  description: string;
}

interface AutocompleteValue {
  value: string;
  count: number;
}

interface AutocompleteResponse {
  fields?: AutocompleteField[];
  values?: AutocompleteValue[];
  is_field: boolean;
}

interface SearchHistoryEntry {
  id: string;
  kql_query: string;
  result_count: number;
  created_at: string;
}

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  jobId?: string;
  inputRef?: RefObject<HTMLInputElement | null>;
}

export function SearchBar({ value, onChange, jobId, inputRef: externalInputRef }: SearchBarProps) {
  const internalInputRef = useRef<HTMLInputElement>(null);
  const inputRef = externalInputRef || internalInputRef;
  const [showDropdown, setShowDropdown] = useState(false);
  const [suggestions, setSuggestions] = useState<AutocompleteResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [cursorPosition, setCursorPosition] = useState(0);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const historyRef = useRef<HTMLDivElement>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<SearchHistoryEntry[]>([]);

  const getPrefix = useCallback((text: string, cursorPos: number): string => {
    const textBeforeCursor = text.substring(0, cursorPos);
    const lastAndIndex = textBeforeCursor.lastIndexOf(" AND ");
    const lastOrIndex = textBeforeCursor.lastIndexOf(" OR ");
    const lastNotIndex = textBeforeCursor.lastIndexOf(" NOT ");
    const lastSpaceIndex = textBeforeCursor.lastIndexOf(" ");
    
    let startIndex = Math.max(lastAndIndex + 5, lastOrIndex + 4, lastNotIndex + 5, lastSpaceIndex + 1);
    if (startIndex < 0) startIndex = 0;
    
    return textBeforeCursor.substring(startIndex);
  }, []);

  const fetchSuggestions = useCallback(async (prefix: string) => {
    if (!prefix || prefix.length < 1) {
      setSuggestions(null);
      setShowDropdown(false);
      return;
    }

    setLoading(true);
    try {
      const params = new URLSearchParams({ prefix });
      if (jobId) params.set("job_id", jobId);

      const res = await fetch(`${API_BASE}/search/autocomplete?${params}`, {
        headers: getApiHeaders(),
      });

      if (res.ok) {
        const data: AutocompleteResponse = await res.json();
        setSuggestions(data);
        setShowDropdown(true);
        setSelectedIndex(0);
      }
    } catch (err) {
      console.error("Autocomplete fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    const newCursorPos = e.target.selectionStart || 0;
    onChange(newValue);
    setCursorPosition(newCursorPos);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      const prefix = getPrefix(newValue, newCursorPos);
      fetchSuggestions(prefix);
    }, 150);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      if (showDropdown) {
        setShowDropdown(false);
        e.preventDefault();
      } else {
        inputRef.current?.blur();
      }
      return;
    }

    if (!showDropdown || !suggestions) return;

    const items = suggestions.is_field ? suggestions.fields : suggestions.values;
    if (!items || items.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      selectItem(items[selectedIndex], suggestions.is_field);
    }
  };

  const selectItem = (item: AutocompleteField | AutocompleteValue, isField: boolean) => {
    const textBeforeCursor = value.substring(0, cursorPosition);
    const textAfterCursor = value.substring(cursorPosition);
    
    const lastAndIndex = textBeforeCursor.lastIndexOf(" AND ");
    const lastOrIndex = textBeforeCursor.lastIndexOf(" OR ");
    const lastNotIndex = textBeforeCursor.lastIndexOf(" NOT ");
    const lastSpaceIndex = textBeforeCursor.lastIndexOf(" ");
    
    let startIndex = Math.max(lastAndIndex + 5, lastOrIndex + 4, lastNotIndex + 5, lastSpaceIndex + 1);
    if (startIndex < 0) startIndex = 0;

    let replacement: string;
    if (isField) {
      const field = item as AutocompleteField;
      replacement = field.name + ":";
    } else {
      const val = item as AutocompleteValue;
      if (val.value.includes(" ") || val.value.includes(":")) {
        replacement = `"${val.value}"`;
      } else {
        replacement = val.value;
      }
    }

    const newValue = value.substring(0, startIndex) + replacement + textAfterCursor;
    onChange(newValue);
    setShowDropdown(false);
    setSuggestions(null);

    setTimeout(() => {
      const newCursorPos = startIndex + replacement.length;
      inputRef.current?.setSelectionRange(newCursorPos, newCursorPos);
      inputRef.current?.focus();
    }, 0);
  };

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (selectedIndex > 0 && dropdownRef.current) {
      const selectedElement = dropdownRef.current.children[selectedIndex] as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: "nearest" });
      }
    }
  }, [selectedIndex]);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/search/history`, {
        headers: getApiHeaders(),
      });
      if (res.ok) {
        const data: SearchHistoryEntry[] = await res.json();
        setHistory(data);
      }
    } catch (err) {
      console.error("Failed to fetch history:", err);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  useEffect(() => {
    if (!showHistory) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (historyRef.current && !historyRef.current.contains(e.target as Node)) {
        setShowHistory(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showHistory]);

  const highlightedTokens = useMemo(() => {
    if (!value) return null;
    return highlightKQL(value);
  }, [value]);

  const getTokenColor = (type: TokenType): string => {
    switch (type) {
      case "field":
        return "text-blue-600 dark:text-blue-400";
      case "operator":
        return "text-orange-600 dark:text-orange-400";
      case "value-string":
        return "text-green-600 dark:text-green-400";
      case "value-number":
        return "text-purple-600 dark:text-purple-400";
      case "keyword":
        return "text-orange-700 dark:text-orange-300 font-semibold";
      case "wildcard":
        return "text-muted-foreground";
      case "error":
        return "text-red-600 dark:text-red-400 underline decoration-wavy";
      default:
        return "text-foreground";
    }
  };

  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <div className="relative">
            {highlightedTokens && (
              <div
                className="absolute inset-0 pl-10 pr-4 py-2 text-sm font-mono whitespace-pre overflow-hidden pointer-events-none"
                aria-hidden="true"
              >
                {highlightedTokens.map((token, i) => (
                  <span key={i} className={getTokenColor(token.type)}>
                    {token.text}
                  </span>
                ))}
              </div>
            )}
            <input
              ref={inputRef}
              type="text"
              value={value}
              onChange={handleInputChange}
              onSelect={(e) => setCursorPosition((e.target as HTMLInputElement).selectionStart || 0)}
              placeholder="Search logs... (e.g. type:API AND duration:>1000)"
              className={`w-full pl-10 pr-4 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 font-mono ${
                highlightedTokens ? "bg-transparent text-transparent caret-foreground" : "bg-background text-foreground"
              }`}
              aria-label="Search logs"
              onKeyDown={handleKeyDown}
              onBlur={() => {
                setTimeout(() => setShowDropdown(false), 200);
              }}
            />
          </div>
          {loading && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="h-4 w-4 border-2 border-muted-foreground border-t-primary rounded-full animate-spin" />
            </div>
          )}
        </div>
        <div className="relative" ref={historyRef}>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="p-2 text-muted-foreground hover:text-foreground border rounded"
            title="Search history"
            aria-expanded={showHistory}
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
          {showHistory && (
            <div className="absolute right-0 top-full mt-1 bg-popover border rounded-md shadow-lg max-h-64 w-72 overflow-y-auto z-50">
              {history.length === 0 ? (
                <div className="px-3 py-2 text-sm text-muted-foreground">No search history</div>
              ) : (
                history.map((entry) => (
                  <button
                    key={entry.id}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-accent"
                    onClick={() => {
                      onChange(entry.kql_query);
                      setShowHistory(false);
                      inputRef.current?.focus();
                    }}
                  >
                    <div className="font-mono truncate text-xs">{entry.kql_query}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {entry.result_count} results • {new Date(entry.created_at).toLocaleDateString()}
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {showDropdown && suggestions && (
        <div
          ref={dropdownRef}
          className="absolute top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-lg max-h-64 overflow-y-auto z-50"
        >
          {suggestions.is_field && suggestions.fields?.map((field, index) => (
            <button
              key={field.name}
              type="button"
              className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-accent ${
                index === selectedIndex ? "bg-accent" : ""
              }`}
              onClick={() => selectItem(field, true)}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <span className="font-mono text-primary font-medium">{field.name}</span>
              <span className="text-muted-foreground text-xs truncate">{field.description}</span>
            </button>
          ))}
          {!suggestions.is_field && suggestions.values?.map((val, index) => (
            <button
              key={val.value}
              type="button"
              className={`w-full px-3 py-2 text-left text-sm flex items-center justify-between gap-2 hover:bg-accent ${
                index === selectedIndex ? "bg-accent" : ""
              }`}
              onClick={() => selectItem(val, false)}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <span className="font-mono truncate">{val.value}</span>
              <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                {val.count.toLocaleString()}
              </span>
            </button>
          ))}
          {((suggestions.is_field && (!suggestions.fields || suggestions.fields.length === 0)) ||
            (!suggestions.is_field && (!suggestions.values || suggestions.values.length === 0))) && (
            <div className="px-3 py-2 text-sm text-muted-foreground">No suggestions</div>
          )}
        </div>
      )}

      {!value && (
        <div className="mt-1.5 flex gap-1.5 flex-wrap items-center">
          <span className="text-[10px] text-muted-foreground/60 mr-0.5">Try:</span>
          {[
            { label: "type:API", desc: "API calls" },
            { label: "type:SQL", desc: "SQL queries" },
            { label: "type:FLTR", desc: "Filters" },
            { label: "type:ESCL", desc: "Escalations" },
            { label: "duration:>1000", desc: "Slow (>1s)" },
            { label: "status:false", desc: "Errors" },
          ].map((hint) => (
            <button
              key={hint.label}
              type="button"
              className="px-1.5 py-0.5 text-[11px] text-muted-foreground border border-border/50 rounded hover:bg-accent hover:text-accent-foreground transition-colors font-mono"
              onClick={() => {
                onChange(hint.label);
                inputRef.current?.focus();
              }}
              title={hint.desc}
            >
              {hint.label}
            </button>
          ))}
        </div>
      )}
      {value && !showDropdown && (
        <div className="mt-1.5 flex gap-1.5 flex-wrap items-center">
          <span className="text-[10px] text-muted-foreground/60 mr-0.5">Refine:</span>
          {[
            { label: "AND duration:>1000", desc: "Add slow filter" },
            { label: "AND NOT status:false", desc: "Exclude errors" },
            { label: "AND type:SQL", desc: "Add SQL type" },
          ].map((hint) => (
            <button
              key={hint.label}
              type="button"
              className="px-1.5 py-0.5 text-[11px] text-muted-foreground border border-border/50 rounded hover:bg-accent hover:text-accent-foreground transition-colors font-mono"
              onClick={() => {
                onChange(`${value} ${hint.label}`);
                inputRef.current?.focus();
              }}
              title={hint.desc}
            >
              + {hint.label.replace("AND ", "")}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

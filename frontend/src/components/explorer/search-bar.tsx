"use client";

import { useRef } from "react";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

export function SearchBar({ value, onChange }: SearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
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
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Search logs... (e.g. type:API AND duration:>1000)"
            className="w-full pl-10 pr-4 py-2 border rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            aria-label="Search logs"
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                inputRef.current?.blur();
              }
            }}
          />
        </div>
      </div>
      <div className="mt-1.5 flex gap-2 flex-wrap">
        {[
          "type:API",
          "duration:>1000",
          'user:"Demo"',
          "form:HPD*",
        ].map((hint) => (
          <button
            key={hint}
            type="button"
            className="px-2 py-0.5 text-xs text-muted-foreground bg-muted rounded hover:bg-muted/80 font-mono"
            onClick={() => {
              const newValue = value ? `${value} AND ${hint}` : hint;
              onChange(newValue);
              inputRef.current?.focus();
            }}
          >
            {hint}
          </button>
        ))}
      </div>
    </div>
  );
}

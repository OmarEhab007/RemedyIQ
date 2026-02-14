"use client";

import { useState, type ReactNode } from "react";

interface CollapsibleSectionProps {
  title: string;
  badge?: string | number;
  defaultOpen?: boolean;
  children: ReactNode;
}

export function CollapsibleSection({
  title,
  badge,
  defaultOpen = false,
  children,
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border rounded-lg bg-card overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-muted-foreground text-sm">
            {isOpen ? "▼" : "▶"}
          </span>
          <h3 className="text-lg font-semibold">{title}</h3>
          {badge !== undefined && badge !== null && (
            <span className="px-2.5 py-0.5 bg-muted text-muted-foreground rounded-full text-xs font-medium">
              {badge}
            </span>
          )}
        </div>
      </button>
      {isOpen && <div className="border-t">{children}</div>}
    </div>
  );
}

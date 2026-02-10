"use client";

import { useState } from "react";
import type { TopNEntry } from "@/lib/api";

interface TopNTableProps {
  apiCalls: TopNEntry[];
  sqlStatements: TopNEntry[];
  filters: TopNEntry[];
  escalations: TopNEntry[];
}

const tabs = [
  { key: "api", label: "API Calls" },
  { key: "sql", label: "SQL" },
  { key: "filters", label: "Filters" },
  { key: "escalations", label: "Escalations" },
] as const;

type TabKey = (typeof tabs)[number]["key"];

export function TopNTable({ apiCalls, sqlStatements, filters, escalations }: TopNTableProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("api");

  const dataMap: Record<TabKey, TopNEntry[]> = {
    api: apiCalls,
    sql: sqlStatements,
    filters: filters,
    escalations: escalations,
  };

  const entries = dataMap[activeTab] || [];

  return (
    <div className="border rounded-lg bg-card">
      <div className="flex border-b">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? "border-b-2 border-primary text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
            <span className="ml-1.5 text-xs text-muted-foreground">
              ({dataMap[tab.key]?.length || 0})
            </span>
          </button>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-2 text-left font-medium">#</th>
              <th className="px-4 py-2 text-left font-medium">Identifier</th>
              {activeTab === "api" && (
                <>
                  <th className="px-4 py-2 text-left font-medium">Form</th>
                  <th className="px-4 py-2 text-left font-medium">User</th>
                  <th className="px-4 py-2 text-left font-medium">Queue</th>
                </>
              )}
              <th className="px-4 py-2 text-right font-medium">Duration (ms)</th>
              <th className="px-4 py-2 text-center font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry, idx) => (
              <tr key={idx} className="border-b hover:bg-muted/30">
                <td className="px-4 py-2 text-muted-foreground">{entry.rank}</td>
                <td className="px-4 py-2 font-mono text-xs">{entry.identifier}</td>
                {activeTab === "api" && (
                  <>
                    <td className="px-4 py-2">{entry.form || "-"}</td>
                    <td className="px-4 py-2">{entry.user || "-"}</td>
                    <td className="px-4 py-2">{entry.queue || "-"}</td>
                  </>
                )}
                <td className="px-4 py-2 text-right font-mono">
                  {entry.duration_ms.toLocaleString()}
                </td>
                <td className="px-4 py-2 text-center">
                  <span
                    className={`inline-block w-2 h-2 rounded-full ${
                      entry.success ? "bg-green-500" : "bg-red-500"
                    }`}
                  />
                </td>
              </tr>
            ))}
            {entries.length === 0 && (
              <tr>
                <td colSpan={activeTab === "api" ? 7 : 4} className="px-4 py-8 text-center text-muted-foreground">
                  No data available
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

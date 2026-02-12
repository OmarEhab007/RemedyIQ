"use client";

import { useState, Fragment } from "react";
import type { TopNEntry } from "@/lib/api";

interface TopNTableProps {
  apiCalls: TopNEntry[];
  sqlStatements: TopNEntry[];
  filters: TopNEntry[];
  escalations: TopNEntry[];
  jobId?: string;
}

interface ParsedDetails {
  thread_id?: string;
  raw_text?: string;
  sql_statement?: string;
  sql_table?: string;
  filter_name?: string;
  filter_level?: number;
  esc_name?: string;
  esc_pool?: string;
  delay_ms?: number;
  error_encountered?: boolean;
}

const tabs = [
  { key: "api", label: "API Calls" },
  { key: "sql", label: "SQL" },
  { key: "filters", label: "Filters" },
  { key: "escalations", label: "Escalations" },
] as const;

type TabKey = (typeof tabs)[number]["key"];

function parseDetails(details?: string): ParsedDetails {
  if (!details) return {};
  try {
    return JSON.parse(details);
  } catch {
    return {};
  }
}

function truncate(str: string, len: number): string {
  if (str.length <= len) return str;
  return str.slice(0, len) + "...";
}

export function TopNTable({ apiCalls, sqlStatements, filters, escalations, jobId }: TopNTableProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("api");
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  const dataMap: Record<TabKey, TopNEntry[]> = {
    api: apiCalls,
    sql: sqlStatements,
    filters: filters,
    escalations: escalations,
  };

  const entries = dataMap[activeTab] || [];

  const toggleRow = (idx: number) => {
    setExpandedRow(expandedRow === idx ? null : idx);
  };

  const getTypeColumns = () => {
    switch (activeTab) {
      case "api":
        return ["Form", "User", "Queue"];
      case "sql":
        return ["Table", "Statement", "Queue Wait"];
      case "filters":
        return ["Filter Name", "Level", "Queue Wait"];
      case "escalations":
        return ["Pool", "Delay (ms)", "Error"];
      default:
        return [];
    }
  };

  const getTypeCells = (entry: TopNEntry) => {
    const d = parseDetails(entry.details);
    switch (activeTab) {
      case "api":
        return [entry.form || "-", entry.user || "-", entry.queue || "-"];
      case "sql":
        return [
          d.sql_table || entry.identifier || "-",
          d.sql_statement ? truncate(d.sql_statement, 60) : "-",
          entry.queue_time_ms?.toLocaleString() || "-",
        ];
      case "filters":
        return [
          d.filter_name || entry.identifier || "-",
          d.filter_level?.toString() || "-",
          entry.queue_time_ms?.toLocaleString() || "-",
        ];
      case "escalations":
        return [
          d.esc_pool || "-",
          d.delay_ms?.toLocaleString() || "-",
          d.error_encountered ? "Yes" : "No",
        ];
      default:
        return [];
    }
  };

  return (
    <div className="border rounded-lg bg-card">
      <div className="flex border-b">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => { setActiveTab(tab.key); setExpandedRow(null); }}
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
              <th className="px-4 py-2 text-left font-medium w-8">#</th>
              <th className="px-4 py-2 text-left font-medium">Identifier</th>
              {getTypeColumns().map((col) => (
                <th key={col} className="px-4 py-2 text-left font-medium">{col}</th>
              ))}
              <th className="px-4 py-2 text-right font-medium">Duration (ms)</th>
              <th className="px-4 py-2 text-center font-medium">Status</th>
              <th className="px-4 py-2 text-center font-medium w-8"></th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry, idx) => (
              <Fragment key={idx}>
                <tr
                  className={`border-b hover:bg-muted/30 cursor-pointer ${
                    expandedRow === idx ? "bg-muted/20" : ""
                  }`}
                  onClick={() => toggleRow(idx)}
                >
                  <td className="px-4 py-2 text-muted-foreground">{entry.rank}</td>
                  <td className="px-4 py-2 font-mono text-xs">{entry.identifier}</td>
                  {getTypeCells(entry).map((cell, ci) => (
                    <td key={ci} className="px-4 py-2 text-xs">{cell}</td>
                  ))}
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
                  <td className="px-4 py-2 text-center text-muted-foreground">
                    {expandedRow === idx ? "▲" : "▼"}
                  </td>
                </tr>
                {expandedRow === idx && (
                  <tr key={`${idx}-detail`} className="border-b bg-muted/10">
                    <td colSpan={getTypeColumns().length + 5} className="px-6 py-3">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                        <div>
                          <span className="text-muted-foreground">Trace ID:</span>{" "}
                          <span className="font-mono">{entry.trace_id || "-"}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">RPC ID:</span>{" "}
                          <span className="font-mono">{entry.rpc_id || "-"}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Thread:</span>{" "}
                          <span className="font-mono">{parseDetails(entry.details).thread_id || "-"}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Line:</span>{" "}
                          {entry.line_number}
                        </div>
                        {parseDetails(entry.details).raw_text && (
                          <div className="col-span-full">
                            <span className="text-muted-foreground">Raw:</span>{" "}
                            <pre className="mt-1 p-2 bg-muted rounded text-xs overflow-x-auto whitespace-pre-wrap">
                              {parseDetails(entry.details).raw_text}
                            </pre>
                          </div>
                        )}
                      </div>
                      {jobId && (
                        <a
                          href={`/explorer?line=${entry.line_number}&job=${jobId}`}
                          className="inline-block mt-2 text-xs text-blue-500 hover:text-blue-400 hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          View in Explorer →
                        </a>
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {entries.length === 0 && (
              <tr>
                <td colSpan={getTypeColumns().length + 5} className="px-4 py-8 text-center text-muted-foreground">
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

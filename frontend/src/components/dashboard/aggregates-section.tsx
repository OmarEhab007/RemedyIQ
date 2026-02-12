"use client";

import { useState } from "react";
import type { AggregatesResponse, AggregateGroup } from "@/lib/api";

interface AggregatesSectionProps {
  data: AggregatesResponse | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

type SortField = "name" | "count" | "error_count" | "min_ms" | "max_ms" | "avg_ms" | "total_ms";
type SortDirection = "asc" | "desc";

export function AggregatesSection({ data, loading, error, refetch }: AggregatesSectionProps) {
  const [activeTab, setActiveTab] = useState<"api" | "sql" | "filter">("api");
  const [sortField, setSortField] = useState<SortField>("count");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const sortGroups = (groups: AggregateGroup[]): AggregateGroup[] => {
    return [...groups].sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      if (sortField === "name") {
        aVal = aVal as string;
        bVal = bVal as string;
        return sortDirection === "asc"
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }

      aVal = aVal as number;
      bVal = bVal as number;
      return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
    });
  };

  if (loading) {
    return (
      <div className="border rounded-lg p-6 bg-card">
        <h3 className="text-lg font-semibold mb-4">Aggregates</h3>
        <div className="animate-pulse space-y-4">
          <div className="h-10 bg-gray-200 rounded"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="border rounded-lg p-6 bg-card">
        <h3 className="text-lg font-semibold mb-4">Aggregates</h3>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800 mb-3">{error}</p>
          <button
            onClick={refetch}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="border rounded-lg p-6 bg-card">
        <h3 className="text-lg font-semibold mb-4">Aggregates</h3>
        <p className="text-muted-foreground">No data available</p>
      </div>
    );
  }

  const currentData = data[activeTab];
  const groups = currentData?.groups ? sortGroups(currentData.groups) : [];
  const grandTotal = currentData?.grand_total;

  const renderHeader = (field: SortField, label: string) => (
    <th
      key={field}
      className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:bg-gray-50"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {label}
        {sortField === field && (
          <span>{sortDirection === "asc" ? "↑" : "↓"}</span>
        )}
      </div>
    </th>
  );

  return (
    <div className="border rounded-lg p-6 bg-card">
      <h3 className="text-lg font-semibold mb-4">Aggregates</h3>

      {/* Tabs */}
      <div className="flex gap-2 mb-4 border-b">
        <button
          onClick={() => setActiveTab("api")}
          className={`px-4 py-2 font-medium text-sm transition-colors ${
            activeTab === "api"
              ? "border-b-2 border-blue-600 text-blue-600"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          API (by Form)
        </button>
        <button
          onClick={() => setActiveTab("sql")}
          className={`px-4 py-2 font-medium text-sm transition-colors ${
            activeTab === "sql"
              ? "border-b-2 border-blue-600 text-blue-600"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          SQL (by Table)
        </button>
        <button
          onClick={() => setActiveTab("filter")}
          className={`px-4 py-2 font-medium text-sm transition-colors ${
            activeTab === "filter"
              ? "border-b-2 border-blue-600 text-blue-600"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Filters (by Name)
        </button>
      </div>

      {/* Table */}
      {groups.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No {activeTab} data available
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {renderHeader("name", "Name")}
                {renderHeader("count", "Count")}
                {renderHeader("error_count", "OK")}
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Fail
                </th>
                {renderHeader("min_ms", "MIN(ms)")}
                {renderHeader("max_ms", "MAX(ms)")}
                {renderHeader("avg_ms", "AVG(ms)")}
                {renderHeader("total_ms", "SUM(ms)")}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {groups.map((group, idx) => (
                <tr key={idx} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-foreground">
                    {group.name}
                  </td>
                  <td className="px-4 py-3 text-sm text-foreground">
                    {group.count.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-sm text-green-600">
                    {(group.count - group.error_count).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-sm text-red-600">
                    {group.error_count.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-sm text-foreground">
                    {group.min_ms.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-sm text-foreground">
                    {group.max_ms.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-sm text-foreground">
                    {group.avg_ms.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-sm text-foreground">
                    {group.total_ms.toFixed(2)}
                  </td>
                </tr>
              ))}
              {grandTotal && (
                <tr className="bg-gray-100 font-bold">
                  <td className="px-4 py-3 text-sm">Grand Total</td>
                  <td className="px-4 py-3 text-sm">
                    {grandTotal.count.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-sm text-green-600">
                    {(grandTotal.count - grandTotal.error_count).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-sm text-red-600">
                    {grandTotal.error_count.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {grandTotal.min_ms.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {grandTotal.max_ms.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {grandTotal.avg_ms.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {grandTotal.total_ms.toFixed(2)}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

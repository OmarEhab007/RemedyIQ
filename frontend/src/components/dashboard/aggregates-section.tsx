"use client";

import React, { useState } from "react";
import type {
  AggregatesResponse,
  AggregateGroup,
  JARAggregatesResponse,
  JARAggregateTable,
  JARAggregateGroup,
  JARAggregateRow
} from "@/lib/api";

interface AggregatesSectionProps {
  data: AggregatesResponse | JARAggregatesResponse | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
  headless?: boolean;
}

type LegacyTab = "api" | "sql" | "filter";
type JARTab = "api_by_form" | "api_by_client" | "api_by_client_ip" | "sql_by_table" | "esc_by_form" | "esc_by_pool";
type SortField = "name" | "count" | "error_count" | "min_ms" | "max_ms" | "avg_ms" | "total_ms";
type SortDirection = "asc" | "desc";

function isJARAggregates(data: any): data is JARAggregatesResponse {
  return data && (data.source === "jar_parsed" || data.source === "computed");
}

export function AggregatesSection({ data, loading, error, refetch, headless }: AggregatesSectionProps) {
  const [legacyActiveTab, setLegacyActiveTab] = useState<LegacyTab>("api");
  const [jarActiveTab, setJarActiveTab] = useState<JARTab>("api_by_form");
  const [sortField, setSortField] = useState<SortField>("count");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [showAllGroups, setShowAllGroups] = useState(false);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const toggleGroup = (groupName: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupName)) {
      newExpanded.delete(groupName);
    } else {
      newExpanded.add(groupName);
    }
    setExpandedGroups(newExpanded);
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
      <div className={headless ? "" : "border rounded-lg p-6 bg-card"}>
        {!headless && <h3 className="text-lg font-semibold mb-4">Aggregates</h3>}
        <div className="animate-pulse space-y-4">
          <div className="h-10 bg-muted rounded"></div>
          <div className="h-64 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={headless ? "" : "border rounded-lg p-6 bg-card"}>
        {!headless && <h3 className="text-lg font-semibold mb-4">Aggregates</h3>}
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
          <p className="text-destructive mb-3">{error}</p>
          <button
            onClick={refetch}
            className="px-4 py-2 bg-destructive text-white rounded-lg hover:bg-destructive/90"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className={headless ? "" : "border rounded-lg p-6 bg-card"}>
        {!headless && <h3 className="text-lg font-semibold mb-4">Aggregates</h3>}
        <p className="text-muted-foreground">No data available</p>
      </div>
    );
  }

  const isJAR = isJARAggregates(data);

  // Render JAR aggregates
  if (isJAR) {
    const jarData = data as JARAggregatesResponse;

    const allTabs: Array<{ key: JARTab; label: string; data?: JARAggregateTable }> = [
      { key: "api_by_form", label: "By Form", data: jarData.api_by_form },
      { key: "api_by_client", label: "By Client", data: jarData.api_by_client },
      { key: "api_by_client_ip", label: "By Client IP", data: jarData.api_by_client_ip },
      { key: "sql_by_table", label: "By Table", data: jarData.sql_by_table },
      { key: "esc_by_form", label: "By Esc Form", data: jarData.esc_by_form },
      { key: "esc_by_pool", label: "By Esc Pool", data: jarData.esc_by_pool },
    ];
    const availableTabs = allTabs.filter(tab => tab.data != null);

    // If the active tab has no data, fall back to the first available tab
    const effectiveTab = jarData[jarActiveTab] != null ? jarActiveTab : (availableTabs[0]?.key ?? jarActiveTab);
    const currentTable = jarData[effectiveTab];
    const showBanner = jarData.source === "computed";

    return (
      <div className={headless ? "" : "border rounded-lg p-6 bg-card"}>
        {!headless && <h3 className="text-lg font-semibold mb-4">Aggregates</h3>}

        {showBanner && (
          <div className="mb-4 bg-muted border border-border rounded-lg p-3 text-sm text-muted-foreground">
            <span className="font-medium">Info:</span> Showing computed data. Re-analyze for full JAR-native details.
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-4 border-b overflow-x-auto">
          {availableTabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setJarActiveTab(tab.key)}
              className={`px-4 py-2 font-medium text-sm transition-colors whitespace-nowrap ${
                effectiveTab === tab.key
                  ? "border-b-2 border-primary text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* JAR Table */}
        {!currentTable || currentTable.groups.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No data available for this view
          </div>
        ) : (
          <>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-muted">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Entity Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Operation Type
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    OK
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Fail
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Total
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    MIN Time
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    MAX Time
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    AVG Time
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    SUM Time
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(showAllGroups ? currentTable.groups : currentTable.groups.slice(0, 20)).map((group) => {
                  const isExpanded = expandedGroups.has(group.entity_name);
                  return (
                    <React.Fragment key={group.entity_name}>
                      {/* Entity group row (clickable to expand) — shows subtotal summary */}
                      <tr
                        className="hover:bg-muted/60 cursor-pointer font-medium bg-muted/30"
                        onClick={() => toggleGroup(group.entity_name)}
                      >
                        <td className="px-4 py-3 text-sm text-foreground">
                          <span className="inline-block w-4">{isExpanded ? "▼" : "▶"}</span> {group.entity_name}
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {group.rows.length} op(s)
                        </td>
                        {group.subtotal ? (
                          <>
                            <td className="px-4 py-3 text-sm text-emerald-600">{group.subtotal.ok.toLocaleString()}</td>
                            <td className="px-4 py-3 text-sm text-destructive">{group.subtotal.fail.toLocaleString()}</td>
                            <td className="px-4 py-3 text-sm text-foreground">{group.subtotal.total.toLocaleString()}</td>
                            <td className="px-4 py-3 text-sm text-foreground">{group.subtotal.min_time.toFixed(2)}</td>
                            <td className="px-4 py-3 text-sm text-foreground">{group.subtotal.max_time.toFixed(2)}</td>
                            <td className="px-4 py-3 text-sm text-foreground">{group.subtotal.avg_time.toFixed(2)}</td>
                            <td className="px-4 py-3 text-sm text-foreground">{group.subtotal.sum_time.toFixed(2)}</td>
                          </>
                        ) : (
                          <td colSpan={7} />
                        )}
                      </tr>

                      {/* Expanded operation rows */}
                      {isExpanded && group.rows.map((row, idx) => (
                        <tr key={`${group.entity_name}-${idx}`} className="hover:bg-muted/40 text-sm">
                          <td className="px-4 py-2 pl-12 text-muted-foreground"></td>
                          <td className="px-4 py-2 text-foreground">{row.operation_type}</td>
                          <td className="px-4 py-2 text-emerald-600">{row.ok.toLocaleString()}</td>
                          <td className="px-4 py-2 text-destructive">{row.fail.toLocaleString()}</td>
                          <td className="px-4 py-2 text-foreground">{row.total.toLocaleString()}</td>
                          <td className="px-4 py-2 text-foreground">{row.min_time.toFixed(2)}</td>
                          <td className="px-4 py-2 text-foreground">{row.max_time.toFixed(2)}</td>
                          <td className="px-4 py-2 text-foreground">{row.avg_time.toFixed(2)}</td>
                          <td className="px-4 py-2 text-foreground">{row.sum_time.toFixed(2)}</td>
                        </tr>
                      ))}

                      {/* Subtotal row */}
                      {isExpanded && group.subtotal && (
                        <tr className="bg-muted/50 font-semibold text-sm">
                          <td className="px-4 py-2 pl-12 text-foreground">Subtotal</td>
                          <td className="px-4 py-2 text-muted-foreground">-</td>
                          <td className="px-4 py-2 text-emerald-600">{group.subtotal.ok.toLocaleString()}</td>
                          <td className="px-4 py-2 text-destructive">{group.subtotal.fail.toLocaleString()}</td>
                          <td className="px-4 py-2 text-foreground">{group.subtotal.total.toLocaleString()}</td>
                          <td className="px-4 py-2 text-foreground">{group.subtotal.min_time.toFixed(2)}</td>
                          <td className="px-4 py-2 text-foreground">{group.subtotal.max_time.toFixed(2)}</td>
                          <td className="px-4 py-2 text-foreground">{group.subtotal.avg_time.toFixed(2)}</td>
                          <td className="px-4 py-2 text-foreground">{group.subtotal.sum_time.toFixed(2)}</td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}

                {/* Grand total row */}
                {currentTable.grand_total && (
                  <tr className="bg-muted font-bold">
                    <td className="px-4 py-3 text-sm">Grand Total</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">-</td>
                    <td className="px-4 py-3 text-sm text-emerald-600">
                      {currentTable.grand_total.ok.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-destructive">
                      {currentTable.grand_total.fail.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {currentTable.grand_total.total.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {currentTable.grand_total.min_time.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {currentTable.grand_total.max_time.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {currentTable.grand_total.avg_time.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {currentTable.grand_total.sum_time.toFixed(2)}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {currentTable.groups.length > 20 && (
            <div className="mt-3 text-center">
              <button
                onClick={() => setShowAllGroups(!showAllGroups)}
                className="px-4 py-2 text-sm text-primary hover:text-primary/80 font-medium"
              >
                {showAllGroups
                  ? "Show less"
                  : `Show all ${currentTable.groups.length} groups (${currentTable.groups.length - 20} more)`}
              </button>
            </div>
          )}
          </>
        )}
      </div>
    );
  }

  // Render legacy aggregates
  const legacyData = data as AggregatesResponse;
  const currentData = legacyData[legacyActiveTab];
  const groups = currentData?.groups ? sortGroups(currentData.groups) : [];
  const grandTotal = currentData?.grand_total;

  const renderHeader = (field: SortField, label: string) => (
    <th
      key={field}
      className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:bg-muted/60"
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
    <div className={headless ? "" : "border rounded-lg p-6 bg-card"}>
      {!headless && <h3 className="text-lg font-semibold mb-4">Aggregates</h3>}

      {/* Tabs */}
      <div className="flex gap-2 mb-4 border-b">
        <button
          onClick={() => setLegacyActiveTab("api")}
          className={`px-4 py-2 font-medium text-sm transition-colors ${
            legacyActiveTab === "api"
              ? "border-b-2 border-primary text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          API (by Form)
        </button>
        <button
          onClick={() => setLegacyActiveTab("sql")}
          className={`px-4 py-2 font-medium text-sm transition-colors ${
            legacyActiveTab === "sql"
              ? "border-b-2 border-primary text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          SQL (by Table)
        </button>
        <button
          onClick={() => setLegacyActiveTab("filter")}
          className={`px-4 py-2 font-medium text-sm transition-colors ${
            legacyActiveTab === "filter"
              ? "border-b-2 border-primary text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Filters (by Name)
        </button>
      </div>

      {/* Table */}
      {groups.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No {legacyActiveTab} data available
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-muted">
              <tr>
                {renderHeader("name", "Name")}
                {renderHeader("count", "Count")}
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  OK
                </th>
                {renderHeader("error_count", "Errors")}
                {renderHeader("min_ms", "MIN(ms)")}
                {renderHeader("max_ms", "MAX(ms)")}
                {renderHeader("avg_ms", "AVG(ms)")}
                {renderHeader("total_ms", "SUM(ms)")}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {groups.map((group) => (
                <tr key={group.name} className="hover:bg-muted/60">
                  <td className="px-4 py-3 text-sm font-medium text-foreground">
                    {group.name}
                  </td>
                  <td className="px-4 py-3 text-sm text-foreground">
                    {group.count.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-sm text-emerald-600">
                    {(group.count - group.error_count).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-sm text-destructive">
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
                <tr className="bg-muted font-bold">
                  <td className="px-4 py-3 text-sm">Grand Total</td>
                  <td className="px-4 py-3 text-sm">
                    {grandTotal.count.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-sm text-emerald-600">
                    {(grandTotal.count - grandTotal.error_count).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-sm text-destructive">
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

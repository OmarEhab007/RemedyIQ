"use client";

import { useState } from "react";
import type {
  FilterComplexityResponse,
  MostExecutedFilter,
  FilterPerTransaction,
} from "@/lib/api";

interface FiltersSectionProps {
  data: FilterComplexityResponse | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function FiltersSection({ data, loading, error, refetch }: FiltersSectionProps) {
  const [activeTab, setActiveTab] = useState<"most_executed" | "per_transaction">(
    "most_executed"
  );

  if (loading) {
    return (
      <div className="border rounded-lg p-6 bg-card">
        <h3 className="text-lg font-semibold mb-4">Filter Complexity</h3>
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
        <h3 className="text-lg font-semibold mb-4">Filter Complexity</h3>
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

  if (
    !data ||
    (data.most_executed.length === 0 && data.per_transaction.length === 0)
  ) {
    return (
      <div className="border rounded-lg p-6 bg-card">
        <h3 className="text-lg font-semibold mb-4">Filter Complexity</h3>
        <div className="text-center py-8 text-muted-foreground">
          No filter activity detected
        </div>
      </div>
    );
  }

  const { most_executed, per_transaction, total_filter_time_ms } = data;

  return (
    <div className="border rounded-lg p-6 bg-card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Filter Complexity</h3>
        <div className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm font-medium">
          Total: {total_filter_time_ms.toFixed(2)} ms
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4 border-b">
        <button
          onClick={() => setActiveTab("most_executed")}
          className={`px-4 py-2 font-medium text-sm transition-colors ${
            activeTab === "most_executed"
              ? "border-b-2 border-blue-600 text-blue-600"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Most Executed
        </button>
        <button
          onClick={() => setActiveTab("per_transaction")}
          className={`px-4 py-2 font-medium text-sm transition-colors ${
            activeTab === "per_transaction"
              ? "border-b-2 border-blue-600 text-blue-600"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Per Transaction
        </button>
      </div>

      {/* Most Executed Tab */}
      {activeTab === "most_executed" && (
        <div className="overflow-x-auto">
          {most_executed.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No data available
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Rank
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Filter Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Count
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Total Time(ms)
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {most_executed.map((filter: MostExecutedFilter, idx: number) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-foreground">{idx + 1}</td>
                    <td className="px-4 py-3 text-sm font-medium text-foreground">
                      {filter.name}
                    </td>
                    <td className="px-4 py-3 text-sm text-foreground">
                      {filter.count.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-foreground">
                      {filter.total_ms.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Per Transaction Tab */}
      {activeTab === "per_transaction" && (
        <div className="overflow-x-auto">
          {per_transaction.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No data available
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Transaction ID
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Filter Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Count
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Total(ms)
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Avg(ms)
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Max(ms)
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {per_transaction.map((txn: FilterPerTransaction, idx: number) => {
                  const isHighExecution = txn.execution_count > 100;
                  return (
                    <tr
                      key={idx}
                      className={`hover:bg-gray-50 ${
                        isHighExecution ? "bg-amber-50" : ""
                      }`}
                    >
                      <td className="px-4 py-3 text-sm font-mono text-foreground">
                        {txn.transaction_id}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-foreground">
                        {txn.filter_name}
                      </td>
                      <td
                        className={`px-4 py-3 text-sm ${
                          isHighExecution
                            ? "font-bold text-amber-700"
                            : "text-foreground"
                        }`}
                      >
                        {txn.execution_count.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground">
                        {txn.total_ms.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground">
                        {txn.avg_ms.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground">
                        {txn.max_ms.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

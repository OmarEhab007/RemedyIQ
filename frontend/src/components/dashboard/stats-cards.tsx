"use client";

import type { GeneralStats } from "@/lib/api";

interface StatsCardsProps {
  stats: GeneralStats;
}

function formatNumber(n: number): string {
  return n.toLocaleString();
}

export function StatsCards({ stats }: StatsCardsProps) {
  const cards = [
    { label: "API Calls", value: stats.api_count, color: "text-blue-600" },
    { label: "SQL Operations", value: stats.sql_count, color: "text-green-600" },
    { label: "Filter Executions", value: stats.filter_count, color: "text-purple-600" },
    { label: "Escalations", value: stats.esc_count, color: "text-orange-600" },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <div key={card.label} className="border rounded-lg p-4 bg-card">
          <p className="text-sm text-muted-foreground">{card.label}</p>
          <p className={`text-2xl font-bold mt-1 ${card.color}`}>
            {formatNumber(card.value)}
          </p>
        </div>
      ))}

      <div className="border rounded-lg p-4 bg-card">
        <p className="text-sm text-muted-foreground">Total Lines</p>
        <p className="text-2xl font-bold mt-1">{formatNumber(stats.total_lines)}</p>
      </div>
      <div className="border rounded-lg p-4 bg-card">
        <p className="text-sm text-muted-foreground">Unique Users</p>
        <p className="text-2xl font-bold mt-1">{stats.unique_users}</p>
      </div>
      <div className="border rounded-lg p-4 bg-card">
        <p className="text-sm text-muted-foreground">Unique Forms</p>
        <p className="text-2xl font-bold mt-1">{stats.unique_forms}</p>
      </div>
      <div className="border rounded-lg p-4 bg-card">
        <p className="text-sm text-muted-foreground">Duration</p>
        <p className="text-lg font-bold mt-1">{stats.log_duration}</p>
      </div>
    </div>
  );
}

"use client";

import type { HealthScore, HealthScoreFactor } from "@/lib/api";

interface HealthScoreCardProps {
  healthScore: HealthScore | null | undefined;
}

export function HealthScoreCard({ healthScore }: HealthScoreCardProps) {
  if (!healthScore) {
    return null;
  }

  const { score, status, factors } = healthScore;

  // Determine color based on score
  const getScoreColor = (score: number): string => {
    if (score > 80) return "stroke-green-500 text-green-600";
    if (score >= 50) return "stroke-yellow-500 text-yellow-600";
    return "stroke-red-500 text-red-600";
  };

  const scoreColor = getScoreColor(score);

  // SVG circle parameters
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <div className="border rounded-lg p-6 bg-card">
      <h3 className="text-lg font-semibold mb-6">System Health Score</h3>

      {/* Circular Score Indicator */}
      <div className="flex justify-center mb-8">
        <div className="relative">
          <svg width="180" height="180" className="transform -rotate-90">
            {/* Background circle */}
            <circle
              cx="90"
              cy="90"
              r={radius}
              fill="none"
              stroke="#e5e7eb"
              strokeWidth="12"
            />
            {/* Progress circle */}
            <circle
              cx="90"
              cy="90"
              r={radius}
              fill="none"
              className={scoreColor.split(" ")[0]}
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              style={{ transition: "stroke-dashoffset 0.5s ease" }}
            />
          </svg>
          {/* Score text in center */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-4xl font-bold ${scoreColor.split(" ")[1]}`}>
              {Math.round(score)}
            </span>
            <span className="text-sm text-muted-foreground capitalize">
              {status}
            </span>
          </div>
        </div>
      </div>

      {/* Factor Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {factors.map((factor: HealthScoreFactor) => {
          const isRedZone = factor.severity === "red";
          return (
            <div
              key={factor.name}
              className={`border rounded-lg p-4 ${
                isRedZone ? "border-red-500 bg-red-50" : "bg-card"
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <h4 className="font-medium text-sm">{factor.name}</h4>
                {isRedZone && (
                  <svg
                    className="w-5 h-5 text-red-500 flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                )}
              </div>
              <div className="flex items-baseline gap-2 mb-2">
                <span
                  className={`text-xl font-bold ${
                    isRedZone ? "text-red-600" : "text-foreground"
                  }`}
                >
                  {factor.score}
                </span>
                <span className="text-sm text-muted-foreground">
                  / {factor.max_score}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {factor.description}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

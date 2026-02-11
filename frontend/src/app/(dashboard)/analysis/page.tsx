"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { listAnalyses, type AnalysisJob } from "@/lib/api";

const statusStyles: Record<string, string> = {
  queued: "bg-muted text-muted-foreground",
  parsing: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  analyzing: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  storing: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  complete: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  failed: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${statusStyles[status] || "bg-muted text-muted-foreground"}`}>
      {status}
    </span>
  );
}

function formatDate(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleString();
  } catch {
    return dateStr;
  }
}

export default function AnalysesPage() {
  const [jobs, setJobs] = useState<AnalysisJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchJobs() {
      try {
        const data = await listAnalyses();
        setJobs(data.jobs || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load analyses");
      } finally {
        setLoading(false);
      }
    }
    fetchJobs();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading analyses...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-destructive/10 text-destructive rounded-md">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Analyses</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {jobs.length} analysis job{jobs.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Link
          href="/upload"
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          New Analysis
        </Link>
      </div>

      {jobs.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>No analyses yet.</p>
          <Link href="/upload" className="text-primary hover:underline mt-2 inline-block">
            Upload a log file to get started
          </Link>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b">
                <th className="text-left px-4 py-3 font-medium">Job ID</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-left px-4 py-3 font-medium">Progress</th>
                <th className="text-left px-4 py-3 font-medium">Created</th>
                <th className="text-left px-4 py-3 font-medium">Completed</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    {job.status === "complete" ? (
                      <Link href={`/analysis/${job.id}`} className="text-primary hover:underline font-mono text-xs">
                        {job.id.slice(0, 8)}...
                      </Link>
                    ) : (
                      <span className="font-mono text-xs text-muted-foreground">{job.id.slice(0, 8)}...</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={job.status} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${job.status === "failed" ? "bg-destructive" : "bg-primary"}`}
                          style={{ width: `${job.progress_pct}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground">{job.progress_pct}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {formatDate(job.created_at)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {job.completed_at ? formatDate(job.completed_at) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { listAnalyses, type AnalysisJob } from "@/lib/api";

const statusColors: Record<string, string> = {
  queued: "bg-yellow-100 text-yellow-800",
  parsing: "bg-blue-100 text-blue-800",
  analyzing: "bg-blue-100 text-blue-800",
  storing: "bg-blue-100 text-blue-800",
  complete: "bg-green-100 text-green-800",
  failed: "bg-red-100 text-red-800",
};

export default function DashboardPage() {
  const [jobs, setJobs] = useState<AnalysisJob[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchJobs() {
      try {
        const data = await listAnalyses();
        setJobs(data.jobs || []);
      } catch {
        // Silently fail — the API may not be running yet.
      } finally {
        setLoading(false);
      }
    }
    fetchJobs();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Recent analysis jobs
          </p>
        </div>
        <Link
          href="/upload"
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          Upload New
        </Link>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      ) : jobs.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed rounded-lg">
          <p className="text-muted-foreground">No analysis jobs yet.</p>
          <Link href="/upload" className="text-primary text-sm mt-2 inline-block hover:underline">
            Upload your first log file
          </Link>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">Job ID</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Progress</th>
                <th className="px-4 py-3 text-right font-medium">API</th>
                <th className="px-4 py-3 text-right font-medium">SQL</th>
                <th className="px-4 py-3 text-left font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.id} className="border-b hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <Link
                      href={`/analysis/${job.id}`}
                      className="font-mono text-xs text-primary hover:underline"
                    >
                      {job.id.slice(0, 8)}...
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                        statusColors[job.status] || "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {job.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">{job.progress_pct}%</td>
                  <td className="px-4 py-3 text-right font-mono">
                    {job.api_count?.toLocaleString() ?? "-"}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    {job.sql_count?.toLocaleString() ?? "-"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(job.created_at).toLocaleDateString()}
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

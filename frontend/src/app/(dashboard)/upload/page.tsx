"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Dropzone } from "@/components/upload/dropzone";
import { ProgressTracker } from "@/components/upload/progress-tracker";
import { uploadFile, createAnalysis } from "@/lib/api";
import { useAnalysisProgress } from "@/hooks/use-analysis";

export default function UploadPage() {
  const router = useRouter();
  const [uploadStatus, setUploadStatus] = useState<"idle" | "uploading" | "uploaded" | "analyzing">("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [fileId, setFileId] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { job } = useAnalysisProgress(jobId);

  const handleFileSelected = async (file: File) => {
    setError(null);
    setUploadStatus("uploading");
    setUploadProgress(0);

    try {
      const logFile = await uploadFile(file, undefined, (pct) => {
        setUploadProgress(pct);
      });
      setUploadProgress(100);
      setFileId(logFile.id);
      setUploadStatus("uploaded");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setUploadStatus("idle");
      setUploadProgress(0);
    }
  };

  const handleStartAnalysis = async () => {
    if (!fileId) return;
    setError(null);
    setUploadStatus("analyzing");

    try {
      const analysisJob = await createAnalysis(fileId);
      setJobId(analysisJob.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start analysis");
      setUploadStatus("uploaded");
    }
  };

  // Navigate to dashboard when complete or show error when failed
  useEffect(() => {
    if (job?.status === "complete" && jobId) {
      router.push(`/analysis/${jobId}`);
    } else if (job?.status === "failed") {
      setError(job.error_message || "Analysis failed");
      setUploadStatus("uploaded");
    }
  }, [job?.status, job?.error_message, jobId, router]);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Upload Log Files</h1>
        <p className="text-muted-foreground mt-1">
          Upload AR Server log files to start analysis.
        </p>
      </div>

      <Dropzone
        onFileSelected={handleFileSelected}
        disabled={uploadStatus !== "idle"}
      />

      {uploadStatus === "uploading" && (
        <ProgressTracker status="uploading" progressPct={uploadProgress} />
      )}

      {uploadStatus === "uploaded" && (
        <div className="space-y-4">
          <ProgressTracker status="uploaded" progressPct={100} message="File uploaded successfully" />
          <button
            onClick={handleStartAnalysis}
            className="w-full py-2.5 px-4 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 transition-colors"
          >
            Start Analysis
          </button>
        </div>
      )}

      {uploadStatus === "analyzing" && job && (
        <ProgressTracker
          status={job.status}
          progressPct={job.progress_pct}
        />
      )}

      {uploadStatus === "analyzing" && !job && (
        <ProgressTracker status="queued" progressPct={0} />
      )}

      {error && (
        <div className="p-4 bg-destructive/10 text-destructive rounded-md text-sm">
          {error}
        </div>
      )}
    </div>
  );
}

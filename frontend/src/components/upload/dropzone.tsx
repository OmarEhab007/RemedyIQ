"use client";

import { useState, useCallback, type DragEvent } from "react";

interface DropzoneProps {
  onFileSelected: (file: File) => void;
  disabled?: boolean;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

const MAX_SIZE = 2 * 1024 * 1024 * 1024; // 2 GB

export function Dropzone({ onFileSelected, disabled }: DropzoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFile = useCallback(
    (file: File) => {
      setError(null);
      if (file.size > MAX_SIZE) {
        setError(`File exceeds 2GB limit (${formatFileSize(file.size)})`);
        return;
      }
      setSelectedFile(file);
      onFileSelected(file);
    },
    [onFileSelected],
  );

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  return (
    <div>
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors cursor-pointer ${
          isDragOver
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-primary/50"
        } ${disabled ? "opacity-50 pointer-events-none" : ""}`}
        onClick={() => {
          if (disabled) return;
          const input = document.createElement("input");
          input.type = "file";
          input.accept = ".log,.txt";
          input.onchange = (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (file) handleFile(file);
          };
          input.click();
        }}
      >
        <svg
          className="mx-auto w-12 h-12 text-muted-foreground mb-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
          />
        </svg>
        <p className="text-lg font-medium">
          {selectedFile ? selectedFile.name : "Drop your log file here"}
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          {selectedFile
            ? formatFileSize(selectedFile.size)
            : "AR Server log files (.log, .txt) up to 2GB"}
        </p>
        {!selectedFile && (
          <p className="text-xs text-muted-foreground mt-3">
            Supports: arapi, arsql, arfilter, aresc logs
          </p>
        )}
      </div>
      {error && (
        <p className="text-destructive text-sm mt-2">{error}</p>
      )}
    </div>
  );
}

"use client";

import { useRef, useCallback } from "react";
import { cn } from "@/lib/utils";

interface ChatInputProps {
  onSend: (query: string) => void;
  onStop?: () => void;
  disabled?: boolean;
  isStreaming?: boolean;
  placeholder?: string;
}

export function ChatInput({ onSend, onStop, disabled, isStreaming, placeholder }: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = useCallback(() => {
    const query = textareaRef.current?.value.trim();
    if (query && !disabled && !isStreaming) {
      onSend(query);
      if (textareaRef.current) {
        textareaRef.current.value = "";
        textareaRef.current.style.height = "auto";
      }
    }
  }, [onSend, disabled, isStreaming]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
      if (e.key === "Escape" && isStreaming) {
        onStop?.();
      }
    },
    [handleSubmit, isStreaming, onStop]
  );

  const handleInput = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const target = e.target;
    target.style.height = "auto";
    target.style.height = `${Math.min(target.scrollHeight, 200)}px`;
  }, []);

  return (
    <div className="flex items-end gap-2 p-4 border-t bg-background">
      <textarea
        ref={textareaRef}
        placeholder={placeholder || "Ask a question about your logs..."}
        disabled={disabled}
        onKeyDown={handleKeyDown}
        onChange={handleInput}
        rows={1}
        className={cn(
          "flex-1 resize-none rounded-lg border bg-background px-3 py-2 text-sm",
          "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
          "placeholder:text-muted-foreground",
          "disabled:opacity-50 disabled:cursor-not-allowed"
        )}
      />

      {isStreaming ? (
        <button
          onClick={() => onStop?.()}
          disabled={!onStop}
          className={cn(
            "px-4 py-2 rounded-lg text-sm font-medium",
            "bg-destructive text-destructive-foreground",
            "hover:bg-destructive/90 transition-colors",
            "disabled:opacity-50 disabled:cursor-not-allowed"
          )}
        >
          Stop
        </button>
      ) : (
        <button
          onClick={handleSubmit}
          disabled={disabled}
          className={cn(
            "px-4 py-2 rounded-lg text-sm font-medium",
            "bg-primary text-primary-foreground",
            "hover:bg-primary/90 transition-colors",
            "disabled:opacity-50 disabled:cursor-not-allowed"
          )}
        >
          Send
        </button>
      )}
    </div>
  );
}

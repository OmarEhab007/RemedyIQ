"use client";

import { useEffect, useRef } from "react";
import { Streamdown } from "streamdown";
import type { Message } from "@/lib/ai-types";
import { cn } from "@/lib/utils";

interface MessageViewProps {
  message: Message;
  isStreaming?: boolean;
  onFollowUpClick?: (query: string) => void;
}

const skillColors: Record<string, string> = {
  performance: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  root_cause: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  error_explainer: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  anomaly_narrator: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  summarizer: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  nl_query: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
};

export function MessageView({ message, isStreaming, onFollowUpClick }: MessageViewProps) {
  const isUser = message.role === "user";
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isStreaming && scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [message.content, isStreaming]);

  return (
    <div className={cn("flex w-full", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-lg px-4 py-3",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-card border"
        )}
      >
        {!isUser && message.skill_name && (
          <div className="mb-2">
            <span
              className={cn(
                "inline-block px-2 py-0.5 text-xs font-medium rounded",
                skillColors[message.skill_name] || skillColors.nl_query
              )}
            >
              {message.skill_name.replace("_", " ")}
            </span>
          </div>
        )}

        <div ref={scrollRef} className="prose prose-sm dark:prose-invert max-w-none">
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <Streamdown>{message.content}</Streamdown>
          )}
          {isStreaming && <span className="animate-pulse">▊</span>}
        </div>

        {!isUser && !isStreaming && message.status === "complete" && (
          <div className="mt-3 pt-3 border-t border-border/50">
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {message.tokens_used && <span>{message.tokens_used} tokens</span>}
              {message.latency_ms && <span>{message.latency_ms}ms</span>}
            </div>

            {message.follow_ups && message.follow_ups.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {message.follow_ups.map((followUp, i) => (
                  <button
                    key={i}
                    onClick={() => onFollowUpClick?.(followUp)}
                    className="px-2 py-1 text-xs bg-muted hover:bg-muted/80 rounded transition-colors"
                  >
                    {followUp}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {message.status === "error" && message.error_message && (
          <div className="mt-2 text-sm text-destructive">
            {message.error_message}
          </div>
        )}
      </div>
    </div>
  );
}

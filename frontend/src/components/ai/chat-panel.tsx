"use client";

import { useState, useRef, useEffect } from "react";
import { Streamdown } from "streamdown";
import type { Message, StreamState } from "@/lib/ai-types";
import { cn } from "@/lib/utils";

interface ChatPanelProps {
  messages: Message[];
  streamState: StreamState;
  onSend: (message: string) => void;
  onStop: () => void;
}

const skillColors: Record<string, string> = {
  performance: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  root_cause: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  error_explainer: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  anomaly_narrator: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  summarizer: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  nl_query: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
};

export function ChatPanel({ messages, streamState, onSend, onStop }: ChatPanelProps) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamState.content]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || streamState.isStreaming) return;
    onSend(input.trim());
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape" && streamState.isStreaming) {
      onStop();
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && !streamState.isStreaming && (
          <div className="text-center text-muted-foreground text-sm py-12">
            Ask a question about your log analysis
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
            <div className={cn("max-w-[80%] rounded-lg px-4 py-2", msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted")}>
              {msg.role !== "user" && msg.skill_name && (
                <div className="mb-1">
                  <span className={cn("inline-block px-2 py-0.5 text-xs font-medium rounded", skillColors[msg.skill_name] || skillColors.nl_query)}>
                    {msg.skill_name.replace("_", " ")}
                  </span>
                </div>
              )}
              <div className="prose prose-sm dark:prose-invert max-w-none">
                {msg.role === "user" ? (
                  <p className="whitespace-pre-wrap m-0">{msg.content}</p>
                ) : (
                  <Streamdown>{msg.content}</Streamdown>
                )}
              </div>
              {msg.follow_ups && msg.follow_ups.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {msg.follow_ups.map((q, i) => (
                    <button key={i} className="text-xs px-2 py-1 bg-muted/50 hover:bg-muted rounded" onClick={() => onSend(q)} disabled={streamState.isStreaming}>
                      {q}
                    </button>
                  ))}
                </div>
              )}
              {msg.role === "assistant" && msg.latency_ms != null && msg.tokens_used != null && (
                <div className="mt-1 text-[10px] text-muted-foreground">{msg.latency_ms}ms | {msg.tokens_used} tokens</div>
              )}
            </div>
          </div>
        ))}

        {streamState.isStreaming && (
          <div className="flex justify-start">
            <div className="max-w-[80%] rounded-lg px-4 py-2 bg-muted">
              {streamState.skillName && (
                <div className="mb-1">
                  <span className={cn("inline-block px-2 py-0.5 text-xs font-medium rounded", skillColors[streamState.skillName] || skillColors.nl_query)}>
                    {streamState.skillName.replace("_", " ")}
                  </span>
                </div>
              )}
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <Streamdown>{streamState.content}</Streamdown>
                <span className="animate-pulse">▊</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="border-t p-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your logs..."
            className="flex-1 px-3 py-2 border rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            disabled={streamState.isStreaming}
          />
          {streamState.isStreaming ? (
            <button type="button" onClick={onStop} className="px-4 py-2 bg-destructive text-destructive-foreground rounded-md text-sm font-medium hover:bg-destructive/90">
              Stop
            </button>
          ) : (
            <button type="submit" disabled={!input.trim()} className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
              Send
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

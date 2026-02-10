"use client";

import { useState, useRef, useEffect } from "react";
import type { AIMessage } from "@/hooks/use-ai";

interface ChatPanelProps {
  messages: AIMessage[];
  loading: boolean;
  onSend: (message: string, skillName?: string) => void;
  selectedSkill: string;
}

export function ChatPanel({ messages, loading, onSend, selectedSkill }: ChatPanelProps) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;
    onSend(input.trim(), selectedSkill);
    setInput("");
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-muted-foreground text-sm py-12">
            Ask a question about your log analysis
          </div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[80%] rounded-lg px-4 py-2 ${
              msg.role === "user"
                ? "bg-primary text-primary-foreground"
                : "bg-muted"
            }`}>
              <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
              {msg.followUps && msg.followUps.length > 0 && (
                <div className="mt-2 space-y-1">
                  {msg.followUps.map((q, i) => (
                    <button
                      key={i}
                      className="block text-xs text-primary hover:underline"
                      onClick={() => onSend(q, selectedSkill)}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}
              {msg.role === "assistant" && msg.latencyMs != null && (
                <div className="mt-1 text-[10px] text-muted-foreground">
                  {msg.latencyMs}ms | {msg.tokensUsed} tokens
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-lg px-4 py-2 text-sm text-muted-foreground">
              Thinking...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="border-t p-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your logs..."
            className="flex-1 px-3 py-2 border rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}

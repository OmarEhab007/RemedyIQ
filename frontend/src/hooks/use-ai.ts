"use client";

import { useState, useCallback } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export interface AIMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  skillName?: string;
  references?: LogReference[];
  followUps?: string[];
  confidence?: number;
  tokensUsed?: number;
  latencyMs?: number;
  timestamp: Date;
}

export interface LogReference {
  entry_id: string;
  line_number: number;
  log_type: string;
  summary: string;
}

export interface SkillInfo {
  name: string;
  description: string;
  examples: string[];
}

export function useAI(jobId: string) {
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [skills, setSkills] = useState<SkillInfo[]>([]);

  const fetchSkills = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/ai/skills`, {
        headers: {
          "X-Dev-User-ID": "dev-user",
          "X-Dev-Tenant-ID": "dev-tenant",
        },
      });
      if (res.ok) {
        const data = await res.json();
        setSkills(data.skills || []);
      }
    } catch {
      // Skills listing is optional
    }
  }, []);

  const sendMessage = useCallback(async (query: string, skillName: string = "nl_query") => {
    const userMsg: AIMessage = {
      id: `msg-${Date.now()}`,
      role: "user",
      content: query,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/api/v1/analysis/${jobId}/ai`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Dev-User-ID": "dev-user",
          "X-Dev-Tenant-ID": "dev-tenant",
        },
        body: JSON.stringify({ query, skill_name: skillName }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "AI query failed");
      }

      const data = await res.json();

      const aiMsg: AIMessage = {
        id: `msg-${Date.now()}-ai`,
        role: "assistant",
        content: data.answer,
        skillName: data.skill_name,
        references: data.references,
        followUps: data.follow_ups,
        confidence: data.confidence,
        tokensUsed: data.tokens_used,
        latencyMs: data.latency_ms,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI query failed");
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  return { messages, loading, error, skills, sendMessage, clearMessages, fetchSkills };
}

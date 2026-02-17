export interface Message {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  skill_name?: string;
  follow_ups?: string[];
  tokens_used?: number;
  latency_ms?: number;
  status: "pending" | "streaming" | "complete" | "error";
  error_message?: string;
  created_at: string;
}

export interface Conversation {
  id: string;
  job_id: string;
  title?: string;
  message_count: number;
  last_message_at?: string;
  created_at: string;
  updated_at: string;
  messages?: Message[];
}

export interface Skill {
  name: string;
  description: string;
  examples: string[];
  keywords?: string[];
}

export interface StreamState {
  conversationId: string | null;
  messageId: string | null;
  skillName: string | null;
  content: string;
  tokensUsed: number;
  latencyMs: number;
  followUps: string[];
  isStreaming: boolean;
  error: string | null;
}

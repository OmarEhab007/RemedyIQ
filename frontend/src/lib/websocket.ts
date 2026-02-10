const WS_BASE = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8080/api/v1/ws";

type MessageHandler = (data: Record<string, unknown>) => void;

interface WSMessage {
  type: string;
  payload?: Record<string, unknown>;
}

export class RemedyWSClient {
  private ws: WebSocket | null = null;
  private handlers: Map<string, Set<MessageHandler>> = new Map();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private token: string = "";
  private isConnecting: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectDelay: number = 30000; // 30 seconds max
  // Use a single queue to preserve subscribe/unsubscribe order
  private pendingMessages: WSMessage[] = [];
  private intentionalClose: boolean = false;

  connect(token: string): void {
    // Close any existing socket before opening a new one
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      this.ws.close();
    }

    // Reset state for new connection attempt
    this.token = token;
    this.isConnecting = true;
    this.intentionalClose = false;
    this.reconnectAttempts = 0;

    this.ws = new WebSocket(`${WS_BASE}?token=${encodeURIComponent(token)}`);

    this.ws.onopen = () => {
      this.isConnecting = false;

      // Replay pending messages in order (preserves subscribe/unsubscribe order)
      this.pendingMessages.forEach(msg => {
        this.send(msg);
      });
      this.pendingMessages = [];
    };

    this.ws.onmessage = (event) => {
      try {
        const msg: WSMessage = JSON.parse(event.data);
        const typeHandlers = this.handlers.get(msg.type);
        if (typeHandlers) {
          typeHandlers.forEach((handler) => handler(msg.payload || {}));
        }
      } catch {
        // Ignore malformed messages.
      }
    };

    this.ws.onclose = () => {
      this.isConnecting = false;

      // Skip reconnect if this was an intentional close
      if (this.intentionalClose) {
        this.intentionalClose = false;
        return;
      }

      // Exponential backoff with jitter
      this.reconnectAttempts++;
      const baseDelay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), this.maxReconnectDelay);
      const jitter = Math.random() * 1000;
      const delay = baseDelay + jitter;

      this.reconnectTimer = setTimeout(() => this.connect(this.token), delay);
    };

    this.ws.onerror = () => {
      this.isConnecting = false;
      this.ws?.close();
    };
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    // Only set intentionalClose if we have an active socket
    if (this.ws) {
      this.intentionalClose = true;
      this.ws.close();
      this.ws = null;
    }
  }

  subscribeJobProgress(
    jobId: string,
    handler: (progress: { progress_pct: number; status: string; message?: string }) => void,
  ): () => void {
    const subscribeMsg = { type: "subscribe_job_progress", payload: { job_id: jobId } };
    this.send(subscribeMsg);

    const progressHandler: MessageHandler = (data) => {
      if (data.job_id === jobId) {
        handler(data as { progress_pct: number; status: string; message?: string });
      }
    };

    const completeHandler: MessageHandler = (data) => {
      if (data.job_id === jobId || (data as Record<string, unknown>).id === jobId) {
        handler({ progress_pct: 100, status: "complete" });
      }
    };

    this.on("job_progress", progressHandler);
    this.on("job_complete", completeHandler);

    return () => {
      this.off("job_progress", progressHandler);
      this.off("job_complete", completeHandler);
      this.send({ type: "unsubscribe_job_progress", payload: { job_id: jobId } });
    };
  }

  subscribeLiveTail(
    logType: string,
    handler: (entry: Record<string, unknown>) => void,
  ): () => void {
    const subscribeMsg = { type: "subscribe_live_tail", payload: { log_type: logType } };
    this.send(subscribeMsg);
    this.on("live_tail_entry", handler);

    return () => {
      this.off("live_tail_entry", handler);
      this.send({ type: "unsubscribe_live_tail", payload: { log_type: logType } });
    };
  }

  private send(msg: WSMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    } else {
      // Queue subscribe/unsubscribe messages if not connected
      // This preserves the order of subscribe/unsubscribe operations
      if (msg.type.startsWith("subscribe_") || msg.type.startsWith("unsubscribe_")) {
        this.pendingMessages.push(msg);
      }
    }
  }

  private on(type: string, handler: MessageHandler): void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    this.handlers.get(type)!.add(handler);
  }

  private off(type: string, handler: MessageHandler): void {
    this.handlers.get(type)?.delete(handler);
  }
}

let clientInstance: RemedyWSClient | null = null;

export function getWSClient(): RemedyWSClient {
  if (!clientInstance) {
    clientInstance = new RemedyWSClient();
  }
  return clientInstance;
}

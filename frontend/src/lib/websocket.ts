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
  private pendingSubscriptions: WSMessage[] = [];

  connect(token: string): void {
    // Prevent duplicate connections
    if (this.ws?.readyState === WebSocket.OPEN || this.ws?.readyState === WebSocket.CONNECTING || this.isConnecting) {
      return;
    }

    this.token = token;
    this.isConnecting = true;
    this.ws = new WebSocket(`${WS_BASE}?token=${encodeURIComponent(token)}`);

    this.ws.onopen = () => {
      this.isConnecting = false;
      this.reconnectAttempts = 0;

      // Replay pending subscriptions
      this.pendingSubscriptions.forEach(msg => {
        this.send(msg);
      });
      this.pendingSubscriptions = [];
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
    this.ws?.close();
    this.ws = null;
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
      // Queue subscription messages if not connected
      if (msg.type.startsWith("subscribe_")) {
        this.pendingSubscriptions.push(msg);
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

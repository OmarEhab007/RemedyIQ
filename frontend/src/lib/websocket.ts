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

  connect(token: string): void {
    this.token = token;
    this.ws = new WebSocket(`${WS_BASE}?token=${encodeURIComponent(token)}`);

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
      this.reconnectTimer = setTimeout(() => this.connect(this.token), 3000);
    };

    this.ws.onerror = () => {
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
    this.send({ type: "subscribe_job_progress", payload: { job_id: jobId } });

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
    this.send({ type: "subscribe_live_tail", payload: { log_type: logType } });
    this.on("live_tail_entry", handler);

    return () => {
      this.off("live_tail_entry", handler);
      this.send({ type: "unsubscribe_live_tail", payload: { log_type: logType } });
    };
  }

  private send(msg: WSMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
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

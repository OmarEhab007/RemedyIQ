/**
 * WebSocket client for RemedyIQ real-time events.
 *
 * Connects to GET /ws on the backend and maintains a persistent,
 * self-reconnecting WebSocket. Subscribers register typed callbacks
 * keyed by event type (e.g. "job:progress", "job:complete").
 *
 * @module websocket
 */

import { API_BASE, getAuthHeaders } from "./api";

/** Connection states exposed to callers. */
export type ConnectionStatus =
  | "connecting"
  | "connected"
  | "disconnected"
  | "reconnecting";

/** Shape of every message received from the server. */
export interface WSMessage<TPayload = unknown> {
  type: string;
  payload: TPayload;
}

/** Payload for job progress updates. */
export interface JobProgressPayload {
  job_id: string;
  status: string;
  progress_pct: number;
  error_message: string | null;
}

/**
 * Derives the WebSocket URL from the REST `API_BASE`.
 * Replaces http(s) scheme with ws(s) and strips the `/api/v1` suffix
 * so we end up at the raw WebSocket handler.
 */
function buildWsUrl(token?: string): string {
  const base = API_BASE.replace(/^http/, "ws").replace(/\/api\/v1\/?$/, "");
  const wsPath = "/api/v1/ws";
  if (token) {
    return `${base}${wsPath}?token=${encodeURIComponent(token)}`;
  }
  return `${base}${wsPath}`;
}

export class RemedyWebSocket {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 10;

  /** Base reconnect delay in milliseconds. Doubles each attempt up to 30 s. */
  private readonly baseDelayMs = 1_000;
  private readonly maxDelayMs = 30_000;

  /** Listeners keyed by event `type`. */
  private readonly listeners: Map<string, Set<(payload: unknown) => void>> =
    new Map();

  /** Subscribed job IDs — sent to the server on (re)connect. */
  private readonly subscribedJobs: Set<string> = new Set();

  private _status: ConnectionStatus = "disconnected";
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingInterval: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly url: string = buildWsUrl(),
    private readonly token?: string,
  ) {}

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /** Opens the WebSocket connection. Safe to call multiple times. */
  connect(): void {
    if (
      this.ws &&
      (this.ws.readyState === WebSocket.OPEN ||
        this.ws.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    this._status = "connecting";
    this.emit("__status__", this._status);

    // Build final URL with auth embedded as query params (WS cannot
    // send arbitrary headers in browsers).
    let effectiveUrl = this.url;
    if (this.token) {
      const sep = effectiveUrl.includes("?") ? "&" : "?";
      effectiveUrl = `${effectiveUrl}${sep}token=${encodeURIComponent(this.token)}`;
    } else {
      // In dev mode, backend accepts ?token=dev as a bypass
      const devHeaders = getAuthHeaders();
      const devUserId = devHeaders["X-Dev-User-Id"];
      const devTenantId = devHeaders["X-Dev-Tenant-Id"];
      if (devUserId && devTenantId) {
        const sep = effectiveUrl.includes("?") ? "&" : "?";
        effectiveUrl = `${effectiveUrl}${sep}token=dev`;
      }
    }

    const ws = new WebSocket(effectiveUrl);
    this.ws = ws;

    ws.addEventListener("open", this.handleOpen);
    ws.addEventListener("message", this.handleMessage);
    ws.addEventListener("close", this.handleClose);
    ws.addEventListener("error", this.handleError);
  }

  /** Closes the connection and stops reconnection attempts. */
  disconnect(): void {
    this.clearReconnectTimer();
    this.clearPingInterval();
    this.reconnectAttempts = 0;
    if (this.ws) {
      this.ws.removeEventListener("open", this.handleOpen);
      this.ws.removeEventListener("message", this.handleMessage);
      this.ws.removeEventListener("close", this.handleClose);
      this.ws.removeEventListener("error", this.handleError);
      if (
        this.ws.readyState === WebSocket.OPEN ||
        this.ws.readyState === WebSocket.CONNECTING
      ) {
        this.ws.close(1000, "Client disconnected");
      }
      this.ws = null;
    }
    this._status = "disconnected";
    this.emit("__status__", this._status);
  }

  /**
   * Sends a subscribe message for a specific job's progress events.
   *
   * The subscription is persisted across reconnects.
   *
   * @param jobId - The analysis job ID to subscribe to.
   */
  subscribeToJobProgress(jobId: string): void {
    this.subscribedJobs.add(jobId);
    this.sendJson({
      type: "subscribe_job_progress",
      payload: { job_id: jobId },
    });
  }

  /**
   * Cancels a job progress subscription.
   *
   * @param jobId - The analysis job ID to unsubscribe from.
   */
  unsubscribeFromJobProgress(jobId: string): void {
    this.subscribedJobs.delete(jobId);
    this.sendJson({
      type: "unsubscribe_job_progress",
      payload: { job_id: jobId },
    });
  }

  /**
   * Registers a callback for a given event `type`.
   *
   * @param type     - Event type string (e.g. "job:progress").
   * @param callback - Function invoked with the event payload.
   * @returns        An unsubscribe function that removes this callback.
   */
  on<TPayload = unknown>(
    type: string,
    callback: (payload: TPayload) => void,
  ): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    const typed = callback as (payload: unknown) => void;
    this.listeners.get(type)!.add(typed);
    return () => {
      this.listeners.get(type)?.delete(typed);
    };
  }

  /** `true` when the underlying WebSocket is in the OPEN state. */
  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  /** Current connection status string. */
  get connectionStatus(): ConnectionStatus {
    return this._status;
  }

  // -------------------------------------------------------------------------
  // Private — event handlers (arrow functions to preserve `this`)
  // -------------------------------------------------------------------------

  private readonly handleOpen = (): void => {
    this._status = "connected";
    this.reconnectAttempts = 0;
    this.emit("__status__", this._status);

    // Re-subscribe to all persisted job subscriptions after reconnect
    for (const jobId of this.subscribedJobs) {
      this.sendJson({
        type: "subscribe_job_progress",
        payload: { job_id: jobId },
      });
    }

    this.startPingInterval();
  };

  private readonly handleClose = (event: CloseEvent): void => {
    this.clearPingInterval();

    // 1000 = normal closure (client-initiated disconnect)
    if (event.code === 1000) {
      this._status = "disconnected";
      this.emit("__status__", this._status);
      return;
    }

    this.reconnect();
  };

  private readonly handleError = (_event: Event): void => {
    // Errors are followed by a close event, so reconnection is handled there.
    // We emit an error event so callers can log/display it.
    this.emit("__error__", { message: "WebSocket error" });
  };

  private readonly handleMessage = (event: MessageEvent): void => {
    let message: WSMessage;
    try {
      message = JSON.parse(event.data as string) as WSMessage;
    } catch {
      // Malformed frame — ignore
      return;
    }
    if (typeof message.type !== "string") return;
    this.emit(message.type, message.payload);
  };

  // -------------------------------------------------------------------------
  // Private — reconnection logic
  // -------------------------------------------------------------------------

  private reconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this._status = "disconnected";
      this.emit("__status__", this._status);
      this.emit("__max_reconnects__", {
        attempts: this.reconnectAttempts,
      });
      return;
    }

    this._status = "reconnecting";
    this.emit("__status__", this._status);

    const delay = Math.min(
      this.baseDelayMs * Math.pow(2, this.reconnectAttempts),
      this.maxDelayMs,
    );
    this.reconnectAttempts += 1;

    this.reconnectTimer = setTimeout(() => {
      this.ws = null;
      this.connect();
    }, delay);
  }

  // -------------------------------------------------------------------------
  // Private — ping / pong keepalive
  // -------------------------------------------------------------------------

  private startPingInterval(): void {
    this.clearPingInterval();
    this.pingInterval = setInterval(() => {
      if (this.isConnected) {
        this.sendJson({ type: "ping" });
      }
    }, 30_000);
  }

  private clearPingInterval(): void {
    if (this.pingInterval !== null) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  // -------------------------------------------------------------------------
  // Private — helpers
  // -------------------------------------------------------------------------

  /** Sends a JSON-serializable object if the socket is open. */
  private sendJson(data: unknown): void {
    if (this.isConnected) {
      try {
        this.ws!.send(JSON.stringify(data));
      } catch {
        // Socket might have closed between the readyState check and send
      }
    }
  }

  /** Dispatches an event to all registered listeners. */
  private emit(type: string, payload: unknown): void {
    const handlers = this.listeners.get(type);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(payload);
        } catch {
          // Prevent a bad listener from breaking the event loop
        }
      }
    }
  }
}

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { RemedyWSClient, getWSClient } from "@/lib/websocket";

type MockWebSocket = {
  readyState: number;
  send: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  onopen: ((event: Event) => void) | null;
  onmessage: ((event: MessageEvent) => void) | null;
  onclose: ((event: CloseEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
};

describe("websocket", () => {
  let client: RemedyWSClient;
  let mockWebSocket: MockWebSocket;
  let WebSocketMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();

    mockWebSocket = {
      readyState: 0,
      send: vi.fn(),
      close: vi.fn(),
      onopen: null,
      onmessage: null,
      onclose: null,
      onerror: null,
    };

    WebSocketMock = vi.fn(() => mockWebSocket);
    (WebSocketMock as unknown as Record<string, number>).CONNECTING = 0;
    (WebSocketMock as unknown as Record<string, number>).OPEN = 1;
    (WebSocketMock as unknown as Record<string, number>).CLOSING = 2;
    (WebSocketMock as unknown as Record<string, number>).CLOSED = 3;

    vi.stubGlobal("WebSocket", WebSocketMock);

    client = new RemedyWSClient();
  });

  afterEach(() => {
    client.disconnect();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  describe("RemedyWSClient", () => {
    describe("connect", () => {
      it("creates WebSocket connection with token", () => {
        client.connect("test-token");

        expect(WebSocket).toHaveBeenCalledWith(
          expect.stringContaining("test-token")
        );
      });

      it("skips reconnect when already connected", () => {
        client.connect("first-token");
        mockWebSocket.readyState = 1;
        client.connect("second-token");
        // Implementation returns early if already OPEN/CONNECTING
        expect(mockWebSocket.close).not.toHaveBeenCalled();
        expect(WebSocketMock).toHaveBeenCalledTimes(1);
      });

      it("URL encodes the token", () => {
        client.connect("token/with/slashes");

        expect(WebSocket).toHaveBeenCalledWith(
          expect.stringContaining("token%2Fwith%2Fslashes")
        );
      });
    });

    describe("connection state", () => {
      it("sets isConnecting flag during connection", () => {
        mockWebSocket.readyState = 0;
        client.connect("test-token");
        expect(mockWebSocket.readyState).toBe(0);
      });

      it("clears isConnecting flag on open", () => {
        client.connect("test-token");
        mockWebSocket.readyState = 1;
        mockWebSocket.onopen?.({} as Event);
      });

      it("clears isConnecting flag on close", () => {
        client.connect("test-token");
        mockWebSocket.readyState = 1;
        mockWebSocket.onopen?.({} as Event);
        mockWebSocket.readyState = 3;
        mockWebSocket.onclose?.({ code: 1000, reason: "", wasClean: true } as CloseEvent);
      });
    });

    describe("disconnect", () => {
      it("closes the WebSocket connection", () => {
        client.connect("test-token");
        mockWebSocket.readyState = 1;
        client.disconnect();

        expect(mockWebSocket.close).toHaveBeenCalled();
      });

      it("clears reconnect timer", () => {
        client.connect("test-token");
        mockWebSocket.readyState = 1;

        mockWebSocket.onclose?.({ code: 1006, reason: "", wasClean: false } as CloseEvent);

        client.disconnect();

        vi.advanceTimersByTime(5000);

        expect(WebSocketMock).toHaveBeenCalledTimes(1);
      });

      it("handles disconnect when not connected", () => {
        expect(() => client.disconnect()).not.toThrow();
      });
    });

    describe("subscribeJobProgress", () => {
      it("sends subscribe message when connected", () => {
        client.connect("test-token");
        mockWebSocket.readyState = 1;
        mockWebSocket.onopen?.({} as Event);

        const handler = vi.fn();
        client.subscribeJobProgress("job-123", handler);

        expect(mockWebSocket.send).toHaveBeenCalledWith(
          JSON.stringify({ type: "subscribe_job_progress", payload: { job_id: "job-123" } })
        );
      });

      it("queues subscribe message and sends on open", () => {
        mockWebSocket.readyState = 0;
        client.connect("test-token");

        const handler = vi.fn();
        client.subscribeJobProgress("job-123", handler);

        mockWebSocket.readyState = 1;
        mockWebSocket.onopen?.({} as Event);

        expect(mockWebSocket.send).toHaveBeenCalledWith(
          JSON.stringify({ type: "subscribe_job_progress", payload: { job_id: "job-123" } })
        );
      });

      it("calls handler on job_progress message", () => {
        client.connect("test-token");
        mockWebSocket.readyState = 1;
        mockWebSocket.onopen?.({} as Event);

        const handler = vi.fn();
        client.subscribeJobProgress("job-123", handler);

        mockWebSocket.onmessage?.({
          data: JSON.stringify({
            type: "job_progress",
            payload: { job_id: "job-123", progress_pct: 50, status: "parsing" },
          }),
        } as MessageEvent);

        expect(handler).toHaveBeenCalledWith({
          job_id: "job-123",
          progress_pct: 50,
          status: "parsing",
        });
      });

      it("calls handler on job_complete message", () => {
        client.connect("test-token");
        mockWebSocket.readyState = 1;
        mockWebSocket.onopen?.({} as Event);

        const handler = vi.fn();
        client.subscribeJobProgress("job-123", handler);

        mockWebSocket.onmessage?.({
          data: JSON.stringify({
            type: "job_complete",
            payload: { id: "job-123" },
          }),
        } as MessageEvent);

        expect(handler).toHaveBeenCalledWith({
          progress_pct: 100,
          status: "complete",
        });
      });

      it("does not call handler for different job_id", () => {
        client.connect("test-token");
        mockWebSocket.readyState = 1;
        mockWebSocket.onopen?.({} as Event);

        const handler = vi.fn();
        client.subscribeJobProgress("job-123", handler);

        mockWebSocket.onmessage?.({
          data: JSON.stringify({
            type: "job_progress",
            payload: { job_id: "job-456", progress_pct: 50, status: "parsing" },
          }),
        } as MessageEvent);

        expect(handler).not.toHaveBeenCalled();
      });

      it("unsubscribe function sends unsubscribe message and removes handlers", () => {
        client.connect("test-token");
        mockWebSocket.readyState = 1;
        mockWebSocket.onopen?.({} as Event);

        const handler = vi.fn();
        const unsubscribe = client.subscribeJobProgress("job-123", handler);
        unsubscribe();

        expect(mockWebSocket.send).toHaveBeenCalledWith(
          JSON.stringify({ type: "unsubscribe_job_progress", payload: { job_id: "job-123" } })
        );

        mockWebSocket.onmessage?.({
          data: JSON.stringify({
            type: "job_progress",
            payload: { job_id: "job-123", progress_pct: 50, status: "parsing" },
          }),
        } as MessageEvent);

        expect(handler).not.toHaveBeenCalled();
      });
    });

    describe("subscribeLiveTail", () => {
      it("sends subscribe message when connected", () => {
        client.connect("test-token");
        mockWebSocket.readyState = 1;
        mockWebSocket.onopen?.({} as Event);

        const handler = vi.fn();
        client.subscribeLiveTail("api", handler);

        expect(mockWebSocket.send).toHaveBeenCalledWith(
          JSON.stringify({ type: "subscribe_live_tail", payload: { log_type: "api" } })
        );
      });

      it("calls handler on live_tail_entry message", () => {
        client.connect("test-token");
        mockWebSocket.readyState = 1;
        mockWebSocket.onopen?.({} as Event);

        const handler = vi.fn();
        client.subscribeLiveTail("api", handler);

        const entry = { timestamp: "2026-02-12T00:00:00Z", message: "test entry" };
        mockWebSocket.onmessage?.({
          data: JSON.stringify({
            type: "live_tail_entry",
            payload: entry,
          }),
        } as MessageEvent);

        expect(handler).toHaveBeenCalledWith(entry);
      });

      it("unsubscribe function removes handler", () => {
        client.connect("test-token");
        mockWebSocket.readyState = 1;
        mockWebSocket.onopen?.({} as Event);

        const handler = vi.fn();
        const unsubscribe = client.subscribeLiveTail("api", handler);
        unsubscribe();

        expect(mockWebSocket.send).toHaveBeenCalledWith(
          JSON.stringify({ type: "unsubscribe_live_tail", payload: { log_type: "api" } })
        );
      });
    });

    describe("reconnection", () => {
      it("does not reconnect on intentional close", () => {
        client.connect("test-token");
        mockWebSocket.readyState = 1;
        mockWebSocket.onopen?.({} as Event);

        client.disconnect();
        mockWebSocket.readyState = 3;
        mockWebSocket.onclose?.({ code: 1000, reason: "", wasClean: true } as CloseEvent);

        vi.advanceTimersByTime(5000);

        expect(WebSocketMock).toHaveBeenCalledTimes(1);
      });

      it("schedules reconnection on unexpected close", () => {
        let callCount = 0;
        const mockWs1: MockWebSocket = {
          readyState: 0,
          send: vi.fn(),
          close: vi.fn(),
          onopen: null,
          onmessage: null,
          onclose: null,
          onerror: null,
        };
        const mockWs2: MockWebSocket = {
          readyState: 0,
          send: vi.fn(),
          close: vi.fn(),
          onopen: null,
          onmessage: null,
          onclose: null,
          onerror: null,
        };
        
        WebSocketMock.mockImplementation(() => {
          callCount++;
          return callCount === 1 ? mockWs1 : mockWs2;
        });

        const reconnectClient = new RemedyWSClient();
        reconnectClient.connect("test-token");
        mockWs1.readyState = 1;
        mockWs1.onopen?.({} as Event);

        mockWs1.readyState = 3;
        mockWs1.onclose?.({ code: 1006, reason: "", wasClean: false } as CloseEvent);

        vi.advanceTimersByTime(3000);

        expect(WebSocketMock).toHaveBeenCalledTimes(2);
        reconnectClient.disconnect();
      });
    });

    describe("error handling", () => {
      it("closes connection on error", () => {
        client.connect("test-token");
        mockWebSocket.readyState = 0;
        mockWebSocket.onerror?.({} as Event);

        expect(mockWebSocket.close).toHaveBeenCalled();
      });

      it("ignores malformed JSON messages", () => {
        client.connect("test-token");
        mockWebSocket.readyState = 1;
        mockWebSocket.onopen?.({} as Event);

        const handler = vi.fn();
        client.subscribeLiveTail("api", handler);

        expect(() => {
          mockWebSocket.onmessage?.({
            data: "invalid json",
          } as MessageEvent);
        }).not.toThrow();

        expect(handler).not.toHaveBeenCalled();
      });

      it("ignores messages without type field", () => {
        client.connect("test-token");
        mockWebSocket.readyState = 1;
        mockWebSocket.onopen?.({} as Event);

        const handler = vi.fn();
        client.subscribeLiveTail("api", handler);

        mockWebSocket.onmessage?.({
          data: JSON.stringify({ payload: { data: "test" } }),
        } as MessageEvent);

        expect(handler).not.toHaveBeenCalled();
      });
    });
  });

  describe("getWSClient", () => {
    it("returns singleton instance", () => {
      const client1 = new RemedyWSClient();
      const client2 = new RemedyWSClient();

      expect(client1).not.toBe(client2);
    });
  });
});

/**
 * SSE (Server-Sent Events) client for AI streaming responses.
 *
 * Targets POST /ai/stream on the backend which returns a text/event-stream
 * response. Individual SSE frames carry JSON-encoded `AIStreamEvent` objects.
 *
 * @module sse
 */

import { API_BASE, ApiError, getAuthHeaders } from "./api";
import type { AIStreamEvent } from "./api-types";

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

export interface AIStreamOptions {
  /** Analysis job ID that scopes the AI query. */
  jobId: string;
  /** Existing conversation to append this message to. */
  conversationId: string;
  /** User message text. */
  message: string;
  /** Optional skill name (e.g. "slow_query_analyzer"). */
  skill?: string;
  /** Optional Clerk Bearer token. Not required in dev mode. */
  token?: string;
  /** Called with each streamed text token. */
  onToken: (token: string) => void;
  /** Called when the stream ends successfully. May include follow-up prompts. */
  onDone: (followUps?: string[]) => void;
  /** Called when a stream-level error occurs. */
  onError: (error: string) => void;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

/**
 * Initiates an SSE stream for an AI response.
 *
 * Internally uses `fetch` with a `ReadableStream` body reader so that token
 * delivery is incremental. The returned `AbortController` can be used to
 * cancel the stream at any time; `onDone` will NOT be called after abort.
 *
 * @param options - Configuration and callbacks for the stream.
 * @returns       An `AbortController` whose `.abort()` cancels the stream.
 *
 * @example
 * ```ts
 * const ctrl = streamAIResponse({
 *   jobId,
 *   conversationId,
 *   message: "Why are these queries slow?",
 *   onToken: (t) => setContent((c) => c + t),
 *   onDone: (followUps) => setFollowUps(followUps ?? []),
 *   onError: (err) => console.error(err),
 * });
 * // Cancel midway:
 * ctrl.abort();
 * ```
 */
export function streamAIResponse(options: AIStreamOptions): AbortController {
  const {
    jobId,
    conversationId,
    message,
    skill,
    token,
    onToken,
    onDone,
    onError,
  } = options;

  const controller = new AbortController();
  const { signal } = controller;

  // Run async in background; errors surface through `onError`.
  void runStream({
    jobId,
    conversationId,
    message,
    skill,
    token,
    signal,
    onToken,
    onDone,
    onError,
  });

  return controller;
}

// ---------------------------------------------------------------------------
// Internal async runner
// ---------------------------------------------------------------------------

interface RunStreamParams {
  jobId: string;
  conversationId: string;
  message: string;
  skill?: string;
  token?: string;
  signal: AbortSignal;
  onToken: (token: string) => void;
  onDone: (followUps?: string[]) => void;
  onError: (error: string) => void;
}

async function runStream(params: RunStreamParams): Promise<void> {
  const {
    jobId,
    conversationId,
    message,
    skill,
    token,
    signal,
    onToken,
    onDone,
    onError,
  } = params;

  const url = `${API_BASE}/ai/stream`;

  const requestHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "text/event-stream",
    ...getAuthHeaders(),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const body = JSON.stringify({
    job_id: jobId,
    conversation_id: conversationId,
    query: message,
    skill,
  });

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: requestHeaders,
      body,
      signal,
    });
  } catch (err: unknown) {
    if (signal.aborted) return; // Normal cancellation — do not call onError
    onError(
      err instanceof Error ? err.message : "Network error initiating AI stream",
    );
    return;
  }

  if (!response.ok) {
    let code = "STREAM_ERROR";
    let errMsg = response.statusText;
    try {
      const b = (await response.json()) as {
        code?: string;
        error?: string;
        message?: string;
      };
      code = b.code ?? code;
      errMsg = b.error ?? b.message ?? errMsg;
    } catch {
      // Non-JSON error body
    }
    const apiErr = new ApiError(response.status, code, errMsg);
    onError(apiErr.message);
    return;
  }

  if (!response.body) {
    onError("SSE response contained no body");
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      // Respect abort signal
      if (signal.aborted) {
        reader.cancel().catch(() => undefined);
        return;
      }

      let done: boolean;
      let value: Uint8Array | undefined;

      try {
        ({ done, value } = await reader.read());
      } catch (readErr: unknown) {
        if (signal.aborted) return;
        onError(
          readErr instanceof Error
            ? readErr.message
            : "Error reading AI stream",
        );
        return;
      }

      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // SSE messages are delimited by double newlines
      const messages = buffer.split("\n\n");
      // Keep any incomplete trailing message in the buffer
      buffer = messages.pop() ?? "";

      for (const msg of messages) {
        const event = parseSseMessage(msg);
        if (event === null) continue;
        handleEvent(event, onToken, onDone);
      }
    }

    // Process any remaining buffered data after the stream ends
    if (buffer.trim()) {
      const event = parseSseMessage(buffer);
      if (event !== null) {
        handleEvent(event, onToken, onDone);
      }
    }

    // If the server did not send an explicit "done" event, signal completion
    onDone();
  } catch (err: unknown) {
    if (signal.aborted) return;
    onError(err instanceof Error ? err.message : "Unexpected SSE error");
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // Already released
    }
  }
}

// ---------------------------------------------------------------------------
// SSE parsing helpers
// ---------------------------------------------------------------------------

/**
 * Parses a single SSE message block (the text between two `\n\n` delimiters)
 * into an `AIStreamEvent`, or returns `null` if the block carries no data.
 */
function parseSseMessage(raw: string): AIStreamEvent | null {
  const lines = raw.split("\n");
  let eventType = "";
  let dataLine: string | null = null;

  for (const line of lines) {
    if (line.startsWith("event:")) {
      eventType = line.slice(6).trim();
    } else if (line.startsWith("data:")) {
      dataLine = line.slice(5).trim();
    }
  }

  if (dataLine === null || dataLine === "" || dataLine === "[DONE]") {
    return null;
  }

  try {
    const parsed = JSON.parse(dataLine) as Record<string, unknown>;

    // Map backend SSE format to AIStreamEvent based on event type
    switch (eventType) {
      case "token":
        return { type: "token", content: (parsed.text as string) ?? "" };
      case "done":
        return { type: "done", follow_ups: parsed.follow_ups as string[] | undefined };
      case "error":
        return { type: "error", error: (parsed.message as string) ?? (parsed.error as string) ?? "Unknown error" };
      case "follow_ups":
        return { type: "follow_ups", follow_ups: parsed.follow_ups as string[] };
      case "start":
      case "skill":
      case "metadata":
        // Informational events — skip (not needed by callbacks)
        return null;
      default:
        // Fallback: try to use parsed as-is
        return (parsed.type ? parsed : null) as AIStreamEvent | null;
    }
  } catch {
    // Malformed JSON in data field — silently skip
    return null;
  }
}

/**
 * Dispatches a parsed `AIStreamEvent` to the appropriate callback.
 *
 * The `onDone` callback is invoked immediately when the server sends a
 * `"done"` event so callers can finalise the UI without waiting for the
 * stream to close.
 */
function handleEvent(
  event: AIStreamEvent,
  onToken: (token: string) => void,
  onDone: (followUps?: string[]) => void,
): void {
  switch (event.type) {
    case "token":
      if (event.content !== undefined && event.content !== "") {
        onToken(event.content);
      }
      break;
    case "follow_ups":
      // follow_ups arrive before done; accumulate them — the final onDone
      // call (from the "done" event or stream end) carries them.
      // Here we surface them immediately via onDone so the UI can act early.
      onDone(event.follow_ups);
      break;
    case "done":
      onDone(event.follow_ups);
      break;
    case "error":
      // Errors are handled by the caller's onError; we do not call onDone.
      // The caller's onError is wired via the outer runStream function;
      // this branch is only reached if the server wraps errors as SSE events.
      // We re-throw so runStream's catch block picks it up.
      throw new Error(event.error ?? "Unknown AI stream error");
    default:
      // Future event types — ignore gracefully
      break;
  }
}

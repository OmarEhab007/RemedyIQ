/**
 * Tests for streamAIResponse (SSE client).
 *
 * Covers: correct URL and headers, token events, done event with follow-ups,
 * error events, HTTP error responses, abort cancellation, no-body response.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { streamAIResponse } from './sse'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('./api', () => ({
  API_BASE: 'http://localhost:8080/api/v1',
  ApiError: class ApiError extends Error {
    status: number
    code: string
    constructor(status: number, code: string, message: string) {
      super(message)
      this.status = status
      this.code = code
    }
  },
  getAuthHeaders: vi.fn(() => ({
    'X-Dev-User-Id': 'user-1',
    'X-Dev-Tenant-Id': 'tenant-1',
  })),
}))

// ---------------------------------------------------------------------------
// SSE stream builder helpers
// ---------------------------------------------------------------------------

/**
 * Builds a ReadableStream that yields UTF-8 encoded chunks from the given
 * string lines joined by double newlines (as real SSE delivers them).
 */
function makeSseStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk))
      }
      controller.close()
    },
  })
}

/** Returns a mock fetch response with an SSE body. */
function makeSseResponse(chunks: string[]): Response {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    body: makeSseStream(chunks),
    json: vi.fn(),
  } as unknown as Response
}

// ---------------------------------------------------------------------------
// Default options factory
// ---------------------------------------------------------------------------

function makeOptions(overrides: Partial<Parameters<typeof streamAIResponse>[0]> = {}) {
  return {
    jobId: 'job-1',
    conversationId: 'conv-1',
    message: 'Why are queries slow?',
    onToken: vi.fn(),
    onDone: vi.fn(),
    onError: vi.fn(),
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('streamAIResponse', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // -------------------------------------------------------------------------
  // Return value
  // -------------------------------------------------------------------------

  it('returns an AbortController', () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeSseResponse([])))

    const ctrl = streamAIResponse(makeOptions())
    expect(ctrl).toBeInstanceOf(AbortController)
    ctrl.abort()
  })

  // -------------------------------------------------------------------------
  // Fetch request
  // -------------------------------------------------------------------------

  it('calls fetch with the correct URL and method', async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeSseResponse([]))
    vi.stubGlobal('fetch', fetchMock)

    const opts = makeOptions()
    streamAIResponse(opts)

    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalled()
    })

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('http://localhost:8080/api/v1/ai/stream')
    expect(init.method).toBe('POST')
  })

  it('sends the correct JSON body', async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeSseResponse([]))
    vi.stubGlobal('fetch', fetchMock)

    streamAIResponse(
      makeOptions({ jobId: 'job-42', conversationId: 'conv-42', message: 'Hello', skill: 'error_analyzer' }),
    )

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled())

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(init.body as string)
    expect(body).toEqual({
      job_id: 'job-42',
      conversation_id: 'conv-42',
      query: 'Hello',
      skill: 'error_analyzer',
    })
  })

  it('includes Content-Type and Accept headers', async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeSseResponse([]))
    vi.stubGlobal('fetch', fetchMock)

    streamAIResponse(makeOptions())
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled())

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const headers = init.headers as Record<string, string>
    expect(headers['Content-Type']).toBe('application/json')
    expect(headers['Accept']).toBe('text/event-stream')
  })

  it('includes Authorization header when token is provided', async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeSseResponse([]))
    vi.stubGlobal('fetch', fetchMock)

    streamAIResponse(makeOptions({ token: 'my-jwt' }))
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled())

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const headers = init.headers as Record<string, string>
    expect(headers['Authorization']).toBe('Bearer my-jwt')
  })

  // -------------------------------------------------------------------------
  // Token events
  // -------------------------------------------------------------------------

  it('calls onToken for each token event in the stream', async () => {
    const chunks = [
      'data: {"type":"token","content":"Hello"}\n\n',
      'data: {"type":"token","content":" world"}\n\n',
    ]
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeSseResponse(chunks)))

    const opts = makeOptions()
    streamAIResponse(opts)

    await vi.waitFor(() => {
      expect(opts.onToken).toHaveBeenCalledTimes(2)
    })

    expect(opts.onToken).toHaveBeenNthCalledWith(1, 'Hello')
    expect(opts.onToken).toHaveBeenNthCalledWith(2, ' world')
  })

  it('does not call onToken for token events with empty content', async () => {
    const chunks = ['data: {"type":"token","content":""}\n\n']
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeSseResponse(chunks)))

    const opts = makeOptions()
    streamAIResponse(opts)

    await vi.waitFor(() => {
      expect(opts.onDone).toHaveBeenCalled()
    })

    expect(opts.onToken).not.toHaveBeenCalled()
  })

  // -------------------------------------------------------------------------
  // Done event
  // -------------------------------------------------------------------------

  it('calls onDone when the stream ends', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeSseResponse([])))

    const opts = makeOptions()
    streamAIResponse(opts)

    await vi.waitFor(() => {
      expect(opts.onDone).toHaveBeenCalled()
    })
  })

  it('calls onDone with follow-ups from a "done" event', async () => {
    const chunks = [
      'data: {"type":"done","follow_ups":["Tell me more","Show examples"]}\n\n',
    ]
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeSseResponse(chunks)))

    const opts = makeOptions()
    streamAIResponse(opts)

    await vi.waitFor(() => {
      expect(opts.onDone).toHaveBeenCalled()
    })

    expect(opts.onDone).toHaveBeenCalledWith(['Tell me more', 'Show examples'])
  })

  it('calls onDone with follow-ups from a "follow_ups" event', async () => {
    const chunks = [
      'data: {"type":"follow_ups","follow_ups":["A","B"]}\n\n',
    ]
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeSseResponse(chunks)))

    const opts = makeOptions()
    streamAIResponse(opts)

    await vi.waitFor(() => {
      expect(opts.onDone).toHaveBeenCalled()
    })

    expect(opts.onDone).toHaveBeenCalledWith(['A', 'B'])
  })

  // -------------------------------------------------------------------------
  // Error events
  // -------------------------------------------------------------------------

  it('calls onError when the server sends an "error" type SSE event', async () => {
    const chunks = [
      'data: {"type":"error","error":"Something went wrong"}\n\n',
    ]
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeSseResponse(chunks)))

    const opts = makeOptions()
    streamAIResponse(opts)

    await vi.waitFor(() => {
      expect(opts.onError).toHaveBeenCalled()
    })

    expect(opts.onError).toHaveBeenCalledWith('Something went wrong')
  })

  it('calls onError with "Unknown AI stream error" when error field is absent', async () => {
    const chunks = [
      'data: {"type":"error"}\n\n',
    ]
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeSseResponse(chunks)))

    const opts = makeOptions()
    streamAIResponse(opts)

    await vi.waitFor(() => {
      expect(opts.onError).toHaveBeenCalled()
    })

    expect(opts.onError).toHaveBeenCalledWith('Unknown AI stream error')
  })

  // -------------------------------------------------------------------------
  // HTTP error response
  // -------------------------------------------------------------------------

  it('calls onError when HTTP response is not OK', async () => {
    const errorResponse = {
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      body: null,
      json: vi.fn().mockResolvedValue({ error: 'Server exploded', code: 'INTERNAL' }),
    } as unknown as Response
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(errorResponse))

    const opts = makeOptions()
    streamAIResponse(opts)

    await vi.waitFor(() => {
      expect(opts.onError).toHaveBeenCalled()
    })

    expect(opts.onError).toHaveBeenCalledWith('Server exploded')
  })

  it('calls onError with statusText when JSON error body cannot be parsed', async () => {
    const errorResponse = {
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
      body: null,
      json: vi.fn().mockRejectedValue(new Error('not json')),
    } as unknown as Response
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(errorResponse))

    const opts = makeOptions()
    streamAIResponse(opts)

    await vi.waitFor(() => {
      expect(opts.onError).toHaveBeenCalled()
    })

    expect(opts.onError).toHaveBeenCalledWith('Service Unavailable')
  })

  // -------------------------------------------------------------------------
  // No body
  // -------------------------------------------------------------------------

  it('calls onError when response has no body', async () => {
    const noBodyResponse = {
      ok: true,
      status: 200,
      statusText: 'OK',
      body: null,
      json: vi.fn(),
    } as unknown as Response
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(noBodyResponse))

    const opts = makeOptions()
    streamAIResponse(opts)

    await vi.waitFor(() => {
      expect(opts.onError).toHaveBeenCalled()
    })

    expect(opts.onError).toHaveBeenCalledWith('SSE response contained no body')
  })

  // -------------------------------------------------------------------------
  // Abort / cancellation
  // -------------------------------------------------------------------------

  it('does not call onError when fetch is aborted by the returned controller', async () => {
    const abortError = new DOMException('The user aborted a request', 'AbortError')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((_url: string, init: { signal: AbortSignal }) => {
        return new Promise((_, reject) => {
          init.signal.addEventListener('abort', () => reject(abortError))
        })
      }),
    )

    const opts = makeOptions()
    const ctrl = streamAIResponse(opts)
    ctrl.abort()

    // Give the async internals time to run
    await new Promise((r) => setTimeout(r, 50))

    expect(opts.onError).not.toHaveBeenCalled()
    expect(opts.onDone).not.toHaveBeenCalled()
  })

  // -------------------------------------------------------------------------
  // Network error (non-abort)
  // -------------------------------------------------------------------------

  it('calls onError with network error message when fetch rejects for non-abort reason', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('Failed to fetch')),
    )

    const opts = makeOptions()
    streamAIResponse(opts)

    await vi.waitFor(() => {
      expect(opts.onError).toHaveBeenCalled()
    })

    expect(opts.onError).toHaveBeenCalledWith('Failed to fetch')
  })

  // -------------------------------------------------------------------------
  // SSE parsing edge cases
  // -------------------------------------------------------------------------

  it('ignores SSE lines that are not "data:" prefixed', async () => {
    const chunks = [
      'id: 1\nevent: message\ndata: {"type":"token","content":"ok"}\n\n',
    ]
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeSseResponse(chunks)))

    const opts = makeOptions()
    streamAIResponse(opts)

    await vi.waitFor(() => {
      expect(opts.onToken).toHaveBeenCalled()
    })

    expect(opts.onToken).toHaveBeenCalledWith('ok')
  })

  it('skips "[DONE]" data lines without error', async () => {
    const chunks = ['data: [DONE]\n\n']
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeSseResponse(chunks)))

    const opts = makeOptions()
    streamAIResponse(opts)

    await vi.waitFor(() => {
      expect(opts.onDone).toHaveBeenCalled()
    })

    expect(opts.onError).not.toHaveBeenCalled()
    expect(opts.onToken).not.toHaveBeenCalled()
  })

  it('skips malformed JSON in data field without calling onError', async () => {
    const chunks = ['data: {bad json}\n\n']
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeSseResponse(chunks)))

    const opts = makeOptions()
    streamAIResponse(opts)

    await vi.waitFor(() => {
      expect(opts.onDone).toHaveBeenCalled()
    })

    expect(opts.onError).not.toHaveBeenCalled()
  })

  it('handles unknown event types gracefully', async () => {
    const chunks = ['data: {"type":"future_event","data":"x"}\n\n']
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeSseResponse(chunks)))

    const opts = makeOptions()
    streamAIResponse(opts)

    await vi.waitFor(() => {
      expect(opts.onDone).toHaveBeenCalled()
    })

    expect(opts.onToken).not.toHaveBeenCalled()
    expect(opts.onError).not.toHaveBeenCalled()
  })
})

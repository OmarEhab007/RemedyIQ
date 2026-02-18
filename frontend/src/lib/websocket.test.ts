/**
 * Tests for RemedyWebSocket class.
 *
 * Covers: connect/disconnect, event subscription (on/off), message parsing,
 * job subscription, auto-reconnect behavior, error event, max reconnect limit.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { RemedyWebSocket } from './websocket'

// ---------------------------------------------------------------------------
// Mock API module dependencies
// ---------------------------------------------------------------------------

vi.mock('./api', () => ({
  API_BASE: 'http://localhost:8080/api/v1',
  getAuthHeaders: vi.fn(() => ({
    'X-Dev-User-Id': '',
    'X-Dev-Tenant-Id': '',
  })),
}))

// ---------------------------------------------------------------------------
// MockWebSocket
// ---------------------------------------------------------------------------

class MockWebSocket {
  static CONNECTING = 0
  static OPEN = 1
  static CLOSING = 2
  static CLOSED = 3

  readyState = MockWebSocket.OPEN
  send = vi.fn()
  close = vi.fn()
  url: string

  private _listeners: Map<string, ((e: unknown) => void)[]> = new Map()

  constructor(url: string) {
    this.url = url
    // Automatically trigger open on the next tick
    Promise.resolve().then(() => this._trigger('open', undefined))
  }

  addEventListener(event: string, handler: (e: unknown) => void) {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, [])
    }
    this._listeners.get(event)!.push(handler)
  }

  removeEventListener(event: string, handler: (e: unknown) => void) {
    const handlers = this._listeners.get(event)
    if (handlers) {
      this._listeners.set(
        event,
        handlers.filter((h) => h !== handler),
      )
    }
  }

  _trigger(event: string, data: unknown) {
    const handlers = this._listeners.get(event) ?? []
    for (const h of handlers) {
      h(data)
    }
  }
}

vi.stubGlobal('WebSocket', MockWebSocket)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns the most recently constructed MockWebSocket instance. */
function getLastWs(): MockWebSocket {
  return (MockWebSocket as unknown as { _lastInstance: MockWebSocket })._lastInstance
}

// Track instances by patching the constructor
const instances: MockWebSocket[] = []
const OriginalMockWebSocket = MockWebSocket

class TrackingMockWebSocket extends OriginalMockWebSocket {
  constructor(url: string) {
    super(url)
    instances.push(this)
  }
}

vi.stubGlobal('WebSocket', TrackingMockWebSocket)

function lastInstance(): TrackingMockWebSocket {
  return instances[instances.length - 1] as TrackingMockWebSocket
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('RemedyWebSocket', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    instances.length = 0
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // -------------------------------------------------------------------------
  // connect()
  // -------------------------------------------------------------------------

  it('creates a WebSocket connection with the correct URL on connect()', () => {
    const rws = new RemedyWebSocket('ws://localhost:8080/api/v1/ws')
    rws.connect()

    expect(instances).toHaveLength(1)
    expect(instances[0].url).toBe('ws://localhost:8080/api/v1/ws')
  })

  it('does not create a second connection if already OPEN', () => {
    const rws = new RemedyWebSocket('ws://localhost:8080/api/v1/ws')
    rws.connect()
    rws.connect() // second call should be a no-op

    expect(instances).toHaveLength(1)
  })

  it('sets status to "connecting" before the socket opens', () => {
    const rws = new RemedyWebSocket('ws://localhost:8080/api/v1/ws')
    const statusValues: string[] = []
    rws.on('__status__', (s) => statusValues.push(s as string))

    // Replace with a non-auto-opening socket
    const NonOpeningSocket = class extends TrackingMockWebSocket {
      constructor(url: string) {
        super(url)
        // Do NOT auto-trigger open
      }
    }
    vi.stubGlobal('WebSocket', NonOpeningSocket)

    rws.connect()
    expect(statusValues).toContain('connecting')

    vi.stubGlobal('WebSocket', TrackingMockWebSocket)
  })

  it('sets status to "connected" after the socket fires open', async () => {
    const rws = new RemedyWebSocket('ws://localhost:8080/api/v1/ws')
    const statusValues: string[] = []
    rws.on('__status__', (s) => statusValues.push(s as string))

    rws.connect()
    await Promise.resolve() // flush microtasks so open fires

    expect(statusValues).toContain('connected')
    expect(rws.connectionStatus).toBe('connected')
    expect(rws.isConnected).toBe(true)
  })

  // -------------------------------------------------------------------------
  // disconnect()
  // -------------------------------------------------------------------------

  it('calls ws.close() on disconnect()', async () => {
    const rws = new RemedyWebSocket('ws://localhost:8080/api/v1/ws')
    rws.connect()
    await Promise.resolve()

    rws.disconnect()
    expect(lastInstance().close).toHaveBeenCalledWith(1000, 'Client disconnected')
  })

  it('sets status to "disconnected" after disconnect()', async () => {
    const rws = new RemedyWebSocket('ws://localhost:8080/api/v1/ws')
    const statusValues: string[] = []
    rws.on('__status__', (s) => statusValues.push(s as string))

    rws.connect()
    await Promise.resolve()
    rws.disconnect()

    expect(rws.connectionStatus).toBe('disconnected')
    expect(statusValues).toContain('disconnected')
  })

  it('does not reconnect after a clean 1000 close', async () => {
    const rws = new RemedyWebSocket('ws://localhost:8080/api/v1/ws')
    rws.connect()
    await Promise.resolve()

    const ws = lastInstance()
    // Simulate a normal closure (code 1000)
    ws._trigger('close', { code: 1000 })

    // Advance timers — no reconnect should be scheduled
    vi.advanceTimersByTime(5000)

    // Still only the original instance
    expect(instances).toHaveLength(1)
    expect(rws.connectionStatus).toBe('disconnected')
  })

  // -------------------------------------------------------------------------
  // Event subscription — on() / off (unsubscribe)
  // -------------------------------------------------------------------------

  it('on() registers a listener and returns an unsubscribe function', async () => {
    const rws = new RemedyWebSocket('ws://localhost:8080/api/v1/ws')
    rws.connect()
    await Promise.resolve()

    const handler = vi.fn()
    const unsub = rws.on('job:progress', handler)

    lastInstance()._trigger('message', {
      data: JSON.stringify({ type: 'job:progress', payload: { pct: 50 } }),
    })

    expect(handler).toHaveBeenCalledWith({ pct: 50 })

    // Unsubscribe then re-trigger — should not call handler again
    unsub()
    lastInstance()._trigger('message', {
      data: JSON.stringify({ type: 'job:progress', payload: { pct: 75 } }),
    })

    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('dispatches the event payload to all registered listeners for that type', async () => {
    const rws = new RemedyWebSocket('ws://localhost:8080/api/v1/ws')
    rws.connect()
    await Promise.resolve()

    const h1 = vi.fn()
    const h2 = vi.fn()
    rws.on('job:complete', h1)
    rws.on('job:complete', h2)

    lastInstance()._trigger('message', {
      data: JSON.stringify({ type: 'job:complete', payload: { job_id: 'j-1' } }),
    })

    expect(h1).toHaveBeenCalledWith({ job_id: 'j-1' })
    expect(h2).toHaveBeenCalledWith({ job_id: 'j-1' })
  })

  it('does not dispatch to listeners registered for a different event type', async () => {
    const rws = new RemedyWebSocket('ws://localhost:8080/api/v1/ws')
    rws.connect()
    await Promise.resolve()

    const progressHandler = vi.fn()
    const completeHandler = vi.fn()
    rws.on('job:progress', progressHandler)
    rws.on('job:complete', completeHandler)

    lastInstance()._trigger('message', {
      data: JSON.stringify({ type: 'job:progress', payload: {} }),
    })

    expect(progressHandler).toHaveBeenCalled()
    expect(completeHandler).not.toHaveBeenCalled()
  })

  // -------------------------------------------------------------------------
  // Message parsing
  // -------------------------------------------------------------------------

  it('ignores malformed JSON frames', async () => {
    const rws = new RemedyWebSocket('ws://localhost:8080/api/v1/ws')
    rws.connect()
    await Promise.resolve()

    const handler = vi.fn()
    rws.on('job:progress', handler)

    // Malformed JSON — should not throw or call handler
    expect(() => {
      lastInstance()._trigger('message', { data: 'not-json{{{' })
    }).not.toThrow()

    expect(handler).not.toHaveBeenCalled()
  })

  it('ignores messages without a string type field', async () => {
    const rws = new RemedyWebSocket('ws://localhost:8080/api/v1/ws')
    rws.connect()
    await Promise.resolve()

    const handler = vi.fn()
    rws.on('job:progress', handler)

    lastInstance()._trigger('message', {
      data: JSON.stringify({ type: 123, payload: {} }),
    })

    expect(handler).not.toHaveBeenCalled()
  })

  // -------------------------------------------------------------------------
  // Job subscriptions
  // -------------------------------------------------------------------------

  it('sends subscribe message when subscribeToJobProgress is called', async () => {
    const rws = new RemedyWebSocket('ws://localhost:8080/api/v1/ws')
    rws.connect()
    await Promise.resolve()

    rws.subscribeToJobProgress('job-abc')
    expect(lastInstance().send).toHaveBeenCalledWith(
      JSON.stringify({ type: 'subscribe_job_progress', payload: { job_id: 'job-abc' } }),
    )
  })

  it('sends unsubscribe message when unsubscribeFromJobProgress is called', async () => {
    const rws = new RemedyWebSocket('ws://localhost:8080/api/v1/ws')
    rws.connect()
    await Promise.resolve()

    rws.subscribeToJobProgress('job-abc')
    rws.unsubscribeFromJobProgress('job-abc')

    expect(lastInstance().send).toHaveBeenCalledWith(
      JSON.stringify({ type: 'unsubscribe_job_progress', payload: { job_id: 'job-abc' } }),
    )
  })

  // -------------------------------------------------------------------------
  // Error event
  // -------------------------------------------------------------------------

  it('emits __error__ event when the socket fires error', async () => {
    const rws = new RemedyWebSocket('ws://localhost:8080/api/v1/ws')
    rws.connect()
    await Promise.resolve()

    const errorHandler = vi.fn()
    rws.on('__error__', errorHandler)

    lastInstance()._trigger('error', {})

    expect(errorHandler).toHaveBeenCalledWith({ message: 'WebSocket error' })
  })

  // -------------------------------------------------------------------------
  // Auto-reconnect
  // -------------------------------------------------------------------------

  it('schedules reconnect when socket closes with non-1000 code', async () => {
    const rws = new RemedyWebSocket('ws://localhost:8080/api/v1/ws')
    rws.connect()
    await Promise.resolve()

    expect(instances).toHaveLength(1)

    // Simulate unexpected close
    lastInstance()._trigger('close', { code: 1006 })

    // Status transitions to reconnecting
    expect(rws.connectionStatus).toBe('reconnecting')

    // Advance past the first reconnect delay (1000 ms)
    vi.advanceTimersByTime(1100)
    await Promise.resolve()

    // A new connection should have been attempted
    expect(instances.length).toBeGreaterThan(1)
  })

  it('emits __status__ "reconnecting" before reconnect attempt', async () => {
    const rws = new RemedyWebSocket('ws://localhost:8080/api/v1/ws')
    const statuses: string[] = []
    rws.on('__status__', (s) => statuses.push(s as string))
    rws.connect()
    await Promise.resolve()

    lastInstance()._trigger('close', { code: 1006 })

    expect(statuses).toContain('reconnecting')
  })

  it('emits __max_reconnects__ and sets status to disconnected after max attempts', async () => {
    // A standalone WebSocket mock that tracks listeners but never auto-fires 'open'.
    const allInstances: StandaloneWs[] = []

    class StandaloneWs {
      static CONNECTING = 0
      static OPEN = 1
      static CLOSING = 2
      static CLOSED = 3

      readyState = StandaloneWs.CONNECTING
      url: string
      send = vi.fn()
      close = vi.fn()
      private _ls: Map<string, ((e: unknown) => void)[]> = new Map()

      constructor(url: string) {
        this.url = url
        allInstances.push(this)
      }

      addEventListener(ev: string, h: (e: unknown) => void) {
        if (!this._ls.has(ev)) this._ls.set(ev, [])
        this._ls.get(ev)!.push(h)
      }

      removeEventListener(ev: string, h: (e: unknown) => void) {
        this._ls.set(ev, (this._ls.get(ev) ?? []).filter((fn) => fn !== h))
      }

      trigger(ev: string, data: unknown) {
        for (const h of this._ls.get(ev) ?? []) h(data)
      }
    }

    vi.stubGlobal('WebSocket', StandaloneWs)

    const rws = new RemedyWebSocket('ws://localhost:8080/api/v1/ws')
    const maxReconnectHandler = vi.fn()
    rws.on('__max_reconnects__', maxReconnectHandler)

    rws.connect()
    // Manually fire 'open' on the first socket so reconnectAttempts resets to 0
    const first = allInstances[allInstances.length - 1]
    first.readyState = StandaloneWs.OPEN
    first.trigger('open', undefined)

    // Each close increments reconnectAttempts and schedules a setTimeout.
    // The setTimeout delay doubles each attempt: 1s, 2s, 4s, 8s, ... up to 30s.
    // After maxReconnectAttempts (10) closes, the 11th call to reconnect() fires
    // __max_reconnects__. We use advanceTimersByTime(delay) to fire exactly one
    // timer per iteration so we don't accidentally cascade all retries at once.
    const delays = [1000, 2000, 4000, 8000, 16000, 30000, 30000, 30000, 30000, 30000]

    for (let i = 0; i < 10; i++) {
      const currentWs = allInstances[allInstances.length - 1]
      currentWs.readyState = StandaloneWs.CLOSED
      currentWs.trigger('close', { code: 1006 })
      // Fire only the specific timer for this iteration to avoid cascading
      vi.advanceTimersByTime(delays[i]! + 100)
      await Promise.resolve()
    }

    // After 10 reconnect cycles the 11th close should have fired __max_reconnects__
    const finalWs = allInstances[allInstances.length - 1]
    finalWs.readyState = StandaloneWs.CLOSED
    finalWs.trigger('close', { code: 1006 })

    expect(maxReconnectHandler).toHaveBeenCalled()
    expect(rws.connectionStatus).toBe('disconnected')

    // Restore
    vi.stubGlobal('WebSocket', TrackingMockWebSocket)
  })
})

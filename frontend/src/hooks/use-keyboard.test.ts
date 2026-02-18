import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { fireEvent } from '@testing-library/react'

import { useKeyboardShortcut } from './use-keyboard'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Dispatch a keydown event on window with the given properties.
 */
function pressKey(
  key: string,
  modifiers: {
    metaKey?: boolean
    ctrlKey?: boolean
    shiftKey?: boolean
    altKey?: boolean
  } = {},
  target: EventTarget = window
) {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
    metaKey: modifiers.metaKey ?? false,
    ctrlKey: modifiers.ctrlKey ?? false,
    shiftKey: modifiers.shiftKey ?? false,
    altKey: modifiers.altKey ?? false,
  })
  // fireEvent dispatches on the given target; for window-level we just use
  // window.dispatchEvent which bypasses RTL's target overrides.
  if (target === window) {
    window.dispatchEvent(event)
  } else {
    ;(target as HTMLElement).dispatchEvent(event)
  }
  return event
}

/**
 * Create an element of the given tag, attach it to document.body, dispatch a
 * keydown event on it, and return both the element and the event.
 */
function pressKeyOnElement(
  tag: 'input' | 'textarea' | 'select' | 'div',
  key: string
) {
  const el = document.createElement(tag)
  document.body.appendChild(el)
  el.focus()

  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
  })
  el.dispatchEvent(event)

  document.body.removeChild(el)
  return event
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useKeyboardShortcut', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // --- Basic matching ------------------------------------------------------

  it('calls the callback when the matching key is pressed', () => {
    const callback = vi.fn()
    renderHook(() => useKeyboardShortcut('a', callback))

    pressKey('a')
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('does not call the callback for a non-matching key', () => {
    const callback = vi.fn()
    renderHook(() => useKeyboardShortcut('a', callback))

    pressKey('b')
    expect(callback).not.toHaveBeenCalled()
  })

  it('calls the callback multiple times when the key is pressed repeatedly', () => {
    const callback = vi.fn()
    renderHook(() => useKeyboardShortcut('x', callback))

    pressKey('x')
    pressKey('x')
    pressKey('x')
    expect(callback).toHaveBeenCalledTimes(3)
  })

  // --- Case-insensitive key matching for single chars ----------------------

  it('matches uppercase key against lowercase shortcut definition', () => {
    const callback = vi.fn()
    renderHook(() => useKeyboardShortcut('a', callback))

    pressKey('A') // uppercase event key should match 'a'
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('matches uppercase shortcut definition against lowercase event key', () => {
    const callback = vi.fn()
    renderHook(() => useKeyboardShortcut('A', callback))

    pressKey('a')
    expect(callback).toHaveBeenCalledTimes(1)
  })

  // --- Multi-char keys (Escape) are case-sensitive -------------------------

  it('matches "Escape" exactly (case-sensitive for multi-char keys)', () => {
    const callback = vi.fn()
    renderHook(() => useKeyboardShortcut('Escape', callback))

    pressKey('Escape')
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('does not match "escape" when shortcut is "Escape"', () => {
    const callback = vi.fn()
    renderHook(() => useKeyboardShortcut('Escape', callback))

    pressKey('escape') // wrong casing
    expect(callback).not.toHaveBeenCalled()
  })

  // --- Meta modifier -------------------------------------------------------

  it('calls the callback when meta modifier is required and metaKey is true', () => {
    const callback = vi.fn()
    renderHook(() => useKeyboardShortcut('k', callback, { meta: true }))

    pressKey('k', { metaKey: true })
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('does not call the callback when meta is required but metaKey is false', () => {
    const callback = vi.fn()
    renderHook(() => useKeyboardShortcut('k', callback, { meta: true }))

    pressKey('k') // no metaKey
    expect(callback).not.toHaveBeenCalled()
  })

  it('does not fire a plain shortcut when unwanted metaKey is present', () => {
    const callback = vi.fn()
    // shortcut registered WITHOUT meta requirement
    renderHook(() => useKeyboardShortcut('k', callback))

    // Pressing Cmd+K should NOT trigger a plain 'k' shortcut
    pressKey('k', { metaKey: true })
    expect(callback).not.toHaveBeenCalled()
  })

  // --- Ctrl modifier -------------------------------------------------------

  it('calls the callback when ctrl modifier is required and ctrlKey is true', () => {
    const callback = vi.fn()
    renderHook(() => useKeyboardShortcut('s', callback, { ctrl: true }))

    pressKey('s', { ctrlKey: true })
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('does not call the callback when ctrl is required but ctrlKey is false', () => {
    const callback = vi.fn()
    renderHook(() => useKeyboardShortcut('s', callback, { ctrl: true }))

    pressKey('s') // no ctrlKey
    expect(callback).not.toHaveBeenCalled()
  })

  it('does not fire a plain shortcut when unwanted ctrlKey is present', () => {
    const callback = vi.fn()
    renderHook(() => useKeyboardShortcut('s', callback))

    pressKey('s', { ctrlKey: true })
    expect(callback).not.toHaveBeenCalled()
  })

  // --- Alt modifier --------------------------------------------------------

  it('calls the callback when alt modifier is required and altKey is true', () => {
    const callback = vi.fn()
    renderHook(() => useKeyboardShortcut('p', callback, { alt: true }))

    pressKey('p', { altKey: true })
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('does not fire a plain shortcut when unwanted altKey is present', () => {
    const callback = vi.fn()
    renderHook(() => useKeyboardShortcut('p', callback))

    pressKey('p', { altKey: true })
    expect(callback).not.toHaveBeenCalled()
  })

  // --- Shift modifier ------------------------------------------------------

  it('calls the callback when shift modifier is required and shiftKey is true', () => {
    const callback = vi.fn()
    renderHook(() => useKeyboardShortcut('?', callback, { shift: true }))

    pressKey('?', { shiftKey: true })
    expect(callback).toHaveBeenCalledTimes(1)
  })

  // Note: shift is intentionally NOT guarded when not required (see source).
  // A plain 'a' shortcut can still fire even if Shift is held (e.g. typing '?').

  // --- enabled option ------------------------------------------------------

  it('does not call the callback when enabled=false', () => {
    const callback = vi.fn()
    renderHook(() => useKeyboardShortcut('a', callback, { enabled: false }))

    pressKey('a')
    expect(callback).not.toHaveBeenCalled()
  })

  it('calls the callback when enabled=true (explicit)', () => {
    const callback = vi.fn()
    renderHook(() => useKeyboardShortcut('a', callback, { enabled: true }))

    pressKey('a')
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('stops calling callback after enabled changes to false (re-render)', () => {
    const callback = vi.fn()
    let enabled = true

    const { rerender } = renderHook(() =>
      useKeyboardShortcut('a', callback, { enabled })
    )

    pressKey('a')
    expect(callback).toHaveBeenCalledTimes(1)

    enabled = false
    rerender()

    pressKey('a')
    expect(callback).toHaveBeenCalledTimes(1) // count stays at 1
  })

  // --- Editable target guards ----------------------------------------------

  it('ignores events dispatched from an <input> element', () => {
    const callback = vi.fn()
    renderHook(() => useKeyboardShortcut('a', callback))

    pressKeyOnElement('input', 'a')
    expect(callback).not.toHaveBeenCalled()
  })

  it('ignores events dispatched from a <textarea> element', () => {
    const callback = vi.fn()
    renderHook(() => useKeyboardShortcut('a', callback))

    pressKeyOnElement('textarea', 'a')
    expect(callback).not.toHaveBeenCalled()
  })

  it('ignores events dispatched from a <select> element', () => {
    const callback = vi.fn()
    renderHook(() => useKeyboardShortcut('a', callback))

    pressKeyOnElement('select', 'a')
    expect(callback).not.toHaveBeenCalled()
  })

  it('ignores events dispatched from a contenteditable element', () => {
    const callback = vi.fn()

    // jsdom does not implement the `isContentEditable` getter, so we patch
    // the prototype to simulate the real browser behaviour for this test.
    const originalDescriptor = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      'isContentEditable'
    )
    Object.defineProperty(HTMLElement.prototype, 'isContentEditable', {
      get() {
        return this.getAttribute('contenteditable') === 'true'
      },
      configurable: true,
    })

    try {
      renderHook(() => useKeyboardShortcut('a', callback))

      const el = document.createElement('div')
      el.setAttribute('contenteditable', 'true')
      document.body.appendChild(el)

      const event = new KeyboardEvent('keydown', {
        key: 'a',
        bubbles: true,
        cancelable: true,
      })
      el.dispatchEvent(event)
      document.body.removeChild(el)

      expect(callback).not.toHaveBeenCalled()
    } finally {
      // Restore original descriptor to avoid test pollution
      if (originalDescriptor) {
        Object.defineProperty(
          HTMLElement.prototype,
          'isContentEditable',
          originalDescriptor
        )
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        delete (HTMLElement.prototype as any).isContentEditable
      }
    }
  })

  // --- preventDefault ------------------------------------------------------

  it('calls event.preventDefault when the shortcut matches', () => {
    const callback = vi.fn()
    renderHook(() => useKeyboardShortcut('a', callback))

    // We need to capture the event to check preventDefault
    let capturedEvent: KeyboardEvent | null = null
    const spy = vi.spyOn(window, 'addEventListener').mockImplementation(
      (type, handler) => {
        if (type === 'keydown') {
          capturedEvent = new KeyboardEvent('keydown', {
            key: 'a',
            bubbles: true,
            cancelable: true,
          })
          ;(handler as EventListener)(capturedEvent)
        }
      }
    )
    spy.mockRestore()

    // Alternative: dispatch and verify the effect via the spied preventDefault
    const event = new KeyboardEvent('keydown', {
      key: 'a',
      bubbles: true,
      cancelable: true,
    })
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault')
    window.dispatchEvent(event)

    expect(preventDefaultSpy).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('does not call preventDefault when the key does not match', () => {
    const callback = vi.fn()
    renderHook(() => useKeyboardShortcut('a', callback))

    const event = new KeyboardEvent('keydown', {
      key: 'b',
      bubbles: true,
      cancelable: true,
    })
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault')
    window.dispatchEvent(event)

    expect(preventDefaultSpy).not.toHaveBeenCalled()
  })

  // --- Cleanup (unmount) ---------------------------------------------------

  it('removes the event listener when the hook unmounts', () => {
    const callback = vi.fn()
    const { unmount } = renderHook(() => useKeyboardShortcut('a', callback))

    unmount()
    pressKey('a')

    expect(callback).not.toHaveBeenCalled()
  })

  // --- Stable callback ref -------------------------------------------------

  it('always calls the latest callback reference without re-registering', () => {
    let callCount = 0
    const firstCallback = vi.fn(() => { callCount++ })
    const secondCallback = vi.fn(() => { callCount++ })

    const { rerender } = renderHook(
      ({ cb }: { cb: () => void }) => useKeyboardShortcut('a', cb),
      { initialProps: { cb: firstCallback } }
    )

    pressKey('a')
    expect(firstCallback).toHaveBeenCalledTimes(1)

    // Update callback reference — the listener should NOT be re-registered,
    // but the new callback should be called on the next keypress.
    rerender({ cb: secondCallback })
    pressKey('a')

    expect(secondCallback).toHaveBeenCalledTimes(1)
    expect(callCount).toBe(2)
  })
})

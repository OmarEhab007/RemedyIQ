'use client'

/**
 * use-keyboard.ts — Declarative keyboard shortcut hook.
 *
 * Usage:
 *   // Cmd/Ctrl + K
 *   useKeyboardShortcut('k', openSearch, { meta: true })
 *
 *   // Shift + ? (show help)
 *   useKeyboardShortcut('?', showHelp, { shift: true })
 *
 *   // Conditionally disabled
 *   useKeyboardShortcut('s', saveDocument, { meta: true, enabled: canSave })
 *
 *   // Escape (no modifiers)
 *   useKeyboardShortcut('Escape', closeModal)
 */

import { useEffect, useRef } from 'react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface KeyboardShortcutOptions {
  /** Require the Meta key (Cmd on macOS, Win on Windows). Default false. */
  meta?: boolean
  /** Require the Ctrl key. Default false. */
  ctrl?: boolean
  /** Require the Shift key. Default false. */
  shift?: boolean
  /** Require the Alt/Option key. Default false. */
  alt?: boolean
  /**
   * Whether the shortcut is active. Defaults to true.
   * Set to false to temporarily disable without removing the hook call.
   */
  enabled?: boolean
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns true when the active element is an input, textarea, select, or
 * any element with contenteditable="true". Keyboard shortcuts should not
 * fire when the user is typing.
 */
function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName.toLowerCase()
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true
  if (target.isContentEditable) return true
  return false
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Registers a keydown listener for the specified key + modifier combination.
 * Fires `callback` when the shortcut matches, calling `event.preventDefault()`
 * to suppress default browser behaviour.
 *
 * Automatically ignores events fired while focus is inside an editable element
 * (input, textarea, contenteditable) so typing is never interrupted.
 *
 * @param key         The `event.key` value to match (e.g. 'k', 'Escape', '?').
 *                    Comparison is case-insensitive for single-character keys.
 * @param callback    The function to invoke when the shortcut fires.
 * @param options     Optional modifier flags and enabled toggle.
 */
export function useKeyboardShortcut(
  key: string,
  callback: () => void,
  options: KeyboardShortcutOptions = {}
): void {
  const {
    meta = false,
    ctrl = false,
    shift = false,
    alt = false,
    enabled = true,
  } = options

  // Keep a stable ref to the callback so the effect doesn't re-run on
  // every render when an inline function is passed.
  const callbackRef = useRef(callback)
  callbackRef.current = callback

  useEffect(() => {
    if (!enabled) return

    function handleKeyDown(event: KeyboardEvent): void {
      // Ignore events from editable elements
      if (isEditableTarget(event.target)) return

      // Normalise the key for comparison (single chars lowercased)
      const eventKey =
        event.key.length === 1 ? event.key.toLowerCase() : event.key
      const targetKey = key.length === 1 ? key.toLowerCase() : key

      if (eventKey !== targetKey) return

      // Check modifier keys
      if (meta && !event.metaKey) return
      if (ctrl && !event.ctrlKey) return
      if (shift && !event.shiftKey) return
      if (alt && !event.altKey) return

      // Guard against unwanted modifier combos when none are required.
      // For example, `useKeyboardShortcut('k', fn)` should not fire on Cmd+K.
      if (!meta && event.metaKey) return
      if (!ctrl && event.ctrlKey) return
      if (!alt && event.altKey) return
      // Note: shift is NOT guarded here — Shift is commonly pressed for `?`
      // and similar characters where the key itself implies the shift. Callers
      // that need strict shift exclusion should explicitly pass `shift: false`
      // and check event.shiftKey themselves, or rely on the key value being
      // different without shift.

      event.preventDefault()
      callbackRef.current()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [key, meta, ctrl, shift, alt, enabled])
}

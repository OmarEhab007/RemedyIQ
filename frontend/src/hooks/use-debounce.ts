'use client'

/**
 * use-debounce.ts — Generic debounce hook.
 *
 * Returns a debounced copy of `value` that only updates after `delay`
 * milliseconds have elapsed since the last change. Cleans up the pending
 * timer automatically on unmount or when dependencies change.
 *
 * Usage:
 *   const [query, setQuery] = useState('')
 *   const debouncedQuery = useDebounce(query, 400)
 *
 *   // Fires API request only after typing stops for 400 ms
 *   useEffect(() => {
 *     if (debouncedQuery) fetchResults(debouncedQuery)
 *   }, [debouncedQuery])
 */

import { useState, useEffect } from 'react'

/**
 * Returns a debounced version of `value`.
 *
 * @param value  The value to debounce — can be any type.
 * @param delay  Debounce wait in milliseconds. Defaults to 300 ms.
 * @returns      The last stable value after the delay has passed.
 */
export function useDebounce<T>(value: T, delay = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    // Clear the previous timer whenever value or delay changes,
    // and also on unmount.
    return () => clearTimeout(timer)
  }, [value, delay])

  return debouncedValue
}

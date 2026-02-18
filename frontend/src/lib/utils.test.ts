import { describe, it, expect } from 'vitest'
import { cn, formatDate, formatDuration, formatBytes, formatNumber, truncate } from './utils'

// ---------------------------------------------------------------------------
// cn — Tailwind class name merging
// ---------------------------------------------------------------------------

describe('cn', () => {
  it('returns an empty string when called with no arguments', () => {
    expect(cn()).toBe('')
  })

  it('returns a single class name unchanged', () => {
    expect(cn('px-4')).toBe('px-4')
  })

  it('merges multiple class names with a space', () => {
    const result = cn('px-4', 'py-2', 'bg-blue-500')
    expect(result).toContain('px-4')
    expect(result).toContain('py-2')
    expect(result).toContain('bg-blue-500')
  })

  it('omits falsy conditional classes (false)', () => {
    const result = cn('px-4', false && 'hidden', 'py-2')
    expect(result).not.toContain('hidden')
    expect(result).toContain('px-4')
    expect(result).toContain('py-2')
  })

  it('omits undefined conditional classes', () => {
    const result = cn('px-4', undefined, 'py-2')
    expect(result).not.toContain('undefined')
    expect(result).toContain('px-4')
    expect(result).toContain('py-2')
  })

  it('omits null conditional classes', () => {
    const result = cn('px-4', null, 'py-2')
    expect(result).not.toContain('null')
    expect(result).toContain('px-4')
  })

  it('includes truthy conditional classes', () => {
    const isActive = true
    const result = cn('base', isActive && 'bg-blue-500')
    expect(result).toContain('base')
    expect(result).toContain('bg-blue-500')
  })

  it('resolves Tailwind conflicts (later class wins)', () => {
    // tailwind-merge should deduplicate conflicting utilities.
    // 'px-2' and 'px-4' conflict — the last one should win.
    const result = cn('px-2', 'px-4')
    expect(result).toContain('px-4')
    expect(result).not.toContain('px-2')
  })

  it('handles array of class names', () => {
    const result = cn(['px-4', 'py-2'], 'bg-red-500')
    expect(result).toContain('px-4')
    expect(result).toContain('py-2')
    expect(result).toContain('bg-red-500')
  })

  it('handles an object with boolean values', () => {
    const result = cn({ 'bg-blue-500': true, 'bg-red-500': false })
    expect(result).toContain('bg-blue-500')
    expect(result).not.toContain('bg-red-500')
  })
})

// ---------------------------------------------------------------------------
// formatDate — human-readable date strings
// ---------------------------------------------------------------------------

describe('formatDate', () => {
  it('formats an ISO 8601 string input', () => {
    // Use a fixed UTC instant to avoid locale/timezone flakiness in CI.
    // The formatter is 'en-US' so the format is predictable.
    const result = formatDate('2024-03-15T00:00:00Z')
    expect(result).toMatch(/Mar/)
    expect(result).toMatch(/15/)
    expect(result).toMatch(/2024/)
  })

  it('formats a Date object input', () => {
    const date = new Date('2024-06-01T12:00:00Z')
    const result = formatDate(date)
    expect(result).toMatch(/Jun/)
    expect(result).toMatch(/2024/)
  })

  it('returns "Invalid date" for an invalid string', () => {
    expect(formatDate('not-a-date')).toBe('Invalid date')
  })

  it('returns "Invalid date" for an invalid Date object', () => {
    expect(formatDate(new Date('invalid'))).toBe('Invalid date')
  })

  it('includes time component when dateOnly=false (default)', () => {
    const result = formatDate('2024-03-15T14:30:00Z')
    // en-US with hour/minute should have digits resembling a time
    expect(result).toMatch(/\d{1,2}:\d{2}/)
  })

  it('omits time component when dateOnly=true', () => {
    const result = formatDate('2024-03-15T14:30:00Z', true)
    // Should contain month, day, year but no colon-separated time
    expect(result).not.toMatch(/\d{1,2}:\d{2}/)
    expect(result).toMatch(/Mar/)
    expect(result).toMatch(/2024/)
  })

  it('handles epoch (1970-01-01T00:00:00Z) without crashing', () => {
    const result = formatDate('1970-01-01T00:00:00Z')
    expect(result).toMatch(/1970/)
    expect(result).not.toBe('Invalid date')
  })

  it('handles a far-future date without crashing', () => {
    // Use noon UTC on Jan 1 to avoid timezone roll-over into 2100 on any offset.
    const result = formatDate('2099-01-01T12:00:00Z')
    expect(result).toMatch(/2099/)
    expect(result).not.toBe('Invalid date')
  })
})

// ---------------------------------------------------------------------------
// formatDuration — milliseconds to human-readable
// ---------------------------------------------------------------------------

describe('formatDuration', () => {
  it('formats sub-second durations with ms suffix', () => {
    expect(formatDuration(450)).toBe('450ms')
  })

  it('rounds sub-second durations to the nearest ms', () => {
    expect(formatDuration(450.6)).toBe('451ms')
    expect(formatDuration(0.4)).toBe('0ms')
  })

  it('formats exactly 0 ms', () => {
    expect(formatDuration(0)).toBe('0ms')
  })

  it('formats exactly 999 ms', () => {
    expect(formatDuration(999)).toBe('999ms')
  })

  it('formats 1000 ms as "1s"', () => {
    expect(formatDuration(1000)).toBe('1s')
  })

  it('formats a fractional-second duration', () => {
    expect(formatDuration(1234)).toBe('1.2s')
  })

  it('formats 59999 ms correctly (just under 1 minute)', () => {
    // 59.999s → rounds to 60.0 → still less than 60? No: 59999/1000=59.999 < 60.
    // toFixed(1) → "60.0", but: totalSeconds < 60 is true for 59.999
    expect(formatDuration(59999)).toBe('60.0s')
  })

  it('formats 60000 ms as "1m"', () => {
    expect(formatDuration(60000)).toBe('1m')
  })

  it('formats 65000 ms as "1m 5s"', () => {
    expect(formatDuration(65000)).toBe('1m 5s')
  })

  it('formats 90000 ms as "1m 30s"', () => {
    expect(formatDuration(90000)).toBe('1m 30s')
  })

  it('formats an exact minute with no seconds remainder as "Xm"', () => {
    expect(formatDuration(120000)).toBe('2m')
  })

  it('formats 3600000 ms (1 hour) as "1h"', () => {
    expect(formatDuration(3600000)).toBe('1h')
  })

  it('formats 3700000 ms as "1h 1m"', () => {
    expect(formatDuration(3700000)).toBe('1h 1m')
  })

  it('formats 7260000 ms as "2h 1m"', () => {
    expect(formatDuration(7260000)).toBe('2h 1m')
  })

  it('formats exactly 2 hours with no remainder as "2h"', () => {
    expect(formatDuration(7200000)).toBe('2h')
  })

  it('returns the em dash for negative values', () => {
    expect(formatDuration(-1)).toBe('—')
    expect(formatDuration(-1000)).toBe('—')
  })

  it('returns the em dash for Infinity', () => {
    expect(formatDuration(Infinity)).toBe('—')
  })

  it('returns the em dash for -Infinity', () => {
    expect(formatDuration(-Infinity)).toBe('—')
  })

  it('returns the em dash for NaN', () => {
    expect(formatDuration(NaN)).toBe('—')
  })
})

// ---------------------------------------------------------------------------
// formatBytes — byte count to human-readable size
// ---------------------------------------------------------------------------

describe('formatBytes', () => {
  it('formats 0 bytes as "0 B"', () => {
    expect(formatBytes(0)).toBe('0 B')
  })

  it('formats bytes below 1 KB', () => {
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(1)).toBe('1 B')
    expect(formatBytes(1023)).toBe('1023 B')
  })

  it('formats 1024 bytes as "1.0 KB"', () => {
    expect(formatBytes(1024)).toBe('1.0 KB')
  })

  it('formats 1536 bytes as "1.5 KB"', () => {
    expect(formatBytes(1536)).toBe('1.5 KB')
  })

  it('formats 1 MB (1048576 bytes)', () => {
    expect(formatBytes(1048576)).toBe('1.0 MB')
  })

  it('formats 1.5 MB', () => {
    expect(formatBytes(1572864)).toBe('1.5 MB')
  })

  it('formats 1 GB (1073741824 bytes)', () => {
    expect(formatBytes(1073741824)).toBe('1.0 GB')
  })

  it('formats 1 TB', () => {
    expect(formatBytes(1099511627776)).toBe('1.0 TB')
  })

  it('caps at TB — does not create a PB unit', () => {
    // > 1 PB should still show in TB
    const result = formatBytes(2 * 1099511627776)
    expect(result).toContain('TB')
    expect(result).not.toContain('PB')
  })

  it('returns the em dash for negative bytes', () => {
    expect(formatBytes(-1)).toBe('—')
    expect(formatBytes(-1024)).toBe('—')
  })

  it('returns the em dash for Infinity', () => {
    expect(formatBytes(Infinity)).toBe('—')
  })

  it('returns the em dash for NaN', () => {
    expect(formatBytes(NaN)).toBe('—')
  })
})

// ---------------------------------------------------------------------------
// formatNumber — locale-aware thousands separator
// ---------------------------------------------------------------------------

describe('formatNumber', () => {
  it('formats numbers below 1000 without separators', () => {
    expect(formatNumber(42)).toBe('42')
    expect(formatNumber(999)).toBe('999')
  })

  it('formats 1000 with a comma', () => {
    expect(formatNumber(1000)).toBe('1,000')
  })

  it('formats 1234567 with commas', () => {
    expect(formatNumber(1234567)).toBe('1,234,567')
  })

  it('formats 0', () => {
    expect(formatNumber(0)).toBe('0')
  })

  it('formats negative numbers', () => {
    expect(formatNumber(-1234)).toBe('-1,234')
  })

  it('returns the em dash for Infinity', () => {
    expect(formatNumber(Infinity)).toBe('—')
  })

  it('returns the em dash for -Infinity', () => {
    expect(formatNumber(-Infinity)).toBe('—')
  })

  it('returns the em dash for NaN', () => {
    expect(formatNumber(NaN)).toBe('—')
  })
})

// ---------------------------------------------------------------------------
// truncate — string truncation with ellipsis
// ---------------------------------------------------------------------------

describe('truncate', () => {
  it('returns the string unchanged when shorter than maxLength', () => {
    expect(truncate('Hello', 10)).toBe('Hello')
  })

  it('returns the string unchanged when equal to maxLength', () => {
    expect(truncate('Hello', 5)).toBe('Hello')
  })

  it('truncates and appends "..." when longer than maxLength', () => {
    expect(truncate('Hello, World!', 8)).toBe('Hello...')
  })

  it('truncates correctly for the example in the docstring', () => {
    // 'Hello, World!' has 13 chars; maxLength=8 → slice(0, 5) + '...' = 'Hello...'
    expect(truncate('Hello, World!', 8)).toBe('Hello...')
  })

  it('handles maxLength=4 (just above the 3-char boundary)', () => {
    // slice(0, 4-3=1) + '...' = 'H...'
    expect(truncate('Hello', 4)).toBe('H...')
  })

  it('returns the first maxLength chars when maxLength <= 3', () => {
    expect(truncate('Hello', 3)).toBe('Hel')
    expect(truncate('Hello', 2)).toBe('He')
    expect(truncate('Hello', 1)).toBe('H')
  })

  it('handles maxLength=0 by returning an empty string', () => {
    // maxLength <= 3 → slice(0, 0) = ''
    expect(truncate('Hello', 0)).toBe('')
  })

  it('handles an empty string input', () => {
    expect(truncate('', 5)).toBe('')
  })

  it('handles an empty string with maxLength=0', () => {
    expect(truncate('', 0)).toBe('')
  })

  it('handles a string with exactly maxLength-3 chars plus some excess', () => {
    // 'ABCDE' (5 chars), maxLength=5 → equal, return unchanged
    expect(truncate('ABCDE', 5)).toBe('ABCDE')
    // 'ABCDEF' (6 chars), maxLength=5 → slice(0,2) + '...' = 'AB...'
    expect(truncate('ABCDEF', 5)).toBe('AB...')
  })

  it('correctly handles a very large maxLength', () => {
    expect(truncate('short', 10000)).toBe('short')
  })
})

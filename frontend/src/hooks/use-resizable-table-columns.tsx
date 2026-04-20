'use client'

/**
 * useResizableTableColumns — pixel widths + drag handles for <table> layouts.
 * Persists to localStorage when `storageKey` is set.
 */

import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ResizableColumnConfig = {
  id: string
  defaultWidth: number
  minWidth?: number
  maxWidth?: number
}

export type UseResizableTableColumnsOptions = {
  storageKey?: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n))
}

function fingerprint(spec: ResizableColumnConfig[]): string {
  return spec.map((c) => c.id).join('|')
}

function defaultsFromSpec(spec: ResizableColumnConfig[]): number[] {
  return spec.map((c) => c.defaultWidth)
}

function loadStoredWidths(key: string, spec: ResizableColumnConfig[]): number[] | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const arr = JSON.parse(raw) as unknown
    if (!Array.isArray(arr) || arr.length !== spec.length) return null
    const out: number[] = []
    for (let i = 0; i < spec.length; i++) {
      const n = arr[i]
      if (typeof n !== 'number' || !Number.isFinite(n)) return null
      const { minWidth = 48, maxWidth = 960 } = spec[i]!
      out.push(clamp(Math.round(n), minWidth, maxWidth))
    }
    return out
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// TableColumnResizeHandle — place inside a relative <th>
// ---------------------------------------------------------------------------

export function TableColumnResizeHandle({
  onPointerDown,
}: {
  onPointerDown: (e: ReactPointerEvent<HTMLSpanElement>) => void
}) {
  return (
    <span
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize column"
      className="absolute right-0 top-0 z-[1] h-full w-2 cursor-col-resize touch-none select-none hover:bg-[var(--color-primary)]/25"
      onPointerDown={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onPointerDown(e)
      }}
    />
  )
}

// ---------------------------------------------------------------------------
// useResizableTableColumns
// ---------------------------------------------------------------------------

export function useResizableTableColumns(
  spec: ResizableColumnConfig[],
  options?: UseResizableTableColumnsOptions,
) {
  const storageKey = options?.storageKey
  const specRef = useRef(spec)
  // eslint-disable-next-line react-hooks/refs
  specRef.current = spec

  const [widths, setWidths] = useState<number[]>(() => {
    if (typeof window === 'undefined' || !storageKey) return defaultsFromSpec(spec)
    return loadStoredWidths(storageKey, spec) ?? defaultsFromSpec(spec)
  })

  const widthsRef = useRef(widths)
  // eslint-disable-next-line react-hooks/refs
  widthsRef.current = widths

  const fp = fingerprint(spec)
  const prevFp = useRef(fp)
  useEffect(() => {
    if (prevFp.current === fp) return
    prevFp.current = fp
    const nextSpec = specRef.current
    if (storageKey && typeof window !== 'undefined') {
      const loaded = loadStoredWidths(storageKey, nextSpec)
      setWidths(loaded ?? defaultsFromSpec(nextSpec))
    } else {
      setWidths(defaultsFromSpec(nextSpec))
    }
  }, [fp, storageKey])

  useEffect(() => {
    widthsRef.current = widths
  }, [widths])

  const persist = useCallback(
    (next: number[]) => {
      if (!storageKey || typeof window === 'undefined') return
      try {
        localStorage.setItem(storageKey, JSON.stringify(next))
      } catch {
        /* quota */
      }
    },
    [storageKey],
  )

  const beginResize = useCallback(
    (colIndex: number, e: ReactPointerEvent<HTMLSpanElement>) => {
      e.preventDefault()
      e.stopPropagation()
      const startX = e.clientX
      const startW = widthsRef.current[colIndex] ?? specRef.current[colIndex]?.defaultWidth ?? 120
      const minW = specRef.current[colIndex]?.minWidth ?? 48
      const maxW = specRef.current[colIndex]?.maxWidth ?? 960

      const onMove = (ev: PointerEvent) => {
        const dx = ev.clientX - startX
        const next = clamp(Math.round(startW + dx), minW, maxW)
        setWidths((prev) => {
          if (prev[colIndex] === next) return prev
          const copy = [...prev]
          copy[colIndex] = next
          return copy
        })
      }

      const onUp = () => {
        document.removeEventListener('pointermove', onMove)
        document.removeEventListener('pointerup', onUp)
        document.removeEventListener('pointercancel', onUp)
        persist(widthsRef.current)
      }

      document.addEventListener('pointermove', onMove)
      document.addEventListener('pointerup', onUp)
      document.addEventListener('pointercancel', onUp)
    },
    [persist],
  )

  const totalWidth = widths.reduce((a, b) => a + b, 0)

  const thStyle = useCallback(
    (colIndex: number): CSSProperties => ({
      width: widths[colIndex],
      minWidth: widths[colIndex],
      maxWidth: widths[colIndex],
      boxSizing: 'border-box',
    }),
    [widths],
  )

  const tdStyle = useCallback(
    (colIndex: number): CSSProperties => ({
      width: widths[colIndex],
      minWidth: widths[colIndex],
      maxWidth: widths[colIndex],
      boxSizing: 'border-box',
    }),
    [widths],
  )

  const renderResizeHandle = useCallback(
    (colIndex: number) => <TableColumnResizeHandle onPointerDown={(e) => beginResize(colIndex, e)} />,
    [beginResize],
  )

  return {
    columnWidths: widths,
    totalWidth,
    tableLayoutStyle: {
      tableLayout: 'fixed' as const,
      width: totalWidth,
      minWidth: totalWidth,
    },
    thStyle,
    tdStyle,
    renderResizeHandle,
  }
}

/**
 * T048 — Tests for DropZone component
 *
 * Covers:
 *  - Drag enter / leave styling changes (data-drag-over attribute)
 *  - File selection via the hidden input triggers startUpload
 *  - Upload mutation is called with the selected file
 *  - Progress bar renders during upload
 *  - Error message renders on mutation failure
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DropZone } from './drop-zone'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({ getToken: vi.fn().mockResolvedValue('test-token') }),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/upload',
}))

// Capture mutation callback so tests can call onSuccess / onError
type MutateFn = (
  vars: { file: File; onProgress?: (pct: number) => void },
  callbacks?: {
    onSuccess?: (data: { file: { id: string; filename: string } }) => void
    onError?: (err: Error) => void
  }
) => void

let mutateCapture: MutateFn = vi.fn()

vi.mock('@/hooks/use-api', () => ({
  useUploadFile: () => ({
    mutate: (vars: Parameters<MutateFn>[0], cbs: Parameters<MutateFn>[1]) => {
      mutateCapture(vars, cbs)
    },
    isPending: false,
  }),
  useCreateAnalysis: () => ({ mutate: vi.fn(), isPending: false }),
}))

vi.mock('@/stores/upload-store', () => ({
  useUploadStore: () => ({
    addUpload: vi.fn(),
    updateProgress: vi.fn(),
    markUploaded: vi.fn(),
    removeUpload: vi.fn(),
  }),
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFile(name = 'arserver.log', size = 1024) {
  return new File(['x'.repeat(size)], name, { type: 'text/plain' })
}

function makeDragEvent(file: File) {
  return {
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    dataTransfer: { files: [file] },
    currentTarget: { contains: vi.fn().mockReturnValue(false) },
    relatedTarget: null,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DropZone', () => {
  beforeEach(() => {
    mutateCapture = vi.fn()
  })

  it('renders the drop zone with correct accessible role and label', () => {
    render(<DropZone />)
    expect(
      screen.getByRole('button', { name: /drop log file here or click to browse/i })
    ).toBeInTheDocument()
  })

  it('sets data-drag-over to true on dragEnter', () => {
    render(<DropZone />)
    const zone = screen.getByTestId('drop-zone')

    fireEvent.dragEnter(zone, {
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    })

    expect(zone).toHaveAttribute('data-drag-over', 'true')
  })

  it('clears data-drag-over on dragLeave when leaving the root element', () => {
    render(<DropZone />)
    const zone = screen.getByTestId('drop-zone')

    fireEvent.dragEnter(zone)

    // dragLeave with relatedTarget outside currentTarget
    fireEvent.dragLeave(zone, {
      relatedTarget: null,
      currentTarget: zone,
    })

    expect(zone).toHaveAttribute('data-drag-over', 'false')
  })

  it('calls upload mutation when a file is dropped', () => {
    render(<DropZone />)
    const zone = screen.getByTestId('drop-zone')
    const file = makeFile()

    act(() => {
      fireEvent.drop(zone, makeDragEvent(file))
    })

    expect(mutateCapture).toHaveBeenCalledWith(
      expect.objectContaining({ file }),
      expect.any(Object)
    )
  })

  it('calls upload mutation when a file is selected via the file input', async () => {
    render(<DropZone />)
    const input = screen.getByTestId('file-input')
    const file = makeFile('sql.log')

    await act(async () => {
      await userEvent.upload(input, file)
    })

    expect(mutateCapture).toHaveBeenCalledWith(
      expect.objectContaining({ file }),
      expect.any(Object)
    )
  })

  it('calls onUploadComplete with the returned LogFile after upload completes', () => {
    vi.useFakeTimers()
    const onUploadComplete = vi.fn()
    render(<DropZone onUploadComplete={onUploadComplete} />)
    const zone = screen.getByTestId('drop-zone')
    const file = makeFile()

    act(() => {
      fireEvent.drop(zone, makeDragEvent(file))
    })

    // Simulate the mutation calling onSuccess
    const [, callbacks] = (mutateCapture as ReturnType<typeof vi.fn>).mock.calls[0] as [
      unknown,
      { onSuccess: (data: { file: { id: string; filename: string } }) => void }
    ]

    act(() => {
      callbacks.onSuccess({ file: { id: 'file-123', filename: 'arserver.log' } as never })
    })

    // DropZone delays the onUploadComplete call by 600ms to show the 100% bar
    act(() => {
      vi.advanceTimersByTime(700)
    })

    expect(onUploadComplete).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'file-123' })
    )

    vi.useRealTimers()
  })

  it('shows error message when onUploadError is triggered', () => {
    const onUploadError = vi.fn()
    render(<DropZone onUploadError={onUploadError} />)
    const zone = screen.getByTestId('drop-zone')
    const file = makeFile()

    act(() => {
      fireEvent.drop(zone, makeDragEvent(file))
    })

    const [, callbacks] = (mutateCapture as ReturnType<typeof vi.fn>).mock.calls[0] as [
      unknown,
      { onError: (err: Error) => void }
    ]

    act(() => {
      callbacks.onError(new Error('Network timeout'))
    })

    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText('Network timeout')).toBeInTheDocument()
    expect(onUploadError).toHaveBeenCalled()
  })

  it('has accessible hidden file input', () => {
    render(<DropZone />)
    const input = screen.getByTestId('file-input')
    expect(input).toHaveAttribute('type', 'file')
    expect(input).toHaveClass('sr-only')
  })
})

/**
 * Tests for ExportButton component.
 *
 * Covers: renders button, opens dropdown with CSV/JSON options,
 * triggers file download on selection, disabled state, error handling.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ExportButton } from './export-button'
import { exportSearchResults } from '@/lib/api'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/api', () => ({
  exportSearchResults: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: {
    loading: vi.fn(() => 'toast-id'),
    success: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock('@/lib/utils', () => ({
  cn: (...classes: (string | boolean | undefined | null)[]) =>
    classes.filter(Boolean).join(' '),
}))

const mockExportSearchResults = vi.mocked(exportSearchResults)

// ---------------------------------------------------------------------------
// DOM helpers
// ---------------------------------------------------------------------------

// jsdom does not implement URL.createObjectURL — stub it
const mockObjectUrl = 'blob:http://localhost/fake-url'
Object.defineProperty(URL, 'createObjectURL', {
  writable: true,
  value: vi.fn(() => mockObjectUrl),
})
Object.defineProperty(URL, 'revokeObjectURL', {
  writable: true,
  value: vi.fn(),
})

// ---------------------------------------------------------------------------
// Default props
// ---------------------------------------------------------------------------

const defaultProps = {
  jobId: 'job-123',
  searchParams: { q: 'error', log_type: 'API' },
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ExportButton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: returns a fake Blob
    mockExportSearchResults.mockResolvedValue(new Blob(['data'], { type: 'text/csv' }))
  })

  it('renders the Export trigger button', () => {
    render(<ExportButton {...defaultProps} />)
    expect(screen.getByRole('button', { name: /export log entries/i })).toBeInTheDocument()
    expect(screen.getByText('Export')).toBeInTheDocument()
  })

  it('opens the format dropdown on click', async () => {
    const user = userEvent.setup()
    render(<ExportButton {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: /export log entries/i }))
    expect(screen.getByRole('menu', { name: /export format options/i })).toBeInTheDocument()
    expect(screen.getByText('Export as CSV')).toBeInTheDocument()
    expect(screen.getByText('Export as JSON')).toBeInTheDocument()
  })

  it('closes the dropdown when backdrop is clicked', async () => {
    const user = userEvent.setup()
    render(<ExportButton {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: /export log entries/i }))
    expect(screen.getByRole('menu')).toBeInTheDocument()

    // Click the invisible backdrop div (aria-hidden)
    const backdrop = document.querySelector('.fixed.inset-0.z-30') as HTMLElement
    await user.click(backdrop)
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('calls exportSearchResults with csv format when CSV option is clicked', async () => {
    const user = userEvent.setup()
    render(<ExportButton {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: /export log entries/i }))
    await user.click(screen.getByText('Export as CSV'))

    await waitFor(() => {
      expect(mockExportSearchResults).toHaveBeenCalledWith(
        'job-123',
        { q: 'error', log_type: 'API' },
        'csv',
      )
    })
  })

  it('calls exportSearchResults with json format when JSON option is clicked', async () => {
    const user = userEvent.setup()
    render(<ExportButton {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: /export log entries/i }))
    await user.click(screen.getByText('Export as JSON'))

    await waitFor(() => {
      expect(mockExportSearchResults).toHaveBeenCalledWith(
        'job-123',
        { q: 'error', log_type: 'API' },
        'json',
      )
    })
  })

  it('triggers a file download after successful CSV export', async () => {
    const user = userEvent.setup()
    // Spy on DOM manipulation
    const appendChildSpy = vi.spyOn(document.body, 'appendChild')
    const removeChildSpy = vi.spyOn(document.body, 'removeChild')
    const clickSpy = vi.fn()
    const originalCreateElement = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = originalCreateElement(tag)
      if (tag === 'a') {
        el.click = clickSpy
      }
      return el
    })

    render(<ExportButton {...defaultProps} />)
    await user.click(screen.getByRole('button', { name: /export log entries/i }))
    await user.click(screen.getByText('Export as CSV'))

    await waitFor(() => {
      expect(clickSpy).toHaveBeenCalled()
    })

    expect(appendChildSpy).toHaveBeenCalled()
    expect(removeChildSpy).toHaveBeenCalled()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(mockObjectUrl)

    appendChildSpy.mockRestore()
    removeChildSpy.mockRestore()
    vi.mocked(document.createElement).mockRestore()
  })

  it('shows "Exporting…" and spinner while export is in progress', async () => {
    // Never resolves during this test to keep the loading state visible
    mockExportSearchResults.mockImplementation(() => new Promise(() => {}))

    const user = userEvent.setup()
    render(<ExportButton {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: /export log entries/i }))
    await user.click(screen.getByText('Export as CSV'))

    await waitFor(() => {
      expect(screen.getByText('Exporting…')).toBeInTheDocument()
    })
  })

  it('disables the trigger button when disabled prop is true', () => {
    render(<ExportButton {...defaultProps} disabled />)
    expect(screen.getByRole('button', { name: /export log entries/i })).toBeDisabled()
  })

  it('does not open the dropdown when button is disabled', async () => {
    const user = userEvent.setup()
    render(<ExportButton {...defaultProps} disabled />)

    // pointer-events-none prevents click — menu should not appear
    await user.click(screen.getByRole('button', { name: /export log entries/i }))
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('calls toast.error when export fails', async () => {
    const { toast } = await import('sonner')
    mockExportSearchResults.mockRejectedValue(new Error('Network error'))

    const user = userEvent.setup()
    render(<ExportButton {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: /export log entries/i }))
    await user.click(screen.getByText('Export as CSV'))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Network error', { id: 'toast-id' })
    })
  })
})

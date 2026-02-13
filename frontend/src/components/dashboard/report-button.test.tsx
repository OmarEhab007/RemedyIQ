import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ReportButton } from './report-button'

vi.mock('@/lib/api', () => ({
  generateReport: vi.fn(),
}))

describe('ReportButton', () => {
  const jobId = 'job-123'

  const originalOpen = window.open

  beforeEach(() => {
    window.open = vi.fn()
    URL.createObjectURL = vi.fn(() => 'blob:test-url')
    URL.revokeObjectURL = vi.fn()
  })

  afterEach(() => {
    window.open = originalOpen
    vi.clearAllMocks()
  })

  it('renders button', () => {
    render(<ReportButton jobId={jobId} />)

    expect(screen.getByText('Generate Report')).toBeInTheDocument()
  })

  it('renders with file text icon', () => {
    render(<ReportButton jobId={jobId} />)

    expect(screen.getByRole('button', { name: /Generate HTML report/i })).toBeInTheDocument()
  })

  it('opens format dropdown on click', () => {
    render(<ReportButton jobId={jobId} />)

    const dropdownButton = screen.getByRole('button', { name: 'Select report format' })
    fireEvent.click(dropdownButton)

    expect(screen.getByText('HTML')).toBeInTheDocument()
    expect(screen.getByText('JSON')).toBeInTheDocument()
  })

  it('selects HTML format', async () => {
    render(<ReportButton jobId={jobId} />)

    const dropdownButton = screen.getByRole('button', { name: 'Select report format' })
    fireEvent.click(dropdownButton)

    const htmlOption = screen.getByRole('menuitem', { name: /HTML/i })
    fireEvent.click(htmlOption)

    await waitFor(() => {
      expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    })
  })

  it('selects JSON format', async () => {
    render(<ReportButton jobId={jobId} />)

    const dropdownButton = screen.getByRole('button', { name: 'Select report format' })
    fireEvent.click(dropdownButton)

    const jsonOption = screen.getByRole('menuitem', { name: /JSON/i })
    fireEvent.click(jsonOption)

    await waitFor(() => {
      expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    })
  })

  it('shows loading state during report generation', async () => {
    const { generateReport } = await import('@/lib/api')
    vi.mocked(generateReport).mockImplementation(() => new Promise(() => {}))

    render(<ReportButton jobId={jobId} />)

    const generateButton = screen.getByRole('button', { name: /Generate HTML report/i })
    fireEvent.click(generateButton)

    expect(screen.getByText('Generating...')).toBeInTheDocument()
  })

  it('disables buttons while loading', async () => {
    const { generateReport } = await import('@/lib/api')
    vi.mocked(generateReport).mockImplementation(() => new Promise(() => {}))

    render(<ReportButton jobId={jobId} />)

    const generateButton = screen.getByRole('button', { name: /Generate HTML report/i })
    fireEvent.click(generateButton)

    expect(generateButton).toBeDisabled()
  })

  it('handles generation error', async () => {
    const { generateReport } = await import('@/lib/api')
    vi.mocked(generateReport).mockRejectedValueOnce(new Error('Report generation failed'))

    render(<ReportButton jobId={jobId} />)

    const generateButton = screen.getByRole('button', { name: /Generate HTML report/i })
    fireEvent.click(generateButton)

    await waitFor(() => {
      expect(screen.getByText('Error')).toBeInTheDocument()
      expect(screen.getByText('Report generation failed')).toBeInTheDocument()
    })
  })

  it('handles popup blocked error', async () => {
    const { generateReport } = await import('@/lib/api')
    vi.mocked(generateReport).mockResolvedValueOnce({
      job_id: jobId,
      format: 'html',
      content: '<html><body>Test Report</body></html>',
      generated_at: '2026-02-12T00:00:00Z',
      skill_used: 'report',
    })

    window.open = vi.fn(() => null) as any

    render(<ReportButton jobId={jobId} />)

    const generateButton = screen.getByRole('button', { name: /Generate HTML report/i })
    fireEvent.click(generateButton)

    await waitFor(() => {
      expect(screen.getByText('Popup blocked. Please allow popups for this site.')).toBeInTheDocument()
    })
  })

  it('downloads JSON report when format is JSON', async () => {
    const { generateReport } = await import('@/lib/api')
    vi.mocked(generateReport).mockResolvedValueOnce({
      job_id: jobId,
      format: 'json',
      content: '{"summary": "test"}',
      generated_at: '2026-02-12T00:00:00Z',
      skill_used: 'report',
    })

    render(<ReportButton jobId={jobId} />)

    // Select JSON format
    const dropdownButton = screen.getByRole('button', { name: 'Select report format' })
    fireEvent.click(dropdownButton)
    const jsonOption = screen.getByRole('menuitem', { name: /JSON/i })
    fireEvent.click(jsonOption)

    // Generate report
    const generateButton = screen.getByRole('button', { name: /Generate JSON report/i })
    fireEvent.click(generateButton)

    await waitFor(() => {
      expect(generateReport).toHaveBeenCalledWith(jobId, 'json')
      expect(URL.createObjectURL).toHaveBeenCalled()
      expect(URL.revokeObjectURL).toHaveBeenCalled()
    })
  })

  it('handles non-Error exception with fallback message', async () => {
    const { generateReport } = await import('@/lib/api')
    vi.mocked(generateReport).mockRejectedValueOnce('unknown string error')

    render(<ReportButton jobId={jobId} />)

    const generateButton = screen.getByRole('button', { name: /Generate HTML report/i })
    fireEvent.click(generateButton)

    await waitFor(() => {
      expect(screen.getByText('Failed to generate report. API may not be running.')).toBeInTheDocument()
    })
  })

  it('dismisses error on click', async () => {
    const { generateReport } = await import('@/lib/api')
    vi.mocked(generateReport).mockRejectedValueOnce(new Error('Test error'))

    render(<ReportButton jobId={jobId} />)

    const generateButton = screen.getByRole('button', { name: /Generate HTML report/i })
    fireEvent.click(generateButton)

    await waitFor(() => {
      expect(screen.getByText('Test error')).toBeInTheDocument()
    })

    const dismissButton = screen.getByText('Dismiss')
    fireEvent.click(dismissButton)

    await waitFor(() => {
      expect(screen.queryByText('Test error')).not.toBeInTheDocument()
    })
  })
})

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ProgressTracker } from './progress-tracker'

describe('ProgressTracker', () => {
  it('renders status label for "uploading": "Uploading file..."', () => {
    render(<ProgressTracker status="uploading" progressPct={25} />)

    expect(screen.getByText(/uploading file/i)).toBeInTheDocument()
  })

  it('renders status label for "queued": "Queued for analysis"', () => {
    render(<ProgressTracker status="queued" progressPct={10} />)

    expect(screen.getByText(/queued for analysis/i)).toBeInTheDocument()
  })

  it('renders status label for "parsing": "Parsing log file"', () => {
    render(<ProgressTracker status="parsing" progressPct={40} />)

    expect(screen.getByText(/parsing log file/i)).toBeInTheDocument()
  })

  it('renders status label for "analyzing": "Analyzing results"', () => {
    render(<ProgressTracker status="analyzing" progressPct={60} />)

    expect(screen.getByText(/analyzing results/i)).toBeInTheDocument()
  })

  it('renders status label for "storing": "Storing results"', () => {
    render(<ProgressTracker status="storing" progressPct={80} />)

    expect(screen.getByText(/storing results/i)).toBeInTheDocument()
  })

  it('renders status label for "complete": "Analysis complete"', () => {
    render(<ProgressTracker status="complete" progressPct={100} />)

    expect(screen.getByText(/analysis complete/i)).toBeInTheDocument()
  })

  it('renders status label for "failed": "Analysis failed" with destructive styling', () => {
    render(<ProgressTracker status="failed" progressPct={50} />)

    const failedText = screen.getByText(/analysis failed/i)
    expect(failedText).toBeInTheDocument()
    expect(failedText.className).toContain('text-destructive')
  })

  it('renders percentage text', () => {
    render(<ProgressTracker status="parsing" progressPct={45} />)

    expect(screen.getByText('45%')).toBeInTheDocument()
  })

  it('renders progress bar with correct width style', () => {
    render(<ProgressTracker status="analyzing" progressPct={75} />)

    const progressBar = document.querySelector('[style*="width"]')
    expect(progressBar).toBeInTheDocument()
    expect(progressBar).toHaveStyle({ width: '75%' })
  })

  it('renders green bar for complete status', () => {
    render(<ProgressTracker status="complete" progressPct={100} />)

    const progressBar = document.querySelector('[style*="width"]')
    expect(progressBar!.className).toContain('bg-green-500')
  })

  it('renders destructive bar for failed status', () => {
    render(<ProgressTracker status="failed" progressPct={50} />)

    const progressBar = document.querySelector('[style*="width"]')
    expect(progressBar!.className).toContain('bg-destructive')
  })

  it('renders primary bar for in-progress statuses', () => {
    render(<ProgressTracker status="parsing" progressPct={50} />)

    const progressBar = document.querySelector('[style*="width"]')
    expect(progressBar!.className).toContain('bg-primary')
  })

  it('renders optional message when provided', () => {
    render(
      <ProgressTracker
        status="parsing"
        progressPct={50}
        message="Processing large file, this may take a while"
      />
    )

    expect(screen.getByText(/processing large file/i)).toBeInTheDocument()
  })

  it('does not render message when not provided', () => {
    const { container } = render(<ProgressTracker status="parsing" progressPct={50} />)

    const messageElements = container.querySelectorAll('[class*="message"]')
    expect(messageElements.length).toBe(0)
  })

  it('uses raw status string for unknown status values', () => {
    render(<ProgressTracker status="custom_status" progressPct={30} />)

    expect(screen.getByText(/custom_status/i)).toBeInTheDocument()
  })
})

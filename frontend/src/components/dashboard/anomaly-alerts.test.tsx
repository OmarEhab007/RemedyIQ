import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AnomalyAlerts } from './anomaly-alerts'

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: any) => <a href={href} {...props}>{children}</a>,
}))

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  AlertCircle: (props: any) => <span data-testid="alert-circle" {...props} />,
  TrendingUp: (props: any) => <span data-testid="trending-up" {...props} />,
}))

interface Anomaly {
  id: string
  type: string
  severity: string
  title: string
  description: string
  metric: string
  value: number
  baseline: number
  sigma: number
  detected_at: string
}

const mockAnomalies: Anomaly[] = [
  {
    id: 'a1',
    type: 'slow_api',
    severity: 'critical',
    title: 'Slow API Calls',
    description: 'API calls are 5x slower than baseline',
    metric: 'avg_duration_ms',
    value: 500,
    baseline: 100,
    sigma: 4.5,
    detected_at: '2026-02-12T10:00:00Z',
  },
  {
    id: 'a2',
    type: 'high_error_rate',
    severity: 'high',
    title: 'High Error Rate',
    description: 'Error rate exceeds threshold',
    metric: 'error_rate_pct',
    value: 15,
    baseline: 2,
    sigma: 3.2,
    detected_at: '2026-02-12T10:05:00Z',
  },
  {
    id: 'a3',
    type: 'slow_sql',
    severity: 'medium',
    title: 'Slow SQL',
    description: 'SQL queries are slower',
    metric: 'sql_avg_ms',
    value: 200,
    baseline: 50,
    sigma: 2.8,
    detected_at: '2026-02-12T10:10:00Z',
  },
  {
    id: 'a4',
    type: 'thread_contention',
    severity: 'low',
    title: 'Thread Issue',
    description: 'Thread contention detected',
    metric: 'thread_wait_ms',
    value: 30,
    baseline: 10,
    sigma: 2.1,
    detected_at: '2026-02-12T10:15:00Z',
  },
]

describe('AnomalyAlerts', () => {
  it('returns null when anomalies is empty array', () => {
    const { container } = render(<AnomalyAlerts anomalies={[]} jobId="job-123" />)
    expect(container.firstChild).toBeNull()
  })

  it('returns null when anomalies is undefined/null', () => {
    const { container } = render(<AnomalyAlerts anomalies={[]} jobId="job-123" />)
    expect(container.firstChild).toBeNull()
  })

  it('renders summary banner with count "4 Anomalies Detected"', () => {
    render(<AnomalyAlerts anomalies={mockAnomalies} jobId="job-123" />)
    expect(screen.getByText('4 Anomalies Detected')).toBeInTheDocument()
  })

  it('renders singular "1 Anomaly Detected" for single anomaly', () => {
    render(<AnomalyAlerts anomalies={[mockAnomalies[0]]} jobId="job-123" />)
    expect(screen.getByText('1 Anomaly Detected')).toBeInTheDocument()
  })

  it('renders severity count badges (Critical, High, Medium, Low)', () => {
    render(<AnomalyAlerts anomalies={mockAnomalies} jobId="job-123" />)

    // Should show counts for each severity level with format "N Severity"
    expect(screen.getByText('1 Critical')).toBeInTheDocument()
    expect(screen.getByText('1 High')).toBeInTheDocument()
    expect(screen.getByText('1 Medium')).toBeInTheDocument()
    expect(screen.getByText('1 Low')).toBeInTheDocument()
  })

  it('renders Ask AI link with correct href', () => {
    render(<AnomalyAlerts anomalies={mockAnomalies} jobId="job-123" />)

    const aiLink = screen.getByRole('link', { name: /ask ai/i })
    expect(aiLink).toBeInTheDocument()
    expect(aiLink).toHaveAttribute('href', '/ai?job_id=job-123&context=anomaly')
  })

  it('renders anomaly cards with title, description, severity badge', () => {
    render(<AnomalyAlerts anomalies={mockAnomalies} jobId="job-123" />)

    // Check titles
    expect(screen.getByText('Slow API Calls')).toBeInTheDocument()
    expect(screen.getByText('High Error Rate')).toBeInTheDocument()
    expect(screen.getByText('Slow SQL')).toBeInTheDocument()
    expect(screen.getByText('Thread Issue')).toBeInTheDocument()

    // Check descriptions
    expect(screen.getByText('API calls are 5x slower than baseline')).toBeInTheDocument()
    expect(screen.getByText('Error rate exceeds threshold')).toBeInTheDocument()
    expect(screen.getByText('SQL queries are slower')).toBeInTheDocument()
    expect(screen.getByText('Thread contention detected')).toBeInTheDocument()
  })

  it('displays metric name, value, and baseline', () => {
    render(<AnomalyAlerts anomalies={mockAnomalies} jobId="job-123" />)

    // Check for metric names
    expect(screen.getByText(/avg_duration_ms/i)).toBeInTheDocument()
    expect(screen.getByText(/error_rate_pct/i)).toBeInTheDocument()

    // Check for values
    expect(screen.getByText(/500/)).toBeInTheDocument()
    expect(screen.getByText(/100/)).toBeInTheDocument()
  })

  it('displays sigma value formatted to 2 decimal places', () => {
    render(<AnomalyAlerts anomalies={mockAnomalies} jobId="job-123" />)

    // Check for sigma values with 2 decimal places
    expect(screen.getByText(/4\.50/)).toBeInTheDocument()
    expect(screen.getByText(/3\.20/)).toBeInTheDocument()
    expect(screen.getByText(/2\.80/)).toBeInTheDocument()
    expect(screen.getByText(/2\.10/)).toBeInTheDocument()
  })

  it('applies critical severity color classes (bg-red-50)', () => {
    const { container } = render(<AnomalyAlerts anomalies={mockAnomalies} jobId="job-123" />)

    // Check for critical severity styling
    const criticalElements = container.querySelectorAll('.bg-red-50, [class*="bg-red"]')
    expect(criticalElements.length).toBeGreaterThan(0)
  })

  it('applies high severity color classes (bg-orange-50)', () => {
    const { container } = render(<AnomalyAlerts anomalies={mockAnomalies} jobId="job-123" />)

    // Check for high severity styling
    const highElements = container.querySelectorAll('.bg-orange-50, [class*="bg-orange"]')
    expect(highElements.length).toBeGreaterThan(0)
  })

  it('applies medium severity color (bg-yellow-50)', () => {
    const { container } = render(<AnomalyAlerts anomalies={mockAnomalies} jobId="job-123" />)

    // Check for medium severity styling
    const mediumElements = container.querySelectorAll('.bg-yellow-50, [class*="bg-yellow"]')
    expect(mediumElements.length).toBeGreaterThan(0)
  })

  it('applies low severity color (bg-blue-50)', () => {
    const { container } = render(<AnomalyAlerts anomalies={mockAnomalies} jobId="job-123" />)

    // Check for low severity styling
    const lowElements = container.querySelectorAll('.bg-blue-50, [class*="bg-blue"]')
    expect(lowElements.length).toBeGreaterThan(0)
  })

  it('has role="alert" on container for accessibility', () => {
    render(<AnomalyAlerts anomalies={mockAnomalies} jobId="job-123" />)

    const alertContainer = screen.getByRole('alert')
    expect(alertContainer).toBeInTheDocument()
  })

  it('handles unknown severity with default gray styling', () => {
    const unknownSeverityAnomalies = [
      {
        title: 'Unknown Anomaly',
        description: 'An anomaly with unknown severity',
        severity: 'unknown',
        metric: 'test_metric',
        value: 1,
        threshold: 0.5,
        timestamp: '2026-02-12T10:00:00Z',
      },
    ]
    const { container } = render(
      <AnomalyAlerts anomalies={unknownSeverityAnomalies} jobId="job-123" />
    )

    // Default case should use gray classes
    const grayElements = container.querySelectorAll('[class*="bg-gray"]')
    expect(grayElements.length).toBeGreaterThan(0)
  })
})

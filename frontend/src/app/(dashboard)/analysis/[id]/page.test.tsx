/**
 * T065 — Tests for the Analysis Dashboard Page (Phase 5) — Reworked
 *
 * Covers:
 *  - Shows loading state while dashboard is loading
 *  - Shows error state when dashboard query fails
 *  - Renders PageHeader with job title
 *  - Renders HealthScoreCard when health_score is present
 *  - Renders StatsCards
 *  - Renders TimeSeriesChart
 *  - Renders DistributionChart
 *  - Renders tabbed TopN section with tabs
 *  - Renders all collapsible sections
 *  - ReportButton is present
 *  - Log Explorer button navigates correctly
 *  - Back to analyses button present
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import AnalysisDashboardPage from './page'
import type { DashboardData, AnalysisJob } from '@/lib/api-types'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({ getToken: vi.fn().mockResolvedValue('test-token') }),
}))

const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => '/analysis/test-job-1',
  useParams: () => ({ id: 'test-job-1' }),
}))

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  AreaChart: () => <div data-testid="area-chart" />,
  Area: () => null,
  LineChart: () => <div data-testid="line-chart" />,
  Line: () => null,
  BarChart: () => <div data-testid="bar-chart" />,
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
  Cell: () => null,
}))

vi.mock('@/hooks/use-api', () => ({
  useDashboard: vi.fn(),
  useAnalysis: vi.fn(),
  useDashboardAggregates: vi.fn(),
  useDashboardExceptions: vi.fn(),
  useDashboardGaps: vi.fn(),
  useDashboardThreads: vi.fn(),
  useDashboardFilters: vi.fn(),
  useGenerateReport: vi.fn(),
}))

import {
  useDashboard,
  useAnalysis,
  useDashboardAggregates,
  useDashboardExceptions,
  useDashboardGaps,
  useDashboardThreads,
  useDashboardFilters,
  useGenerateReport,
} from '@/hooks/use-api'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeDashboard(overrides: Partial<DashboardData> = {}): DashboardData {
  return {
    general_stats: {
      total_lines: 10000,
      api_count: 5000,
      sql_count: 3000,
      filter_count: 1500,
      esc_count: 500,
      unique_users: 25,
      unique_forms: 50,
      unique_tables: 30,
      log_start: '2024-01-01T00:00:00Z',
      log_end: '2024-01-01T01:00:00Z',
      log_duration: '1h 0m',
    },
    health_score: {
      score: 85,
      status: 'ok',
      factors: [
        {
          name: 'Error Rate',
          score: 18,
          max_score: 20,
          weight: 0.2,
          description: 'Low error rate',
          severity: 'ok',
        },
      ],
    },
    top_api_calls: [],
    top_sql_statements: [],
    top_filters: [],
    top_escalations: [],
    time_series: [
      {
        timestamp: '2024-01-01T00:00:00Z',
        api_count: 100,
        sql_count: 60,
        filter_count: 30,
        esc_count: 10,
        avg_duration_ms: 250,
        error_count: 2,
      },
    ],
    distribution: {
      log_type: [
        { label: 'API', count: 5000, percentage: 50 },
        { label: 'SQL', count: 3000, percentage: 30 },
      ],
      duration_buckets: [],
      error_rate: 0.02,
    },
    ...overrides,
  }
}

function makeJob(id = 'test-job-1'): AnalysisJob {
  return {
    id,
    tenant_id: 'tenant-1',
    status: 'complete',
    file_id: 'file-1',
    progress_pct: 100,
    processed_lines: 10000,
    api_count: 5000,
    sql_count: 3000,
    filter_count: 1500,
    esc_count: 500,
    log_start: null,
    log_end: null,
    log_duration: '1h 0m',
    error_message: null,
    created_at: '2024-01-01T00:00:00Z',
    completed_at: '2024-01-01T01:05:00Z',
    flags: null,
  }
}

function setupMocks(opts: {
  dashboardLoading?: boolean
  dashboardError?: boolean
  dashboard?: DashboardData
} = {}) {
  ;(useDashboard as Mock).mockReturnValue({
    data: opts.dashboardLoading || opts.dashboardError ? undefined : (opts.dashboard ?? makeDashboard()),
    isLoading: opts.dashboardLoading ?? false,
    isError: opts.dashboardError ?? false,
    refetch: vi.fn(),
  })
  ;(useAnalysis as Mock).mockReturnValue({
    data: makeJob(),
    isLoading: false,
  })
  ;(useDashboardAggregates as Mock).mockReturnValue({
    data: undefined,
    isLoading: false,
  })
  ;(useDashboardExceptions as Mock).mockReturnValue({
    data: undefined,
    isLoading: false,
  })
  ;(useDashboardGaps as Mock).mockReturnValue({
    data: undefined,
    isLoading: false,
  })
  ;(useDashboardThreads as Mock).mockReturnValue({
    data: undefined,
    isLoading: false,
  })
  ;(useDashboardFilters as Mock).mockReturnValue({
    data: undefined,
    isLoading: false,
  })
  ;(useGenerateReport as Mock).mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AnalysisDashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows loading state while dashboard is loading', () => {
    setupMocks({ dashboardLoading: true })
    render(<AnalysisDashboardPage />)
    expect(screen.getByRole('status', { name: /loading/i })).toBeInTheDocument()
  })

  it('shows error state when dashboard fails to load', () => {
    setupMocks({ dashboardError: true })
    render(<AnalysisDashboardPage />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText(/failed to load dashboard/i)).toBeInTheDocument()
  })

  it('renders the page heading with job id', () => {
    setupMocks()
    render(<AnalysisDashboardPage />)
    expect(screen.getByRole('heading', { name: /analysis/i })).toBeInTheDocument()
  })

  it('renders the HealthScoreCard when health_score is present', () => {
    setupMocks()
    render(<AnalysisDashboardPage />)
    expect(screen.getByLabelText(/health score: 85/i)).toBeInTheDocument()
  })

  it('does not render HealthScoreCard when health_score is null', () => {
    setupMocks({ dashboard: makeDashboard({ health_score: null as unknown as DashboardData['health_score'] }) })
    render(<AnalysisDashboardPage />)
    expect(screen.queryByLabelText(/health score/i)).toBeNull()
  })

  it('renders StatsCards with entry counts', () => {
    setupMocks()
    render(<AnalysisDashboardPage />)
    expect(screen.getByRole('region', { name: /summary statistics/i })).toBeInTheDocument()
  })

  it('renders the time series chart area', () => {
    setupMocks()
    render(<AnalysisDashboardPage />)
    expect(screen.getByText(/activity over time/i)).toBeInTheDocument()
  })

  it('renders distribution chart section', () => {
    setupMocks()
    render(<AnalysisDashboardPage />)
    expect(screen.getByText(/log type distribution/i)).toBeInTheDocument()
  })

  it('renders TopN tab buttons', () => {
    setupMocks()
    render(<AnalysisDashboardPage />)
    const tablist = screen.getByRole('tablist', { name: /top entries/i })
    expect(tablist).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /api/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /sql/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /filter/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /escl/i })).toBeInTheDocument()
  })

  it('switches TopN tab content when tab is clicked', () => {
    setupMocks()
    render(<AnalysisDashboardPage />)
    // API tab is selected by default
    expect(screen.getByRole('tab', { name: /api/i })).toHaveAttribute('aria-selected', 'true')
    // Click SQL tab
    fireEvent.click(screen.getByRole('tab', { name: /sql/i }))
    expect(screen.getByRole('tab', { name: /sql/i })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: /api/i })).toHaveAttribute('aria-selected', 'false')
  })

  it('renders collapsible section titles', () => {
    setupMocks()
    render(<AnalysisDashboardPage />)
    expect(screen.getByText('Aggregates')).toBeInTheDocument()
    expect(screen.getByText('Exceptions')).toBeInTheDocument()
    expect(screen.getByText('Timing Gaps')).toBeInTheDocument()
    expect(screen.getByText('Thread Statistics')).toBeInTheDocument()
    expect(screen.getByText('Filter Complexity')).toBeInTheDocument()
  })

  it('renders the Generate Report button', () => {
    setupMocks()
    render(<AnalysisDashboardPage />)
    expect(
      screen.getByRole('button', { name: /generate.*report/i })
    ).toBeInTheDocument()
  })

  it('renders the Log Explorer navigation button', () => {
    setupMocks()
    render(<AnalysisDashboardPage />)
    expect(
      screen.getByRole('button', { name: /log explorer/i })
    ).toBeInTheDocument()
  })

  it('navigates to explorer page when Log Explorer button is clicked', () => {
    setupMocks()
    render(<AnalysisDashboardPage />)
    fireEvent.click(screen.getByRole('button', { name: /log explorer/i }))
    expect(mockPush).toHaveBeenCalledWith('/analysis/test-job-1/explorer')
  })

  it('shows entry count in description', () => {
    setupMocks()
    render(<AnalysisDashboardPage />)
    // 5000 + 3000 + 1500 + 500 = 10,000 entries
    expect(screen.getByText(/10,000 entries analyzed/i)).toBeInTheDocument()
  })

  it('renders "All Jobs" back button', () => {
    setupMocks()
    render(<AnalysisDashboardPage />)
    expect(
      screen.getByRole('button', { name: /back to analyses/i })
    ).toBeInTheDocument()
  })

  it('navigates to /analysis when "All Jobs" is clicked', () => {
    setupMocks()
    render(<AnalysisDashboardPage />)
    fireEvent.click(screen.getByRole('button', { name: /back to analyses/i }))
    expect(mockPush).toHaveBeenCalledWith('/analysis')
  })

  it('auto-selects first non-empty tab when API/SQL have no data', () => {
    const dashboardWithFilters = makeDashboard({
      top_api_calls: [],
      top_sql_statements: [],
      top_filters: [
        {
          rank: 1,
          line_number: 100,
          timestamp: '2024-01-01T00:00:00Z',
          trace_id: 'trace-f1',
          rpc_id: 'rpc-f1',
          queue: 'Fast',
          identifier: 'SetDefaults',
          form: 'HPD:Help Desk',
          user: '',
          duration_ms: 500,
          success: true,
          details: '',
        },
      ],
      top_escalations: [],
    })
    setupMocks({ dashboard: dashboardWithFilters })
    render(<AnalysisDashboardPage />)
    // Filter tab should be auto-selected since it has data
    expect(screen.getByRole('tab', { name: /filter/i })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: /api/i })).toHaveAttribute('aria-selected', 'false')
  })

  it('shows tab counts including zero', () => {
    setupMocks()
    render(<AnalysisDashboardPage />)
    // All tabs should show (0) since mock data has empty arrays
    const tabs = screen.getAllByRole('tab')
    tabs.forEach((tab) => {
      expect(tab.textContent).toContain('(0)')
    })
  })
})

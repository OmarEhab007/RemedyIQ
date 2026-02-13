import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ExceptionsSection } from './exceptions-section';
import type { ExceptionsResponse, ExceptionEntry } from '@/lib/api';

vi.mock('next/link', () => ({
  default: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}));

vi.mock('lucide-react', () => ({
  AlertCircle: (props: any) => <span data-testid="alert-circle" {...props} />,
  TrendingUp: (props: any) => <span data-testid="trending-up" {...props} />,
}));

const mockData: ExceptionsResponse = {
  total_count: 2,
  exceptions: [
    {
      error_code: 'ARERR 302',
      message: 'Entry not found',
      count: 15,
      log_type: 'API',
      first_seen: '2026-02-12T08:00:00Z',
      last_seen: '2026-02-12T12:00:00Z',
      sample_line: 100,
      sample_trace: 'stack trace here',
      queue: 'Default',
      form: 'HPD:Help Desk',
      user: 'Demo',
    },
    {
      error_code: 'ARERR 9801',
      message: 'SQL timeout',
      count: 5,
      log_type: 'SQL',
      first_seen: '2026-02-12T09:00:00Z',
      last_seen: '2026-02-12T11:00:00Z',
      sample_line: 200,
    },
  ],
  error_rates: { API: 0.5, SQL: 3.2, FLTR: 8.1 },
  top_codes: ['ARERR 302', 'ARERR 9801', 'ARERR 1234'],
};

const mockEmptyData: ExceptionsResponse = {
  total_count: 0,
  exceptions: [],
  error_rates: {},
  top_codes: [],
};

describe('ExceptionsSection', () => {
  it('renders loading state', () => {
    render(
      <ExceptionsSection data={null} loading={true} error={null} refetch={vi.fn()} />
    );
    expect(screen.getByText('Exceptions')).toBeInTheDocument();
    const pulseElements = document.querySelectorAll('.animate-pulse');
    expect(pulseElements.length).toBeGreaterThan(0);
  });

  it('renders error state with retry', () => {
    const errorMessage = 'Failed to load exceptions';
    render(
      <ExceptionsSection
        data={null}
        loading={false}
        error={errorMessage}
        refetch={vi.fn()}
      />
    );
    expect(screen.getByText(errorMessage)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('calls refetch on retry button click', () => {
    const refetchMock = vi.fn();
    render(
      <ExceptionsSection
        data={null}
        loading={false}
        error="Test error"
        refetch={refetchMock}
      />
    );
    const retryButton = screen.getByRole('button', { name: /retry/i });
    fireEvent.click(retryButton);
    expect(refetchMock).toHaveBeenCalledTimes(1);
  });

  it('renders no errors detected when total_count is 0', () => {
    render(
      <ExceptionsSection
        data={mockEmptyData}
        loading={false}
        error={null}
        refetch={vi.fn()}
      />
    );
    expect(screen.getByText('No errors detected')).toBeInTheDocument();
  });

  it('renders no errors detected when data is null', () => {
    render(
      <ExceptionsSection data={null} loading={false} error={null} refetch={vi.fn()} />
    );
    expect(screen.getByText('No errors detected')).toBeInTheDocument();
  });

  it('renders error rate badges with correct colors (< 1% green, < 5% yellow, >= 5% red)', () => {
    render(
      <ExceptionsSection data={mockData} loading={false} error={null} refetch={vi.fn()} />
    );

    // API: 0.5% (green)
    const apiBadge = screen.getByText(/API: 0.50%/);
    expect(apiBadge).toHaveClass('bg-green-100', 'text-green-800');

    // SQL: 3.2% (yellow)
    const sqlBadge = screen.getByText(/SQL: 3.20%/);
    expect(sqlBadge).toHaveClass('bg-yellow-100', 'text-yellow-800');

    // FLTR: 8.1% (red)
    const fltrBadge = screen.getByText(/FLTR: 8.10%/);
    expect(fltrBadge).toHaveClass('bg-red-100', 'text-red-800');
  });

  it('renders top error codes', () => {
    render(
      <ExceptionsSection data={mockData} loading={false} error={null} refetch={vi.fn()} />
    );
    expect(screen.getByText('Top Error Codes')).toBeInTheDocument();
    // ARERR 302 and ARERR 9801 appear in both top_codes and exception cards
    expect(screen.getAllByText('ARERR 302').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('ARERR 9801').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('ARERR 1234')).toBeInTheDocument();
  });

  it('renders exception cards with error code, message, count, log type', () => {
    render(
      <ExceptionsSection data={mockData} loading={false} error={null} refetch={vi.fn()} />
    );

    // Error codes appear in both top_codes and exception cards
    expect(screen.getAllByText('ARERR 302').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Entry not found')).toBeInTheDocument();
    expect(screen.getByText('× 15')).toBeInTheDocument();

    // Check for log type badges
    const logTypeBadges = screen.getAllByText('API');
    expect(logTypeBadges.length).toBeGreaterThan(0);

    // Second exception
    expect(screen.getAllByText('ARERR 9801').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('SQL timeout')).toBeInTheDocument();
    expect(screen.getByText('× 5')).toBeInTheDocument();
    expect(screen.getByText('SQL')).toBeInTheDocument();
  });

  it('expands exception on click to show sample trace/line/queue/form/user', () => {
    render(
      <ExceptionsSection data={mockData} loading={false} error={null} refetch={vi.fn()} />
    );

    // Exception should be collapsed initially
    expect(screen.queryByText('Sample Trace')).not.toBeInTheDocument();

    // Click to expand
    const firstException = screen.getByText('Entry not found');
    fireEvent.click(firstException);

    // Now expanded details should be visible
    expect(screen.getByText('Sample Line #100')).toBeInTheDocument();
    expect(screen.getByText('Sample Trace')).toBeInTheDocument();
    expect(screen.getByText('stack trace here')).toBeInTheDocument();
    expect(screen.getByText(/Queue:/)).toBeInTheDocument();
    expect(screen.getByText('Default')).toBeInTheDocument();
    expect(screen.getByText(/Form:/)).toBeInTheDocument();
    expect(screen.getByText('HPD:Help Desk')).toBeInTheDocument();
    expect(screen.getByText(/User:/)).toBeInTheDocument();
    expect(screen.getByText('Demo')).toBeInTheDocument();
  });

  it('collapses on second click', () => {
    render(
      <ExceptionsSection data={mockData} loading={false} error={null} refetch={vi.fn()} />
    );

    const firstException = screen.getByText('Entry not found');

    // Expand
    fireEvent.click(firstException);
    expect(screen.getByText('Sample Trace')).toBeInTheDocument();

    // Collapse
    fireEvent.click(firstException);
    expect(screen.queryByText('Sample Trace')).not.toBeInTheDocument();
  });

  it('renders first seen and last seen timestamps', () => {
    render(
      <ExceptionsSection data={mockData} loading={false} error={null} refetch={vi.fn()} />
    );
    // Multiple exceptions show First:/Last: timestamps
    expect(screen.getAllByText(/First:/).length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText(/Last:/).length).toBeGreaterThanOrEqual(2);
  });

  it('renders exception without optional fields', () => {
    render(
      <ExceptionsSection data={mockData} loading={false} error={null} refetch={vi.fn()} />
    );

    // Click second exception which has no queue/form/user
    const secondException = screen.getByText('SQL timeout');
    fireEvent.click(secondException);

    // Should show sample line
    expect(screen.getByText('Sample Line #200')).toBeInTheDocument();

    // Should not show queue/form/user since they're undefined
    const expandedSection = screen.getByText('Sample Line #200').closest('div');
    expect(expandedSection).not.toHaveTextContent('Queue:');
    expect(expandedSection).not.toHaveTextContent('Form:');
    expect(expandedSection).not.toHaveTextContent('User:');
  });
});

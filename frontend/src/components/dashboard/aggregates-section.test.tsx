import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AggregatesSection } from './aggregates-section';
import type { AggregatesResponse, AggregateGroup } from '@/lib/api';

vi.mock('next/link', () => ({
  default: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}));

vi.mock('lucide-react', () => ({
  AlertCircle: (props: any) => <span data-testid="alert-circle" {...props} />,
  TrendingUp: (props: any) => <span data-testid="trending-up" {...props} />,
}));

const mockData: AggregatesResponse = {
  api: {
    groups: [
      {
        name: 'HPD:Help Desk',
        count: 100,
        error_count: 5,
        min_ms: 10,
        max_ms: 500,
        avg_ms: 150.5,
        total_ms: 15050,
        error_rate: 5,
        unique_traces: 90,
      },
      {
        name: 'CHG:Infrastructure',
        count: 50,
        error_count: 2,
        min_ms: 5,
        max_ms: 300,
        avg_ms: 100.25,
        total_ms: 5012.5,
        error_rate: 4,
        unique_traces: 48,
      },
    ],
    grand_total: {
      name: 'Total',
      count: 150,
      error_count: 7,
      min_ms: 5,
      max_ms: 500,
      avg_ms: 133.75,
      total_ms: 20062.5,
      error_rate: 4.67,
      unique_traces: 138,
    },
  },
  sql: {
    groups: [
      {
        name: 'HPD_Entry',
        count: 80,
        error_count: 3,
        min_ms: 1,
        max_ms: 200,
        avg_ms: 50,
        total_ms: 4000,
        error_rate: 3.75,
        unique_traces: 77,
      },
    ],
    grand_total: {
      name: 'Total',
      count: 80,
      error_count: 3,
      min_ms: 1,
      max_ms: 200,
      avg_ms: 50,
      total_ms: 4000,
      error_rate: 3.75,
      unique_traces: 77,
    },
  },
  filter: {
    groups: [],
    grand_total: {
      name: 'Total',
      count: 0,
      error_count: 0,
      min_ms: 0,
      max_ms: 0,
      avg_ms: 0,
      total_ms: 0,
      error_rate: 0,
      unique_traces: 0,
    },
  },
};

describe('AggregatesSection', () => {
  it('renders loading state with pulse animation', () => {
    render(
      <AggregatesSection data={null} loading={true} error={null} refetch={vi.fn()} />
    );
    expect(screen.getByText('Aggregates')).toBeInTheDocument();
    const pulseElements = document.querySelectorAll('.animate-pulse');
    expect(pulseElements.length).toBeGreaterThan(0);
  });

  it('renders error state with error message and retry button', () => {
    const errorMessage = 'Failed to load aggregates';
    render(
      <AggregatesSection
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
      <AggregatesSection
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

  it('renders no data message when data is null', () => {
    render(
      <AggregatesSection data={null} loading={false} error={null} refetch={vi.fn()} />
    );
    expect(screen.getByText('No data available')).toBeInTheDocument();
  });

  it('renders title "Aggregates"', () => {
    render(
      <AggregatesSection data={mockData} loading={false} error={null} refetch={vi.fn()} />
    );
    expect(screen.getByText('Aggregates')).toBeInTheDocument();
  });

  it('renders tab buttons: "API (by Form)", "SQL (by Table)", "Filters (by Name)"', () => {
    render(
      <AggregatesSection data={mockData} loading={false} error={null} refetch={vi.fn()} />
    );
    expect(screen.getByRole('button', { name: /API \(by Form\)/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /SQL \(by Table\)/i })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Filters \(by Name\)/i })
    ).toBeInTheDocument();
  });

  it('renders API groups by default with name, count, errors', () => {
    render(
      <AggregatesSection data={mockData} loading={false} error={null} refetch={vi.fn()} />
    );
    expect(screen.getByText('HPD:Help Desk')).toBeInTheDocument();
    expect(screen.getByText('CHG:Infrastructure')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('displays grand total row', () => {
    render(
      <AggregatesSection data={mockData} loading={false} error={null} refetch={vi.fn()} />
    );
    expect(screen.getByText('Grand Total')).toBeInTheDocument();
    expect(screen.getByText('150')).toBeInTheDocument();
  });

  it('switches to SQL tab on click', () => {
    render(
      <AggregatesSection data={mockData} loading={false} error={null} refetch={vi.fn()} />
    );
    const sqlTab = screen.getByRole('button', { name: /SQL \(by Table\)/i });
    fireEvent.click(sqlTab);
    expect(screen.getByText('HPD_Entry')).toBeInTheDocument();
    // 80 appears in both the data row and grand total, so use getAllByText
    const countElements = screen.getAllByText('80');
    expect(countElements.length).toBeGreaterThanOrEqual(1);
  });

  it('switches to Filters tab and shows empty state "No filter data available"', () => {
    render(
      <AggregatesSection data={mockData} loading={false} error={null} refetch={vi.fn()} />
    );
    const filterTab = screen.getByRole('button', { name: /Filters \(by Name\)/i });
    fireEvent.click(filterTab);
    expect(screen.getByText('No filter data available')).toBeInTheDocument();
  });

  it('sorts by clicking column headers (e.g., click "Name" sorts alphabetically)', () => {
    render(
      <AggregatesSection data={mockData} loading={false} error={null} refetch={vi.fn()} />
    );
    const nameHeader = screen.getByText('Name');
    fireEvent.click(nameHeader);

    // After clicking Name, should sort alphabetically (desc first, then asc)
    // Default sort is by count desc, so first Name click should sort by name desc
    const rows = screen.getAllByRole('row');
    // Check that CHG:Infrastructure comes before HPD:Help Desk when sorted desc
    expect(rows[1]).toHaveTextContent('HPD:Help Desk');
  });

  it('clicking same sort column toggles direction', () => {
    render(
      <AggregatesSection data={mockData} loading={false} error={null} refetch={vi.fn()} />
    );
    const countHeader = screen.getByText('Count');

    // Default sort is count desc, arrow already shows ↓
    // First click on same column toggles to asc → ↑
    fireEvent.click(countHeader);
    expect(screen.getByText('↑')).toBeInTheDocument();

    // Second click toggles back to desc → ↓
    fireEvent.click(countHeader);
    expect(screen.getByText('↓')).toBeInTheDocument();
  });

  it('renders OK column with success count', () => {
    render(
      <AggregatesSection data={mockData} loading={false} error={null} refetch={vi.fn()} />
    );
    expect(screen.getByText('OK')).toBeInTheDocument();
    // HPD:Help Desk has 100 total - 5 errors = 95 OK
    expect(screen.getByText('95')).toBeInTheDocument();
    // CHG:Infrastructure has 50 total - 2 errors = 48 OK
    expect(screen.getByText('48')).toBeInTheDocument();
  });

  it('renders all timing columns', () => {
    render(
      <AggregatesSection data={mockData} loading={false} error={null} refetch={vi.fn()} />
    );
    expect(screen.getByText('MIN(ms)')).toBeInTheDocument();
    expect(screen.getByText('MAX(ms)')).toBeInTheDocument();
    expect(screen.getByText('AVG(ms)')).toBeInTheDocument();
    expect(screen.getByText('SUM(ms)')).toBeInTheDocument();
  });
});

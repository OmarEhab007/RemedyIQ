/**
 * T066 — Tests for AggregatesSection component (T058)
 */

import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { AggregatesSection } from './aggregates-section'
import type { AggregatesResponse } from '@/lib/api-types'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeData(overrides: Partial<AggregatesResponse> = {}): AggregatesResponse {
  return {
    job_id: 'job-001',
    sections: [],
    ...overrides,
  }
}

const fullData: AggregatesResponse = {
  job_id: 'job-001',
  sections: [
    {
      title: 'API Summary',
      groups: [
        {
          name: 'Request Counts',
          headers: ['Total', 'Success', 'Errors'],
          rows: [
            { label: 'GET /api/v1/jobs', values: [120, 115, 5] },
            { label: 'POST /api/v1/upload', values: [30, 30, 0] },
          ],
        },
        {
          name: 'Empty Group',
          headers: ['Col'],
          rows: [],
        },
      ],
    },
    {
      title: 'SQL Summary',
      groups: [
        {
          name: '',
          headers: ['Count', 'Avg Duration'],
          rows: [
            { label: 'SELECT queries', values: [500, null] },
          ],
        },
      ],
    },
  ],
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AggregatesSection', () => {
  describe('empty state', () => {
    it('shows empty message when sections array is empty', () => {
      render(<AggregatesSection data={makeData({ sections: [] })} />)
      expect(
        screen.getByText('No aggregates data available for this job.')
      ).toBeInTheDocument()
    })

    it('does not render any table when empty', () => {
      render(<AggregatesSection data={makeData({ sections: [] })} />)
      expect(screen.queryByRole('table')).toBeNull()
    })
  })

  describe('section rendering', () => {
    it('renders all section titles as headings', () => {
      render(<AggregatesSection data={fullData} />)
      expect(screen.getByText('API Summary')).toBeInTheDocument()
      expect(screen.getByText('SQL Summary')).toBeInTheDocument()
    })

    it('renders group names as subheadings', () => {
      render(<AggregatesSection data={fullData} />)
      expect(screen.getByText('Request Counts')).toBeInTheDocument()
    })

    it('does not render a subheading element for groups with empty name', () => {
      render(<AggregatesSection data={fullData} />)
      const h4s = document.querySelectorAll('h4')
      const texts = Array.from(h4s).map((el) => el.textContent?.trim())
      expect(texts).not.toContain('')
    })
  })

  describe('table rendering', () => {
    it('renders table column headers', () => {
      render(<AggregatesSection data={fullData} />)
      expect(screen.getByText('Total')).toBeInTheDocument()
      expect(screen.getByText('Success')).toBeInTheDocument()
      expect(screen.getByText('Errors')).toBeInTheDocument()
    })

    it('always renders a "Label" column header when headers exist', () => {
      render(<AggregatesSection data={fullData} />)
      const labelHeaders = screen.getAllByText('Label')
      expect(labelHeaders.length).toBeGreaterThanOrEqual(1)
    })

    it('renders row labels in the first cell', () => {
      render(<AggregatesSection data={fullData} />)
      expect(screen.getByText('GET /api/v1/jobs')).toBeInTheDocument()
      expect(screen.getByText('POST /api/v1/upload')).toBeInTheDocument()
    })

    it('renders numeric values as strings', () => {
      render(<AggregatesSection data={fullData} />)
      expect(screen.getByText('120')).toBeInTheDocument()
      expect(screen.getByText('115')).toBeInTheDocument()
    })

    it('renders null values as em dash', () => {
      render(<AggregatesSection data={fullData} />)
      const cells = screen.getAllByText('—')
      expect(cells.length).toBeGreaterThanOrEqual(1)
    })

    it('renders tables with correct aria-label from group name', () => {
      render(<AggregatesSection data={fullData} />)
      expect(screen.getByRole('table', { name: 'Request Counts' })).toBeInTheDocument()
    })

    it('renders table rows for each data row', () => {
      render(<AggregatesSection data={fullData} />)
      const table = screen.getByRole('table', { name: 'Request Counts' })
      const rows = within(table).getAllByRole('row')
      // 1 header row + 2 data rows
      expect(rows).toHaveLength(3)
    })
  })

  describe('empty group rows', () => {
    it('shows "No data" text for groups with empty rows array', () => {
      render(<AggregatesSection data={fullData} />)
      expect(screen.getByText('No data')).toBeInTheDocument()
    })

    it('does not render a table for groups with no rows', () => {
      render(<AggregatesSection data={fullData} />)
      const tables = screen.getAllByRole('table')
      // Request Counts table + SQL unnamed group table = 2 tables (not Empty Group)
      expect(tables).toHaveLength(2)
    })
  })

  describe('no headers', () => {
    it('omits thead when group has no headers', () => {
      const dataNoHeaders: AggregatesResponse = {
        job_id: 'job-002',
        sections: [
          {
            title: 'Section A',
            groups: [
              {
                name: 'Group A',
                headers: [],
                rows: [{ label: 'Row 1', values: [42] }],
              },
            ],
          },
        ],
      }
      render(<AggregatesSection data={dataNoHeaders} />)
      const table = screen.getByRole('table', { name: 'Group A' })
      expect(within(table).queryByRole('columnheader')).toBeNull()
    })
  })

  describe('single section single group', () => {
    it('renders a single section without crashing', () => {
      const singleSection: AggregatesResponse = {
        job_id: 'job-003',
        sections: [
          {
            title: 'Minimal',
            groups: [
              {
                name: 'Group',
                headers: ['Value'],
                rows: [{ label: 'X', values: [1] }],
              },
            ],
          },
        ],
      }
      render(<AggregatesSection data={singleSection} />)
      expect(screen.getByText('Minimal')).toBeInTheDocument()
      expect(screen.getByText('X')).toBeInTheDocument()
      expect(screen.getByText('1')).toBeInTheDocument()
    })
  })

  describe('className prop', () => {
    it('passes className to the wrapper when data is present', () => {
      const { container } = render(
        <AggregatesSection data={fullData} className="test-class" />
      )
      expect(container.firstChild).toHaveClass('test-class')
    })
  })
})

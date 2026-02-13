import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { FilterPanel } from './filter-panel'
import type { FacetEntry } from '@/hooks/use-search'

const mockFacets: Record<string, FacetEntry[]> = {
  log_type: [
    { value: 'API', count: 150 },
    { value: 'SQL', count: 80 },
    { value: 'FLTR', count: 45 },
    { value: 'ESCL', count: 20 },
  ],
  user: [
    { value: 'Demo', count: 120 },
    { value: 'Admin', count: 75 },
    { value: 'Guest', count: 30 },
  ],
  queue: [
    { value: 'Default', count: 100 },
    { value: 'High', count: 50 },
  ],
}

describe('FilterPanel', () => {
  it('renders empty state when no facets provided', () => {
    render(
      <FilterPanel
        facets={{}}
        activeFilters={{}}
        onFilterChange={vi.fn()}
      />
    )

    expect(screen.getByText('Filters will appear after searching')).toBeInTheDocument()
  })

  it('renders title when facets exist', () => {
    render(
      <FilterPanel
        facets={mockFacets}
        activeFilters={{}}
        onFilterChange={vi.fn()}
      />
    )

    expect(screen.getByText('Filters')).toBeInTheDocument()
  })

  it('renders all facet groups', () => {
    render(
      <FilterPanel
        facets={mockFacets}
        activeFilters={{}}
        onFilterChange={vi.fn()}
      />
    )

    expect(screen.getByText('Log Type')).toBeInTheDocument()
    expect(screen.getByText('User')).toBeInTheDocument()
    expect(screen.getByText('Queue')).toBeInTheDocument()
  })

  it('renders all facet entries with counts', () => {
    render(
      <FilterPanel
        facets={mockFacets}
        activeFilters={{}}
        onFilterChange={vi.fn()}
      />
    )

    // Check log_type facets
    expect(screen.getByText('API')).toBeInTheDocument()
    expect(screen.getByText('150')).toBeInTheDocument()
    expect(screen.getByText('SQL')).toBeInTheDocument()
    expect(screen.getByText('80')).toBeInTheDocument()

    // Check user facets
    expect(screen.getByText('Demo')).toBeInTheDocument()
    expect(screen.getByText('120')).toBeInTheDocument()
    expect(screen.getByText('Admin')).toBeInTheDocument()
    expect(screen.getByText('75')).toBeInTheDocument()
  })

  it('renders checkboxes for all facet entries', () => {
    render(
      <FilterPanel
        facets={mockFacets}
        activeFilters={{}}
        onFilterChange={vi.fn()}
      />
    )

    const checkboxes = screen.getAllByRole('checkbox')
    // 4 log_type + 3 user + 2 queue = 9 total
    expect(checkboxes).toHaveLength(9)
  })

  it('checks active filters', () => {
    render(
      <FilterPanel
        facets={mockFacets}
        activeFilters={{ log_type: ['API', 'SQL'], user: ['Demo'] }}
        onFilterChange={vi.fn()}
      />
    )

    const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[]
    const checkedBoxes = checkboxes.filter((cb) => cb.checked)

    expect(checkedBoxes).toHaveLength(3) // API, SQL, Demo
  })

  it('calls onFilterChange when filter is checked', () => {
    const onFilterChange = vi.fn()
    render(
      <FilterPanel
        facets={mockFacets}
        activeFilters={{}}
        onFilterChange={onFilterChange}
      />
    )

    // Click the API checkbox via its label
    const apiCheckbox = screen.getByText('API').closest('label')!.querySelector('input')!
    fireEvent.click(apiCheckbox)

    expect(onFilterChange).toHaveBeenCalledWith({ log_type: ['API'] })
  })

  it('calls onFilterChange when filter is unchecked', () => {
    const onFilterChange = vi.fn()
    render(
      <FilterPanel
        facets={mockFacets}
        activeFilters={{ log_type: ['API', 'SQL'] }}
        onFilterChange={onFilterChange}
      />
    )

    // Uncheck SQL - find by text content within log_type group
    const sqlCheckbox = screen.getByText('SQL').closest('label')!.querySelector('input')!
    fireEvent.click(sqlCheckbox)

    expect(onFilterChange).toHaveBeenCalledWith({ log_type: ['API'] })
  })

  it('adds filter to existing filters in different facet', () => {
    const onFilterChange = vi.fn()
    render(
      <FilterPanel
        facets={mockFacets}
        activeFilters={{ log_type: ['API'] }}
        onFilterChange={onFilterChange}
      />
    )

    // Check Demo user
    const demoCheckbox = screen.getByText('Demo').closest('label')!.querySelector('input')!
    fireEvent.click(demoCheckbox)

    expect(onFilterChange).toHaveBeenCalledWith({
      log_type: ['API'],
      user: ['Demo'],
    })
  })

  it('allows multiple selections in same facet', () => {
    const onFilterChange = vi.fn()
    render(
      <FilterPanel
        facets={mockFacets}
        activeFilters={{ log_type: ['API'] }}
        onFilterChange={onFilterChange}
      />
    )

    // Add SQL to log_type
    const sqlCheckbox = screen.getByText('SQL').closest('label')!.querySelector('input')!
    fireEvent.click(sqlCheckbox)

    expect(onFilterChange).toHaveBeenCalledWith({ log_type: ['API', 'SQL'] })
  })

  it('uses custom label for known facets', () => {
    render(
      <FilterPanel
        facets={mockFacets}
        activeFilters={{}}
        onFilterChange={vi.fn()}
      />
    )

    // Check that custom labels are used
    expect(screen.getByText('Log Type')).toBeInTheDocument() // instead of 'log_type'
    expect(screen.getByText('User')).toBeInTheDocument() // instead of 'user'
    expect(screen.getByText('Queue')).toBeInTheDocument() // instead of 'queue'
  })

  it('uses facet key as label for unknown facets', () => {
    const facetsWithUnknown = {
      ...mockFacets,
      custom_field: [{ value: 'test', count: 10 }],
    }

    render(
      <FilterPanel
        facets={facetsWithUnknown}
        activeFilters={{}}
        onFilterChange={vi.fn()}
      />
    )

    expect(screen.getByText('custom_field')).toBeInTheDocument()
  })

  it('handles empty active filters gracefully', () => {
    const onFilterChange = vi.fn()
    render(
      <FilterPanel
        facets={mockFacets}
        activeFilters={{}}
        onFilterChange={onFilterChange}
      />
    )

    // Click any filter
    const apiCheckbox = screen.getByText('API').closest('label')!.querySelector('input')!
    fireEvent.click(apiCheckbox)

    expect(onFilterChange).toHaveBeenCalledWith({ log_type: ['API'] })
  })

  it('applies hover styles to filter labels', () => {
    render(
      <FilterPanel
        facets={mockFacets}
        activeFilters={{}}
        onFilterChange={vi.fn()}
      />
    )

    const label = screen.getByText('API').closest('label')
    expect(label).toHaveClass('hover:bg-muted/50')
  })

  it('renders facets in order they appear in object', () => {
    const { container } = render(
      <FilterPanel
        facets={mockFacets}
        activeFilters={{}}
        onFilterChange={vi.fn()}
      />
    )

    const headers = container.querySelectorAll('h4')
    expect(headers[0]).toHaveTextContent('Log Type')
    expect(headers[1]).toHaveTextContent('User')
    expect(headers[2]).toHaveTextContent('Queue')
  })

  it('handles single facet value', () => {
    const singleFacet = {
      log_type: [{ value: 'API', count: 100 }],
    }

    render(
      <FilterPanel
        facets={singleFacet}
        activeFilters={{}}
        onFilterChange={vi.fn()}
      />
    )

    expect(screen.getByText('API')).toBeInTheDocument()
    expect(screen.getByText('100')).toBeInTheDocument()
  })
})

/**
 * Tests for FilterPanel component.
 *
 * Covers: rendering, log type checkbox toggling, error-only toggle,
 * duration inputs, active filter badges, clear all button.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FilterPanel } from './filter-panel'
import type { ExplorerFilter } from '@/stores/explorer-store'

// ---------------------------------------------------------------------------
// Default props
// ---------------------------------------------------------------------------

const defaultProps = {
  filters: [] as ExplorerFilter[],
  onAddFilter: vi.fn(),
  onRemoveFilter: vi.fn(),
  onClearFilters: vi.fn(),
}

function setup(filters: ExplorerFilter[] = [], overrides = {}) {
  const onAddFilter = vi.fn()
  const onRemoveFilter = vi.fn()
  const onClearFilters = vi.fn()
  const user = userEvent.setup()

  const result = render(
    <FilterPanel
      filters={filters}
      onAddFilter={onAddFilter}
      onRemoveFilter={onRemoveFilter}
      onClearFilters={onClearFilters}
      {...overrides}
    />,
  )

  return { user, onAddFilter, onRemoveFilter, onClearFilters, ...result }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('FilterPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the filter panel with correct accessible role', () => {
    setup()
    expect(screen.getByRole('complementary', { name: /log filters/i })).toBeInTheDocument()
  })

  it('renders all four log type checkboxes', () => {
    setup()
    expect(screen.getByRole('checkbox', { name: /API calls/i })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: /SQL queries/i })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: /filter executions/i })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: /escalation/i })).toBeInTheDocument()
  })

  it('calls onAddFilter when API log type checkbox is checked', async () => {
    const { user, onAddFilter } = setup()
    const apiCheckbox = screen.getByRole('checkbox', { name: /API calls/i })
    await user.click(apiCheckbox)
    expect(onAddFilter).toHaveBeenCalledWith({
      field: 'log_type',
      value: 'API',
      operator: 'eq',
    })
  })

  it('calls onRemoveFilter when already-checked log type is clicked', async () => {
    const filters: ExplorerFilter[] = [
      { field: 'log_type', value: 'SQL', operator: 'eq' },
    ]
    const { user, onRemoveFilter } = setup(filters)
    const sqlCheckbox = screen.getByRole('checkbox', { name: /SQL queries/i })
    await user.click(sqlCheckbox)
    expect(onRemoveFilter).toHaveBeenCalledWith(0)
  })

  it('renders the "Errors only" checkbox', () => {
    setup()
    expect(screen.getByRole('checkbox', { name: /show error entries only/i })).toBeInTheDocument()
  })

  it('calls onAddFilter with error_only when errors checkbox is clicked', async () => {
    const { user, onAddFilter } = setup()
    const errorCheck = screen.getByRole('checkbox', { name: /show error entries only/i })
    await user.click(errorCheck)
    expect(onAddFilter).toHaveBeenCalledWith({
      field: 'error_only',
      value: 'true',
      operator: 'eq',
    })
  })

  it('does not show "Clear all" button when no filters are active', () => {
    setup()
    expect(screen.queryByRole('button', { name: /clear all/i })).not.toBeInTheDocument()
  })

  it('shows "Clear all" button when filters are active', () => {
    const filters: ExplorerFilter[] = [
      { field: 'log_type', value: 'API', operator: 'eq' },
    ]
    setup(filters)
    expect(screen.getByRole('button', { name: /clear all/i })).toBeInTheDocument()
  })

  it('calls onClearFilters when "Clear all" is clicked', async () => {
    const filters: ExplorerFilter[] = [
      { field: 'log_type', value: 'API', operator: 'eq' },
    ]
    const { user, onClearFilters } = setup(filters)
    await user.click(screen.getByRole('button', { name: /clear all/i }))
    expect(onClearFilters).toHaveBeenCalledTimes(1)
  })

  it('renders active filter badges', () => {
    const filters: ExplorerFilter[] = [
      { field: 'log_type', value: 'FLTR', operator: 'eq' },
      { field: 'error_only', value: 'true', operator: 'eq' },
    ]
    setup(filters)
    // Both filters should be rendered as badges
    const activeFilters = screen.getByRole('list', { name: /active filters/i })
    expect(activeFilters.children.length).toBe(2)
  })

  it('calls onRemoveFilter when a filter badge remove button is clicked', async () => {
    const filters: ExplorerFilter[] = [
      { field: 'log_type', value: 'API', operator: 'eq' },
    ]
    const { user, onRemoveFilter } = setup(filters)
    const removeBtn = screen.getByRole('button', { name: /remove filter: log_type api/i })
    await user.click(removeBtn)
    expect(onRemoveFilter).toHaveBeenCalledWith(0)
  })

  it('renders duration range inputs', () => {
    setup()
    expect(screen.getByLabelText(/min/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/max/i)).toBeInTheDocument()
  })

  it('calls onAddFilter with min_duration on blur', async () => {
    const { user, onAddFilter } = setup()
    const minInput = screen.getByLabelText(/^min$/i)
    await user.type(minInput, '1000')
    fireEvent.blur(minInput)
    expect(onAddFilter).toHaveBeenCalledWith({
      field: 'min_duration',
      value: '1000',
      operator: 'gte',
    })
  })

  it('calls onAddFilter with max_duration on Enter', async () => {
    const { user, onAddFilter } = setup()
    const maxInput = screen.getByLabelText(/^max$/i)
    await user.type(maxInput, '5000')
    await user.keyboard('{Enter}')
    expect(onAddFilter).toHaveBeenCalledWith({
      field: 'max_duration',
      value: '5000',
      operator: 'lte',
    })
  })
})

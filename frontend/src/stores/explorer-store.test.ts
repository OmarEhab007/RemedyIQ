import { describe, it, expect, beforeEach } from 'vitest'
import { useExplorerStore, type ExplorerFilter, type ExplorerTimeRange } from './explorer-store'

// Reset to initial state before each test to prevent inter-test contamination.
beforeEach(() => {
  useExplorerStore.getState().reset()
})

describe('useExplorerStore — initial state', () => {
  it('has an empty query string', () => {
    expect(useExplorerStore.getState().query).toBe('')
  })

  it('has an empty filters array', () => {
    expect(useExplorerStore.getState().filters).toEqual([])
  })

  it('has null selectedEntryId', () => {
    expect(useExplorerStore.getState().selectedEntryId).toBeNull()
  })

  it('has null timeRange', () => {
    expect(useExplorerStore.getState().timeRange).toBeNull()
  })
})

describe('useExplorerStore — setQuery', () => {
  it('updates the query string', () => {
    useExplorerStore.getState().setQuery('level:ERROR')
    expect(useExplorerStore.getState().query).toBe('level:ERROR')
  })

  it('replaces a previous query', () => {
    useExplorerStore.getState().setQuery('level:WARN')
    useExplorerStore.getState().setQuery('level:ERROR schema:API')
    expect(useExplorerStore.getState().query).toBe('level:ERROR schema:API')
  })

  it('accepts an empty string to clear the query', () => {
    useExplorerStore.getState().setQuery('some query')
    useExplorerStore.getState().setQuery('')
    expect(useExplorerStore.getState().query).toBe('')
  })

  it('does not affect filters or other state', () => {
    const filter: ExplorerFilter = { field: 'level', value: 'ERROR', operator: 'eq' }
    useExplorerStore.getState().addFilter(filter)
    useExplorerStore.getState().setQuery('new query')

    expect(useExplorerStore.getState().filters).toHaveLength(1)
    expect(useExplorerStore.getState().query).toBe('new query')
  })
})

describe('useExplorerStore — addFilter', () => {
  it('appends a single filter', () => {
    const filter: ExplorerFilter = { field: 'level', value: 'ERROR', operator: 'eq' }
    useExplorerStore.getState().addFilter(filter)

    expect(useExplorerStore.getState().filters).toHaveLength(1)
    expect(useExplorerStore.getState().filters[0]).toEqual(filter)
  })

  it('appends multiple filters in order', () => {
    const f1: ExplorerFilter = { field: 'level', value: 'ERROR', operator: 'eq' }
    const f2: ExplorerFilter = { field: 'schema', value: 'API', operator: 'eq' }
    const f3: ExplorerFilter = { field: 'operation', value: 'SELECT', operator: 'contains' }

    useExplorerStore.getState().addFilter(f1)
    useExplorerStore.getState().addFilter(f2)
    useExplorerStore.getState().addFilter(f3)

    const { filters } = useExplorerStore.getState()
    expect(filters).toHaveLength(3)
    expect(filters[0]).toEqual(f1)
    expect(filters[1]).toEqual(f2)
    expect(filters[2]).toEqual(f3)
  })

  it('allows duplicate filters (no deduplication)', () => {
    const filter: ExplorerFilter = { field: 'level', value: 'ERROR', operator: 'eq' }
    useExplorerStore.getState().addFilter(filter)
    useExplorerStore.getState().addFilter(filter)

    expect(useExplorerStore.getState().filters).toHaveLength(2)
  })

  it('supports all common operators', () => {
    const operators = ['eq', 'neq', 'contains', 'not_contains', 'gt', 'lt']
    operators.forEach((operator) => {
      useExplorerStore.getState().addFilter({ field: 'f', value: 'v', operator })
    })
    expect(useExplorerStore.getState().filters).toHaveLength(operators.length)
  })
})

describe('useExplorerStore — removeFilter', () => {
  beforeEach(() => {
    // Set up three filters for removal tests
    useExplorerStore.getState().addFilter({ field: 'level', value: 'ERROR', operator: 'eq' })
    useExplorerStore.getState().addFilter({ field: 'schema', value: 'API', operator: 'eq' })
    useExplorerStore.getState().addFilter({ field: 'operation', value: 'GET', operator: 'eq' })
  })

  it('removes the filter at index 0 (first)', () => {
    useExplorerStore.getState().removeFilter(0)
    const { filters } = useExplorerStore.getState()
    expect(filters).toHaveLength(2)
    expect(filters[0].field).toBe('schema')
    expect(filters[1].field).toBe('operation')
  })

  it('removes the filter at the last index', () => {
    useExplorerStore.getState().removeFilter(2)
    const { filters } = useExplorerStore.getState()
    expect(filters).toHaveLength(2)
    expect(filters[0].field).toBe('level')
    expect(filters[1].field).toBe('schema')
  })

  it('removes a middle filter by index', () => {
    useExplorerStore.getState().removeFilter(1)
    const { filters } = useExplorerStore.getState()
    expect(filters).toHaveLength(2)
    expect(filters[0].field).toBe('level')
    expect(filters[1].field).toBe('operation')
  })

  it('removes all filters one by one from the front', () => {
    useExplorerStore.getState().removeFilter(0)
    useExplorerStore.getState().removeFilter(0)
    useExplorerStore.getState().removeFilter(0)
    expect(useExplorerStore.getState().filters).toHaveLength(0)
  })

  it('is a no-op for an out-of-bounds index (no crash)', () => {
    // filter(_, i) with an out-of-bounds index will remove nothing;
    // the store uses array.filter so it silently returns the same array
    useExplorerStore.getState().removeFilter(99)
    expect(useExplorerStore.getState().filters).toHaveLength(3)
  })
})

describe('useExplorerStore — clearFilters', () => {
  it('removes all active filters', () => {
    useExplorerStore.getState().addFilter({ field: 'level', value: 'ERROR', operator: 'eq' })
    useExplorerStore.getState().addFilter({ field: 'schema', value: 'API', operator: 'eq' })

    useExplorerStore.getState().clearFilters()
    expect(useExplorerStore.getState().filters).toEqual([])
  })

  it('is a no-op when filters are already empty', () => {
    useExplorerStore.getState().clearFilters()
    expect(useExplorerStore.getState().filters).toEqual([])
  })

  it('does not affect the query or other state', () => {
    useExplorerStore.getState().setQuery('level:ERROR')
    useExplorerStore.getState().addFilter({ field: 'level', value: 'ERROR', operator: 'eq' })
    useExplorerStore.getState().clearFilters()

    expect(useExplorerStore.getState().query).toBe('level:ERROR')
    expect(useExplorerStore.getState().filters).toEqual([])
  })
})

describe('useExplorerStore — selectEntry', () => {
  it('sets selectedEntryId to the provided id', () => {
    useExplorerStore.getState().selectEntry('entry-abc')
    expect(useExplorerStore.getState().selectedEntryId).toBe('entry-abc')
  })

  it('updates selectedEntryId when selecting a different entry', () => {
    useExplorerStore.getState().selectEntry('entry-abc')
    useExplorerStore.getState().selectEntry('entry-xyz')
    expect(useExplorerStore.getState().selectedEntryId).toBe('entry-xyz')
  })

  it('clears selectedEntryId by passing null', () => {
    useExplorerStore.getState().selectEntry('entry-abc')
    useExplorerStore.getState().selectEntry(null)
    expect(useExplorerStore.getState().selectedEntryId).toBeNull()
  })

  it('does not affect filters or query', () => {
    useExplorerStore.getState().setQuery('some query')
    useExplorerStore.getState().addFilter({ field: 'level', value: 'ERROR', operator: 'eq' })
    useExplorerStore.getState().selectEntry('entry-abc')

    expect(useExplorerStore.getState().query).toBe('some query')
    expect(useExplorerStore.getState().filters).toHaveLength(1)
  })
})

describe('useExplorerStore — setTimeRange', () => {
  const range: ExplorerTimeRange = {
    start: '2024-01-01T00:00:00Z',
    end: '2024-01-02T00:00:00Z',
  }

  it('sets the timeRange', () => {
    useExplorerStore.getState().setTimeRange(range)
    expect(useExplorerStore.getState().timeRange).toEqual(range)
  })

  it('replaces a previous timeRange', () => {
    const range2: ExplorerTimeRange = {
      start: '2024-06-01T00:00:00Z',
      end: '2024-06-30T23:59:59Z',
    }
    useExplorerStore.getState().setTimeRange(range)
    useExplorerStore.getState().setTimeRange(range2)
    expect(useExplorerStore.getState().timeRange).toEqual(range2)
  })

  it('clears timeRange by passing null', () => {
    useExplorerStore.getState().setTimeRange(range)
    useExplorerStore.getState().setTimeRange(null)
    expect(useExplorerStore.getState().timeRange).toBeNull()
  })

  it('does not affect other state slices', () => {
    useExplorerStore.getState().setQuery('level:WARN')
    useExplorerStore.getState().setTimeRange(range)

    expect(useExplorerStore.getState().query).toBe('level:WARN')
  })
})

describe('useExplorerStore — reset', () => {
  it('resets query to empty string', () => {
    useExplorerStore.getState().setQuery('level:ERROR')
    useExplorerStore.getState().reset()
    expect(useExplorerStore.getState().query).toBe('')
  })

  it('resets filters to empty array', () => {
    useExplorerStore.getState().addFilter({ field: 'level', value: 'ERROR', operator: 'eq' })
    useExplorerStore.getState().addFilter({ field: 'schema', value: 'API', operator: 'eq' })
    useExplorerStore.getState().reset()
    expect(useExplorerStore.getState().filters).toEqual([])
  })

  it('resets selectedEntryId to null', () => {
    useExplorerStore.getState().selectEntry('entry-abc')
    useExplorerStore.getState().reset()
    expect(useExplorerStore.getState().selectedEntryId).toBeNull()
  })

  it('resets timeRange to null', () => {
    useExplorerStore.getState().setTimeRange({ start: '2024-01-01T00:00:00Z', end: '2024-01-02T00:00:00Z' })
    useExplorerStore.getState().reset()
    expect(useExplorerStore.getState().timeRange).toBeNull()
  })

  it('resets all state at once from a fully-populated store', () => {
    useExplorerStore.getState().setQuery('level:ERROR')
    useExplorerStore.getState().addFilter({ field: 'level', value: 'ERROR', operator: 'eq' })
    useExplorerStore.getState().selectEntry('entry-abc')
    useExplorerStore.getState().setTimeRange({ start: '2024-01-01T00:00:00Z', end: '2024-01-02T00:00:00Z' })

    useExplorerStore.getState().reset()

    const state = useExplorerStore.getState()
    expect(state.query).toBe('')
    expect(state.filters).toEqual([])
    expect(state.selectedEntryId).toBeNull()
    expect(state.timeRange).toBeNull()
  })
})

/**
 * T040 — Tests for SourceFilesSection
 *
 * Covers:
 *  - Renders file list with ordinals, names, time ranges, and durations
 *  - Shows empty state when no data
 *  - Handles single file
 *  - Shows formatted timestamps and durations
 */

import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { SourceFilesSection } from './source-files-section'
import type { FileMetadataEntry } from '@/lib/api-types'

const multiFileData: FileMetadataEntry[] = [
  {
    file_number: 1,
    file_name: 'arserver_20260203.log',
    start_time: '2026-02-03T10:00:00Z',
    end_time: '2026-02-03T14:00:00Z',
    duration_ms: 14400000,
    entry_count: 50000,
  },
  {
    file_number: 2,
    file_name: 'arserver_20260204.log',
    start_time: '2026-02-04T08:00:00Z',
    end_time: '2026-02-04T16:30:00Z',
    duration_ms: 30600000,
    entry_count: 80000,
  },
]

describe('SourceFilesSection', () => {
  it('renders file list with ordinals and names', () => {
    render(<SourceFilesSection data={multiFileData} />)
    expect(screen.getByRole('region', { name: /source files/i })).toBeInTheDocument()
    expect(screen.getByText('arserver_20260203.log')).toBeInTheDocument()
    expect(screen.getByText('arserver_20260204.log')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('shows formatted durations', () => {
    render(<SourceFilesSection data={multiFileData} />)
    // 14400000ms = 4h
    expect(screen.getByText('4h')).toBeInTheDocument()
    // 30600000ms = 8h 30m
    expect(screen.getByText('8h 30m')).toBeInTheDocument()
  })

  it('shows empty state when no data', () => {
    render(<SourceFilesSection data={[]} />)
    expect(screen.getByText(/no source file metadata/i)).toBeInTheDocument()
  })

  it('handles null data', () => {
    render(<SourceFilesSection data={null as unknown as FileMetadataEntry[]} />)
    expect(screen.getByText(/no source file metadata/i)).toBeInTheDocument()
  })

  it('handles single file', () => {
    render(<SourceFilesSection data={[multiFileData[0]]} />)
    const table = screen.getByRole('table')
    const rows = within(table).getAllByRole('row')
    // 1 header row + 1 data row
    expect(rows).toHaveLength(2)
  })

  it('renders column headers', () => {
    render(<SourceFilesSection data={multiFileData} />)
    expect(screen.getByText('#')).toBeInTheDocument()
    expect(screen.getByText('File Name')).toBeInTheDocument()
    expect(screen.getByText('Start Time')).toBeInTheDocument()
    expect(screen.getByText('End Time')).toBeInTheDocument()
    expect(screen.getByText('Duration')).toBeInTheDocument()
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Dropzone } from './dropzone'

describe('Dropzone', () => {
  const mockOnFileSelected = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders drop zone with "Drop your log file here" text', () => {
    render(<Dropzone onFileSelected={mockOnFileSelected} />)

    expect(screen.getByText(/drop your log file here/i)).toBeInTheDocument()
  })

  it('renders file type info "AR Server log files (.log, .txt) up to 2GB"', () => {
    render(<Dropzone onFileSelected={mockOnFileSelected} />)

    expect(screen.getByText(/AR Server log files/)).toBeInTheDocument()
    expect(screen.getByText(/\.log, \.txt/)).toBeInTheDocument()
    expect(screen.getByText(/2GB/)).toBeInTheDocument()
  })

  it('renders supported formats text "Supports: arapi, arsql, arfilter, aresc logs"', () => {
    render(<Dropzone onFileSelected={mockOnFileSelected} />)

    expect(screen.getByText(/Supports:/)).toBeInTheDocument()
    expect(screen.getByText(/arapi/)).toBeInTheDocument()
    expect(screen.getByText(/arsql/)).toBeInTheDocument()
    expect(screen.getByText(/arfilter/)).toBeInTheDocument()
    expect(screen.getByText(/aresc/)).toBeInTheDocument()
  })

  it('handles file drop event calling onFileSelected', () => {
    render(<Dropzone onFileSelected={mockOnFileSelected} />)

    const mockFile = new File(['test content'], 'test.log', { type: 'text/plain' })
    const dropzone = screen.getByText(/drop your log file here/i).closest('div')!

    fireEvent.drop(dropzone, {
      dataTransfer: { files: [mockFile] },
    })

    expect(mockOnFileSelected).toHaveBeenCalledWith(mockFile)
  })

  it('shows file name and size after selection', () => {
    render(<Dropzone onFileSelected={mockOnFileSelected} />)

    const mockFile = new File(['test content'], 'test.log', { type: 'text/plain' })
    const dropzone = screen.getByText(/drop your log file here/i).closest('div')!

    fireEvent.drop(dropzone, {
      dataTransfer: { files: [mockFile] },
    })

    expect(screen.getByText('test.log')).toBeInTheDocument()
    // formatFileSize outputs "12 B" for 12 bytes
    expect(screen.getByText(/\d+ B/)).toBeInTheDocument()
  })

  it('shows error for files exceeding 2GB limit', () => {
    render(<Dropzone onFileSelected={mockOnFileSelected} />)

    const mockFile = new File(['test content'], 'large.log', { type: 'text/plain' })
    Object.defineProperty(mockFile, 'size', { value: 3 * 1024 * 1024 * 1024 })

    const dropzone = screen.getByText(/drop your log file here/i).closest('div')!

    fireEvent.drop(dropzone, {
      dataTransfer: { files: [mockFile] },
    })

    expect(screen.getByText(/exceeds 2GB limit/i)).toBeInTheDocument()
    expect(mockOnFileSelected).not.toHaveBeenCalled()
  })

  it('applies disabled styling when disabled prop is true', () => {
    render(<Dropzone onFileSelected={mockOnFileSelected} disabled={true} />)

    const dropzone = screen.getByText(/drop your log file here/i).closest('div')!
    expect(dropzone.className).toContain('opacity-50')
    expect(dropzone.className).toContain('pointer-events-none')
  })

  it('handles drag over by changing border style', () => {
    render(<Dropzone onFileSelected={mockOnFileSelected} />)

    const dropzone = screen.getByText(/drop your log file here/i).closest('div')!
    const initialClassName = dropzone.className

    fireEvent.dragOver(dropzone)

    // Border style should change to border-primary
    expect(dropzone.className).not.toBe(initialClassName)
    expect(dropzone.className).toContain('border-primary')
  })

  it('handles drag leave by resetting style', () => {
    render(<Dropzone onFileSelected={mockOnFileSelected} />)

    const dropzone = screen.getByText(/drop your log file here/i).closest('div')!

    fireEvent.dragOver(dropzone)
    expect(dropzone.className).toContain('border-primary')

    fireEvent.dragLeave(dropzone)

    // Style should reset after drag leave - back to border-dashed
    expect(dropzone.className).toContain('border-dashed')
    expect(dropzone.className).not.toContain('bg-primary/5')
  })

  it('triggers file input on click', () => {
    render(<Dropzone onFileSelected={mockOnFileSelected} />)

    const dropzone = screen.getByText(/drop your log file here/i).closest('div')!

    // Spy on createElement before click, but only for 'input' calls
    const originalCreateElement = document.createElement.bind(document)
    const mockClick = vi.fn()
    vi.spyOn(document, 'createElement').mockImplementation((tag: string, options?: ElementCreationOptions) => {
      const el = originalCreateElement(tag, options)
      if (tag === 'input') {
        el.click = mockClick
      }
      return el
    })

    fireEvent.click(dropzone)

    expect(mockClick).toHaveBeenCalled()

    vi.restoreAllMocks()
  })
})

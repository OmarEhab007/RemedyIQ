import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { CommandPalette } from './command-palette'
import { useTheme } from '@/hooks/use-theme'

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@/hooks/use-theme', () => ({
  useTheme: vi.fn(() => ({
    resolvedTheme: 'light' as const,
    toggleTheme: vi.fn(),
  })),
}))

vi.mock('@/lib/constants', () => ({
  ROUTES: {
    UPLOAD: '/upload',
    ANALYSIS: '/analysis',
    EXPLORER: '/explorer',
    TRACE: '/trace',
    AI: '/ai',
  },
}))

// Override next/navigation so we control a single shared push spy.
// The global mock in test-setup.tsx creates a new vi.fn() each call, meaning
// the component's router.push and the test's router.push are different objects.
const mockPush = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn(), back: vi.fn() }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}))

// ---------------------------------------------------------------------------
// Mock the cmdk-backed command UI components
//
// cmdk uses ResizeObserver internally, which jsdom does not provide. Rather
// than polyfilling the whole observer chain we stub the UI layer — the
// component logic (item labels, routing, toggleTheme) is what we actually
// want to test here.
// ---------------------------------------------------------------------------

vi.mock('@/components/ui/command', () => {
  const React = require('react') as typeof import('react')

  /**
   * Thin stand-in for CommandDialog: renders children when open=true,
   * nothing when open=false.
   */
  function CommandDialog({
    open,
    children,
  }: {
    open?: boolean
    onOpenChange?: (open: boolean) => void
    children?: React.ReactNode
  }) {
    if (!open) return null
    return <div data-testid="command-dialog">{children}</div>
  }

  function CommandInput({ placeholder }: { placeholder?: string }) {
    return <input placeholder={placeholder} data-testid="command-input" />
  }

  function CommandList({ children }: { children?: React.ReactNode }) {
    return <div data-testid="command-list">{children}</div>
  }

  function CommandEmpty({ children }: { children?: React.ReactNode }) {
    return <div data-testid="command-empty">{children}</div>
  }

  function CommandGroup({
    heading,
    children,
  }: {
    heading?: string
    children?: React.ReactNode
  }) {
    return (
      <div data-testid="command-group">
        {heading && <span data-testid="command-group-heading">{heading}</span>}
        {children}
      </div>
    )
  }

  function CommandItem({
    onSelect,
    children,
  }: {
    onSelect?: () => void
    children?: React.ReactNode
  }) {
    return (
      <button
        data-testid="command-item"
        onClick={onSelect}
        type="button"
      >
        {children}
      </button>
    )
  }

  function CommandSeparator() {
    return <hr data-testid="command-separator" />
  }

  return {
    CommandDialog,
    CommandInput,
    CommandList,
    CommandEmpty,
    CommandGroup,
    CommandItem,
    CommandSeparator,
  }
})

const mockUseTheme = useTheme as ReturnType<typeof vi.fn>

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface RenderProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

function renderPalette({ open = true, onOpenChange = vi.fn() }: RenderProps = {}) {
  return render(
    <CommandPalette open={open} onOpenChange={onOpenChange} />
  )
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CommandPalette', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseTheme.mockReturnValue({
      resolvedTheme: 'light' as const,
      toggleTheme: vi.fn(),
    })
  })

  // --- Visibility ----------------------------------------------------------

  it('does not render command input when open=false', () => {
    renderPalette({ open: false })
    expect(screen.queryByTestId('command-dialog')).not.toBeInTheDocument()
    expect(
      screen.queryByPlaceholderText('Type a command or search...')
    ).not.toBeInTheDocument()
  })

  it('renders the command input placeholder when open=true', () => {
    renderPalette({ open: true })
    expect(
      screen.getByPlaceholderText('Type a command or search...')
    ).toBeInTheDocument()
  })

  it('renders the command dialog container when open=true', () => {
    renderPalette()
    expect(screen.getByTestId('command-dialog')).toBeInTheDocument()
  })

  // --- Page items ----------------------------------------------------------

  it('shows the Upload page item when open', () => {
    renderPalette()
    expect(screen.getByText('Upload')).toBeInTheDocument()
  })

  it('shows the Analyses page item when open', () => {
    renderPalette()
    expect(screen.getByText('Analyses')).toBeInTheDocument()
  })

  it('shows the Explorer page item when open', () => {
    renderPalette()
    expect(screen.getByText('Explorer')).toBeInTheDocument()
  })

  it('shows the Traces page item when open', () => {
    renderPalette()
    expect(screen.getByText('Traces')).toBeInTheDocument()
  })

  it('shows the AI Assistant page item when open', () => {
    renderPalette()
    expect(screen.getByText('AI Assistant')).toBeInTheDocument()
  })

  // --- Action items --------------------------------------------------------

  it('shows the Toggle Theme action when open', () => {
    renderPalette()
    expect(screen.getByText('Toggle Theme')).toBeInTheDocument()
  })

  it('shows the New Upload action when open', () => {
    renderPalette()
    expect(screen.getByText('New Upload')).toBeInTheDocument()
  })

  // --- Groups --------------------------------------------------------------

  it('renders the "Pages" group heading', () => {
    renderPalette()
    expect(screen.getByText('Pages')).toBeInTheDocument()
  })

  it('renders the "Actions" group heading', () => {
    renderPalette()
    expect(screen.getByText('Actions')).toBeInTheDocument()
  })

  // --- onOpenChange is called after item selection -------------------------

  it('calls onOpenChange(false) when a page item is selected', async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    renderPalette({ onOpenChange })

    // The Upload item is a button in our stub
    const items = screen.getAllByTestId('command-item')
    const uploadItem = items.find((el) => el.textContent?.includes('Upload'))!
    await user.click(uploadItem)

    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('calls onOpenChange(false) when Toggle Theme is selected', async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    renderPalette({ onOpenChange })

    const items = screen.getAllByTestId('command-item')
    const toggleItem = items.find((el) =>
      el.textContent?.includes('Toggle Theme')
    )!
    await user.click(toggleItem)

    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  // --- Router navigation on item selection ---------------------------------
  // mockPush is the shared vi.fn() returned by useRouter() in this file's
  // vi.mock('next/navigation') override, so both the component under test
  // and these assertions reference the exact same spy instance.

  it('navigates to /upload when Upload item is selected', async () => {
    const user = userEvent.setup()
    renderPalette()

    const items = screen.getAllByTestId('command-item')
    const uploadItem = items.find((el) => el.textContent?.includes('Upload'))!
    await user.click(uploadItem)

    expect(mockPush).toHaveBeenCalledWith('/upload')
  })

  it('navigates to /analysis when Analyses item is selected', async () => {
    const user = userEvent.setup()
    renderPalette()

    const items = screen.getAllByTestId('command-item')
    const analysesItem = items.find((el) =>
      el.textContent?.includes('Analyses')
    )!
    await user.click(analysesItem)

    expect(mockPush).toHaveBeenCalledWith('/analysis')
  })

  it('navigates to /explorer when Explorer item is selected', async () => {
    const user = userEvent.setup()
    renderPalette()

    const items = screen.getAllByTestId('command-item')
    const explorerItem = items.find((el) =>
      el.textContent?.includes('Explorer')
    )!
    await user.click(explorerItem)

    expect(mockPush).toHaveBeenCalledWith('/explorer')
  })

  it('navigates to /trace when Traces item is selected', async () => {
    const user = userEvent.setup()
    renderPalette()

    const items = screen.getAllByTestId('command-item')
    const tracesItem = items.find((el) =>
      el.textContent?.includes('Traces')
    )!
    await user.click(tracesItem)

    expect(mockPush).toHaveBeenCalledWith('/trace')
  })

  it('navigates to /ai when AI Assistant item is selected', async () => {
    const user = userEvent.setup()
    renderPalette()

    const items = screen.getAllByTestId('command-item')
    const aiItem = items.find((el) =>
      el.textContent?.includes('AI Assistant')
    )!
    await user.click(aiItem)

    expect(mockPush).toHaveBeenCalledWith('/ai')
  })

  // --- Toggle Theme action -------------------------------------------------

  it('calls toggleTheme when Toggle Theme action is selected', async () => {
    const user = userEvent.setup()
    const toggleTheme = vi.fn()
    mockUseTheme.mockReturnValue({ resolvedTheme: 'light', toggleTheme })
    renderPalette()

    const items = screen.getAllByTestId('command-item')
    const toggleItem = items.find((el) =>
      el.textContent?.includes('Toggle Theme')
    )!
    await user.click(toggleItem)

    expect(toggleTheme).toHaveBeenCalledTimes(1)
  })

  // --- New Upload action navigates to /upload ------------------------------

  it('navigates to /upload when New Upload action is selected', async () => {
    const user = userEvent.setup()
    renderPalette()

    const items = screen.getAllByTestId('command-item')
    const newUploadItem = items.find((el) =>
      el.textContent?.includes('New Upload')
    )!
    await user.click(newUploadItem)

    expect(mockPush).toHaveBeenCalledWith('/upload')
  })
})

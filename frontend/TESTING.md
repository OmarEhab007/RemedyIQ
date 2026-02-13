# Frontend Testing Guide

This guide covers the testing infrastructure and best practices for the ARLogAnalyzer frontend application.

## Stack

- **Test Runner**: Vitest 3.x
- **Testing Library**: React Testing Library 16.x
- **User Interaction**: @testing-library/user-event
- **Assertions**: @testing-library/jest-dom (vitest matchers)
- **Coverage**: Vitest Coverage (v8 provider)

## Quick Start

```bash
# Run tests in watch mode
npm test

# Run tests once
npm run test:run

# Run tests with coverage
npm run test:coverage

# Run tests with UI
npm run test:ui
```

## Test Infrastructure

### Configuration Files

#### `vitest.config.ts`
- Configures Vitest test runner
- Sets up jsdom environment for React testing
- Defines coverage thresholds (85% minimum, 90% for components/hooks/lib)
- Configures module aliases for mocking recharts and react-window

#### `src/test-setup.ts`
- Global test setup file
- Mocks browser APIs:
  - `IntersectionObserver`
  - `ResizeObserver`
  - `matchMedia`
- Imports jest-dom matchers

#### `src/__mocks__/`
Contains mock implementations for third-party libraries:
- `recharts.tsx`: Mock chart components for testing
- `react-window.tsx`: Mock virtualized list components

## Writing Tests

### Basic Test Structure

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { YourComponent } from './your-component'

describe('YourComponent', () => {
  it('should render correctly', () => {
    render(<YourComponent />)
    expect(screen.getByText('Expected Text')).toBeInTheDocument()
  })

  it('should handle user interactions', async () => {
    const handleClick = vi.fn()
    const user = userEvent.setup()

    render(<YourComponent onClick={handleClick} />)
    await user.click(screen.getByRole('button'))

    expect(handleClick).toHaveBeenCalledTimes(1)
  })
})
```

### Component Testing Best Practices

#### 1. Test User Behavior, Not Implementation

❌ **Bad**: Testing internal state or implementation details
```tsx
expect(component.state.isOpen).toBe(true)
```

✅ **Good**: Testing user-visible behavior
```tsx
expect(screen.getByRole('dialog')).toBeInTheDocument()
```

#### 2. Use Semantic Queries

Priority order for queries:
1. `getByRole` - Best for accessibility
2. `getByLabelText` - For form fields
3. `getByPlaceholderText` - For inputs
4. `getByText` - For non-interactive elements
5. `getByTestId` - Last resort only

```tsx
// Best - accessible to all users
screen.getByRole('button', { name: /submit/i })

// Good - for form fields
screen.getByLabelText('Email')

// Last resort - when semantic queries won't work
screen.getByTestId('complex-widget')
```

#### 3. Test Accessibility

```tsx
describe('Accessibility', () => {
  it('should have correct ARIA attributes', () => {
    render(<Dialog title="Delete confirmation" />)
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-labelledby')
  })

  it('should be keyboard navigable', async () => {
    const user = userEvent.setup()
    render(<Menu />)

    await user.tab()
    expect(screen.getByRole('button')).toHaveFocus()
  })
})
```

#### 4. Test Variants and States

```tsx
describe('Button Variants', () => {
  it.each([
    ['default', 'default'],
    ['destructive', 'destructive'],
    ['outline', 'outline'],
  ])('should render %s variant', (name, variant) => {
    render(<Button variant={variant}>Button</Button>)
    expect(screen.getByRole('button')).toHaveAttribute('data-variant', variant)
  })
})
```

#### 5. Async Testing

```tsx
it('should load data asynchronously', async () => {
  render(<DataComponent />)

  // Wait for loading to finish
  await waitFor(() => {
    expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
  })

  // Assert data is loaded
  expect(screen.getByText('Data loaded')).toBeInTheDocument()
})
```

### Testing Components with Charts

Recharts components are mocked to render simple divs with test IDs:

```tsx
import { LineChart, XAxis, YAxis, Line } from 'recharts'

it('should render a line chart', () => {
  const data = [{ name: 'Jan', value: 100 }]

  render(
    <LineChart data={data} width={400} height={300}>
      <XAxis dataKey="name" />
      <YAxis />
      <Line dataKey="value" />
    </LineChart>
  )

  expect(screen.getByTestId('line-chart')).toBeInTheDocument()
  expect(screen.getByTestId('x-axis')).toBeInTheDocument()
})
```

### Testing Components with Virtualization

react-window components are mocked to render all items:

```tsx
import { FixedSizeList } from 'react-window'

it('should render virtualized list', () => {
  const Row = ({ index, style }) => (
    <div style={style}>Row {index}</div>
  )

  render(
    <FixedSizeList
      itemCount={100}
      itemSize={40}
      height={400}
      width={300}
    >
      {Row}
    </FixedSizeList>
  )

  expect(screen.getByTestId('fixed-size-list')).toBeInTheDocument()
  expect(screen.getByText('Row 0')).toBeInTheDocument()
})
```

### Testing Hooks

```tsx
import { renderHook, waitFor } from '@testing-library/react'
import { useSearch } from './use-search'

describe('useSearch', () => {
  it('should update results on search', async () => {
    const { result } = renderHook(() => useSearch())

    act(() => {
      result.current.search('error')
    })

    await waitFor(() => {
      expect(result.current.results).toHaveLength(5)
    })
  })
})
```

### Mocking Dependencies

#### Mock Functions
```tsx
import { vi } from 'vitest'

const mockFn = vi.fn()
const mockFnWithReturn = vi.fn(() => 'value')
const mockFnWithImplementation = vi.fn((arg) => arg * 2)
```

#### Mock Modules
```tsx
vi.mock('@/lib/api', () => ({
  fetchData: vi.fn(() => Promise.resolve({ data: [] })),
}))
```

#### Mock Fetch/API Calls
```tsx
beforeEach(() => {
  global.fetch = vi.fn(() =>
    Promise.resolve({
      ok: true,
      json: async () => ({ data: [] }),
    })
  )
})
```

## Coverage Requirements

The project enforces the following coverage thresholds:

### Global Thresholds (85%)
- Statements: 85%
- Branches: 85%
- Functions: 85%
- Lines: 85%

### Component, Hook, and Library Thresholds (90%)
- `src/components/**`: 90% all metrics
- `src/hooks/**`: 90% all metrics
- `src/lib/**`: 90% all metrics

### Coverage Exclusions
- Test files: `**/*.test.{ts,tsx}`
- Type definitions: `**/*.d.ts`
- Mock files: `src/__mocks__/**`
- Test setup: `src/test-setup.ts`

### Viewing Coverage Reports

```bash
# Generate and view HTML coverage report
npm run test:coverage
open coverage/index.html
```

## Common Patterns

### Testing Forms

```tsx
it('should submit form with valid data', async () => {
  const handleSubmit = vi.fn()
  const user = userEvent.setup()

  render(<LoginForm onSubmit={handleSubmit} />)

  await user.type(screen.getByLabelText('Email'), 'user@example.com')
  await user.type(screen.getByLabelText('Password'), 'password123')
  await user.click(screen.getByRole('button', { name: /submit/i }))

  await waitFor(() => {
    expect(handleSubmit).toHaveBeenCalledWith({
      email: 'user@example.com',
      password: 'password123',
    })
  })
})
```

### Testing Error States

```tsx
it('should display error message on failed submission', async () => {
  const user = userEvent.setup()

  // Mock API to return error
  vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'))

  render(<DataForm />)
  await user.click(screen.getByRole('button', { name: /submit/i }))

  await screen.findByText('Network error')
})
```

### Testing Loading States

```tsx
it('should show loading state while fetching', async () => {
  render(<DataList />)

  expect(screen.getByText('Loading...')).toBeInTheDocument()

  await waitFor(() => {
    expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
  })
})
```

### Testing Conditional Rendering

```tsx
it('should render children when condition is true', () => {
  render(<ConditionalComponent show={true}>Content</ConditionalComponent>)
  expect(screen.getByText('Content')).toBeInTheDocument()
})

it('should not render children when condition is false', () => {
  render(<ConditionalComponent show={false}>Content</ConditionalComponent>)
  expect(screen.queryByText('Content')).not.toBeInTheDocument()
})
```

## Debugging Tests

### Debug Test Output
```tsx
import { screen } from '@testing-library/react'

it('should render component', () => {
  render(<MyComponent />)

  // Print the DOM
  screen.debug()

  // Print a specific element
  screen.debug(screen.getByRole('button'))
})
```

### Run Specific Tests
```bash
# Run tests matching a pattern
npx vitest --run button

# Run a specific test file
npx vitest --run src/components/ui/button.test.tsx

# Run tests with a specific name
npx vitest --run -t "should render"
```

### Watch Mode
```bash
# Run tests in watch mode
npm test

# In watch mode, press:
# - a: run all tests
# - f: run only failed tests
# - p: filter by filename
# - t: filter by test name
```

## CI/CD Integration

Tests run automatically on:
- Pull requests
- Pre-commit hooks
- CI/CD pipeline

The build will fail if:
- Any test fails
- Coverage thresholds are not met

## Additional Resources

- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/react)
- [Testing Library Queries](https://testing-library.com/docs/queries/about)
- [Jest-DOM Matchers](https://github.com/testing-library/jest-dom)
- [User Event API](https://testing-library.com/docs/user-event/intro)

## Example Tests

See `src/components/ui/button.test.tsx` for a comprehensive example of component testing covering:
- Rendering variations
- All variants and sizes
- User interactions
- Accessibility features
- Custom props handling

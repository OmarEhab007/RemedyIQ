import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'

// Simple component to test the infrastructure
function TestComponent() {
  return <div>Hello Test</div>
}

describe('Test Infrastructure', () => {
  it('should render a basic component', () => {
    render(<TestComponent />)
    expect(screen.getByText('Hello Test')).toBeInTheDocument()
  })

  it('should support globals (vitest)', () => {
    expect(true).toBe(true)
  })

  it('should have access to window', () => {
    expect(window).toBeDefined()
  })

  it('should have ResizeObserver mock', () => {
    const observer = new window.ResizeObserver(() => {})
    expect(observer).toBeDefined()
    expect(observer.observe).toBeDefined()
    expect(observer.unobserve).toBeDefined()
    expect(observer.disconnect).toBeDefined()
  })

  it('should have IntersectionObserver mock', () => {
    const observer = new window.IntersectionObserver(() => {})
    expect(observer).toBeDefined()
    expect(observer.observe).toBeDefined()
    expect(observer.unobserve).toBeDefined()
    expect(observer.disconnect).toBeDefined()
  })

  it('should have matchMedia mock', () => {
    const match = window.matchMedia('(min-width: 768px)')
    expect(match).toBeDefined()
    expect(match.matches).toBe(false)
  })
})

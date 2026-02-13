import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Button } from './button'

describe('Button Component', () => {
  describe('Rendering', () => {
    it('should render a button with text', () => {
      render(<Button>Click me</Button>)
      expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument()
    })

    it('should render with custom className', () => {
      render(<Button className="custom-class">Button</Button>)
      const button = screen.getByRole('button')
      expect(button).toHaveClass('custom-class')
    })

    it('should apply data attributes for variant and size', () => {
      render(<Button variant="destructive" size="lg">Delete</Button>)
      const button = screen.getByRole('button')
      expect(button).toHaveAttribute('data-variant', 'destructive')
      expect(button).toHaveAttribute('data-size', 'lg')
    })
  })

  describe('Variants', () => {
    it('should render default variant', () => {
      render(<Button>Default</Button>)
      const button = screen.getByRole('button')
      expect(button).toHaveAttribute('data-variant', 'default')
    })

    it('should render destructive variant', () => {
      render(<Button variant="destructive">Delete</Button>)
      const button = screen.getByRole('button')
      expect(button).toHaveAttribute('data-variant', 'destructive')
    })

    it('should render outline variant', () => {
      render(<Button variant="outline">Outline</Button>)
      const button = screen.getByRole('button')
      expect(button).toHaveAttribute('data-variant', 'outline')
    })

    it('should render secondary variant', () => {
      render(<Button variant="secondary">Secondary</Button>)
      const button = screen.getByRole('button')
      expect(button).toHaveAttribute('data-variant', 'secondary')
    })

    it('should render ghost variant', () => {
      render(<Button variant="ghost">Ghost</Button>)
      const button = screen.getByRole('button')
      expect(button).toHaveAttribute('data-variant', 'ghost')
    })

    it('should render link variant', () => {
      render(<Button variant="link">Link</Button>)
      const button = screen.getByRole('button')
      expect(button).toHaveAttribute('data-variant', 'link')
    })
  })

  describe('Sizes', () => {
    it('should render default size', () => {
      render(<Button>Button</Button>)
      const button = screen.getByRole('button')
      expect(button).toHaveAttribute('data-size', 'default')
    })

    it('should render xs size', () => {
      render(<Button size="xs">XS</Button>)
      const button = screen.getByRole('button')
      expect(button).toHaveAttribute('data-size', 'xs')
    })

    it('should render sm size', () => {
      render(<Button size="sm">SM</Button>)
      const button = screen.getByRole('button')
      expect(button).toHaveAttribute('data-size', 'sm')
    })

    it('should render lg size', () => {
      render(<Button size="lg">LG</Button>)
      const button = screen.getByRole('button')
      expect(button).toHaveAttribute('data-size', 'lg')
    })

    it('should render icon size', () => {
      render(<Button size="icon">Icon</Button>)
      const button = screen.getByRole('button')
      expect(button).toHaveAttribute('data-size', 'icon')
    })
  })

  describe('Interactions', () => {
    it('should call onClick handler when clicked', async () => {
      const handleClick = vi.fn()
      const user = userEvent.setup()

      render(<Button onClick={handleClick}>Click me</Button>)
      await user.click(screen.getByRole('button'))

      expect(handleClick).toHaveBeenCalledTimes(1)
    })

    it('should not call onClick when disabled', async () => {
      const handleClick = vi.fn()
      const user = userEvent.setup()

      render(<Button onClick={handleClick} disabled>Disabled</Button>)
      const button = screen.getByRole('button')

      // Try to click - should not work
      await user.click(button)
      expect(handleClick).not.toHaveBeenCalled()
    })

    it('should be disabled when disabled prop is true', () => {
      render(<Button disabled>Disabled</Button>)
      const button = screen.getByRole('button')
      expect(button).toBeDisabled()
    })
  })

  describe('Accessibility', () => {
    it('should have button role', () => {
      render(<Button>Accessible</Button>)
      expect(screen.getByRole('button')).toBeInTheDocument()
    })

    it('should support aria-label', () => {
      render(<Button aria-label="Close dialog">X</Button>)
      expect(screen.getByLabelText('Close dialog')).toBeInTheDocument()
    })

    it('should support aria-describedby', () => {
      render(
        <>
          <Button aria-describedby="help-text">Submit</Button>
          <div id="help-text">This submits the form</div>
        </>
      )
      expect(screen.getByRole('button')).toHaveAttribute('aria-describedby', 'help-text')
    })
  })

  describe('Custom props', () => {
    it('should support type attribute', () => {
      render(<Button type="submit">Submit</Button>)
      const button = screen.getByRole('button')
      expect(button).toHaveAttribute('type', 'submit')
    })

    it('should support id attribute', () => {
      render(<Button id="custom-button">Button</Button>)
      const button = screen.getByRole('button')
      expect(button).toHaveAttribute('id', 'custom-button')
    })

    it('should forward ref correctly', () => {
      const ref = vi.fn()
      render(<Button ref={ref}>Button</Button>)
      expect(ref).toHaveBeenCalled()
    })
  })
})

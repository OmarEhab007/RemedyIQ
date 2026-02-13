import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SkillSelector } from './skill-selector'
import type { SkillInfo } from '@/hooks/use-ai'

describe('SkillSelector', () => {
  const mockOnSelect = vi.fn()
  const mockSkills: SkillInfo[] = [
    { name: 'summarizer', description: 'Summarize log analysis results' },
    { name: 'anomaly', description: 'Detect anomalies in log data' },
    { name: 'error_explainer', description: 'Explain error codes and messages' },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns null when skills array is empty', () => {
    const { container } = render(
      <SkillSelector skills={[]} selected="summarizer" onSelect={mockOnSelect} />
    )

    expect(container.firstChild).toBeNull()
  })

  it('renders "AI Skill" heading', () => {
    render(<SkillSelector skills={mockSkills} selected="summarizer" onSelect={mockOnSelect} />)

    expect(screen.getByText(/ai skill/i)).toBeInTheDocument()
  })

  it('renders all skill buttons with name and description', () => {
    render(<SkillSelector skills={mockSkills} selected="summarizer" onSelect={mockOnSelect} />)

    expect(screen.getByText('summarizer')).toBeInTheDocument()
    expect(screen.getByText('Summarize log analysis results')).toBeInTheDocument()
    expect(screen.getByText('anomaly')).toBeInTheDocument()
    expect(screen.getByText('Detect anomalies in log data')).toBeInTheDocument()
    expect(screen.getByText('error_explainer')).toBeInTheDocument()
    expect(screen.getByText('Explain error codes and messages')).toBeInTheDocument()
  })

  it('applies selected styling to selected skill', () => {
    render(<SkillSelector skills={mockSkills} selected="anomaly" onSelect={mockOnSelect} />)

    const anomalyButton = screen.getByText('anomaly').closest('button')!
    expect(anomalyButton.className).toContain('bg-primary')
  })

  it('does not apply selected styling to unselected skills', () => {
    render(<SkillSelector skills={mockSkills} selected="anomaly" onSelect={mockOnSelect} />)

    const summarizerButton = screen.getByText('summarizer').closest('button')!
    const errorExplainerButton = screen.getByText('error_explainer').closest('button')!

    expect(summarizerButton.className).not.toContain('bg-primary')
    expect(errorExplainerButton.className).not.toContain('bg-primary')
  })

  it('calls onSelect with skill name when clicked', () => {
    render(<SkillSelector skills={mockSkills} selected="summarizer" onSelect={mockOnSelect} />)

    const anomalyButton = screen.getByText('anomaly').closest('button')!
    fireEvent.click(anomalyButton)

    expect(mockOnSelect).toHaveBeenCalledWith('anomaly')
  })

  it('renders each skill description', () => {
    render(<SkillSelector skills={mockSkills} selected="summarizer" onSelect={mockOnSelect} />)

    expect(screen.getByText('Summarize log analysis results')).toBeInTheDocument()
    expect(screen.getByText('Detect anomalies in log data')).toBeInTheDocument()
    expect(screen.getByText('Explain error codes and messages')).toBeInTheDocument()
  })

  it('handles single skill', () => {
    const singleSkill: SkillInfo[] = [
      { name: 'summarizer', description: 'Summarize log analysis results' },
    ]

    render(<SkillSelector skills={singleSkill} selected="summarizer" onSelect={mockOnSelect} />)

    expect(screen.getByText('summarizer')).toBeInTheDocument()
    expect(screen.getByText('Summarize log analysis results')).toBeInTheDocument()

    const button = screen.getByText('summarizer').closest('button')!
    expect(button!.className).toContain('bg-primary')
  })
})

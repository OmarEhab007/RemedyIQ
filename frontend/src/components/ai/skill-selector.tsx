'use client'

/**
 * skill-selector.tsx — AI skill picker buttons.
 *
 * Shows "Auto" (null skill) + each skill from useAISkills().
 * Active skill is highlighted. Tooltip on each button via title attr.
 *
 * Usage:
 *   <SkillSelector
 *     selectedSkill={selectedSkill}
 *     onSelectSkill={setSkill}
 *   />
 */

import { useCallback } from 'react'
import { cn } from '@/lib/utils'
import { useAISkills } from '@/hooks/use-api'
import type { AISkill } from '@/lib/api-types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SkillSelectorProps {
  selectedSkill: string | null
  onSelectSkill: (skill: string | null) => void
  className?: string
}

// ---------------------------------------------------------------------------
// Fallback skill icon based on skill name
// ---------------------------------------------------------------------------

function getSkillEmoji(name: string): string {
  const map: Record<string, string> = {
    performance: '⚡',
    root_cause: '🔍',
    root_cause_analysis: '🔍',
    error_explainer: '🚨',
    anomaly_narrator: '📊',
    summarizer: '📝',
    summary: '📝',
  }
  return map[name.toLowerCase()] ?? '🤖'
}

// ---------------------------------------------------------------------------
// Static fallback skills (shown when API is loading/unavailable)
// ---------------------------------------------------------------------------

const FALLBACK_SKILLS: AISkill[] = [
  {
    name: 'performance',
    display_name: 'Performance',
    description: 'Analyze query performance and bottlenecks',
    icon: '⚡',
  },
  {
    name: 'root_cause',
    display_name: 'Root Cause',
    description: 'Identify root causes of errors and failures',
    icon: '🔍',
  },
  {
    name: 'error_explainer',
    display_name: 'Error Explainer',
    description: 'Explain error messages in plain language',
    icon: '🚨',
  },
  {
    name: 'anomaly_narrator',
    display_name: 'Anomaly Narrator',
    description: 'Narrate unusual patterns and anomalies',
    icon: '📊',
  },
  {
    name: 'summarizer',
    display_name: 'Summarizer',
    description: 'Generate concise summaries of log data',
    icon: '📝',
  },
]

// ---------------------------------------------------------------------------
// Skill button
// ---------------------------------------------------------------------------

interface SkillButtonProps {
  name: string | null
  label: string
  description: string
  icon: string
  isActive: boolean
  onClick: (name: string | null) => void
}

function SkillButton({ name, label, description, icon, isActive, onClick }: SkillButtonProps) {
  const handleClick = useCallback(() => {
    onClick(name)
  }, [name, onClick])

  return (
    <button
      type="button"
      onClick={handleClick}
      title={description}
      aria-label={`${label}: ${description}`}
      aria-pressed={isActive}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2',
        isActive
          ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-white shadow-sm'
          : 'border-[var(--color-border)] bg-[var(--color-bg-primary)] text-[var(--color-text-secondary)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]',
      )}
    >
      <span role="img" aria-hidden="true">{icon}</span>
      {label}
    </button>
  )
}

// ---------------------------------------------------------------------------
// SkillSelector
// ---------------------------------------------------------------------------

export function SkillSelector({
  selectedSkill,
  onSelectSkill,
  className,
}: SkillSelectorProps) {
  const { data: skills, isLoading } = useAISkills()

  const displaySkills = isLoading || !skills?.length ? FALLBACK_SKILLS : skills

  return (
    <div
      className={cn('flex flex-wrap items-center gap-1.5', className)}
      role="group"
      aria-label="AI skill selector"
    >
      {/* Auto (no skill) */}
      <SkillButton
        name={null}
        label="Auto"
        description="Let the AI choose the best approach"
        icon="✨"
        isActive={selectedSkill === null}
        onClick={onSelectSkill}
      />

      {/* Divider */}
      <div className="h-4 w-px bg-[var(--color-border)]" aria-hidden="true" />

      {/* Skill buttons */}
      {displaySkills.map((skill) => (
        <SkillButton
          key={skill.name}
          name={skill.name}
          label={skill.display_name}
          description={skill.description}
          icon={skill.icon || getSkillEmoji(skill.name)}
          isActive={selectedSkill === skill.name}
          onClick={onSelectSkill}
        />
      ))}
    </div>
  )
}

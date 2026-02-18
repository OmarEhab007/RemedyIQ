'use client'

/**
 * SearchBar — KQL-style log search input with autocomplete dropdown.
 *
 * - Debounced 300 ms via useDebounce
 * - Autocomplete suggestions from useAutocomplete('query', prefix, jobId)
 * - Submit on Enter key or search button click
 * - Keyboard-navigable suggestion list (Arrow keys, Enter, Escape)
 *
 * Usage:
 *   <SearchBar
 *     value={query}
 *     onChange={setQuery}
 *     onSubmit={handleSearch}
 *     jobId="job-123"
 *     placeholder="Search logs… e.g. user:john form:HPD:Help_Desk"
 *   />
 */

import { useRef, useState, useCallback, useEffect } from 'react'
import { useDebounce } from '@/hooks/use-debounce'
import { useAutocomplete } from '@/hooks/use-api'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SearchBarProps {
  value: string
  onChange: (value: string) => void
  onSubmit: (value: string) => void
  jobId?: string | null
  placeholder?: string
  className?: string
  'aria-label'?: string
}

// ---------------------------------------------------------------------------
// SearchBar component
// ---------------------------------------------------------------------------

export function SearchBar({
  value,
  onChange,
  onSubmit,
  jobId,
  placeholder = 'Search logs… e.g. user:john duration:>5000',
  className,
  'aria-label': ariaLabel = 'Search logs',
}: SearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)

  // Extract the last "token" being typed for autocomplete prefix
  const lastToken = value.split(/\s+/).pop() ?? ''
  const debouncedPrefix = useDebounce(lastToken, 300)

  const { data: autocompleteData } = useAutocomplete(
    'query',
    debouncedPrefix,
    jobId ?? undefined,
  )
  const suggestions = autocompleteData?.suggestions ?? []
  const hasSuggestions = suggestions.length > 0 && debouncedPrefix.length >= 1

  // Open/close dropdown based on suggestions
  useEffect(() => {
    setIsOpen(hasSuggestions)
    setActiveIndex(-1)
  }, [hasSuggestions, debouncedPrefix])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
        setActiveIndex(-1)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSelect = useCallback(
    (suggestion: string) => {
      // Replace the last token with the selected suggestion
      const tokens = value.split(/\s+/)
      tokens[tokens.length - 1] = suggestion
      const newValue = tokens.join(' ')
      onChange(newValue)
      setIsOpen(false)
      setActiveIndex(-1)
      inputRef.current?.focus()
    },
    [value, onChange],
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!isOpen) {
        if (e.key === 'Enter') {
          e.preventDefault()
          onSubmit(value)
        }
        return
      }

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setActiveIndex((prev) => Math.min(prev + 1, suggestions.length - 1))
          break
        case 'ArrowUp':
          e.preventDefault()
          setActiveIndex((prev) => Math.max(prev - 1, -1))
          break
        case 'Enter':
          e.preventDefault()
          if (activeIndex >= 0 && suggestions[activeIndex]) {
            handleSelect(suggestions[activeIndex].value)
          } else {
            setIsOpen(false)
            onSubmit(value)
          }
          break
        case 'Escape':
          setIsOpen(false)
          setActiveIndex(-1)
          break
        case 'Tab':
          if (activeIndex >= 0 && suggestions[activeIndex]) {
            e.preventDefault()
            handleSelect(suggestions[activeIndex].value)
          } else {
            setIsOpen(false)
          }
          break
      }
    },
    [isOpen, activeIndex, suggestions, value, onSubmit, handleSelect],
  )

  const handleClear = useCallback(() => {
    onChange('')
    onSubmit('')
    inputRef.current?.focus()
  }, [onChange, onSubmit])

  return (
    <div ref={containerRef} className={cn('relative w-full', className)}>
      {/* Input wrapper */}
      <div className="relative flex items-center">
        {/* Search icon */}
        <div className="pointer-events-none absolute left-3 flex items-center" aria-hidden="true">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-[var(--color-text-tertiary)]"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
        </div>

        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-label={ariaLabel}
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-autocomplete="list"
          aria-controls={isOpen ? 'search-autocomplete-list' : undefined}
          aria-activedescendant={
            activeIndex >= 0 ? `search-suggestion-${activeIndex}` : undefined
          }
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          spellCheck={false}
          autoComplete="off"
          className={cn(
            'h-10 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)]',
            'pl-10 pr-20 font-mono text-sm text-[var(--color-text-primary)]',
            'placeholder:font-sans placeholder:text-[var(--color-text-tertiary)]',
            'focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20',
            'transition-colors',
          )}
        />

        {/* Clear + Search buttons */}
        <div className="absolute right-1 flex items-center gap-1">
          {value.length > 0 && (
            <button
              type="button"
              onClick={handleClear}
              aria-label="Clear search"
              className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--color-text-tertiary)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          )}
          <button
            type="button"
            onClick={() => onSubmit(value)}
            aria-label="Submit search"
            className="flex h-7 items-center gap-1 rounded-md bg-[var(--color-primary)] px-2.5 text-xs font-medium text-white hover:bg-[var(--color-primary-dark)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-1 transition-colors"
          >
            Search
          </button>
        </div>
      </div>

      {/* Autocomplete dropdown */}
      {isOpen && hasSuggestions && (
        <ul
          ref={listRef}
          id="search-autocomplete-list"
          role="listbox"
          aria-label="Autocomplete suggestions"
          className={cn(
            'absolute left-0 right-0 top-full z-50 mt-1',
            'max-h-56 overflow-y-auto',
            'rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] shadow-lg',
            'divide-y divide-[var(--color-border-light)]',
          )}
        >
          {suggestions.map((suggestion, index) => (
            <li
              key={suggestion.value}
              id={`search-suggestion-${index}`}
              role="option"
              aria-selected={index === activeIndex}
              onMouseDown={(e) => {
                // Prevent input blur before click fires
                e.preventDefault()
                handleSelect(suggestion.value)
              }}
              onMouseEnter={() => setActiveIndex(index)}
              className={cn(
                'flex cursor-pointer items-center justify-between px-4 py-2 text-sm',
                'transition-colors',
                index === activeIndex
                  ? 'bg-[var(--color-primary-light)] text-[var(--color-primary-dark)] ring-1 ring-inset ring-[var(--color-primary)]'
                  : 'text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)]',
              )}
            >
              <span className="font-mono">{suggestion.value}</span>
              <span className="ml-3 text-xs text-[var(--color-text-tertiary)]">
                {suggestion.count.toLocaleString()}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

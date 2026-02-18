'use client'

import { useRouter } from 'next/navigation'
import {
  Upload,
  BarChart3,
  Search,
  GitBranch,
  Bot,
  Sun,
  Moon,
  Plus,
} from 'lucide-react'

import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from '@/components/ui/command'
import { useTheme } from '@/hooks/use-theme'
import { ROUTES } from '@/lib/constants'

export interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter()
  const { resolvedTheme, toggleTheme } = useTheme()

  function select(action: () => void) {
    action()
    onOpenChange(false)
  }

  const pageItems = [
    {
      label: 'Upload',
      icon: Upload,
      route: ROUTES.UPLOAD,
    },
    {
      label: 'Analyses',
      icon: BarChart3,
      route: ROUTES.ANALYSIS,
    },
    {
      label: 'Explorer',
      icon: Search,
      route: ROUTES.EXPLORER,
    },
    {
      label: 'Traces',
      icon: GitBranch,
      route: ROUTES.TRACE,
    },
    {
      label: 'AI Assistant',
      icon: Bot,
      route: ROUTES.AI,
    },
  ] as const

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Pages">
          {pageItems.map(({ label, icon: Icon, route }) => (
            <CommandItem
              key={route}
              onSelect={() => select(() => router.push(route))}
            >
              <Icon />
              {label}
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Actions">
          <CommandItem onSelect={() => select(toggleTheme)}>
            {resolvedTheme === 'dark' ? <Sun /> : <Moon />}
            Toggle Theme
          </CommandItem>
          <CommandItem
            onSelect={() => select(() => router.push(ROUTES.UPLOAD))}
          >
            <Plus />
            New Upload
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}

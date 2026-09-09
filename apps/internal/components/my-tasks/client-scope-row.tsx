'use client'

import { Check } from 'lucide-react'

import { CommandItem } from '@/components/ui/command'
import { cn } from '@/lib/utils'

type ClientScopeRowProps = {
  label: string
  checked: boolean
  disabled?: boolean
  onToggle: () => void
  className?: string
}

/**
 * A checkbox-styled row in the client selector's "Show" group. Toggling
 * never closes the popover — the caller only flips a URL param — so a
 * planner can flip both boxes in one visit.
 */
export function ClientScopeRow({
  label,
  checked,
  disabled = false,
  onToggle,
  className,
}: ClientScopeRowProps) {
  return (
    <CommandItem
      value={label}
      aria-checked={checked}
      disabled={disabled}
      onSelect={onToggle}
      className={cn('whitespace-nowrap', className)}
    >
      <span
        aria-hidden='true'
        className={cn(
          'border-input flex size-4 shrink-0 items-center justify-center rounded-sm border',
          checked && 'bg-primary border-primary text-primary-foreground'
        )}
      >
        {checked ? <Check className='size-3 text-current!' /> : null}
      </span>
      {label}
    </CommandItem>
  )
}

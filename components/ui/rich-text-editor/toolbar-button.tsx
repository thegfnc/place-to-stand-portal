import type { ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type ToolbarButtonProps = {
  onClick: () => void
  active?: boolean
  disabled?: boolean
  icon: ReactNode
  label: string
}

export function ToolbarButton({
  onClick,
  active,
  disabled,
  icon,
  label,
}: ToolbarButtonProps) {
  return (
    <Button
      type='button'
      variant='ghost'
      size='icon-sm'
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active ?? false}
      className={cn(
        'h-8 w-8 rounded-md',
        active && 'bg-accent text-accent-foreground'
      )}
    >
      {icon}
    </Button>
  )
}

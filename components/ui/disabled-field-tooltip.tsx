'use client'

import { cloneElement, type CSSProperties, type ReactElement } from 'react'

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

type DisabledFieldTooltipProps = {
  disabled: boolean
  reason?: string | null
  children: ReactElement<{ className?: string; style?: CSSProperties }>
  className?: string
}

export function DisabledFieldTooltip({
  disabled,
  reason,
  children,
  className,
}: DisabledFieldTooltipProps) {
  if (!disabled || !reason) {
    return children
  }

  const { className: childClassName, style: childStyle } = children.props

  const wrappedChild = cloneElement(children, {
    className: cn(childClassName, 'pointer-events-none'),
    style: { ...childStyle, pointerEvents: 'none' },
  })

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn('w-full cursor-not-allowed', className)}
          aria-disabled='true'
        >
          <div className='w-full'>{wrappedChild}</div>
        </div>
      </TooltipTrigger>
      <TooltipContent>{reason}</TooltipContent>
    </Tooltip>
  )
}

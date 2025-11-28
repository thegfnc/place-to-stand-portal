'use client'

import {
  memo,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from 'react'
import { defaultAnimateLayoutChanges, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Mail, Phone, User } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { getLeadSourceLabel } from '@/lib/leads/constants'
import type { LeadRecord } from '@/lib/leads/types'
import { cn } from '@/lib/utils'

type LeadCardProps = {
  lead: LeadRecord
  columnId: string
  canManage: boolean
  onEditLead: (lead: LeadRecord) => void
  disableDropTransition?: boolean
}

export const LeadCard = memo(function LeadCard({
  lead,
  columnId,
  canManage,
  onEditLead,
  disableDropTransition = false,
}: LeadCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: lead.id,
    data: {
      type: 'lead',
      columnId,
    },
    disabled: !canManage,
    animateLayoutChanges: args => {
      if (!disableDropTransition) {
        return defaultAnimateLayoutChanges(args)
      }
      return false
    },
  })

  const listenersMap = listeners ?? {}
  const draggableKeyDown = (
    listenersMap as {
      onKeyDown?: (event: KeyboardEvent<HTMLDivElement>) => void
    }
  ).onKeyDown
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  const cleanedAttributes = useMemo(() => {
    if (!attributes) {
      return {}
    }

    const { ['aria-describedby']: _omitDescribedBy, ...rest } = attributes
    void _omitDescribedBy
    return rest
  }, [attributes])

  const shouldDisableTransition = disableDropTransition && !isDragging
  const style: CSSProperties = {
    opacity: isDragging ? 0 : 1,
    transform: transform ? CSS.Transform.toString(transform) : undefined,
    transition: shouldDisableTransition
      ? 'none'
      : isDragging
        ? undefined
        : transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(isMounted ? attributes : cleanedAttributes)}
      {...listenersMap}
      role='button'
      onClick={() => onEditLead(lead)}
      onKeyDown={event => {
        draggableKeyDown?.(event)
        if (event.defaultPrevented) {
          return
        }
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onEditLead(lead)
        }
      }}
      className={cn(
        'group bg-card focus-visible:ring-ring focus-visible:ring-offset-background rounded-lg border-y border-r border-l-4 border-l-amber-500 p-4 text-left shadow-sm transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
        canManage ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer',
        isDragging && 'ring-primary ring-2',
        isDragging && 'border-primary/50 bg-primary/5 shadow-md',
        !isDragging &&
          'hover:border-r-amber-500/50 hover:border-y-amber-500/50 hover:bg-amber-500/5 hover:shadow-md'
      )}
    >
      <LeadCardContent lead={lead} />
    </div>
  )
})

export function LeadCardContent({ lead }: { lead: LeadRecord }) {
  const assigneeDisplay =
    lead.assigneeName ?? lead.assigneeEmail ?? 'Unassigned'
  const companyDisplay = lead.companyName?.trim()
  const sourceLabel = lead.sourceType
    ? getLeadSourceLabel(lead.sourceType)
    : null
  const sourceDetail = lead.sourceDetail?.trim()
  const showSourceTooltip = Boolean(sourceDetail && sourceLabel)

  const badge = sourceLabel ? (
    <Badge
      variant='outline'
      className='text-muted-foreground text-[10px] font-medium tracking-wide uppercase'
    >
      {sourceLabel}
    </Badge>
  ) : null

  return (
    <>
      <div className='space-y-0.5'>
        <div className='flex items-start justify-between gap-3'>
          <h3 className='text-foreground line-clamp-2 text-sm leading-snug font-semibold'>
            {lead.contactName}
          </h3>
          {showSourceTooltip && badge ? (
            <Tooltip>
              <TooltipTrigger asChild>{badge}</TooltipTrigger>
              <TooltipContent side='top'>{sourceDetail}</TooltipContent>
            </Tooltip>
          ) : (
            badge
          )}
        </div>
        {companyDisplay ? (
          <p className='text-muted-foreground text-xs font-medium'>
            {companyDisplay}
          </p>
        ) : null}
      </div>
      <div className='mt-5 space-y-2'>
        {lead.contactEmail ? (
          <div className='text-muted-foreground flex flex-wrap items-center gap-2 text-xs'>
            <AnchorRow
              icon={Mail}
              value={lead.contactEmail}
              href={`mailto:${lead.contactEmail}`}
            />
          </div>
        ) : null}
        {lead.contactPhone ? (
          <div className='text-muted-foreground flex flex-wrap items-center gap-2 text-xs'>
            <AnchorRow
              icon={Phone}
              value={lead.contactPhone}
              href={`tel:${lead.contactPhone}`}
            />
          </div>
        ) : null}
        <div className='text-muted-foreground flex flex-wrap items-center gap-1 text-xs'>
          <User className='h-3.5 w-3.5' aria-hidden />
          <span>{assigneeDisplay}</span>
        </div>
      </div>
    </>
  )
}

type AnchorRowProps = {
  icon: typeof Mail
  value: string
  href: string
}

function AnchorRow({ icon: Icon, value, href }: AnchorRowProps) {
  return (
    <a
      href={href}
      className='hover:text-foreground inline-flex items-center gap-1 underline-offset-4 transition hover:underline font-mono font-medium'
      onClick={event => event.stopPropagation()}
      title={value}
    >
      <Icon className='h-3.5 w-3.5 shrink-0' aria-hidden />

        {value}

    </a>
  )
}

export function LeadCardPreview({ lead }: { lead: LeadRecord }) {
  return (
    <div className='bg-card border-l-amber-500 w-80 rounded-lg border-y border-r border-l-4 p-4 shadow-sm'>
      <LeadCardContent lead={lead} />
    </div>
  )
}

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
import { cn } from '@/lib/utils'
import type { LeadRecord } from '@/lib/leads/types'

type LeadCardProps = {
  lead: LeadRecord
  columnId: string
  canManage: boolean
  onEditLead: (lead: LeadRecord) => void
  disableDropTransition?: boolean
}

const toPlainText = (value: string | null | undefined) => {
  if (!value) {
    return ''
  }

  return value
    .replace(/<br\s*\/?>(\s|&nbsp;|\u00a0)*/gi, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
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
        'group bg-card focus-visible:ring-ring focus-visible:ring-offset-background rounded-lg border p-4 text-left shadow-sm transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
        canManage ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer',
        isDragging && 'ring-primary ring-2',
        isDragging && 'border-primary/50 bg-primary/5 shadow-md',
        !isDragging &&
          'hover:border-primary/40 hover:bg-primary/5 hover:shadow-md'
      )}
    >
      <LeadCardContent lead={lead} />
    </div>
  )
})

export function LeadCardContent({ lead }: { lead: LeadRecord }) {
  const ownerDisplay = lead.ownerName ?? lead.ownerEmail ?? 'Unassigned'
  const notesPreview = toPlainText(lead.notesHtml)

  return (
    <>
      <div className='space-y-2'>
        <div className='flex items-start justify-between gap-3'>
          <h3 className='text-foreground line-clamp-2 text-sm leading-snug font-semibold'>
            {lead.name}
          </h3>
          {lead.source ? (
            <Badge
              variant='outline'
              className='text-muted-foreground text-[10px] font-medium tracking-wide uppercase'
            >
              {lead.source}
            </Badge>
          ) : null}
        </div>
        {notesPreview ? (
          <p className='text-muted-foreground line-clamp-3 text-xs'>
            {notesPreview}
          </p>
        ) : null}
      </div>
      <div className='text-muted-foreground mt-4 space-y-2 text-xs'>
        <div className='flex flex-wrap items-center gap-x-3 gap-y-2'>
          <div className='inline-flex items-center gap-1'>
            <User className='h-3.5 w-3.5' aria-hidden />
            {ownerDisplay}
          </div>
        </div>
        {lead.contactEmail ? (
          <AnchorRow
            icon={Mail}
            value={lead.contactEmail}
            href={`mailto:${lead.contactEmail}`}
          />
        ) : (
          <p className='text-xs'>
            Add an email address to keep outreach on track.
          </p>
        )}
        {lead.contactPhone ? (
          <AnchorRow
            icon={Phone}
            value={lead.contactPhone}
            href={`tel:${lead.contactPhone}`}
          />
        ) : null}
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
      className='text-muted-foreground hover:text-foreground inline-flex items-center gap-2 transition'
      onClick={event => event.stopPropagation()}
      title={value}
    >
      <Icon className='h-3.5 w-3.5 shrink-0' aria-hidden />
      <span className='truncate font-mono text-[11px] font-medium'>
        {value}
      </span>
    </a>
  )
}

export function LeadCardPreview({ lead }: { lead: LeadRecord }) {
  return (
    <div className='bg-card w-80 rounded-lg border p-4 shadow-sm'>
      <LeadCardContent lead={lead} />
    </div>
  )
}

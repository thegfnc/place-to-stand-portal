'use client'

import { Fragment, type MutableRefObject, type UIEventHandler } from 'react'
import { Plus } from 'lucide-react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'

import { cn } from '@/lib/utils'
import type { LeadRecord } from '@/lib/leads/types'
import type { LeadStatusValue } from '@/lib/leads/constants'
import { getLeadStatusToken } from '@/lib/leads/constants'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

import { BoardDropPlaceholder } from '@/components/board/drop-placeholder'

import { LeadCard } from './lead-card'

type LeadColumnProps = {
  columnId: LeadStatusValue
  label: string
  leads: LeadRecord[]
  canManage: boolean
  onEditLead: (lead: LeadRecord) => void
  onCreateLead?: (status: LeadStatusValue) => void
  isDropTarget?: boolean
  dropIndicatorIndex?: number | null
  draggingLeadId?: string | null
  recentlyMovedLeadId?: string | null
  activeLeadId?: string | null
  columnScrollRef?: MutableRefObject<HTMLDivElement | null>
  onColumnScroll?: UIEventHandler<HTMLDivElement>
}

export function LeadColumn({
  columnId,
  label,
  leads,
  canManage,
  onEditLead,
  onCreateLead,
  isDropTarget = false,
  dropIndicatorIndex = null,
  draggingLeadId = null,
  recentlyMovedLeadId = null,
  activeLeadId = null,
  columnScrollRef,
  onColumnScroll,
}: LeadColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: columnId,
    data: {
      type: 'column',
      columnId,
    },
  })

  const statusToken = getLeadStatusToken(columnId)
  const highlight = isOver || isDropTarget
  const draggingLeadVisibleInColumn = Boolean(
    draggingLeadId && leads.some(lead => lead.id === draggingLeadId)
  )
  const showPlaceholder =
    dropIndicatorIndex !== null &&
    draggingLeadId !== null &&
    !draggingLeadVisibleInColumn

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'bg-background/80 flex min-h-0 w-80 shrink-0 flex-col gap-4 overflow-hidden rounded-xl border p-4 shadow-sm transition',
        highlight && 'ring-primary ring-2'
      )}
    >
      <div className='flex items-center justify-between gap-2'>
        <div className='flex items-center gap-3'>
          <Badge
            variant='outline'
            className={cn(
              'text-xs font-semibold tracking-wide uppercase',
              statusToken
            )}
          >
            {label}
          </Badge>
          <span className='text-muted-foreground text-[10px]'>
            {leads.length}
          </span>
        </div>
        <div className='flex items-center gap-2'>
          {canManage && onCreateLead ? (
            <Button
              type='button'
              size='icon'
              variant='ghost'
              className='h-7 w-7'
              onClick={() => onCreateLead(columnId)}
            >
              <Plus className='h-4 w-4' />
              <span className='sr-only'>Add lead to {label}</span>
            </Button>
          ) : null}
        </div>
      </div>
      <div
        ref={columnScrollRef}
        onScroll={onColumnScroll}
        className='flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1'
      >
        <SortableContext
          id={columnId}
          items={leads.map(lead => lead.id)}
          strategy={verticalListSortingStrategy}
        >
          {leads.map((lead, index) => {
            const shouldShowPlaceholder =
              showPlaceholder && dropIndicatorIndex === index

            return (
              <Fragment key={lead.id}>
                {shouldShowPlaceholder ? <BoardDropPlaceholder /> : null}
                <LeadCard
                  lead={lead}
                  columnId={columnId}
                  canManage={canManage}
                  onEditLead={onEditLead}
                  disableDropTransition={lead.id === recentlyMovedLeadId}
                  isActive={lead.id === activeLeadId}
                />
              </Fragment>
            )
          })}
          {showPlaceholder &&
          dropIndicatorIndex !== null &&
          dropIndicatorIndex >= leads.length ? (
            <BoardDropPlaceholder key={`${columnId}-placeholder`} />
          ) : null}
        </SortableContext>
      </div>
    </div>
  )
}

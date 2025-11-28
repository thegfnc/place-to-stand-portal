'use client'

import {
  closestCenter,
  DndContext,
  DragOverlay,
  pointerWithin,
  rectIntersection,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
} from 'react'

import { useProjectsBoardSensors } from '@/app/(dashboard)/projects/_hooks/use-projects-board-sensors'
import type { LeadBoardColumnData, LeadRecord } from '@/lib/leads/types'
import type { LeadStatusValue } from '@/lib/leads/constants'
import { useToast } from '@/components/ui/use-toast'
import { moveLead } from '../actions'
import { getRankAfter, getRankBefore, getRankBetween } from '@/lib/rank'
import { useRecentlyMovedItem } from '@/lib/dnd/use-recently-moved-item'

import { LeadColumn } from './lead-column'
import { LeadCardPreview } from './lead-card'

type LeadsBoardProps = {
  initialColumns: LeadBoardColumnData[]
  canManage: boolean
  onEditLead: (lead: LeadRecord) => void
  activeLeadId: string | null
}

export function LeadsBoard({
  initialColumns,
  canManage,
  onEditLead,
  activeLeadId,
}: LeadsBoardProps) {
  const { sensors } = useProjectsBoardSensors()
  const [columns, setColumns] = useState(() =>
    cloneColumns(initialColumns)
  )
  const columnsRef = useRef(columns)
  const [draggingLead, setDraggingLead] = useState<LeadRecord | null>(null)
  const dropPreviewRef = useRef<DropTarget | null>(null)
  const [dropPreviewValue, setDropPreviewValue] = useState<DropTarget | null>(
    null
  )
  const dropPreview = dropPreviewValue
  const [isPending, startTransition] = useTransition()
  const { toast } = useToast()
  const {
    recentlyMovedId: recentlyMovedLeadId,
    setRecentlyMovedId: setRecentlyMovedLeadId,
    scheduleReset: scheduleRecentlyMovedReset,
    clearTimer: clearRecentlyMovedTimer,
  } = useRecentlyMovedItem()
  const lastLeadOverId = useRef<UniqueIdentifier | null>(null)
  const lastColumnOverId = useRef<UniqueIdentifier | null>(null)

  const setDropPreview = useCallback((next: DropTarget | null) => {
    dropPreviewRef.current = next
    setDropPreviewValue(next)
  }, [])

  useEffect(() => {
    columnsRef.current = columns
  }, [columns])

  useEffect(() => {
    // Reset board when server data refreshes
    setColumns(cloneColumns(initialColumns))
  }, [initialColumns])

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const leadId = event.active.id?.toString()
      if (!leadId) {
        return
      }

      const lead = findLeadById(columnsRef.current, leadId)
      if (lead) {
        setDraggingLead(lead)
      }

      setDropPreview(null)
      setRecentlyMovedLeadId(null)
      clearRecentlyMovedTimer()
    },
    [clearRecentlyMovedTimer, setDropPreview, setRecentlyMovedLeadId]
  )

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const target = resolveDropTarget(event, columnsRef.current)

      const leadId = event.active.id?.toString()
      if (!target || !leadId) {
        setDropPreview(null)
      } else {
        const currentLocation = resolveCurrentLocation(
          leadId,
          columnsRef.current
        )
        const isSameSpot =
          currentLocation &&
          currentLocation.columnId === target.columnId &&
          currentLocation.index === target.index

        setDropPreview(isSameSpot ? null : target)
      }

      if (target) {
        setDraggingLead(prev =>
          prev ? { ...prev, status: target.columnId } : prev
        )
      }
    },
    [setDropPreview]
  )

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const leadId = event.active.id?.toString()
      setDraggingLead(null)
      setDropPreview(null)

      if (!leadId) {
        return
      }

      const currentColumns = columnsRef.current
      const target =
        resolveDropTarget(event, currentColumns) ?? dropPreviewRef.current

      if (!target) {
        return
      }

  const result = produceLeadReorder({
        columns: currentColumns,
        leadId,
        targetColumnId: target.columnId,
        targetIndex: target.index,
      })

      if (!result) {
        return
      }

      setColumns(result.nextColumns)
      setRecentlyMovedLeadId(leadId)
      scheduleRecentlyMovedReset()

      if (!canManage) {
        columnsRef.current = result.nextColumns
        return
      }

      startTransition(async () => {
        const response = await moveLead({
          leadId,
          targetStatus: result.targetColumnId,
          rank: result.rank,
        })

        if (!response.success) {
          setColumns(result.previousColumns)
          columnsRef.current = result.previousColumns
          toast({
            variant: 'destructive',
            title: 'Unable to move lead',
            description: response.error ?? 'Please try again.',
          })
        } else {
          columnsRef.current = result.nextColumns
        }
      })
    },
    [
      canManage,
      scheduleRecentlyMovedReset,
      setDropPreview,
      setRecentlyMovedLeadId,
      startTransition,
      toast,
    ]
  )

  const handleDragCancel = useCallback(() => {
    setDraggingLead(null)
    setDropPreview(null)
  }, [setDropPreview])

  const totalLeads = columns.reduce(
    (sum, column) => sum + column.leads.length,
    0
  )

  type CollisionArgs = Parameters<CollisionDetection>[0]

  const findDroppable = useCallback(
    (
      id: UniqueIdentifier,
      droppableContainers: CollisionArgs['droppableContainers']
    ) => droppableContainers.find(container => container.id === id),
    []
  )

  const prioritizeCollisions = useCallback(
    (
      collisions: ReturnType<typeof pointerWithin>,
      droppableContainers: CollisionArgs['droppableContainers']
    ) => {
      if (collisions.length < 2) {
        return collisions
      }

      const leadCollisions = collisions.filter(collision => {
        const container = findDroppable(collision.id, droppableContainers)
        return container?.data?.current?.type === 'lead'
      })

      if (leadCollisions.length > 0) {
        return leadCollisions
      }

      return collisions
    },
    [findDroppable]
  )

  const rememberLeadCollision = useCallback(
    (
      collisions: ReturnType<typeof pointerWithin>,
      droppableContainers: CollisionArgs['droppableContainers']
    ) => {
      const first = collisions[0]

      if (!first) {
        return
      }

      const container = findDroppable(first.id, droppableContainers)

      if (container?.data?.current?.type === 'lead') {
        lastLeadOverId.current = first.id
      }
    },
    [findDroppable]
  )

  const rememberColumnCollision = useCallback(
    (
      collisions: ReturnType<typeof pointerWithin>,
      droppableContainers: CollisionArgs['droppableContainers']
    ) => {
      for (const collision of collisions) {
        const container = findDroppable(collision.id, droppableContainers)

        if (container?.data?.current?.type === 'column') {
          lastColumnOverId.current = collision.id
          return
        }
      }
    },
    [findDroppable]
  )

  const fallbackToLastLead = useCallback(
    (droppableContainers: CollisionArgs['droppableContainers']) => {
      if (!lastLeadOverId.current) {
        return null
      }

      const container = findDroppable(
        lastLeadOverId.current,
        droppableContainers
      )

      if (!container) {
        lastLeadOverId.current = null
        return null
      }

      return [{ id: lastLeadOverId.current }]
    },
    [findDroppable]
  )

  const fallbackToLastColumn = useCallback(
    (droppableContainers: CollisionArgs['droppableContainers']) => {
      if (!lastColumnOverId.current) {
        return null
      }

      const container = findDroppable(
        lastColumnOverId.current,
        droppableContainers
      )

      if (!container) {
        lastColumnOverId.current = null
        return null
      }

      return [{ id: lastColumnOverId.current }]
    },
    [findDroppable]
  )

  const collisionDetection = useCallback<CollisionDetection>(
    args => {
      const pointerCollisions = pointerWithin(args)

      if (pointerCollisions.length > 0) {
        const prioritized = prioritizeCollisions(
          pointerCollisions,
          args.droppableContainers
        )

        rememberLeadCollision(prioritized, args.droppableContainers)
        rememberColumnCollision(pointerCollisions, args.droppableContainers)

        return prioritized
      }

      const intersections = rectIntersection(args)

      if (intersections.length > 0) {
        const prioritized = prioritizeCollisions(
          intersections,
          args.droppableContainers
        )

        rememberLeadCollision(prioritized, args.droppableContainers)
        rememberColumnCollision(intersections, args.droppableContainers)

        return prioritized
      }

      const leadFallback = fallbackToLastLead(args.droppableContainers)

      if (leadFallback) {
        return leadFallback
      }

      const columnFallback = fallbackToLastColumn(args.droppableContainers)

      if (columnFallback) {
        return columnFallback
      }

      return closestCenter(args)
    },
    [
      fallbackToLastColumn,
      fallbackToLastLead,
      prioritizeCollisions,
      rememberColumnCollision,
      rememberLeadCollision,
    ]
  )

  return (
    <div className='flex min-h-0 flex-1 flex-col'>
      {totalLeads === 0 ? (
        <div className='border-border/60 text-muted-foreground flex flex-1 items-center justify-center rounded-2xl border border-dashed px-6 py-16 text-center'>
          <div className='space-y-2'>
            <p className='text-lg font-semibold'>No leads yet</p>
            <p className='text-sm'>
              {canManage
                ? 'Use the New Lead button above to start tracking opportunities.'
                : 'Leads will appear here once your team adds them.'}
            </p>
          </div>
        </div>
      ) : (
        <div className='relative min-h-0 flex-1'>
        <div className='absolute inset-0 overflow-hidden'>
          <div className='h-full min-h-0 overflow-x-auto'>
            <DndContext
              sensors={sensors}
              onDragStart={event => {
                lastLeadOverId.current = null
                lastColumnOverId.current = null
                handleDragStart(event)
              }}
              onDragOver={handleDragOver}
              onDragEnd={event => {
                lastLeadOverId.current = null
                lastColumnOverId.current = null
                handleDragEnd(event)
              }}
              onDragCancel={() => {
                lastLeadOverId.current = null
                lastColumnOverId.current = null
                handleDragCancel()
              }}
              collisionDetection={collisionDetection}
            >
              <div className='flex h-full w-max gap-4 p-1'>
                {columns.map(column => (
                  <LeadColumn
                    key={column.id}
                    columnId={column.id}
                    label={column.label}
                    leads={column.leads}
                    canManage={canManage && !isPending}
                    onEditLead={onEditLead}
                    activeLeadId={activeLeadId}
                    isDropTarget={dropPreview?.columnId === column.id}
                    dropIndicatorIndex={
                      dropPreview?.columnId === column.id ? dropPreview.index : null
                    }
                    draggingLeadId={draggingLead?.id ?? null}
                    recentlyMovedLeadId={recentlyMovedLeadId}
                  />
                ))}
              </div>
              <DragOverlay dropAnimation={null}>
                {draggingLead ? (
                  <LeadCardPreview lead={draggingLead} />
                ) : null}
              </DragOverlay>
            </DndContext>
          </div>
        </div>
        </div>
      )}
    </div>
  )
}

function cloneColumns(columns: LeadBoardColumnData[]): LeadBoardColumnData[] {
  return columns.map(column => ({
    ...column,
    leads: column.leads.map(lead => ({ ...lead })),
  }))
}

function findLeadById(
  columns: LeadBoardColumnData[],
  leadId: string
): LeadRecord | null {
  for (const column of columns) {
    const lead = column.leads.find(item => item.id === leadId)
    if (lead) {
      return lead
    }
  }

  return null
}

function resolveCurrentLocation(
  leadId: string,
  columns: LeadBoardColumnData[]
): DropTarget | null {
  for (const column of columns) {
    const index = column.leads.findIndex(lead => lead.id === leadId)
    if (index >= 0) {
      return {
        columnId: column.id,
        index,
      }
    }
  }

  return null
}

type DropTarget = {
  columnId: LeadStatusValue
  index: number
}

type LeadDragData = {
  type: 'lead'
  columnId: LeadStatusValue
}

type LeadColumnDropData = {
  type: 'column'
  columnId: LeadStatusValue
}

type SortableMeta = {
  containerId: string
  index: number
}

function extractSortableMeta(payload: unknown): SortableMeta | null {
  if (!payload || typeof payload !== 'object') {
    return null
  }

  const sortable = (payload as { sortable?: SortableMeta | null }).sortable

  if (!sortable || typeof sortable.index !== 'number') {
    return null
  }

  return {
    containerId: String(sortable.containerId),
    index: sortable.index,
  }
}

function resolveDropTarget(
  event: DragOverEvent | DragEndEvent,
  columns: LeadBoardColumnData[]
): DropTarget | null {
  const over = event.over
  if (!over) {
    return null
  }

  const overSortable = extractSortableMeta(over.data?.current)
  if (overSortable) {
    return {
      columnId: overSortable.containerId as LeadStatusValue,
      index: overSortable.index,
    }
  }

  const overData = over.data?.current as
    | LeadDragData
    | LeadColumnDropData
    | undefined
  const overId = over.id ? over.id.toString() : null

  if (overData?.type === 'column') {
    const column = columns.find(col => col.id === overData.columnId)
    return {
      columnId: overData.columnId,
      index: column?.leads.length ?? 0,
    }
  }

  if (overData?.type === 'lead' && overId) {
    const column = columns.find(col => col.id === overData.columnId)
    if (!column) {
      return null
    }
    const index = column.leads.findIndex(entry => entry.id === overId)
    return {
      columnId: overData.columnId,
      index: index >= 0 ? index : column.leads.length,
    }
  }

  if (overId) {
    const column = columns.find(col =>
      col.leads.some(entry => entry.id === overId)
    )
    if (column) {
      const index = column.leads.findIndex(entry => entry.id === overId)
      return {
        columnId: column.id,
        index: index >= 0 ? index : column.leads.length,
      }
    }
  }

  const activeSortable = extractSortableMeta(event.active.data?.current)
  if (activeSortable) {
    return {
      columnId: activeSortable.containerId as LeadStatusValue,
      index: activeSortable.index,
    }
  }

  return null
}

function produceLeadReorder({
  columns,
  leadId,
  targetColumnId,
  targetIndex,
}: {
  columns: LeadBoardColumnData[]
  leadId: string
  targetColumnId: LeadStatusValue
  targetIndex: number
}):
  | {
      nextColumns: LeadBoardColumnData[]
      previousColumns: LeadBoardColumnData[]
      rank: string
      targetColumnId: LeadStatusValue
    }
  | null {
  const previousColumns = cloneColumns(columns)
  const nextColumns = cloneColumns(columns)

  const sourceColumn = nextColumns.find(column =>
    column.leads.some(lead => lead.id === leadId)
  )
  const targetColumn = nextColumns.find(column => column.id === targetColumnId)

  if (!sourceColumn || !targetColumn) {
    return null
  }

  const sourceIndex = sourceColumn.leads.findIndex(lead => lead.id === leadId)

  if (sourceIndex === -1) {
    return null
  }

  const isSameColumn = sourceColumn.id === targetColumnId
  let destinationLeads: LeadRecord[]

  if (isSameColumn) {
    const maxIndex = sourceColumn.leads.length - 1
    const boundedTarget = clamp(targetIndex, 0, maxIndex)

    if (boundedTarget === sourceIndex) {
      return null
    }

    destinationLeads = arrayMove(
      [...sourceColumn.leads],
      sourceIndex,
      boundedTarget
    )
    sourceColumn.leads.splice(0, sourceColumn.leads.length, ...destinationLeads)
  } else {
    const [removedLead] = sourceColumn.leads.splice(sourceIndex, 1)
    if (!removedLead) {
      return null
    }

    const boundedIndex = clamp(targetIndex, 0, targetColumn.leads.length)
    destinationLeads = [
      ...targetColumn.leads.slice(0, boundedIndex),
      removedLead,
      ...targetColumn.leads.slice(boundedIndex),
    ]
    targetColumn.leads.splice(0, targetColumn.leads.length, ...destinationLeads)
  }

  const destinationColumn = isSameColumn ? sourceColumn : targetColumn
  const reorderedLeads = destinationColumn.leads
  const insertedIndex = reorderedLeads.findIndex(lead => lead.id === leadId)

  if (insertedIndex === -1) {
    return null
  }

  const rank = computeRankFromNeighbors(reorderedLeads, insertedIndex)

  reorderedLeads[insertedIndex] = {
    ...reorderedLeads[insertedIndex],
    status: targetColumnId,
    rank,
  }

  const originalLead = previousColumns
    .flatMap(column => column.leads)
    .find(lead => lead.id === leadId)

  if (
    originalLead &&
    originalLead.status === targetColumnId &&
    originalLead.rank === rank
  ) {
    return null
  }

  return {
    nextColumns,
    previousColumns,
    rank,
    targetColumnId,
  }
}

function computeRankFromNeighbors(leads: LeadRecord[], index: number) {
  const previousRank = index > 0 ? leads[index - 1]?.rank ?? null : null
  const nextRank = leads[index + 1]?.rank ?? null

  if (previousRank && nextRank) {
    return getRankBetween(previousRank, nextRank)
  }

  if (previousRank) {
    return getRankAfter(previousRank)
  }

  if (nextRank) {
    return getRankBefore(nextRank)
  }

  return getRankBetween(null, null)
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

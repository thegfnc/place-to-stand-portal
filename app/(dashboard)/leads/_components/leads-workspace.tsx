'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'

import { AppShellHeader } from '@/components/layout/app-shell'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'
import type { LeadAssigneeOption, LeadBoardColumnData } from '@/lib/leads/types'
import type { LeadRecord } from '@/lib/leads/types'
import type { LeadStatusValue } from '@/lib/leads/constants'

import { LeadsHeader } from './leads-header'
import { LeadsBoard } from './leads-board'
import { LeadSheet } from './lead-sheet'

const LEAD_SHEET_CLOSE_MS = 320

type LeadsWorkspaceProps = {
  initialColumns: LeadBoardColumnData[]
  assignees: LeadAssigneeOption[]
  canManage: boolean
  activeLeadId: string | null
}

export function LeadsWorkspace({
  initialColumns,
  assignees,
  canManage,
  activeLeadId,
}: LeadsWorkspaceProps) {
  const router = useRouter()
  const [isCreatingLead, setIsCreatingLead] = useState(false)
  const [initialStatus, setInitialStatus] = useState<LeadStatusValue | null>(null)
  const [closingLeadId, setClosingLeadId] = useState<string | null>(null)
  const [isSheetClosing, setIsSheetClosing] = useState(false)
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [, startRefresh] = useTransition()
  const leadLookup = useMemo(
    () => buildLeadLookup(initialColumns),
    [initialColumns]
  )
  const totalLeads = useMemo(
    () => initialColumns.reduce((sum, column) => sum + column.leads.length, 0),
    [initialColumns]
  )
  const activeLead = activeLeadId ? leadLookup.get(activeLeadId) ?? null : null

  const cancelPendingClose = useCallback(() => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current)
      closeTimeoutRef.current = null
    }
    setIsSheetClosing(false)
  }, [])

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current)
        closeTimeoutRef.current = null
      }
    }
  }, [])

  const handleCreateLead = useCallback((status?: LeadStatusValue) => {
    if (!canManage) {
      return
    }

    cancelPendingClose()
    setClosingLeadId(null)
    setInitialStatus(status ?? null)
    setIsCreatingLead(true)
    router.push('/leads/board', { scroll: false })
  }, [canManage, cancelPendingClose, router])

  const handleEditLead = useCallback(
    (lead: LeadRecord) => {
      if (!canManage) {
        return
      }

      cancelPendingClose()
      setClosingLeadId(null)
      setIsCreatingLead(false)
      router.push(`/leads/board/${lead.id}`, { scroll: false })
    },
    [canManage, cancelPendingClose, router]
  )

  const beginSheetClose = useCallback(() => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current)
    }

    setIsSheetClosing(true)
    closeTimeoutRef.current = setTimeout(() => {
      setIsSheetClosing(false)
      closeTimeoutRef.current = null
    }, LEAD_SHEET_CLOSE_MS)
  }, [])

  const handleSheetOpenChange = useCallback(
    (next: boolean) => {
      if (next) {
        cancelPendingClose()
        setClosingLeadId(null)
        return
      }

      beginSheetClose()

      if (isCreatingLead) {
        setIsCreatingLead(false)
        setInitialStatus(null)
        startRefresh(() => {
          router.refresh()
        })
        return
      }

      if (activeLeadId) {
        setClosingLeadId(activeLeadId)
        router.push('/leads/board', { scroll: false })
      }
      startRefresh(() => {
        router.refresh()
      })
    },
    [
      activeLeadId,
      beginSheetClose,
      cancelPendingClose,
      isCreatingLead,
      router,
      startRefresh,
    ]
  )

  const handleSheetSuccess = useCallback(() => {
    startRefresh(() => {
      router.refresh()
    })
  }, [router, startRefresh])

  const isRouteLeadOpen =
    Boolean(activeLeadId) && activeLeadId !== closingLeadId
  const isSheetOpen = isCreatingLead || isRouteLeadOpen
  const sheetLead = isCreatingLead ? null : activeLead
  const shouldRenderSheet = canManage && (isSheetOpen || isSheetClosing)
  const boardActiveLeadId =
    isCreatingLead || closingLeadId === activeLeadId ? null : activeLeadId

  return (
    <div className='flex h-full min-h-0 flex-col gap-6'>
      <AppShellHeader>
        <LeadsHeader />
      </AppShellHeader>
      {shouldRenderSheet ? (
        <LeadSheet
          open={isSheetOpen}
          onOpenChange={handleSheetOpenChange}
          lead={sheetLead}
          initialStatus={initialStatus}
          assignees={assignees}
          onSuccess={handleSheetSuccess}
        />
      ) : null}
      <Tabs value='board' className='flex min-h-0 flex-1 flex-col gap-3'>
        <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
          <TabsList className='bg-muted/40 h-10 w-full justify-start gap-2 rounded-lg p-1 sm:w-auto'>
            <TabsTrigger value='board' className='px-3 py-1.5 text-sm'>
              Board
            </TabsTrigger>
          </TabsList>
          <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-6'>
            <span className='text-muted-foreground text-sm'>
              Total leads: {totalLeads}
            </span>
            <DisabledFieldTooltip
              disabled={!canManage}
              reason='Admin access is required to create leads.'
            >
              <Button
                type='button'
                size='sm'
                disabled={!canManage}
                onClick={() => handleCreateLead()}
              >
                <Plus className='h-4 w-4' />
                Add lead
              </Button>
            </DisabledFieldTooltip>
          </div>
        </div>
        <TabsContent
          value='board'
          className='mt-0 flex min-h-0 flex-1 flex-col gap-4 focus-visible:outline-none sm:gap-6'
        >
          <LeadsBoard
            initialColumns={initialColumns}
            canManage={canManage}
            onEditLead={handleEditLead}
            onCreateLead={handleCreateLead}
            activeLeadId={boardActiveLeadId}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function buildLeadLookup(columns: LeadBoardColumnData[]) {
  const map = new Map<string, LeadRecord>()

  columns.forEach(column => {
    column.leads.forEach(lead => {
      map.set(lead.id, lead)
    })
  })

  return map
}

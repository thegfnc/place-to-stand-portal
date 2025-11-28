'use client'

import { useCallback, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'

import { AppShellHeader } from '@/components/layout/app-shell'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'
import type { LeadAssigneeOption, LeadBoardColumnData } from '@/lib/leads/types'
import type { LeadRecord } from '@/lib/leads/types'

import { LeadsHeader } from './leads-header'
import { LeadsBoard } from './leads-board'
import { LeadSheet } from './lead-sheet'

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
  const [closingLeadId, setClosingLeadId] = useState<string | null>(null)
  const [, startRefresh] = useTransition()
  const leadLookup = useMemo(
    () => buildLeadLookup(initialColumns),
    [initialColumns]
  )
  const activeLead = activeLeadId ? leadLookup.get(activeLeadId) ?? null : null

  const handleCreateLead = useCallback(() => {
    if (!canManage) {
      return
    }

    setClosingLeadId(null)
    setIsCreatingLead(true)
    router.push('/leads/board', { scroll: false })
  }, [canManage, router])

  const handleEditLead = useCallback(
    (lead: LeadRecord) => {
      if (!canManage) {
        return
      }

      setClosingLeadId(null)
      setIsCreatingLead(false)
      router.push(`/leads/board/${lead.id}`, { scroll: false })
    },
    [canManage, router]
  )

  const handleSheetOpenChange = useCallback(
    (next: boolean) => {
      if (next) {
        setClosingLeadId(null)
        return
      }

      if (isCreatingLead) {
        setIsCreatingLead(false)
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
    [activeLeadId, isCreatingLead, router, startRefresh]
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
  const shouldRenderSheet = canManage && (isCreatingLead || Boolean(activeLead))
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
          <DisabledFieldTooltip
            disabled={!canManage}
            reason='Admin access is required to create leads.'
          >
            <Button
              type='button'
              size='sm'
              disabled={!canManage}
              onClick={handleCreateLead}
            >
              <Plus className='h-4 w-4' />
              New Lead
            </Button>
          </DisabledFieldTooltip>
        </div>
        <TabsContent
          value='board'
          className='mt-0 flex min-h-0 flex-1 flex-col gap-4 focus-visible:outline-none sm:gap-6'
        >
          <LeadsBoard
            initialColumns={initialColumns}
            canManage={canManage}
            onEditLead={handleEditLead}
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

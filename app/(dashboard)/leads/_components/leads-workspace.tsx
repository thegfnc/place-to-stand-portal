'use client'

import { useCallback, useState } from 'react'
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
}

export function LeadsWorkspace({
  initialColumns,
  assignees,
  canManage,
}: LeadsWorkspaceProps) {
  const router = useRouter()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingLead, setEditingLead] = useState<LeadRecord | null>(null)

  const handleCreateLead = useCallback(() => {
    if (!canManage) {
      return
    }

    setEditingLead(null)
    setSheetOpen(true)
  }, [canManage])

  const handleEditLead = useCallback(
    (lead: LeadRecord) => {
      if (!canManage) {
        return
      }

      setEditingLead(lead)
      setSheetOpen(true)
    },
    [canManage]
  )

  const handleSheetOpenChange = useCallback(
    (next: boolean) => {
      setSheetOpen(next)
      if (!next) {
        setEditingLead(null)
      }
    },
    [setSheetOpen]
  )

  const handleSheetSuccess = useCallback(() => {
    router.refresh()
  }, [router])

  return (
    <div className='flex h-full min-h-0 flex-col gap-6'>
      <AppShellHeader>
        <LeadsHeader />
      </AppShellHeader>
      {canManage ? (
        <LeadSheet
          open={sheetOpen}
          onOpenChange={handleSheetOpenChange}
          lead={editingLead}
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
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}

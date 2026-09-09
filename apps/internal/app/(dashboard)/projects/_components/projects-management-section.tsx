'use client'

import { useMemo, type ReactNode } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import { PaginationControls } from '@/components/ui/pagination-controls'
import { useToast } from '@/components/ui/use-toast'
import type { PageInfo } from '@/lib/pagination/cursor'
import type {
  ClientRow,
  ProjectWithClient,
} from '@/lib/settings/projects/project-sheet-form'
import { sortClientsByName } from '@/lib/settings/projects/project-sheet-form'
import type { AdminUserForOwner } from '@/lib/settings/projects/project-sheet-ui-state'

import { ProjectSheet } from '@/app/(dashboard)/settings/projects/project-sheet'
import { ProjectLifecycleDialogs } from '@/components/settings/projects/table/project-lifecycle-dialogs'
import { ProjectsTableSection } from '@/components/settings/projects/table/projects-table-section'
import { type ContractorUserSummary } from '@/components/settings/projects/table/types'
import { useProjectsSettingsController } from '@/components/settings/projects/table/use-projects-settings-controller'
import { PENDING_REASON } from '@/lib/forms/form-controls'


type ProjectsManagementSectionProps = {
  mode: 'active' | 'archive'
  projects: ProjectWithClient[]
  clients: ClientRow[]
  adminUsers: AdminUserForOwner[]
  contractorUsers: ContractorUserSummary[]
  membersByProject: Record<string, ContractorUserSummary[]>
  pageInfo: PageInfo
  /** Rows-per-page the list was served with (drives the footer selector). */
  pageSize: number
  /** Toolbar row (FilterBar) rendered inside the card, above the table. */
  filters?: ReactNode
  /**
   * PRD 004 §01: pages converted to PageShell render tabs/count/action in the
   * shell toolbar; they pass false so the section renders only the table.
   */
}

export function ProjectsManagementSection({
  mode,
  projects,
  clients,
  adminUsers,
  contractorUsers,
  membersByProject,
  pageInfo,
  pageSize,
  filters,
}: ProjectsManagementSectionProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { toast } = useToast()

  const sortedClients = useMemo(() => sortClientsByName(clients), [clients])

  const controller = useProjectsSettingsController({
    toast,
    onRefresh: () => router.refresh(),
  })

  const {
    sheetOpen,
    selectedProject,
    deleteTarget,
    destroyTarget,
    pendingDeleteId,
    pendingRestoreId,
    pendingDestroyId,
    isPending,
    openEdit,
    handleSheetOpenChange,
    handleSheetComplete,
    requestDelete,
    cancelDelete,
    confirmDelete,
    restoreProject,
    requestDestroy,
    cancelDestroy,
    confirmDestroy,
  } = controller

  const pendingReason = PENDING_REASON

  const handlePaginate = (direction: 'forward' | 'backward') => {
    const cursorValue =
      direction === 'forward' ? pageInfo.endCursor : pageInfo.startCursor

    if (!cursorValue) {
      return
    }

    const params = new URLSearchParams(searchParams.toString())
    params.set('cursor', cursorValue)
    params.set('dir', direction)
    const query = params.toString()
    router.push(query ? `${pathname}?${query}` : pathname)
  }

  const hasNextPage = pageInfo.hasNextPage
  const hasPreviousPage = pageInfo.hasPreviousPage

  // Active `?q=` flips the empty state to the filtered message (R4).
  const hasActiveFilter = Boolean(searchParams.get('q')?.trim())
  const emptyMessage = hasActiveFilter
    ? 'No projects match the current filters.'
    : mode === 'active'
      ? 'No projects yet. Create one to begin tracking work.'
      : 'No archived projects. Archived projects appear here after deletion.'

  return (
    <div className='space-y-4'>
      {/* Main Container with Background */}
      <section className='bg-background rounded-xl border p-4 shadow-sm space-y-4'>
        <ProjectLifecycleDialogs
          deleteTarget={deleteTarget}
          destroyTarget={destroyTarget}
          isPending={isPending}
          onCancelDelete={cancelDelete}
          onConfirmDelete={confirmDelete}
          onCancelDestroy={cancelDestroy}
          onConfirmDestroy={confirmDestroy}
        />
        {filters}
        <ProjectsTableSection
          projects={projects}
          mode={mode}
          onEdit={openEdit}
          onRequestDelete={requestDelete}
          onRestore={restoreProject}
          onRequestDestroy={requestDestroy}
          isPending={isPending}
          pendingReason={pendingReason}
          pendingDeleteId={pendingDeleteId}
          pendingRestoreId={pendingRestoreId}
          pendingDestroyId={pendingDestroyId}
          emptyMessage={emptyMessage}
        />
        <PaginationControls
          hasNextPage={hasNextPage}
          hasPreviousPage={hasPreviousPage}
          onNext={() => handlePaginate('forward')}
          onPrevious={() => handlePaginate('backward')}
          disableAll={isPending}
          pageSize={pageSize}
          itemCount={projects.length}
        />
      </section>
      <ProjectSheet
        open={sheetOpen}
        onOpenChange={handleSheetOpenChange}
        onComplete={handleSheetComplete}
        project={selectedProject}
        clients={sortedClients}
        adminUsers={adminUsers}
        contractorDirectory={contractorUsers}
        projectContractors={membersByProject}
      />
    </div>
  )
}


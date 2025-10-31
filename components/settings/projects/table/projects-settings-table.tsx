'use client'

import { useMemo } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/components/ui/use-toast'

import { ProjectSheet } from '@/app/(dashboard)/settings/projects/project-sheet'

import { ProjectLifecycleDialogs } from './project-lifecycle-dialogs'
import { ProjectsTableSection } from './projects-table-section'
import { useProjectsSettingsController } from './use-projects-settings-controller'
import type {
  ProjectWithClient,
  ProjectsSettingsTableProps,
  ProjectsTab,
} from './types'

const ProjectsActivityFeed = dynamic(
  () =>
    import('@/components/activity/activity-feed').then(
      module => module.ActivityFeed
    ),
  {
    ssr: false,
    loading: () => (
      <div className='text-muted-foreground text-sm'>
        Loading recent activity…
      </div>
    ),
  }
)

function useProjectBuckets(projects: ProjectWithClient[]) {
  return useMemo(() => {
    const sorted = [...projects].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    )

    const active = sorted.filter(project => !project.deleted_at)
    const archived = sorted.filter(project => Boolean(project.deleted_at))

    return { active, archived }
  }, [projects])
}

function useSortedClients(
  clients: ProjectsSettingsTableProps['clients']
): ProjectsSettingsTableProps['clients'] {
  return useMemo(
    () =>
      [...clients].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
      ),
    [clients]
  )
}

export function ProjectsSettingsTable(props: ProjectsSettingsTableProps) {
  const { projects, clients, contractorUsers, membersByProject } = props
  const router = useRouter()
  const { toast } = useToast()

  const { active: activeProjects, archived: archivedProjects } =
    useProjectBuckets(projects)
  const sortedClients = useSortedClients(clients)

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
    activeTab,
    isPending,
    openCreate,
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
    setActiveTab,
  } = controller

  const createDisabled = sortedClients.length === 0
  const createDisabledReason = createDisabled
    ? 'Add a client before creating a project.'
    : null
  const pendingReason = 'Please wait for the current request to finish.'

  return (
    <div className='space-y-6'>
      <ProjectLifecycleDialogs
        deleteTarget={deleteTarget}
        destroyTarget={destroyTarget}
        isPending={isPending}
        onCancelDelete={cancelDelete}
        onConfirmDelete={confirmDelete}
        onCancelDestroy={cancelDestroy}
        onConfirmDestroy={confirmDestroy}
      />
      <Tabs
        value={activeTab}
        onValueChange={value => setActiveTab(value as ProjectsTab)}
        className='space-y-6'
      >
        <div className='flex flex-wrap items-center justify-between gap-4'>
          <TabsList>
            <TabsTrigger value='projects'>Projects</TabsTrigger>
            <TabsTrigger value='archive'>Archive</TabsTrigger>
            <TabsTrigger value='activity'>Activity</TabsTrigger>
          </TabsList>
          {activeTab === 'projects' ? (
            <DisabledFieldTooltip
              disabled={createDisabled}
              reason={createDisabledReason}
            >
              <Button onClick={openCreate} disabled={createDisabled}>
                <Plus className='h-4 w-4' /> Add project
              </Button>
            </DisabledFieldTooltip>
          ) : null}
        </div>
        <TabsContent value='projects' className='space-y-6'>
          <ProjectsTableSection
            projects={activeProjects}
            mode='active'
            onEdit={openEdit}
            onRequestDelete={requestDelete}
            onRestore={restoreProject}
            onRequestDestroy={requestDestroy}
            isPending={isPending}
            pendingReason={pendingReason}
            pendingDeleteId={pendingDeleteId}
            pendingRestoreId={pendingRestoreId}
            pendingDestroyId={pendingDestroyId}
            emptyMessage='No projects yet. Create one to begin tracking work.'
          />
        </TabsContent>
        <TabsContent value='archive' className='space-y-6'>
          <ProjectsTableSection
            projects={archivedProjects}
            mode='archive'
            onEdit={openEdit}
            onRequestDelete={requestDelete}
            onRestore={restoreProject}
            onRequestDestroy={requestDestroy}
            isPending={isPending}
            pendingReason={pendingReason}
            pendingDeleteId={pendingDeleteId}
            pendingRestoreId={pendingRestoreId}
            pendingDestroyId={pendingDestroyId}
            emptyMessage='No archived projects. Archived projects appear here after deletion.'
          />
        </TabsContent>
        <TabsContent value='activity' className='space-y-3'>
          <div className='space-y-3 p-1'>
            <div>
              <h3 className='text-lg font-semibold'>Recent activity</h3>
              <p className='text-muted-foreground text-sm'>
                Audit project creation, edits, archives, and deletions in one
                place.
              </p>
            </div>
            <ProjectsActivityFeed
              targetType='PROJECT'
              pageSize={20}
              emptyState='No recent project activity.'
              requireContext={false}
            />
          </div>
        </TabsContent>
      </Tabs>
      <ProjectSheet
        open={sheetOpen}
        onOpenChange={handleSheetOpenChange}
        onComplete={handleSheetComplete}
        project={selectedProject}
        clients={sortedClients}
        contractorDirectory={contractorUsers}
        projectContractors={membersByProject}
      />
    </div>
  )
}

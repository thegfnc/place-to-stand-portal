'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/components/ui/use-toast'

import { ProjectSheet } from '@/app/(dashboard)/settings/projects/project-sheet'

import { ProjectLifecycleDialogs } from './project-lifecycle-dialogs'
import { ProjectsTableSection } from './projects-table-section'
import { useProjectsSettingsController } from './use-projects-settings-controller'
import type {
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
  const {
    projects,
    clients,
    contractorUsers,
    membersByProject,
    tab,
    searchQuery,
    pageInfo,
    totalCount,
  } = props
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const [searchValue, setSearchValue] = useState(searchQuery)

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
  } = controller

  const createDisabled = sortedClients.length === 0
  const createDisabledReason = createDisabled
    ? 'Add a client before creating a project.'
    : null
  const pendingReason = 'Please wait for the current request to finish.'

  useEffect(() => {
    setSearchValue(searchQuery)
  }, [searchQuery])

  const showListViews = tab !== 'activity'

  const handleTabChange = (next: ProjectsTab) => {
    const params = new URLSearchParams(searchParams.toString())
    if (next === 'projects') {
      params.delete('tab')
    } else {
      params.set('tab', next)
    }
    params.delete('cursor')
    params.delete('dir')
    const query = params.toString()
    router.push(query ? `${pathname}?${query}` : pathname)
  }

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const params = new URLSearchParams(searchParams.toString())
    const trimmed = searchValue.trim()
    if (trimmed) {
      params.set('q', trimmed)
    } else {
      params.delete('q')
    }
    params.delete('cursor')
    params.delete('dir')
    const query = params.toString()
    router.push(query ? `${pathname}?${query}` : pathname)
  }

  const handleClearSearch = () => {
    if (!searchQuery) {
      return
    }
    setSearchValue('')
    const params = new URLSearchParams(searchParams.toString())
    params.delete('q')
    params.delete('cursor')
    params.delete('dir')
    const query = params.toString()
    router.push(query ? `${pathname}?${query}` : pathname)
  }

  const handlePaginate = (direction: 'forward' | 'backward') => {
    const cursor =
      direction === 'forward' ? pageInfo.endCursor : pageInfo.startCursor

    if (!cursor) {
      return
    }

    const params = new URLSearchParams(searchParams.toString())
    params.set('cursor', cursor)
    params.set('dir', direction)
    const query = params.toString()
    router.push(query ? `${pathname}?${query}` : pathname)
  }

  const paginationDisabled = !showListViews
  const hasNextPage = pageInfo.hasNextPage && !paginationDisabled
  const hasPreviousPage = pageInfo.hasPreviousPage && !paginationDisabled

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
        value={tab}
        onValueChange={value => handleTabChange(value as ProjectsTab)}
        className='space-y-6'
      >
        <div className='flex flex-wrap items-center justify-between gap-4'>
          <TabsList>
            <TabsTrigger value='projects'>Projects</TabsTrigger>
            <TabsTrigger value='archive'>Archive</TabsTrigger>
            <TabsTrigger value='activity'>Activity</TabsTrigger>
          </TabsList>
          {tab === 'projects' ? (
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
        {showListViews ? (
          <form
            onSubmit={handleSearchSubmit}
            className='flex w-full flex-wrap items-center gap-2'
          >
            <Input
              value={searchValue}
              onChange={event => setSearchValue(event.target.value)}
              placeholder='Search by project name or slug…'
              className='max-w-xs'
              aria-label='Search projects'
            />
            <Button type='submit'>Search</Button>
            {searchQuery ? (
              <Button
                type='button'
                variant='ghost'
                onClick={handleClearSearch}
                disabled={isPending}
              >
                Clear
              </Button>
            ) : null}
            <div className='text-muted-foreground ml-auto text-sm'>
              Total projects: {totalCount}
            </div>
          </form>
        ) : null}
        <TabsContent value='projects' className='space-y-6'>
          {tab === 'projects' ? (
            <>
              <ProjectsTableSection
                projects={projects}
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
              <PaginationControls
                hasNextPage={hasNextPage}
                hasPreviousPage={hasPreviousPage}
                onNext={() => handlePaginate('forward')}
                onPrevious={() => handlePaginate('backward')}
                disableAll={isPending}
              />
            </>
          ) : null}
        </TabsContent>
        <TabsContent value='archive' className='space-y-6'>
          {tab === 'archive' ? (
            <>
              <ProjectsTableSection
                projects={projects}
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
              <PaginationControls
                hasNextPage={hasNextPage}
                hasPreviousPage={hasPreviousPage}
                onNext={() => handlePaginate('forward')}
                onPrevious={() => handlePaginate('backward')}
                disableAll={isPending}
              />
            </>
          ) : null}
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

type PaginationControlsProps = {
  hasNextPage: boolean
  hasPreviousPage: boolean
  onNext: () => void
  onPrevious: () => void
  disableAll?: boolean
}

function PaginationControls({
  hasNextPage,
  hasPreviousPage,
  onNext,
  onPrevious,
  disableAll = false,
}: PaginationControlsProps) {
  const isPrevDisabled = disableAll || !hasPreviousPage
  const isNextDisabled = disableAll || !hasNextPage

  if (!hasNextPage && !hasPreviousPage) {
    return null
  }

  return (
    <div className='flex justify-end gap-2'>
      <Button
        type='button'
        variant='outline'
        onClick={onPrevious}
        disabled={isPrevDisabled}
      >
        Previous
      </Button>
      <Button type='button' onClick={onNext} disabled={isNextDisabled}>
        Next
      </Button>
    </div>
  )
}

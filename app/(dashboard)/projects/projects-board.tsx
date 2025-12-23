'use client'

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'

import { AppShellHeader } from '@/components/layout/app-shell'
import { ProjectSheet } from '@/app/(dashboard)/settings/projects/project-sheet'
import { useToast } from '@/components/ui/use-toast'
import { ProjectLifecycleDialogs } from '@/components/settings/projects/table/project-lifecycle-dialogs'
import { useProjectsSettingsController } from '@/components/settings/projects/table/use-projects-settings-controller'
import type {
  ClientRow,
  ProjectWithClient,
} from '@/lib/settings/projects/project-sheet-form'
import { sortClientsByName } from '@/lib/settings/projects/project-sheet-form'
import type { ContractorUserSummary } from '@/components/settings/projects/table/types'
import type { ProjectWithRelations } from '@/lib/types'
import { ViewLogger } from '@/components/activity/view-logger'
import { ActivityVerbs } from '@/lib/activity/types'
import { useAISuggestionsSheet } from '@/lib/projects/board/state/use-ai-suggestions-sheet'
import { ProjectsBoardEmpty } from './_components/projects-board-empty'
import { ProjectsBoardHeader } from './_components/projects-board-header'
import { ProjectBurndownWidget } from './_components/project-burndown-widget'
import { ProjectsBoardTabsSection } from './_components/projects-board/projects-board-tabs-section'
import { ProjectsBoardDialogs } from './_components/projects-board-dialogs'
import {
  useProjectsBoardViewModel,
  type ProjectsBoardProps,
} from './_hooks/use-projects-board-view-model'

export function ProjectsBoard(props: ProjectsBoardProps) {
  const viewModel = useProjectsBoardViewModel(props)
  const router = useRouter()
  const { toast } = useToast()

  // AI Suggestions sheet state
  const aiSuggestionsState = useAISuggestionsSheet({
    activeProject: viewModel.dialogs.activeProject,
    currentUserId: props.currentUserId,
  })

  const clientRows = useMemo<ClientRow[]>(
    () => buildClientRows(props.projects),
    [props.projects]
  )
  const sortedClients = useMemo(
    () => sortClientsByName(clientRows),
    [clientRows]
  )
  const projectContractors = useMemo(
    () => buildProjectContractors(props.projects),
    [props.projects]
  )

  const controller = useProjectsSettingsController({
    toast,
    onRefresh: () => router.refresh(),
  })

  const {
    sheetOpen,
    selectedProject,
    deleteTarget,
    destroyTarget,
    isPending: projectMutationPending,
    openEdit,
    requestDelete,
    handleSheetOpenChange,
    handleSheetComplete,
    cancelDelete,
    confirmDelete,
    cancelDestroy,
    confirmDestroy,
  } = controller

  const activeProject = viewModel.dialogs.activeProject
  const activeProjectForSheet = useMemo<ProjectWithClient | null>(
    () => (activeProject ? mapRelationsToSheetProject(activeProject) : null),
    [activeProject]
  )

  const pendingReason = 'Please wait for the current request to finish.'

  const handleEditProject = () => {
    if (!activeProjectForSheet || projectMutationPending) {
      return
    }
    openEdit(activeProjectForSheet)
  }

  const handleArchiveProject = () => {
    if (!activeProjectForSheet || projectMutationPending) {
      return
    }
    requestDelete(activeProjectForSheet)
  }

  const projectActions =
    activeProjectForSheet && props.currentUserRole === 'ADMIN'
      ? {
          canEdit: !projectMutationPending,
          canArchive: !projectMutationPending,
          editDisabledReason: projectMutationPending ? pendingReason : null,
          archiveDisabledReason: projectMutationPending ? pendingReason : null,
          onEdit: handleEditProject,
          onArchive: handleArchiveProject,
        }
      : null

  if (viewModel.isEmpty) {
    return (
      <>
        <AppShellHeader>
          <ProjectsBoardHeader
            {...viewModel.header}
            onOpenAISuggestions={aiSuggestionsState.onOpen}
            aiSuggestionsCount={aiSuggestionsState.pendingCount}
            aiSuggestionsDisabled={aiSuggestionsState.disabled}
            aiSuggestionsDisabledReason={aiSuggestionsState.disabledReason}
          />
        </AppShellHeader>
        <div className='flex h-full flex-col gap-6'>
          <ProjectsBoardEmpty
            title={viewModel.emptyState.title}
            description={viewModel.emptyState.description}
          />
        </div>
      </>
    )
  }

  return (
    <>
      {activeProject ? (
        <ViewLogger
          actorId={props.currentUserId}
          verb={ActivityVerbs.PROJECT_VIEWED}
          summary={`Viewed project "${activeProject.name}" (${props.initialTab} tab)`}
          targetType='PROJECT'
          targetId={activeProject.id}
          targetClientId={activeProject.client_id}
          targetProjectId={activeProject.id}
          metadata={{ tab: props.initialTab }}
        />
      ) : null}
      <AppShellHeader>
        <div className='flex justify-between'>
          <ProjectsBoardHeader
            {...viewModel.header}
            onOpenAISuggestions={aiSuggestionsState.onOpen}
            aiSuggestionsCount={aiSuggestionsState.pendingCount}
            aiSuggestionsDisabled={aiSuggestionsState.disabled}
            aiSuggestionsDisabledReason={aiSuggestionsState.disabledReason}
          />
          <div className='flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6'>
            {viewModel.burndown.visible ? (
              <ProjectBurndownWidget
                totalClientRemainingHours={
                  viewModel.burndown.totalClientRemainingHours
                }
                totalProjectLoggedHours={
                  viewModel.burndown.totalProjectLoggedHours
                }
                projectMonthToDateLoggedHours={
                  viewModel.burndown.projectMonthToDateLoggedHours
                }
                className='ml-auto w-full sm:w-auto'
                canLogTime={viewModel.burndown.canLogTime}
                addTimeLogDisabledReason={
                  viewModel.burndown.addTimeLogDisabledReason
                }
                viewTimeLogsHref={viewModel.burndown.viewTimeLogsHref}
                onAddTimeLog={viewModel.burndown.onAddTimeLog}
                showClientRemainingCard={
                  viewModel.burndown.showClientRemainingCard
                }
                showProjectMonthToDate={
                  viewModel.burndown.showProjectMonthToDate
                }
              />
            ) : null}
          </div>
        </div>
      </AppShellHeader>
      <div className='flex h-full min-h-0 flex-col gap-4 sm:gap-6'>
        <ProjectsBoardTabsSection
          {...viewModel.tabs}
          projectActions={projectActions}
        />
        <ProjectsBoardDialogs
          {...viewModel.dialogs}
          aiSuggestionsState={aiSuggestionsState}
        />
      </div>
      <ProjectLifecycleDialogs
        deleteTarget={deleteTarget}
        destroyTarget={destroyTarget}
        isPending={projectMutationPending}
        onCancelDelete={cancelDelete}
        onConfirmDelete={confirmDelete}
        onCancelDestroy={cancelDestroy}
        onConfirmDestroy={confirmDestroy}
      />
      <ProjectSheet
        open={sheetOpen}
        onOpenChange={handleSheetOpenChange}
        onComplete={handleSheetComplete}
        project={selectedProject}
        clients={sortedClients}
        contractorDirectory={[]}
        projectContractors={projectContractors}
      />
    </>
  )
}

function buildClientRows(projects: ProjectWithRelations[]): ClientRow[] {
  const map = new Map<string, ClientRow>()

  projects.forEach(project => {
    if (project.client) {
      map.set(project.client.id, {
        id: project.client.id,
        name: project.client.name,
        deleted_at: project.client.deleted_at,
      })
    }
  })

  return Array.from(map.values())
}

function buildProjectContractors(
  projects: ProjectWithRelations[]
): Record<string, ContractorUserSummary[]> {
  const result: Record<string, ContractorUserSummary[]> = {}

  projects.forEach(project => {
    result[project.id] = project.members.map(member => ({
      id: member.user_id,
      email: member.user.email ?? '',
      fullName: member.user.full_name,
    }))
  })

  return result
}

function mapRelationsToSheetProject(
  project: ProjectWithRelations
): ProjectWithClient {
  return {
    id: project.id,
    name: project.name,
    status: project.status,
    slug: project.slug,
    client_id: project.client_id,
    type: project.type,
    created_by: project.created_by,
    starts_on: project.starts_on,
    ends_on: project.ends_on,
    created_at: project.created_at,
    updated_at: project.updated_at,
    deleted_at: project.deleted_at,
    client: project.client
      ? {
          id: project.client.id,
          name: project.client.name,
          deleted_at: project.client.deleted_at,
        }
      : null,
    owner: project.created_by
      ? {
          id: project.created_by,
          fullName: null,
          email: null,
        }
      : null,
  }
}

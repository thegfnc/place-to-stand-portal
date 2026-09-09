'use client'

import { useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'

import { PageShell } from '@/components/layout/page-shell'
import { crumbsForNav } from '@/lib/navigation/breadcrumbs'
import { useRecordCycle } from '@/hooks/use-record-cycle'
import { ProjectSheet } from '@/app/(dashboard)/settings/projects/project-sheet'
import { useToast } from '@/components/ui/use-toast'
import { ProjectLifecycleDialogs } from '@/components/settings/projects/table/project-lifecycle-dialogs'
import { useProjectsSettingsController } from '@/components/settings/projects/table/use-projects-settings-controller'
import type {
  ClientRow,
  ProjectWithClient,
} from '@/lib/settings/projects/project-sheet-form'
import { sortClientsByName } from '@/lib/settings/projects/project-sheet-form'
import type { AdminUserForOwner } from '@/lib/settings/projects/project-sheet-ui-state'
import type { ContractorUserSummary } from '@/components/settings/projects/table/types'
import type { ProjectWithRelations } from '@/lib/types'
import { updateProjectStatus } from '@/lib/settings/projects/actions/update-project-status'
import type { ProjectStatusValue } from '@/lib/constants'
import { ProjectsBoardEmpty } from './_components/projects-board-empty'
import { ProjectBurndownWidget } from './_components/project-burndown-widget'
import { ProjectsBoardTabsSection } from './_components/projects-board/projects-board-tabs-section'
import { ProjectsBoardDialogs } from './_components/projects-board-dialogs'
import {
  useProjectsBoardViewModel,
  type ProjectsBoardProps,
} from './_hooks/use-projects-board-view-model'
import { PENDING_REASON } from '@/lib/forms/form-controls'

type ProjectsBoardComponentProps = ProjectsBoardProps & {
  adminUsers?: AdminUserForOwner[]
  allClients?: ClientRow[]
}

export function ProjectsBoard(props: ProjectsBoardComponentProps) {
  const viewModel = useProjectsBoardViewModel(props)
  const router = useRouter()
  const { toast } = useToast()

  const clientRows = useMemo<ClientRow[]>(
    () => props.allClients ?? buildClientRows(props.projects),
    [props.allClients, props.projects]
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

  const pendingReason = PENDING_REASON

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

  const handleProjectStatusChange = useCallback(
    async (projectId: string, status: ProjectStatusValue) => {
      const result = await updateProjectStatus({ projectId, status })

      if (result.error) {
        toast({
          title: 'Failed to update status',
          description: result.error,
          variant: 'destructive',
        })
        throw new Error(result.error)
      }

      router.refresh()
    },
    [router, toast]
  )

  const projectActions =
    activeProjectForSheet
      ? {
          canEdit: !projectMutationPending,
          canArchive: !projectMutationPending,
          editDisabledReason: projectMutationPending ? pendingReason : null,
          archiveDisabledReason: projectMutationPending ? pendingReason : null,
          onEdit: handleEditProject,
          onArchive: handleArchiveProject,
        }
      : null

  // D2/D14: the combobox header is retired; the breadcrumb carries the
  // active project label and ⌘[/⌘] cycling moves to the shared hook.
  const activeProjectLabel =
    viewModel.header.projectItems.find(
      item => item.value === viewModel.header.selectedProjectId
    )?.label ??
    activeProject?.name ??
    null

  useRecordCycle({
    canPrevious: viewModel.header.canSelectPrevious,
    canNext: viewModel.header.canSelectNext,
    onPrevious: viewModel.header.onSelectPreviousProject,
    onNext: viewModel.header.onSelectNextProject,
  })

  const boardBreadcrumbs = activeProjectLabel
    ? [...crumbsForNav('/projects'), { label: activeProjectLabel }]
    : crumbsForNav('/projects')

  if (viewModel.isEmpty) {
    return (
      <PageShell
        breadcrumbs={boardBreadcrumbs}
        contentClassName='flex h-full flex-col gap-6'
      >
        <ProjectsBoardEmpty
          title={viewModel.emptyState.title}
          description={viewModel.emptyState.description}
        />
      </PageShell>
    )
  }

  return (
    <PageShell
      breadcrumbs={boardBreadcrumbs}
      headerRight={
        viewModel.burndown.visible ? (
          <ProjectBurndownWidget
            totalClientRemainingHours={
              viewModel.burndown.totalClientRemainingHours
            }
            totalProjectLoggedHours={viewModel.burndown.totalProjectLoggedHours}
            projectMonthToDateLoggedHours={
              viewModel.burndown.projectMonthToDateLoggedHours
            }
            onAddTimeLog={viewModel.burndown.onAddTimeLog}
            showClientRemainingCard={viewModel.burndown.showClientRemainingCard}
            showProjectMonthToDate={viewModel.burndown.showProjectMonthToDate}
          />
        ) : undefined
      }
      // Only the kanban board pins to the viewport (columns scroll
      // internally). Document-flow tabs (review, overview, …) need
      // min-h-fit to defeat the shell wrapper's min-h-0 clamp so the box
      // grows with content and main's bottom padding is honored.
      contentClassName={
        props.initialTab === 'board'
          ? 'flex h-full min-h-0 flex-col gap-4 sm:gap-6'
          : 'flex min-h-fit flex-col gap-4 sm:gap-6'
      }
    >
      <ProjectsBoardTabsSection
        {...viewModel.tabs}
        projectActions={projectActions}
        onProjectStatusChange={handleProjectStatusChange}
      />
      <ProjectsBoardDialogs {...viewModel.dialogs} />
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
        adminUsers={props.adminUsers ?? []}
        contractorDirectory={[]}
        projectContractors={projectContractors}
      />
    </PageShell>
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
    owner_id: project.owner_id,
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
    owner: project.owner_id
      ? {
          id: project.owner_id,
          fullName: null,
          email: null,
        }
      : null,
  }
}

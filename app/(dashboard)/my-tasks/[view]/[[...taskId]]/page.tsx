import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import {
  MyTasksPage,
  type MyTasksInitialEntry,
  type MyTasksView,
} from '@/components/my-tasks/my-tasks-page'
import { requireUser } from '@/lib/auth/session'
import { fetchProjectsWithRelations } from '@/lib/data/projects'
import { fetchAdminUsers } from '@/lib/data/users'
import { listAssignedTaskSummaries } from '@/lib/data/tasks'

export const metadata: Metadata = {
  title: 'My Tasks | Place to Stand Portal',
}

type PageParams = {
  view: string
  taskId?: string[]
}

type PageSearchParams = {
  assignee?: string
}

type PageProps = {
  params: Promise<PageParams>
  searchParams: Promise<PageSearchParams>
}

const DEFAULT_VIEW: MyTasksView = 'board'

export default async function MyTasksViewRoute({
  params,
  searchParams,
}: PageProps) {
  const user = await requireUser()
  const resolvedParams = await params
  const resolvedSearchParams = await searchParams
  const viewParam = resolvedParams.view
  const activeTaskId = resolvedParams.taskId?.[0] ?? null

  if (!isMyTasksView(viewParam)) {
    const suffix = activeTaskId ? `/${activeTaskId}` : ''
    redirect(`/my-tasks/${DEFAULT_VIEW}${suffix}`)
  }

  const [admins, accessibleProjects] = await Promise.all([
    fetchAdminUsers(),
    fetchProjectsWithRelations({
      forUserId: user.id,
      forRole: user.role,
    }),
  ])

  // For admins, allow viewing other admin's tasks via the assignee param
  const isAdmin = user.role === 'ADMIN'
  const requestedAssigneeId = resolvedSearchParams.assignee ?? user.id
  const selectedAssigneeId =
    isAdmin &&
    requestedAssigneeId !== user.id &&
    admins.some(admin => admin.id === requestedAssigneeId)
      ? requestedAssigneeId
      : user.id

  const assignedSummaries = await listAssignedTaskSummaries({
    userId: selectedAssigneeId,
    role: user.role,
    limit: null,
  })

  const projectLookup = new Map(
    accessibleProjects.map(project => [project.id, project])
  )
  const includedProjectIds = new Set<string>()

  const initialEntries: MyTasksInitialEntry[] = []

  const relevantProjects: typeof accessibleProjects = []

  assignedSummaries.items.forEach(item => {
    const project = projectLookup.get(item.project.id)
    if (!project) {
      return
    }

    if (!includedProjectIds.has(project.id)) {
      includedProjectIds.add(project.id)
      relevantProjects.push(project)
    }

    initialEntries.push({
      taskId: item.id,
      projectId: item.project.id,
      sortOrder: item.sortOrder ?? null,
    })
  })

  const selectionProjects = accessibleProjects.filter(
    project => !project.deleted_at
  )

  return (
    <MyTasksPage
      user={user}
      admins={admins}
      projects={relevantProjects}
      projectSelectionProjects={selectionProjects}
      initialEntries={initialEntries}
      activeTaskId={activeTaskId}
      view={viewParam}
      selectedAssigneeId={selectedAssigneeId}
    />
  )
}

function isMyTasksView(value: string): value is MyTasksView {
  return value === 'board' || value === 'calendar'
}


import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import {
  MyTasksPage,
  type MyTasksInitialEntry,
  type MyTasksView,
} from '@/components/my-tasks/my-tasks-page'
import { requireUser } from '@/lib/auth/session'
import {
  fetchProjectsWithRelationsByIds,
} from '@/lib/data/projects'
import { fetchAdminUsers } from '@/lib/data/users'
import { listAssignedTaskSummaries } from '@/lib/data/tasks'

export const metadata: Metadata = {
  title: 'My Tasks | Place to Stand Portal',
}

type PageParams = {
  view: string
  taskId?: string[]
}

type PageProps = {
  params: Promise<PageParams>
}

const DEFAULT_VIEW: MyTasksView = 'board'

export default async function MyTasksViewRoute({ params }: PageProps) {
  const user = await requireUser()
  const resolvedParams = await params
  const viewParam = resolvedParams.view
  const activeTaskId = resolvedParams.taskId?.[0] ?? null

  if (!isMyTasksView(viewParam)) {
    const suffix = activeTaskId ? `/${activeTaskId}` : ''
    redirect(`/my-tasks/${DEFAULT_VIEW}${suffix}`)
  }

  const [assignedSummaries, admins] = await Promise.all([
    listAssignedTaskSummaries({
      userId: user.id,
      role: user.role,
      limit: null,
    }),
    fetchAdminUsers(),
  ])

  const assignedProjectIds = Array.from(
    new Set(
      assignedSummaries.items
        .map(item => item.project.id)
        .filter((id): id is string => Boolean(id))
    )
  )

  const projects = await fetchProjectsWithRelationsByIds(assignedProjectIds)
  const projectIdSet = new Set(projects.map(project => project.id))

  const initialEntries: MyTasksInitialEntry[] = []

  assignedSummaries.items.forEach(item => {
    if (!projectIdSet.has(item.project.id)) {
      return
    }

    initialEntries.push({
      taskId: item.id,
      projectId: item.project.id,
      sortOrder: item.sortOrder ?? null,
    })
  })

  const relevantProjects = projects.filter(project =>
    initialEntries.some(entry => entry.projectId === project.id)
  )

  return (
    <MyTasksPage
      user={user}
      admins={admins}
      projects={relevantProjects}
      initialEntries={initialEntries}
      activeTaskId={activeTaskId}
      view={viewParam}
    />
  )
}

function isMyTasksView(value: string): value is MyTasksView {
  return value === 'board' || value === 'calendar'
}


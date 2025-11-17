import type { Metadata } from 'next'

import { MyTasksPage, type MyTasksInitialEntry } from '@/components/my-tasks/my-tasks-page'
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
  taskId?: string[]
}

type PageProps = {
  params: Promise<PageParams>
}

export default async function MyTasksRoute({ params }: PageProps) {
  const user = await requireUser()
  const resolvedParams = await params
  const activeTaskId = resolvedParams.taskId?.[0] ?? null

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
    />
  )
}


import type { ProjectWithRelations, TaskWithRelations } from '@/lib/types'

import type { BoardColumnId } from './board-constants'

type ProjectsByClientMap = Map<string, ProjectWithRelations[]>
type ProjectLookupMap = Map<string, ProjectWithRelations>
type ClientSlugLookupMap = Map<string, string | null>

type BoardLookups = {
  projectLookup: ProjectLookupMap
  projectsByClientId: ProjectsByClientMap
  clientSlugLookup: ClientSlugLookupMap
}

export const areTaskCollectionsEqual = (
  a: TaskWithRelations[] | undefined,
  b: TaskWithRelations[]
) => {
  if (!a) return b.length === 0
  if (a.length !== b.length) return false

  const snapshot = new Map(
    a.map(task => [
      task.id,
      `${task.status}-${task.updated_at}-${task.commentCount}`,
    ])
  )

  return b.every(
    task =>
      snapshot.get(task.id) ===
      `${task.status}-${task.updated_at}-${task.commentCount}`
  )
}

export const createProjectLookup = (
  projects: ProjectWithRelations[]
): ProjectLookupMap => {
  const map = new Map<string, ProjectWithRelations>()
  projects.forEach(project => {
    map.set(project.id, project)
  })
  return map
}

export const createProjectsByClientLookup = (
  projects: ProjectWithRelations[]
): ProjectsByClientMap => {
  const map = new Map<string, ProjectWithRelations[]>()
  projects.forEach(project => {
    if (!project.client_id) {
      return
    }
    const list = map.get(project.client_id) ?? []
    list.push(project)
    map.set(project.client_id, list)
  })
  return map
}

export const createClientSlugLookup = (
  clients: Array<{ id: string; slug: string | null }>
): ClientSlugLookupMap => {
  const map = new Map<string, string | null>()
  clients.forEach(client => {
    map.set(client.id, client.slug ?? null)
  })
  return map
}

export const buildBoardPath = (
  projectId: string,
  lookups: BoardLookups,
  options: {
    taskId?: string | null
    view?: 'board' | 'activity' | 'refine' | 'review'
  } = {}
) => {
  const { taskId = null, view = 'board' } = options
  const project = lookups.projectLookup.get(projectId)

  if (!project) {
    return null
  }

  const projectSlug = project.slug ?? null
  const clientId = project.client_id ?? null
  const clientSlug =
    project.client?.slug ??
    (clientId ? (lookups.clientSlugLookup.get(clientId) ?? null) : null)

  if (!projectSlug || !clientSlug) {
    return null
  }

  const rootPath = `/projects/${clientSlug}/${projectSlug}`

  if (view === 'activity') {
    return `${rootPath}/activity`
  }

  if (view === 'review') {
    const reviewPath = `${rootPath}/review`
    return taskId ? `${reviewPath}/${taskId}` : reviewPath
  }

  if (view === 'refine') {
    const refinePath = `${rootPath}/refine`
    return taskId ? `${refinePath}/${taskId}` : refinePath
  }

  const boardPath = `${rootPath}/board`
  return taskId ? `${boardPath}/${taskId}` : boardPath
}

export const groupTasksByColumn = (
  tasks: TaskWithRelations[],
  columns: ReadonlyArray<{ id: BoardColumnId }>
) => {
  const map = new Map<BoardColumnId, TaskWithRelations[]>()
  const columnIds = new Set<BoardColumnId>()

  columns.forEach(column => {
    map.set(column.id, [])
    columnIds.add(column.id)
  })

  tasks
    .slice()
    .sort(
      (a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    )
    .forEach(task => {
      const status = task.status
      if (!columnIds.has(status as BoardColumnId)) {
        return
      }

      if (status === 'DONE' && task.accepted_at) {
        return
      }

      map.get(status as BoardColumnId)!.push(task)
    })

  return map
}

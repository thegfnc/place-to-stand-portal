import { useEffect, useState } from 'react'
import type { TransitionStartFunction } from 'react'

import type { ProjectWithRelations, TaskWithRelations } from '@/lib/types'

import { areTaskCollectionsEqual } from '../board-utils'
import type { TaskLookup } from './types'

const createInitialTasksMap = (
  projects: ProjectWithRelations[],
  selector: (project: ProjectWithRelations) => TaskWithRelations[]
): TaskLookup => {
  const map = new Map<string, TaskWithRelations[]>()
  projects.forEach(project => {
    map.set(project.id, selector(project))
  })
  return map
}

type UseBoardTaskCollectionsArgs = {
  projects: ProjectWithRelations[]
  startTransition: TransitionStartFunction
}

export const useBoardTaskCollections = ({
  projects,
  startTransition,
}: UseBoardTaskCollectionsArgs) => {
  const [tasksByProject, setTasksByProject] = useState<TaskLookup>(() =>
    createInitialTasksMap(projects, project => project.tasks ?? [])
  )
  const [archivedTasksByProject, setArchivedTasksByProject] =
    useState<TaskLookup>(() =>
      createInitialTasksMap(projects, project => project.archivedTasks ?? [])
    )

  useEffect(() => {
    startTransition(() => {
      setTasksByProject(prev => {
        let didChange = false
        const next = new Map(prev)
        const incomingProjectIds = new Set<string>()

        projects.forEach(project => {
          incomingProjectIds.add(project.id)
          const projectTasks = project.tasks ?? []
          const existing = next.get(project.id)
          if (!areTaskCollectionsEqual(existing, projectTasks)) {
            next.set(project.id, projectTasks)
            didChange = true
          }
        })

        for (const projectId of next.keys()) {
          if (!incomingProjectIds.has(projectId)) {
            next.delete(projectId)
            didChange = true
          }
        }

        return didChange ? next : prev
      })
      setArchivedTasksByProject(prev => {
        let didChange = false
        const next = new Map(prev)
        const incomingProjectIds = new Set<string>()

        projects.forEach(project => {
          incomingProjectIds.add(project.id)
          const existing = next.get(project.id)
          const archivedTasks = project.archivedTasks ?? []
          if (!areTaskCollectionsEqual(existing, archivedTasks)) {
            next.set(project.id, archivedTasks)
            didChange = true
          }
        })

        for (const projectId of next.keys()) {
          if (!incomingProjectIds.has(projectId)) {
            next.delete(projectId)
            didChange = true
          }
        }

        return didChange ? next : prev
      })
    })
  }, [projects, startTransition])

  return {
    tasksByProject,
    setTasksByProject,
    archivedTasksByProject,
    setArchivedTasksByProject,
  }
}

import { useEffect, useState } from 'react'
import type { TransitionStartFunction } from 'react'

import type { ProjectWithRelations, TaskWithRelations } from '@/lib/types'

import { areTaskCollectionsEqual } from '../board-utils'
import type { TaskLookup } from './types'

const createInitialTasksMap = (
  projects: ProjectWithRelations[]
): TaskLookup => {
  const map = new Map<string, TaskWithRelations[]>()
  projects.forEach(project => {
    map.set(project.id, project.tasks)
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
    createInitialTasksMap(projects)
  )

  useEffect(() => {
    startTransition(() => {
      setTasksByProject(prev => {
        let didChange = false
        const next = new Map(prev)
        const incomingProjectIds = new Set<string>()

        projects.forEach(project => {
          incomingProjectIds.add(project.id)
          const existing = next.get(project.id)
          if (!areTaskCollectionsEqual(existing, project.tasks)) {
            next.set(project.id, project.tasks)
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

  return { tasksByProject, setTasksByProject }
}

'use server'

import { eq } from 'drizzle-orm'

import { requireRole } from '@/lib/auth/session'
import { logActivity } from '@/lib/activity/logger'
import { projectDeletedEvent } from '@/lib/activity/events'
import { trackSettingsServerInteraction } from '@/lib/posthog/server'
import { db } from '@/lib/db'
import { projects } from '@/lib/db/schema'
import {
  countTasksForProject,
  countTimeLogsForProject,
} from '@/lib/queries/projects'
import {
  destroyProjectSchema,
  type DestroyProjectInput,
  type ProjectActionResult,
} from '@/lib/settings/projects/project-service'

import {
  revalidateProjectDetailRoutes,
  revalidateProjectSettings,
} from './shared'

export async function destroyProject(
  input: DestroyProjectInput
): Promise<ProjectActionResult> {
  const user = await requireRole('ADMIN')
  return trackSettingsServerInteraction(
    {
      entity: 'project',
      mode: 'destroy',
      targetId: input.id,
      metadata: {
        actorId: user.id,
      },
    },
    async () => {
      const parsed = destroyProjectSchema.safeParse(input)

      if (!parsed.success) {
        return { error: 'Invalid permanent delete request.' }
      }

      const projectId = parsed.data.id

      let existingProject:
        | {
            id: string
            name: string
            clientId: string | null
            deletedAt: string | null
          }
        | undefined

      try {
        const rows = await db
          .select({
            id: projects.id,
            name: projects.name,
            clientId: projects.clientId,
            deletedAt: projects.deletedAt,
          })
          .from(projects)
          .where(eq(projects.id, projectId))
          .limit(1)

        existingProject = rows[0]
      } catch (error) {
        console.error('Failed to load project for permanent delete', error)
        return { error: 'Unable to permanently delete project.' }
      }

      if (!existingProject) {
        return { error: 'Project not found.' }
      }

      if (!existingProject.deletedAt) {
        return {
          error: 'Archive the project before permanently deleting.',
        }
      }

      let taskCount = 0
      let timeLogCount = 0

      try {
        ;[taskCount, timeLogCount] = await Promise.all([
          countTasksForProject(projectId),
          countTimeLogsForProject(projectId),
        ])
      } catch (error) {
        console.error(
          'Failed to check project dependencies before delete',
          error
        )
        return { error: 'Unable to verify project dependencies.' }
      }

      const blockingResources: string[] = []

      if (taskCount > 0) {
        blockingResources.push('tasks')
      }

      if (timeLogCount > 0) {
        blockingResources.push('time logs')
      }

      if (blockingResources.length > 0) {
        const resourceSummary =
          blockingResources.length === 1
            ? blockingResources[0]
            : `${blockingResources.slice(0, -1).join(', ')} and ${
                blockingResources[blockingResources.length - 1]
              }`

        return {
          error: `Cannot permanently delete this project while ${resourceSummary} reference it.`,
        }
      }

      try {
        await db.delete(projects).where(eq(projects.id, projectId))
      } catch (error) {
        console.error('Failed to permanently delete project', error)
        return {
          error:
            error instanceof Error
              ? error.message
              : 'Unable to permanently delete project.',
        }
      }

      const event = projectDeletedEvent({ name: existingProject.name })

      await logActivity({
        actorId: user.id,
        actorRole: user.role,
        verb: event.verb,
        summary: event.summary,
        targetType: 'PROJECT',
        targetId: existingProject.id,
        targetProjectId: existingProject.id,
        targetClientId: existingProject.clientId,
        metadata: event.metadata,
      })

      await revalidateProjectSettings()
      await revalidateProjectDetailRoutes()

      return {}
    }
  )
}

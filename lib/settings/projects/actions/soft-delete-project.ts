'use server'

import { eq } from 'drizzle-orm'

import { requireRole } from '@/lib/auth/session'
import { logActivity } from '@/lib/activity/logger'
import { projectArchivedEvent } from '@/lib/activity/events'
import { trackSettingsServerInteraction } from '@/lib/posthog/server'
import { db } from '@/lib/db'
import { projects } from '@/lib/db/schema'
import {
  deleteProjectSchema,
  type DeleteProjectInput,
  type ProjectActionResult,
} from '@/lib/settings/projects/project-service'

import { revalidateProjectSettings } from './shared'

export async function softDeleteProject(
  input: DeleteProjectInput
): Promise<ProjectActionResult> {
  const user = await requireRole('ADMIN')
  return trackSettingsServerInteraction(
    {
      entity: 'project',
      mode: 'delete',
      targetId: input.id,
      metadata: {
        actorId: user.id,
      },
    },
    async () => {
      const parsed = deleteProjectSchema.safeParse(input)

      if (!parsed.success) {
        return { error: 'Invalid delete request.' }
      }

      const projectId = parsed.data.id

      let existingProject:
        | {
            id: string
            name: string
            clientId: string | null
          }
        | undefined

      try {
        const rows = await db
          .select({
            id: projects.id,
            name: projects.name,
            clientId: projects.clientId,
          })
          .from(projects)
          .where(eq(projects.id, projectId))
          .limit(1)

        existingProject = rows[0]
      } catch (error) {
        console.error('Failed to load project for archive', error)
        return { error: 'Unable to archive project.' }
      }

      if (!existingProject) {
        return { error: 'Project not found.' }
      }

      try {
        await db
          .update(projects)
          .set({ deletedAt: new Date().toISOString() })
          .where(eq(projects.id, projectId))
      } catch (error) {
        console.error('Failed to archive project', error)
        return {
          error:
            error instanceof Error ? error.message : 'Unable to archive project.',
        }
      }

      const event = projectArchivedEvent({ name: existingProject.name })

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

      return {}
    }
  )
}

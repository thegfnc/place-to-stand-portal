'use server'

import { eq } from 'drizzle-orm'

import { requireRole } from '@/lib/auth/session'
import { logActivity } from '@/lib/activity/logger'
import { projectRestoredEvent } from '@/lib/activity/events'
import { db } from '@/lib/db'
import { projects } from '@/lib/db/schema'
import {
  restoreProjectSchema,
  type ProjectActionResult,
  type RestoreProjectInput,
} from '@/lib/settings/projects/project-service'

import {
  revalidateProjectDetailRoutes,
  revalidateProjectSettings,
} from './shared'

export async function restoreProject(
  input: RestoreProjectInput
): Promise<ProjectActionResult> {
  const user = await requireRole('ADMIN')
  const parsed = restoreProjectSchema.safeParse(input)

  if (!parsed.success) {
    return { error: 'Invalid restore request.' }
  }

  const projectId = parsed.data.id

  let existingProject:
    | {
        id: string
        name: string
        clientId: string
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
    console.error('Failed to load project for restore', error)
    return { error: 'Unable to restore project.' }
  }

  if (!existingProject) {
    return { error: 'Project not found.' }
  }

  if (!existingProject.deletedAt) {
    return { error: 'Project is already active.' }
  }

  try {
    await db
      .update(projects)
      .set({ deletedAt: null })
      .where(eq(projects.id, projectId))
  } catch (error) {
    console.error('Failed to restore project', error)
    return {
      error:
        error instanceof Error ? error.message : 'Unable to restore project.',
    }
  }

  const event = projectRestoredEvent({ name: existingProject.name })

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

'use server'

import { eq } from 'drizzle-orm'

import { requireRole } from '@/lib/auth/session'
import { logActivity } from '@/lib/activity/logger'
import { projectCreatedEvent, projectUpdatedEvent } from '@/lib/activity/events'
import { db } from '@/lib/db'
import { projects } from '@/lib/db/schema'
import {
  generateUniqueProjectSlug,
  projectSchema,
  projectSlugExists,
  toProjectSlug,
  type ProjectActionResult,
  type ProjectInput,
} from '@/lib/settings/projects/project-service'

import {
  revalidateProjectDetailRoutes,
  revalidateProjectSettings,
} from './shared'

const INSERT_RETRY_LIMIT = 3

export async function saveProject(
  input: ProjectInput
): Promise<ProjectActionResult> {
  const user = await requireRole('ADMIN')
  const parsed = projectSchema.safeParse(input)

  if (!parsed.success) {
    const { fieldErrors, formErrors } = parsed.error.flatten()
    const message = formErrors[0] ?? 'Please correct the highlighted fields.'

    return { error: message, fieldErrors }
  }

  const { id, name, clientId, status, startsOn, endsOn, slug } = parsed.data

  const trimmedName = name.trim()
  const providedSlug = slug?.trim() ?? null
  const normalizedProvidedSlug = providedSlug
    ? toProjectSlug(providedSlug)
    : null

  if (normalizedProvidedSlug && normalizedProvidedSlug.length < 3) {
    return { error: 'Slug must be at least 3 characters.' }
  }

  if (!trimmedName) {
    return { error: 'Project name is required.' }
  }

  if (!id) {
    const baseSlug = normalizedProvidedSlug ?? toProjectSlug(trimmedName)
    let slugCandidate = await generateUniqueProjectSlug(baseSlug)
    let insertedId: string | null = null
    let attempt = 0

    while (attempt < INSERT_RETRY_LIMIT) {
      try {
        const inserted = await db
          .insert(projects)
          .values({
            name: trimmedName,
            clientId,
            status,
            startsOn: startsOn ?? null,
            endsOn: endsOn ?? null,
            createdBy: user.id,
            slug: slugCandidate,
          })
          .returning({ id: projects.id })

        insertedId = inserted[0]?.id ?? null

        if (insertedId) {
          break
        }
      } catch (error) {
        if (!isUniqueViolation(error)) {
          console.error('Failed to create project', error)
          return {
            error:
              error instanceof Error
                ? error.message
                : 'Unable to create project.',
          }
      }

        slugCandidate = await generateUniqueProjectSlug(baseSlug)
        attempt += 1
        continue
      }
    }

    if (!insertedId) {
      return {
        error: 'Could not generate a unique slug. Please try again.',
      }
    }

    const event = projectCreatedEvent({
      name: trimmedName,
      status,
    })

    await logActivity({
      actorId: user.id,
      actorRole: user.role,
      verb: event.verb,
      summary: event.summary,
      targetType: 'PROJECT',
      targetId: insertedId,
      targetProjectId: insertedId,
      targetClientId: clientId,
      metadata: event.metadata,
    })
  } else {
    const slugToUpdate = normalizedProvidedSlug

    if (slugToUpdate) {
      const exists = await projectSlugExists(slugToUpdate, {
        excludeId: id,
      })

      if (exists) {
        return { error: 'Another project already uses this slug.' }
      }
    }

    let existingProject:
      | {
          id: string
          name: string
          status: string
          startsOn: string | null
          endsOn: string | null
          slug: string | null
          clientId: string
        }
      | undefined

    try {
      const rows = await db
        .select({
          id: projects.id,
          name: projects.name,
          status: projects.status,
          startsOn: projects.startsOn,
          endsOn: projects.endsOn,
          slug: projects.slug,
          clientId: projects.clientId,
        })
        .from(projects)
        .where(eq(projects.id, id))
        .limit(1)

      existingProject = rows[0]
    } catch (error) {
      console.error('Failed to load project for update', error)
      return { error: 'Unable to update project.' }
    }

    if (!existingProject) {
      return { error: 'Project not found.' }
    }

    try {
      await db
        .update(projects)
        .set({
          name: trimmedName,
          clientId,
          status,
          startsOn: startsOn ?? null,
          endsOn: endsOn ?? null,
          slug: slugToUpdate,
        })
        .where(eq(projects.id, id))
    } catch (error) {
      console.error('Failed to update project', error)
      return {
        error:
          error instanceof Error ? error.message : 'Unable to update project.',
      }
    }

    const changedFields: string[] = []
    const previousDetails: Record<string, unknown> = {}
    const nextDetails: Record<string, unknown> = {}

    if (existingProject.name !== trimmedName) {
      changedFields.push('name')
      previousDetails.name = existingProject.name
      nextDetails.name = trimmedName
    }

    if (existingProject.status !== status) {
      changedFields.push('status')
      previousDetails.status = existingProject.status
      nextDetails.status = status
    }

    const previousStartsOn = existingProject.startsOn ?? null
    const nextStartsOn = startsOn ?? null

    if (previousStartsOn !== nextStartsOn) {
      changedFields.push('start date')
      previousDetails.startsOn = previousStartsOn
      nextDetails.startsOn = nextStartsOn
    }

    const previousEndsOn = existingProject.endsOn ?? null
    const nextEndsOn = endsOn ?? null

    if (previousEndsOn !== nextEndsOn) {
      changedFields.push('end date')
      previousDetails.endsOn = previousEndsOn
      nextDetails.endsOn = nextEndsOn
    }

    const previousSlug = existingProject.slug ?? null
    const nextSlug = slugToUpdate ?? null

    if (previousSlug !== nextSlug) {
      changedFields.push('slug')
      previousDetails.slug = previousSlug
      nextDetails.slug = nextSlug
    }

    if (changedFields.length > 0) {
      const detailsPayload =
        Object.keys(previousDetails).length > 0 ||
        Object.keys(nextDetails).length > 0
          ? { before: previousDetails, after: nextDetails }
          : undefined

      const event = projectUpdatedEvent({
        name: trimmedName,
        changedFields,
        details: detailsPayload,
      })

      await logActivity({
        actorId: user.id,
        actorRole: user.role,
        verb: event.verb,
        summary: event.summary,
        targetType: 'PROJECT',
        targetId: id,
        targetProjectId: id,
        targetClientId: existingProject.clientId,
        metadata: event.metadata,
      })
    }
  }

  await revalidateProjectSettings()
  await revalidateProjectDetailRoutes()

  return {}
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === '23505'
  )
}

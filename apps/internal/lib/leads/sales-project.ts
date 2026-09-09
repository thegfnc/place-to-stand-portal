import 'server-only'

import { and, eq, isNull, isNotNull } from 'drizzle-orm'

import { projectCreatedEvent } from '@/lib/activity/events'
import { logActivity } from '@/lib/activity/logger'
import { db } from '@/lib/db'
import { projects } from '@/lib/db/schema'

const SALES_PROJECT_NAME = 'Sales'
const SALES_PROJECT_SLUG = 'sales'

/**
 * Find (or, only if absent, create) the internal "Sales" project — the single
 * project every lead task is created in.
 *
 * This is the ONE source of truth for lead-task placement. A second copy of
 * this logic previously lived in `lib/sheets/init/resolvers.ts` under the slug
 * `sales-strategy` with an unguarded bare insert — it created phantom projects
 * and, once a phantom was soft-deleted, crashed every task sheet with a unique
 * violation. Do not reintroduce a local copy; import this module.
 *
 * Concurrency: the insert uses `onConflictDoNothing` against the slug index.
 * `idx_projects_slug` is a PARTIAL unique index (`WHERE slug IS NOT NULL`), and
 * Postgres only infers an arbiter whose predicate matches the ON CONFLICT
 * clause — a bare `{ target }` raises "no unique or exclusion constraint
 * matching the ON CONFLICT specification" on every conflict, the exact case
 * the guard exists to absorb. The `where` clause below is load-bearing.
 */
export async function getOrCreateSalesProject(userId: string): Promise<string> {
  const findSalesProject = async () =>
    db
      .select({ id: projects.id })
      .from(projects)
      .where(
        and(
          eq(projects.slug, SALES_PROJECT_SLUG),
          eq(projects.type, 'INTERNAL'),
          isNull(projects.deletedAt)
        )
      )
      .limit(1)

  const [existingProject] = await findSalesProject()

  if (existingProject) {
    return existingProject.id
  }

  const timestamp = new Date().toISOString()
  const [newProject] = await db
    .insert(projects)
    .values({
      name: SALES_PROJECT_NAME,
      slug: SALES_PROJECT_SLUG,
      type: 'INTERNAL',
      status: 'ACTIVE',
      createdBy: userId,
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    .onConflictDoNothing({
      target: projects.slug,
      where: isNotNull(projects.slug),
    })
    .returning({ id: projects.id })

  if (newProject) {
    // Only the call that actually won the insert logs — a conflict returns no
    // row and falls through to the re-select below.
    await logActivity({
      actorId: userId,
      targetType: 'PROJECT',
      targetId: newProject.id,
      targetProjectId: newProject.id,
      ...projectCreatedEvent({ name: SALES_PROJECT_NAME, status: 'ACTIVE' }),
    })

    return newProject.id
  }

  // A concurrent call won the insert race (conflict → no row returned).
  // Re-select to resolve the now-existing project.
  const [racedProject] = await findSalesProject()

  if (!racedProject) {
    throw new Error('Failed to resolve Sales project')
  }

  return racedProject.id
}

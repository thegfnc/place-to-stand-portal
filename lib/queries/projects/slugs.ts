import 'server-only'

import { and, eq, ne } from 'drizzle-orm'

import { db } from '@/lib/db'
import { projects } from '@/lib/db/schema'

export async function projectSlugExistsDrizzle(
  slug: string,
  options: { excludeId?: string } = {},
) {
  const conditions = [eq(projects.slug, slug)]

  if (options.excludeId) {
    conditions.push(ne(projects.id, options.excludeId))
  }

  const rows = await db
    .select({ id: projects.id })
    .from(projects)
    .where(conditions.length > 1 ? and(...conditions) : conditions[0])
    .limit(1)

  return rows.length > 0
}

export async function generateUniqueProjectSlugDrizzle(base: string) {
  const normalizedBase = base || 'project'
  let candidate = normalizedBase
  let suffix = 2

  while (true) {
    const exists = await projectSlugExistsDrizzle(candidate)

    if (!exists) {
      return candidate
    }

    candidate = `${normalizedBase}-${suffix}`
    suffix += 1

    if (suffix > 5) {
      return `${normalizedBase}-${Date.now()}`
    }
  }
}


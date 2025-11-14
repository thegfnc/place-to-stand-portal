'use server'

import { and, eq, ne } from 'drizzle-orm'

import { db } from '@/lib/db'
import { clients } from '@/lib/db/schema'

export async function clientSlugExistsDrizzle(
  slug: string,
  options: { excludeId?: string } = {},
) {
  const conditions = [eq(clients.slug, slug)]

  if (options.excludeId) {
    conditions.push(ne(clients.id, options.excludeId))
  }

  const rows = await db
    .select({ id: clients.id })
    .from(clients)
    .where(conditions.length > 1 ? and(...conditions) : conditions[0])
    .limit(1)

  return rows.length > 0
}

export async function generateUniqueClientSlugDrizzle(
  base: string,
  options: { initialCandidate?: string; startSuffix?: number } = {},
) {
  const normalizedBase = base || 'client'
  let candidate = options.initialCandidate ?? normalizedBase
  let suffix =
    options.startSuffix ??
    (candidate === normalizedBase
      ? 2
      : extractSuffixFromCandidate(candidate, normalizedBase))

  let attempt = 0

  while (attempt < 3) {
    const exists = await clientSlugExistsDrizzle(candidate)

    if (!exists) {
      return candidate
    }

    candidate = `${normalizedBase}-${suffix}`
    suffix += 1
    attempt += 1
  }

  return `${normalizedBase}-${Date.now()}`
}

function extractSuffixFromCandidate(candidate: string, base: string): number {
  if (candidate === base) {
    return 2
  }

  const suffix = Number(candidate.replace(`${base}-`, ''))

  return Number.isFinite(suffix) && suffix >= 2 ? suffix + 1 : 2
}


'use server'

import { and, asc, eq, isNull, ne, or, sql, type SQL } from 'drizzle-orm'

import type { AppUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { clients, contacts, projects } from '@/lib/db/schema'
import { createSearchPattern } from '@/lib/pagination/cursor'

const RESULT_LIMIT = 8

type PaletteClientResult = {
  id: string
  name: string
  slug: string | null
}

type PaletteProjectResult = {
  id: string
  name: string
  /** URL client segment: client slug, 'internal', or 'personal'. */
  clientSegment: string
  projectSlug: string
  /** Disambiguating label prefix, e.g. the client name (R7). */
  clientLabel: string | null
}

type PaletteContactResult = {
  id: string
  name: string
  email: string
}

export type PaletteSearchResult = {
  clients: PaletteClientResult[]
  projects: PaletteProjectResult[]
  contacts: PaletteContactResult[]
}

/**
 * ⌘K palette record search (PRD 004 §01, D13). Fuzzy semantics inherited
 * from `createSearchPattern` by design (W3). Visibility (R3): PERSONAL
 * projects are excluded unless created by the current user — the same rule
 * the retired combobox switcher applied. Project search also matches the
 * client name (R7) so "search clients or projects" parity holds.
 */
export async function searchCommandPalette(
  user: AppUser,
  query: string
): Promise<PaletteSearchResult> {
  assertAdmin(user)

  const pattern = createSearchPattern(query)

  const clientCondition = and(
    isNull(clients.deletedAt),
    sql`${clients.name} ILIKE ${pattern}`
  )

  // R3: PERSONAL projects visible only to their creator.
  const visibilityCondition: SQL = or(
    ne(projects.type, 'PERSONAL'),
    eq(projects.createdBy, user.id)
  )!

  const projectCondition = and(
    isNull(projects.deletedAt),
    visibilityCondition,
    or(
      sql`${projects.name} ILIKE ${pattern}`,
      sql`${projects.slug} ILIKE ${pattern}`,
      sql`${clients.name} ILIKE ${pattern}`
    )
  )

  // Contacts (03 extension): same per-entity predicate the contacts list
  // uses — name/email, no additional visibility rules (admin-only surface).
  const contactCondition = and(
    isNull(contacts.deletedAt),
    or(
      sql`${contacts.name} ILIKE ${pattern}`,
      sql`${contacts.email} ILIKE ${pattern}`
    )
  )

  const [clientRows, projectRows, contactRows] = await Promise.all([
    db
      .select({ id: clients.id, name: clients.name, slug: clients.slug })
      .from(clients)
      .where(clientCondition)
      .orderBy(asc(clients.name))
      .limit(RESULT_LIMIT),
    db
      .select({
        id: projects.id,
        name: projects.name,
        slug: projects.slug,
        type: projects.type,
        clientName: clients.name,
        clientSlug: clients.slug,
      })
      .from(projects)
      .leftJoin(clients, eq(projects.clientId, clients.id))
      .where(projectCondition)
      .orderBy(asc(clients.name), asc(projects.name))
      .limit(RESULT_LIMIT),
    db
      .select({ id: contacts.id, name: contacts.name, email: contacts.email })
      .from(contacts)
      .where(contactCondition)
      .orderBy(asc(contacts.name))
      .limit(RESULT_LIMIT),
  ])

  const projectResults: PaletteProjectResult[] = []
  for (const row of projectRows) {
    const clientSegment =
      row.type === 'INTERNAL'
        ? 'internal'
        : row.type === 'PERSONAL'
          ? 'personal'
          : (row.clientSlug ?? null)

    if (!clientSegment || !row.slug) continue

    projectResults.push({
      id: row.id,
      name: row.name,
      clientSegment,
      projectSlug: row.slug,
      clientLabel:
        row.type === 'INTERNAL'
          ? 'Internal'
          : row.type === 'PERSONAL'
            ? 'Personal'
            : row.clientName,
    })
  }

  return {
    clients: clientRows,
    projects: projectResults,
    contacts: contactRows,
  }
}

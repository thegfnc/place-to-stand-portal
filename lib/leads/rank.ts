import { and, desc, eq, isNull } from 'drizzle-orm'

import { db } from '@/lib/db'
import { leads } from '@/lib/db/schema'
import { getRankAfter } from '@/lib/rank'

import type { LeadStatusValue } from './constants'

export async function resolveNextLeadRank(status: LeadStatusValue) {
  const rows = await db
    .select({ rank: leads.rank })
    .from(leads)
    .where(and(eq(leads.status, status), isNull(leads.deletedAt)))
    .orderBy(desc(leads.rank))
    .limit(1)

  const previousRank = rows[0]?.rank ?? null

  return getRankAfter(previousRank)
}


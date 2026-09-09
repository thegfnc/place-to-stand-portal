import 'server-only'

import { and, desc, eq, isNull } from 'drizzle-orm'

import { assertAdmin } from '@/lib/auth/permissions'
import type { AppUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { leadUpdates, users } from '@/lib/db/schema'
import type { LeadUpdateRecord } from '@/lib/leads/types'
import type { LeadUpdateTypeValue } from '@/lib/leads/updates'

/**
 * Timeline rows for one lead, newest first, with author identity joined.
 *
 * Admin-asserted like `listTasksForLead` — leads are admin-only data and this
 * project has no RLS backstop (W26).
 */
export async function listLeadUpdates(
  user: AppUser,
  leadId: string
): Promise<LeadUpdateRecord[]> {
  assertAdmin(user)

  const rows = await db
    .select({
      id: leadUpdates.id,
      leadId: leadUpdates.leadId,
      type: leadUpdates.type,
      body: leadUpdates.body,
      occurredAt: leadUpdates.occurredAt,
      authorId: leadUpdates.authorId,
      authorName: users.fullName,
      authorEmail: users.email,
      authorAvatarUrl: users.avatarUrl,
      createdAt: leadUpdates.createdAt,
      updatedAt: leadUpdates.updatedAt,
    })
    .from(leadUpdates)
    .leftJoin(users, eq(users.id, leadUpdates.authorId))
    .where(and(eq(leadUpdates.leadId, leadId), isNull(leadUpdates.deletedAt)))
    .orderBy(desc(leadUpdates.occurredAt), desc(leadUpdates.createdAt))

  return rows.map(row => ({
    ...row,
    authorName: row.authorName ?? null,
    authorEmail: row.authorEmail ?? null,
    authorAvatarUrl: row.authorAvatarUrl ?? null,
  }))
}

/**
 * One update row, used by the edit/delete actions to verify ownership before
 * writing. Returns null when the update doesn't exist, is soft-deleted, or
 * belongs to a different lead — the caller must not trust the id alone.
 */
export async function getLeadUpdateForLead(
  updateId: string,
  leadId: string
): Promise<{
  id: string
  type: LeadUpdateTypeValue
  body: string
  occurredAt: string
} | null> {
  const [row] = await db
    .select({
      id: leadUpdates.id,
      type: leadUpdates.type,
      body: leadUpdates.body,
      occurredAt: leadUpdates.occurredAt,
    })
    .from(leadUpdates)
    .where(
      and(
        eq(leadUpdates.id, updateId),
        eq(leadUpdates.leadId, leadId),
        isNull(leadUpdates.deletedAt)
      )
    )
    .limit(1)

  return row ?? null
}

import 'server-only'

import { sql } from 'drizzle-orm'

import { db } from '@/lib/db'
import { clientCommissionTerms, clients } from '@/lib/db/schema'

import { currentMonthStartUtc } from './billing-terms'

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0]
type DbOrTransaction = typeof db | DbTransaction

/**
 * One commission split: who closed the deal and who originated it. Any of the
 * three may be NULL — a NULL closer means the closer share is not paid out and
 * is reported under House (estimated); origination user + contact are mutually
 * exclusive (CHECK constraint).
 */
export type CommissionAssignment = {
  closerUserId: string | null
  originationUserId: string | null
  originationContactId: string | null
}

export function commissionAssignmentsEqual(
  a: CommissionAssignment,
  b: CommissionAssignment
): boolean {
  return (
    (a.closerUserId ?? null) === (b.closerUserId ?? null) &&
    (a.originationUserId ?? null) === (b.originationUserId ?? null) &&
    (a.originationContactId ?? null) === (b.originationContactId ?? null)
  )
}

/**
 * Inserts a client's first commission term, effective the first of the
 * creation month. Must run in the same transaction as the client insert so
 * the client's first month resolves its closer/origination.
 */
export async function insertInitialCommissionTerm(
  tx: DbOrTransaction,
  params: CommissionAssignment & {
    clientId: string
    createdBy: string | null
  }
): Promise<void> {
  await tx.insert(clientCommissionTerms).values({
    clientId: params.clientId,
    effectiveFrom: currentMonthStartUtc(),
    closerUserId: params.closerUserId,
    originationUserId: params.originationUserId,
    originationContactId: params.originationContactId,
    createdBy: params.createdBy,
  })
}

/**
 * Inserts a term at a month boundary, or overwrites the split of the existing
 * active term at that boundary (re-editing a scheduled boundary upserts
 * rather than erroring). Mirrors `upsertBillingTerm`.
 */
export async function upsertCommissionTerm(
  tx: DbOrTransaction,
  params: CommissionAssignment & {
    clientId: string
    effectiveFrom: string
    createdBy: string | null
  }
): Promise<void> {
  await tx
    .insert(clientCommissionTerms)
    .values({
      clientId: params.clientId,
      effectiveFrom: params.effectiveFrom,
      closerUserId: params.closerUserId,
      originationUserId: params.originationUserId,
      originationContactId: params.originationContactId,
      createdBy: params.createdBy,
    })
    .onConflictDoUpdate({
      target: [clientCommissionTerms.clientId, clientCommissionTerms.effectiveFrom],
      targetWhere: sql`deleted_at IS NULL`,
      set: {
        closerUserId: params.closerUserId,
        originationUserId: params.originationUserId,
        originationContactId: params.originationContactId,
        createdBy: params.createdBy,
        updatedAt: new Date().toISOString(),
      },
    })
}

type CommissionColumn = 'closerUserId' | 'originationUserId' | 'originationContactId'

/**
 * SQL fragment resolving one commission column as of a report period — the
 * newest `effective_from` <= period start wins, exactly like
 * `billingTypeAsOfSql`. Correlated against the outer `clients` table, so it
 * is only valid inside a query that joins `clients`. NULL when the resolved
 * term has no assignment (or no term exists at or before the period).
 */
function commissionColumnAsOfSql(column: CommissionColumn, periodStart: string) {
  return sql<string | null>`(
    SELECT ${clientCommissionTerms[column]}
    FROM ${clientCommissionTerms}
    WHERE ${clientCommissionTerms.clientId} = ${clients.id}
      AND ${clientCommissionTerms.effectiveFrom} <= ${periodStart}
      AND ${clientCommissionTerms.deletedAt} IS NULL
    ORDER BY ${clientCommissionTerms.effectiveFrom} DESC
    LIMIT 1
  )`
}

export function closerUserIdAsOfSql(periodStart: string) {
  return commissionColumnAsOfSql('closerUserId', periodStart)
}

export function originationUserIdAsOfSql(periodStart: string) {
  return commissionColumnAsOfSql('originationUserId', periodStart)
}

export function originationContactIdAsOfSql(periodStart: string) {
  return commissionColumnAsOfSql('originationContactId', periodStart)
}

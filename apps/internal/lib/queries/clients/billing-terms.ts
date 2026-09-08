import 'server-only'

import { and, asc, desc, eq, gt, isNull, lte, sql } from 'drizzle-orm'

import { db } from '@/lib/db'
import { clientBillingTerms, clients } from '@/lib/db/schema'
import type { ClientBillingTypeValue } from '@/lib/types'

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0]
type DbOrTransaction = typeof db | DbTransaction

/** First day of the current month in UTC, as 'yyyy-MM-dd'. */
export function currentMonthStartUtc(): string {
  const now = new Date()
  const year = now.getUTCFullYear()
  const month = String(now.getUTCMonth() + 1).padStart(2, '0')
  return `${year}-${month}-01`
}

/** First day of next month in UTC, as 'yyyy-MM-dd'. */
export function nextMonthStartUtc(): string {
  const now = new Date()
  // Date handles month overflow (December -> January next year).
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
  const year = next.getUTCFullYear()
  const month = String(next.getUTCMonth() + 1).padStart(2, '0')
  return `${year}-${month}-01`
}

/**
 * Inserts a client's first billing term, effective the first of the creation
 * month. Must run in the same transaction as the client insert — a client
 * without a terms row is invisible to every monthly close.
 */
export async function insertInitialBillingTerm(
  tx: DbOrTransaction,
  params: {
    clientId: string
    billingType: ClientBillingTypeValue
    createdBy: string | null
  }
): Promise<void> {
  await tx.insert(clientBillingTerms).values({
    clientId: params.clientId,
    billingType: params.billingType,
    effectiveFrom: currentMonthStartUtc(),
    createdBy: params.createdBy,
  })
}

/**
 * Inserts a term at a month boundary, or overwrites the billing type of the
 * existing active term at that boundary (re-editing a scheduled boundary
 * upserts rather than erroring). The unique index is partial, so the conflict
 * target must carry its predicate.
 */
export async function upsertBillingTerm(
  tx: DbOrTransaction,
  params: {
    clientId: string
    billingType: ClientBillingTypeValue
    effectiveFrom: string
    createdBy: string | null
  }
): Promise<void> {
  await tx
    .insert(clientBillingTerms)
    .values({
      clientId: params.clientId,
      billingType: params.billingType,
      effectiveFrom: params.effectiveFrom,
      createdBy: params.createdBy,
    })
    .onConflictDoUpdate({
      target: [clientBillingTerms.clientId, clientBillingTerms.effectiveFrom],
      targetWhere: sql`deleted_at IS NULL`,
      set: {
        billingType: params.billingType,
        createdBy: params.createdBy,
        updatedAt: new Date().toISOString(),
      },
    })
}

/**
 * SQL fragment resolving a client's billing type as of a report period —
 * newest `effective_from` <= period start wins, mirroring how
 * `getPartnerRatesForPeriod` resolves the partner rate schedule. Correlated
 * against the outer `clients` table, so it is only valid inside a query that
 * joins `clients`.
 */
export function billingTypeAsOfSql(periodStart: string) {
  return sql<'prepaid' | 'net_30' | null>`(
    SELECT ${clientBillingTerms.billingType}
    FROM ${clientBillingTerms}
    WHERE ${clientBillingTerms.clientId} = ${clients.id}
      AND ${clientBillingTerms.effectiveFrom} <= ${periodStart}
      AND ${clientBillingTerms.deletedAt} IS NULL
    ORDER BY ${clientBillingTerms.effectiveFrom} DESC
    LIMIT 1
  )`
}

/**
 * Resolves a client's billing type as of a given month start ('yyyy-MM-dd').
 */
async function resolveBillingTypeAsOf(
  clientId: string,
  periodStart: string,
  tx: DbOrTransaction = db
): Promise<ClientBillingTypeValue | null> {
  const [row] = await tx
    .select({ billingType: clientBillingTerms.billingType })
    .from(clientBillingTerms)
    .where(
      and(
        eq(clientBillingTerms.clientId, clientId),
        lte(clientBillingTerms.effectiveFrom, periodStart),
        isNull(clientBillingTerms.deletedAt)
      )
    )
    .orderBy(desc(clientBillingTerms.effectiveFrom))
    .limit(1)

  return row?.billingType ?? null
}

/**
 * Month a newly created hour block's hours are billed in (D13). Defaults to
 * the current month; when the client is still net_30-resolving with a prepaid
 * boundary ahead, clamps forward to that boundary so the block counts in the
 * first month it can actually be billed instead of being orphaned.
 */
export async function resolveHourBlockBillingMonth(
  clientId: string,
  tx: DbOrTransaction = db
): Promise<string> {
  const monthStart = currentMonthStartUtc()
  const current = await resolveBillingTypeAsOf(clientId, monthStart, tx)

  if (current === 'prepaid') {
    return monthStart
  }

  const [upcoming] = await tx
    .select({ effectiveFrom: clientBillingTerms.effectiveFrom })
    .from(clientBillingTerms)
    .where(
      and(
        eq(clientBillingTerms.clientId, clientId),
        eq(clientBillingTerms.billingType, 'prepaid'),
        gt(clientBillingTerms.effectiveFrom, monthStart),
        isNull(clientBillingTerms.deletedAt)
      )
    )
    .orderBy(asc(clientBillingTerms.effectiveFrom))
    .limit(1)

  if (upcoming) {
    return upcoming.effectiveFrom
  }

  // Defensive: an hour block for a client with no prepaid term anywhere.
  // Attribute to the current month rather than failing the write.
  console.error(
    `[resolveHourBlockBillingMonth] Client ${clientId} has no prepaid billing term; attributing block to ${monthStart}`
  )
  return monthStart
}

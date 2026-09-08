import 'server-only'

import { cache } from 'react'
import { and, eq, inArray, isNull, ne, sql } from 'drizzle-orm'

import { db } from '@/lib/db'
import { clients, invoiceLineItems, invoices } from '@pts/db/schema'
import type { AppUser } from '@/lib/auth/session'
import { resolvePortalScope } from '@/lib/auth/view-as'
import type { InvoiceWithLineItems } from '@pts/pdf'

/**
 * Statuses a client may see. DRAFT is excluded everywhere in this file — an
 * unfinished invoice is internal work-in-progress, and excluding it in the
 * query rather than the component means there is no route (list *or* PDF) that
 * can surface one.
 */
type ClientInvoiceStatusValue = 'SENT' | 'VIEWED' | 'PAID' | 'VOID'

export type ClientInvoice = {
  id: string
  invoiceNumber: string | null
  status: ClientInvoiceStatusValue
  clientId: string
  clientName: string
  issuedDate: string | null
  total: string
  paidAt: string | null
  /** Owed *and* reachable on the internal share page, which is where payment lives. */
  isPayable: boolean
  /** Null unless sharing is currently enabled, so callers can't build a dead link. */
  shareToken: string | null
}

/**
 * Every invoice in scope, newest first.
 *
 * SECURITY: client ids come only from resolvePortalScope — never from a route
 * param, query string, or request body — so there is no IDOR surface here. Same
 * rule as `lib/data/hours.ts`; do not reintroduce an ad-hoc membership query.
 */
export const fetchClientInvoices = cache(
  async (user: AppUser): Promise<ClientInvoice[]> => {
    const { clientIds } = await resolvePortalScope(user)
    if (clientIds.length === 0) return []

    const rows = await db
      .select({
        id: invoices.id,
        invoiceNumber: invoices.invoiceNumber,
        status: invoices.status,
        clientId: invoices.clientId,
        clientName: clients.name,
        issuedDate: invoices.issuedDate,
        total: invoices.total,
        paidAt: invoices.paidAt,
        shareToken: invoices.shareToken,
        shareEnabled: invoices.shareEnabled,
      })
      .from(invoices)
      .innerJoin(clients, eq(clients.id, invoices.clientId))
      .where(
        and(
          inArray(invoices.clientId, clientIds),
          isNull(invoices.deletedAt),
          isNull(clients.deletedAt),
          ne(invoices.status, 'DRAFT')
        )
      )
      // Undated invoices sort last rather than first, which is what plain DESC
      // would do in Postgres.
      .orderBy(
        sql`${invoices.issuedDate} desc nulls last`,
        sql`${invoices.createdAt} desc`
      )

    return rows.map((row): ClientInvoice => {
      const status = row.status as ClientInvoiceStatusValue
      const isOwed = status === 'SENT' || status === 'VIEWED'
      // share_token outlives share_enabled (unsharing preserves the token), so
      // the flag is what decides whether a link would actually resolve.
      const shareToken = row.shareEnabled ? row.shareToken : null

      return {
        id: row.id,
        invoiceNumber: row.invoiceNumber,
        status,
        clientId: row.clientId,
        clientName: row.clientName,
        issuedDate: row.issuedDate,
        total: row.total,
        paidAt: row.paidAt,
        isPayable: isOwed && shareToken !== null,
        shareToken,
      }
    })
  }
)

export type ClientInvoiceSummary = {
  unpaidCount: number
  /** Sum of every unpaid invoice, as a numeric string. */
  unpaidTotal: string
}

const EMPTY_SUMMARY: ClientInvoiceSummary = {
  unpaidCount: 0,
  unpaidTotal: '0',
}

/**
 * Counts and balances for the dashboard's Invoices card.
 *
 * A single aggregate rather than counting rows in JS — the dashboard never
 * renders the invoices themselves, so there is no reason to ship them over the
 * wire. "Unpaid" is SENT or VIEWED; PAID and VOID are settled either way.
 */
export const fetchClientInvoiceSummary = cache(
  async (user: AppUser): Promise<ClientInvoiceSummary> => {
    const { clientIds } = await resolvePortalScope(user)
    if (clientIds.length === 0) return EMPTY_SUMMARY

    const [row] = await db
      .select({
        unpaidCount: sql<number>`count(*)::int`,
        unpaidTotal: sql<string>`coalesce(sum(${invoices.total}), 0)::text`,
      })
      .from(invoices)
      .where(
        and(
          inArray(invoices.clientId, clientIds),
          isNull(invoices.deletedAt),
          inArray(invoices.status, ['SENT', 'VIEWED'])
        )
      )

    return row ?? EMPTY_SUMMARY
  }
)

/**
 * One invoice with its line items, in the snake_case shape `@pts/pdf`
 * expects.
 *
 * Returns null rather than throwing when the invoice is out of scope, missing,
 * deleted, or a draft — so the PDF route's 404 is identical in all those cases
 * and cannot be used to probe which invoice ids exist. Same idiom as
 * `fetchProjectDetail` in `lib/data/project-detail.ts`.
 */
export const fetchClientInvoiceForPdf = cache(
  async (
    user: AppUser,
    invoiceId: string
  ): Promise<InvoiceWithLineItems | null> => {
    const { clientIds } = await resolvePortalScope(user)
    if (clientIds.length === 0) return null

    const [row] = await db
      .select({
        invoice: invoices,
        client: {
          id: clients.id,
          name: clients.name,
          slug: clients.slug,
          deletedAt: clients.deletedAt,
        },
      })
      .from(invoices)
      .innerJoin(clients, eq(clients.id, invoices.clientId))
      .where(
        and(
          eq(invoices.id, invoiceId),
          inArray(invoices.clientId, clientIds),
          isNull(invoices.deletedAt),
          ne(invoices.status, 'DRAFT')
        )
      )
      .limit(1)

    if (!row) return null

    const lineItemRows = await db
      .select()
      .from(invoiceLineItems)
      .where(
        and(
          eq(invoiceLineItems.invoiceId, invoiceId),
          isNull(invoiceLineItems.deletedAt)
        )
      )
      .orderBy(invoiceLineItems.sortOrder)

    const { invoice } = row

    return {
      id: invoice.id,
      invoice_number: invoice.invoiceNumber,
      status: invoice.status,
      client_id: invoice.clientId,
      created_by: invoice.createdBy,
      issued_date: invoice.issuedDate,
      due_date: invoice.dueDate,
      subtotal: invoice.subtotal,
      tax_rate: invoice.taxRate,
      tax_amount: invoice.taxAmount,
      total: invoice.total,
      notes: invoice.notes,
      share_token: invoice.shareToken,
      share_enabled: invoice.shareEnabled,
      billing_type: invoice.billingType,
      viewed_at: invoice.viewedAt,
      viewed_count: invoice.viewedCount,
      stripe_checkout_session_id: invoice.stripeCheckoutSessionId,
      stripe_payment_intent_id: invoice.stripePaymentIntentId,
      paid_at: invoice.paidAt,
      created_at: invoice.createdAt,
      updated_at: invoice.updatedAt,
      deleted_at: invoice.deletedAt,
      client: {
        id: row.client.id,
        name: row.client.name,
        slug: row.client.slug,
        deleted_at: row.client.deletedAt,
      },
      line_items: lineItemRows.map(item => ({
        id: item.id,
        invoice_id: item.invoiceId,
        product_catalog_item_id: item.productCatalogItemId,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        amount: item.amount,
        sort_order: item.sortOrder,
        creates_hour_block: item.createsHourBlock,
        created_at: item.createdAt,
        updated_at: item.updatedAt,
        deleted_at: item.deletedAt,
      })),
    }
  }
)

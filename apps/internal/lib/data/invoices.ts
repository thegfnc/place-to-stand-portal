import 'server-only'

import { and, eq, isNull, sql } from 'drizzle-orm'

import { db } from '@/lib/db'
import {
  clients,
  hourBlocks,
  invoiceLineItems,
  invoices,
} from '@/lib/db/schema'
import { hourBlocksCreatedFromInvoiceEvent } from '@/lib/activity/events'
import { logActivity } from '@/lib/activity/logger'
import { resolveHourBlockBillingMonth } from '@/lib/queries/clients/billing-terms'

/**
 * Creates hour blocks for qualifying invoice line items after payment.
 * Called from the Stripe webhook handler — no auth check needed.
 *
 * Uses ON CONFLICT DO NOTHING on the unique partial index
 * (invoice_line_item_id WHERE deleted_at IS NULL) for idempotency.
 */
export async function createHourBlocksFromInvoice(
  invoiceId: string
): Promise<void> {
  // Fetch invoice with client info
  const [invoice] = await db
    .select({
      id: invoices.id,
      clientId: invoices.clientId,
      billingType: invoices.billingType,
      invoiceNumber: invoices.invoiceNumber,
      createdBy: invoices.createdBy,
      clientName: clients.name,
    })
    .from(invoices)
    .leftJoin(clients, eq(invoices.clientId, clients.id))
    .where(eq(invoices.id, invoiceId))
    .limit(1)

  if (!invoice) {
    console.error(
      `[createHourBlocksFromInvoice] Invoice not found: ${invoiceId}`
    )
    return
  }

  // Net 30 invoices are for work already performed — no hour blocks needed
  if (invoice.billingType === 'net_30') {
    return
  }

  // Fetch qualifying line items
  const lineItems = await db
    .select({
      id: invoiceLineItems.id,
      quantity: invoiceLineItems.quantity,
      description: invoiceLineItems.description,
    })
    .from(invoiceLineItems)
    .where(
      and(
        eq(invoiceLineItems.invoiceId, invoiceId),
        eq(invoiceLineItems.createsHourBlock, true),
        isNull(invoiceLineItems.deletedAt)
      )
    )

  // Filter out zero/negative quantities
  const qualifying = lineItems.filter(item => Number(item.quantity) > 0)

  if (!qualifying.length) {
    return
  }

  // Attribute webhook-created blocks to the first month they can be billed
  // in — clamped forward past a pending prepaid cutover, since no UI warning
  // can reach this path (PRD 002 D13).
  const billingMonth = await resolveHourBlockBillingMonth(invoice.clientId)

  const inserted: Array<{ id: string; hoursPurchased: number }> = []

  for (const item of qualifying) {
    const hoursPurchased = Number(item.quantity).toFixed(2)

    // INSERT with ON CONFLICT DO NOTHING for idempotency. `.returning()` is
    // empty when the conflict fired, so a webhook replay creates (and logs)
    // nothing.
    const rows = await db
      .insert(hourBlocks)
      .values({
        clientId: invoice.clientId,
        hoursPurchased,
        invoiceId: invoice.id,
        invoiceLineItemId: item.id,
        createdBy: invoice.createdBy,
        billingMonth,
      })
      .onConflictDoNothing({
        target: hourBlocks.invoiceLineItemId,
        where: sql`deleted_at IS NULL AND invoice_line_item_id IS NOT NULL`,
      })
      .returning({ id: hourBlocks.id })

    for (const row of rows) {
      inserted.push({ id: row.id, hoursPurchased: Number(hoursPurchased) })
    }
  }

  if (!inserted.length) {
    return
  }

  const event = hourBlocksCreatedFromInvoiceEvent({
    count: inserted.length,
    totalHours: inserted.reduce((sum, row) => sum + row.hoursPurchased, 0),
    invoiceNumber: invoice.invoiceNumber,
    hourBlockIds: inserted.map(row => row.id),
  })

  await logActivity({
    actorId: null,
    source: 'SYSTEM',
    verb: event.verb,
    summary: event.summary,
    targetType: 'HOUR_BLOCK',
    targetId: inserted[0]?.id ?? null,
    targetClientId: invoice.clientId,
    metadata: event.metadata,
  })
}

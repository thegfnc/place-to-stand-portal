'use server'

import crypto from 'node:crypto'

import { revalidatePath } from 'next/cache'
import { and, eq, isNull } from 'drizzle-orm'

import { requireUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { logActivity } from '@/lib/activity/logger'
import { invoiceSentEvent } from '@/lib/activity/events'
import { trackSettingsServerInteraction } from '@/lib/posthog/server'
import { db } from '@/lib/db'
import { invoices, clients } from '@/lib/db/schema'

import { sendSchema } from './schemas'
import type { SendResult, SendInput } from './types'
import { INVOICES_PATH } from './helpers'

export async function sendInvoiceAction(
  input: SendInput,
): Promise<SendResult> {
  return trackSettingsServerInteraction(
    {
      entity: 'invoice',
      mode: 'send',
      targetId: input.id,
    },
    async () => performSendInvoice(input),
  )
}

async function performSendInvoice(
  input: SendInput,
): Promise<SendResult> {
  const user = await requireUser()
  assertAdmin(user)

  const parsed = sendSchema.safeParse(input)

  if (!parsed.success) {
    return { error: 'Invalid send request.' }
  }

  const invoiceId = parsed.data.id

  const existingRows = await db
    .select({
      id: invoices.id,
      status: invoices.status,
      clientId: invoices.clientId,
      invoiceNumber: invoices.invoiceNumber,
      total: invoices.total,
      shareToken: invoices.shareToken,
    })
    .from(invoices)
    .where(eq(invoices.id, invoiceId))
    .limit(1)

  const existing = existingRows[0]

  if (!existing) {
    return { error: 'Invoice not found.' }
  }

  if (existing.status !== 'DRAFT') {
    return { error: 'Only draft invoices can be sent.' }
  }

  const invoiceNumber = existing.invoiceNumber

  if (!invoiceNumber) {
    return { error: 'Invoice is missing an invoice number.' }
  }

  const clientRows = await db
    .select({ name: clients.name })
    .from(clients)
    .where(and(eq(clients.id, existing.clientId), isNull(clients.deletedAt)))
    .limit(1)

  const clientName = clientRows[0]?.name ?? null

  try {
    const today = new Date().toISOString().split('T')[0]!
    // Reuse existing share token if one was already generated (e.g. via
    // "Generate Shareable Link" button) to avoid invalidating copied links.
    const shareToken =
      existing.shareToken ?? crypto.randomUUID().replace(/-/g, '')
    const nowIso = new Date().toISOString()

    await db
      .update(invoices)
      .set({
        status: 'SENT',
        issuedDate: today,
        shareToken,
        shareEnabled: true,
        updatedAt: nowIso,
      })
      .where(eq(invoices.id, invoiceId))

    const event = invoiceSentEvent({
      invoiceNumber,
      clientName,
      total: existing.total,
    })

    await logActivity({
      actorId: user.id,
      actorRole: user.role,
      verb: event.verb,
      summary: event.summary,
      targetType: 'INVOICE',
      targetId: invoiceId,
      targetClientId: existing.clientId,
      metadata: event.metadata,
    })


    revalidatePath(INVOICES_PATH)

    return { invoiceNumber }
  } catch (error) {
    console.error('Failed to send invoice', error)

    return {
      error:
        error instanceof Error
          ? error.message
          : 'Unable to send invoice.',
    }
  }
}

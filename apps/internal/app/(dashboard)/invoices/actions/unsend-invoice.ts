'use server'

import { revalidatePath } from 'next/cache'
import { eq } from 'drizzle-orm'

import { requireUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { logActivity } from '@/lib/activity/logger'
import { ActivityVerbs } from '@/lib/activity/types'
import { trackSettingsServerInteraction } from '@/lib/posthog/server'
import { db } from '@/lib/db'
import { invoices } from '@/lib/db/schema'

import { unsendSchema } from './schemas'
import type { ActionResult, UnsendInput } from './types'
import { INVOICES_PATH } from './helpers'

export async function unsendInvoice(
  input: UnsendInput,
): Promise<ActionResult> {
  return trackSettingsServerInteraction(
    {
      entity: 'invoice',
      mode: 'unsend',
      targetId: input.id,
    },
    async () => performUnsendInvoice(input),
  )
}

async function performUnsendInvoice(
  input: UnsendInput,
): Promise<ActionResult> {
  const user = await requireUser()
  assertAdmin(user)

  const parsed = unsendSchema.safeParse(input)

  if (!parsed.success) {
    return { error: 'Invalid request.' }
  }

  const invoiceId = parsed.data.id

  const existingRows = await db
    .select({
      id: invoices.id,
      status: invoices.status,
      invoiceNumber: invoices.invoiceNumber,
      clientId: invoices.clientId,
    })
    .from(invoices)
    .where(eq(invoices.id, invoiceId))
    .limit(1)

  const existing = existingRows[0]

  if (!existing) {
    return { error: 'Invoice not found.' }
  }

  if (existing.status !== 'SENT') {
    return { error: 'Only sent invoices can be reverted to draft.' }
  }

  try {
    const nowIso = new Date().toISOString()

    await db
      .update(invoices)
      .set({
        status: 'DRAFT',
        issuedDate: null,
        updatedAt: nowIso,
      })
      .where(eq(invoices.id, invoiceId))

    await logActivity({
      actorId: user.id,
      actorRole: user.role,
      verb: ActivityVerbs.INVOICE_UNSENT,
      summary: `Reverted invoice ${existing.invoiceNumber ?? invoiceId} to draft`,
      targetType: 'INVOICE',
      targetId: invoiceId,
      targetClientId: existing.clientId,
      metadata: { invoiceNumber: existing.invoiceNumber },
    })

    revalidatePath(INVOICES_PATH)

    return {}
  } catch (error) {
    console.error('Failed to unsend invoice', error)

    return {
      error:
        error instanceof Error
          ? error.message
          : 'Unable to revert invoice to draft.',
    }
  }
}

import { NextResponse } from 'next/server'
import { eq, sql } from 'drizzle-orm'

import { db } from '@/lib/db'
import { invoices } from '@/lib/db/schema'
import { getStripe } from '@/lib/stripe/client'
import {
  getInvoiceByStripeSession,
  getInvoiceByPaymentIntent,
} from '@/lib/queries/invoices'
import { invoicePaidEvent } from '@/lib/activity/events'
import { logActivity } from '@/lib/activity/logger'
import { createHourBlocksFromInvoice } from '@/lib/data/invoices'
import { notifyInvoicePaid } from '@/lib/notifications/google-chat'

/**
 * Mark an invoice as paid, log activity, and create hour blocks.
 * Shared by both checkout.session.completed and payment_intent.succeeded handlers.
 *
 * Hour block creation is idempotent (ON CONFLICT DO NOTHING), so it runs
 * even when the invoice is already PAID — this ensures retried webhooks
 * can recover from a previous incomplete execution.
 */
async function markInvoicePaid(
  invoice: NonNullable<Awaited<ReturnType<typeof getInvoiceByStripeSession>>>,
  paymentIntentId: string | null
) {
  // Only update status if not already paid
  if (invoice.status !== 'PAID') {
    await db
      .update(invoices)
      .set({
        status: 'PAID',
        stripePaymentIntentId: paymentIntentId,
        paidAt: sql`timezone('utc'::text, now())`,
        updatedAt: sql`timezone('utc'::text, now())`,
      })
      .where(eq(invoices.id, invoice.id))

    // Awaited before the response goes out: a fire-and-forget promise here
    // can be cut off when the serverless function terminates.
    const paidEvent = invoicePaidEvent({
      invoiceNumber: invoice.invoice_number,
      total: invoice.total,
      clientName: invoice.client?.name,
    })

    await logActivity({
      actorId: null,
      source: 'SYSTEM',
      verb: paidEvent.verb,
      summary: paidEvent.summary,
      targetType: 'INVOICE',
      targetId: invoice.id,
      targetClientId: invoice.client_id,
      metadata: paidEvent.metadata,
    })

    // Notify the team in Google Chat (fire-and-forget — non-critical).
    // Guarded by status !== 'PAID' so retried webhooks don't re-notify.
    notifyInvoicePaid({
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoice_number,
      total: invoice.total,
      clientName: invoice.client?.name,
    }).catch(console.error)
  }

  // Always attempt hour block creation — must be awaited so it completes
  // before the serverless function terminates. Safe to run on retries
  // because the insert uses ON CONFLICT DO NOTHING.
  await createHourBlocksFromInvoice(invoice.id)
}

export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!webhookSecret) {
    console.error('[stripe-webhook] STRIPE_WEBHOOK_SECRET is not configured')
    return NextResponse.json(
      { ok: false, error: 'Webhook not configured.' },
      { status: 500 }
    )
  }

  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json(
      { ok: false, error: 'Missing stripe-signature header.' },
      { status: 400 }
    )
  }

  let event

  try {
    const body = await request.text()
    event = getStripe().webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err) {
    console.error('[stripe-webhook] Invalid signature:', err)
    return NextResponse.json(
      { ok: false, error: 'Invalid signature.' },
      { status: 400 }
    )
  }

  try {
    switch (event.type) {
      // PaymentIntent flow (Payment Element)
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object

        // Look up invoice by the payment intent ID stored on the invoice
        const invoice = await getInvoiceByPaymentIntent(paymentIntent.id)

        if (!invoice) {
          console.error(
            '[stripe-webhook] Invoice not found for payment_intent:',
            paymentIntent.id
          )
          return NextResponse.json({ ok: true, received: true })
        }

        await markInvoicePaid(invoice, paymentIntent.id)
        break
      }

      // Checkout Session flow (legacy / Embedded Checkout)
      case 'checkout.session.completed': {
        const session = event.data.object

        const invoiceId =
          session.metadata?.invoiceId ?? session.client_reference_id

        if (!invoiceId) {
          console.error(
            '[stripe-webhook] No invoiceId in session metadata or client_reference_id'
          )
          return NextResponse.json({ ok: true, received: true })
        }

        const invoice = await getInvoiceByStripeSession(session.id)

        if (!invoice) {
          console.error(
            '[stripe-webhook] Invoice not found for session:',
            session.id
          )
          return NextResponse.json({ ok: true, received: true })
        }

        const paymentIntentId =
          typeof session.payment_intent === 'string'
            ? session.payment_intent
            : session.payment_intent?.id ?? null

        await markInvoicePaid(invoice, paymentIntentId)
        break
      }

      case 'checkout.session.expired': {
        const session = event.data.object

        // Clear the checkout session ID so a new one can be created
        if (session.id) {
          await db
            .update(invoices)
            .set({
              stripeCheckoutSessionId: null,
              updatedAt: sql`timezone('utc'::text, now())`,
            })
            .where(eq(invoices.stripeCheckoutSessionId, session.id))
        }

        break
      }

      default:
        // Return 200 for unknown events
        break
    }

    return NextResponse.json({ ok: true, received: true })
  } catch (err) {
    console.error('[stripe-webhook] Error processing event:', err)
    return NextResponse.json(
      { ok: false, error: 'Webhook processing failed.' },
      { status: 500 }
    )
  }
}

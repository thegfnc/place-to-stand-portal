import { Download } from 'lucide-react'

import { authSecondaryButtonClass } from '@pts/ui/auth-shell'
import { BlueprintCorners } from '@pts/ui/brand'

import { serverEnv } from '@/lib/env.server'
import type { InvoiceWithLineItems } from '@/lib/invoices/invoice-form'
import { cn } from '@/lib/utils'

import { PublicHeader } from '../../../_components/public-header'
import { InvoiceDocument } from './invoice-document'
import { InvoiceNotices } from './invoice-notices'
import { isStripeConfigured, PaymentPanel } from './payment-panel'
import { ReceiptPanel } from './receipt-panel'
import { DARK_LABEL } from './styles'

type PublicInvoiceProps = {
  invoice: InvoiceWithLineItems
  shareToken: string
  paymentStatus?: 'success' | 'cancelled' | null
}

export function PublicInvoice({
  invoice,
  shareToken,
  paymentStatus,
}: PublicInvoiceProps) {
  const isDraft = invoice.status === 'DRAFT'
  const isVoid = invoice.status === 'VOID'
  // When redirected back from Stripe with success, treat as paid even if the
  // webhook hasn't updated the DB status yet (race between redirect & webhook).
  const isPaid = invoice.status === 'PAID' || paymentStatus === 'success'
  const isPayable =
    !isPaid && (invoice.status === 'SENT' || invoice.status === 'VIEWED')
  const showPayment = isPayable && isStripeConfigured
  const replyTo = serverEnv.RESEND_REPLY_TO_EMAIL

  return (
    <>
      <PublicHeader>
        {invoice.invoice_number ? (
          <span className='hidden font-mono text-[11px] tracking-[0.1em] text-[#a8a8ac] uppercase sm:inline'>
            Invoice {invoice.invoice_number}
          </span>
        ) : null}
      </PublicHeader>

      <main className='mx-auto w-full max-w-6xl flex-1 px-4 pt-6 sm:px-6 sm:pt-14 lg:px-12'>
        <InvoiceNotices
          paymentCancelled={paymentStatus === 'cancelled'}
          isDraft={isDraft}
          isVoid={isVoid}
        />

        <div className='grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-8'>
          <InvoiceDocument invoice={invoice} isPaid={isPaid} isVoid={isVoid} />

          {/* Panel and download stick together as one column on desktop. */}
          <div className='flex flex-col gap-3 lg:sticky lg:top-6'>
            <aside className='relative flex flex-col gap-6 border border-[#2a2b30] bg-[rgba(22,24,28,0.88)] px-5 py-6 sm:p-7'>
              <BlueprintCorners size={12} className='border-[#b5f542]/50' />

              {isPaid ? (
                <ReceiptPanel total={invoice.total} paidAt={invoice.paid_at} />
              ) : showPayment ? (
                <PaymentPanel
                  total={invoice.total}
                  shareToken={shareToken}
                  isPrepaid={invoice.billing_type === 'prepaid'}
                />
              ) : null}

              {/* The receipt's rows end on their own rule; only the payment form needs a divider here. */}
              <div
                className={cn(
                  'flex flex-col gap-1.5',
                  isPaid && 'pt-5',
                  showPayment && 'border-t border-[#2a2b30] pt-5'
                )}
              >
                <span className={DARK_LABEL}>Questions?</span>
                <span className='text-sm text-[#a8a8ac]'>
                  Email{' '}
                  <a
                    href={`mailto:${replyTo}`}
                    className='font-mono text-[13px] text-[#e8e6e3] underline-offset-4 transition-colors hover:text-[#b5f542] hover:underline'
                  >
                    {replyTo}
                  </a>
                </span>
              </div>
            </aside>

            {/* The PDF route 404s drafts, so the button hides with them. */}
            {isDraft ? null : (
              <a
                href={`/api/public/invoices/${shareToken}/pdf?download=1`}
                download
                className={cn(authSecondaryButtonClass, 'h-11')}
              >
                <Download className='size-4' strokeWidth={1.5} />
                Download PDF
              </a>
            )}
          </div>
        </div>
      </main>
    </>
  )
}

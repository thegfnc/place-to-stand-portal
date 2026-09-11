import { BlueprintCorners } from '@pts/ui/brand'

import type { InvoiceWithLineItems } from '@/lib/invoices/invoice-form'
import { cn } from '@/lib/utils'

import { formatCurrency, formatDate, formatTaxRate } from './format'
import { InvoiceLineItems } from './invoice-line-items'
import { HEADLINE_FONT, PAPER_LABEL, SECTION_LABEL } from './styles'

type Props = {
  invoice: InvoiceWithLineItems
  isPaid: boolean
  isVoid: boolean
}

/**
 * The invoice itself, as a white document on the dark page — the same layout
 * the PDF prints (`packages/pdf/src/invoice-pdf.ts`), so what a client sees
 * online matches what they download.
 */
export function InvoiceDocument({ invoice, isPaid, isVoid }: Props) {
  const lineItems = invoice.line_items.filter(item => !item.deleted_at)
  const hasTax = Boolean(invoice.tax_rate && Number(invoice.tax_rate) > 0)
  const issued = formatDate(invoice.issued_date)
  const totalLabel = isPaid ? 'Paid in full' : isVoid ? 'Total' : 'Total due'

  return (
    <article
      className={cn(
        'relative bg-white px-6 pt-7 pb-6 text-[#0e0f11] sm:px-14 sm:pt-12 sm:pb-10',
        isVoid && 'opacity-60'
      )}
    >
      <BlueprintCorners size={16} className='border-[#b5f542]' />

      {/* No logo on the document itself: the page header carries it. The PDF keeps one. */}
      <div className='flex items-end justify-between gap-6'>
        <div className='flex flex-col gap-3'>
          <span className={SECTION_LABEL}>Invoice</span>
          <h1
            className={cn(
              HEADLINE_FONT,
              'text-[28px] leading-none font-bold tracking-[-0.03em] sm:text-4xl'
            )}
          >
            {invoice.invoice_number ?? 'Invoice'}
          </h1>
        </div>
        {isPaid ? (
          <StatusStamp
            tone='paid'
            detail={formatDate(invoice.paid_at, 'short')}
          />
        ) : isVoid ? (
          <StatusStamp tone='void' />
        ) : null}
      </div>

      <dl className='mt-6 grid grid-cols-1 sm:mt-9 sm:grid-cols-2 sm:gap-6'>
        {invoice.client?.name ? (
          <MetaField label='Billed to' value={invoice.client.name} />
        ) : null}
        {issued ? <MetaField label='Issued' value={issued} /> : null}
      </dl>

      <InvoiceLineItems items={lineItems} />

      <div className='mt-4 flex justify-end sm:mt-5'>
        <div className='flex w-full flex-col gap-2.5 sm:w-[280px]'>
          {hasTax ? (
            <>
              <TotalsRow label='Subtotal' value={invoice.subtotal} />
              <TotalsRow
                label={`Tax (${formatTaxRate(invoice.tax_rate)}%)`}
                value={invoice.tax_amount}
              />
            </>
          ) : null}
          <div className='mt-1 flex items-baseline justify-between bg-[#b5f542] px-3.5 py-3'>
            <span className='font-mono text-[11px] tracking-[0.1em] uppercase'>
              {totalLabel}
            </span>
            <span
              className={cn(
                HEADLINE_FONT,
                'text-xl leading-none font-bold tracking-[-0.02em] tabular-nums sm:text-[22px]'
              )}
            >
              {formatCurrency(invoice.total)}
            </span>
          </div>
        </div>
      </div>

      {invoice.notes ? (
        <div className='mt-7 flex flex-col gap-2 sm:mt-10 sm:gap-2.5'>
          <span className={SECTION_LABEL}>Notes</span>
          <p className='max-w-[520px] text-[13px] leading-[1.55] whitespace-pre-wrap text-[#3a3b40] sm:text-sm'>
            {invoice.notes}
          </p>
        </div>
      ) : null}

      <div className='mt-7 flex justify-between border-t border-[#e4e4e7] pt-3 font-mono text-[10px] tracking-[0.1em] text-[#5b5d63] uppercase sm:mt-12 sm:pt-3.5 sm:text-[11px]'>
        <span>Place To Stand · placetostandagency.com</span>
        <span className='hidden sm:inline'>{invoice.invoice_number}</span>
      </div>
    </article>
  )
}

/**
 * Label above value in columns from `sm` up; label left, value right on
 * phones. The first row always carries the heavy ink rule.
 */
function MetaField({ label, value }: { label: string; value: string }) {
  return (
    <div className='flex items-baseline justify-between border-t border-[#e4e4e7] py-2.5 first:border-t-[1.5px] first:border-[#0e0f11] sm:flex-col sm:items-start sm:justify-start sm:gap-1.5 sm:border-t-[1.5px] sm:border-[#0e0f11] sm:pt-3 sm:pb-0'>
      <dt className={PAPER_LABEL}>{label}</dt>
      <dd className='text-sm font-medium sm:text-[15px]'>{value}</dd>
    </div>
  )
}

function TotalsRow({ label, value }: { label: string; value: string }) {
  return (
    <div className='flex justify-between text-sm text-[#3a3b40]'>
      <span>{label}</span>
      <span className='font-mono tabular-nums'>{formatCurrency(value)}</span>
    </div>
  )
}

/** Replaces the watermark: a ruled stamp beside the invoice number. */
function StatusStamp({
  tone,
  detail,
}: {
  tone: 'paid' | 'void'
  detail?: string | null
}) {
  return (
    <div
      className={cn(
        'flex shrink-0 flex-col items-center gap-1 border-[1.5px] px-4 py-2.5 sm:px-[18px]',
        tone === 'paid'
          ? 'border-[#65a30d] text-[#4d7c0f]'
          : 'border-[#dc2626] text-[#b91c1c]'
      )}
    >
      <span
        className={cn(
          HEADLINE_FONT,
          'text-lg leading-none font-bold tracking-[0.12em] uppercase sm:text-[22px]'
        )}
      >
        {tone === 'paid' ? 'Paid' : 'Void'}
      </span>
      {detail ? (
        <span className='font-mono text-[10px] tracking-[0.1em] uppercase'>
          {detail}
        </span>
      ) : null}
    </div>
  )
}

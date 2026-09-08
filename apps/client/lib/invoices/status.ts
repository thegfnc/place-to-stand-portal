/**
 * Client-facing subset of the internal app's invoice status presentation
 * (`apps/internal/app/(dashboard)/invoices/_components/invoices-table-section.tsx`).
 *
 * DRAFT is intentionally absent — drafts are filtered out in the query and are
 * never surfaced in the portal. SENT and VIEWED both read as "Due": the
 * distinction between them tracks whether *we* have seen the client open the
 * invoice, which is not information the client needs about their own invoice.
 */
const INVOICE_STATUS_LABELS = {
  SENT: 'Due',
  VIEWED: 'Due',
  PAID: 'Paid',
  VOID: 'Void',
} as const

const INVOICE_STATUS_TOKENS = {
  SENT: 'border-transparent bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200',
  VIEWED:
    'border-transparent bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200',
  PAID: 'border-transparent bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
  VOID: 'border-transparent bg-slate-200 text-slate-700 dark:bg-slate-700/60 dark:text-slate-200',
} as const

type ClientInvoiceStatus = keyof typeof INVOICE_STATUS_LABELS

export function getInvoiceStatusLabel(value: string): string {
  return value in INVOICE_STATUS_LABELS
    ? INVOICE_STATUS_LABELS[value as ClientInvoiceStatus]
    : value
}

export function getInvoiceStatusToken(value: string): string {
  return value in INVOICE_STATUS_TOKENS
    ? INVOICE_STATUS_TOKENS[value as ClientInvoiceStatus]
    : 'border border-border bg-accent text-accent-foreground'
}

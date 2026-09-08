import { invoiceStatus } from '@/lib/db/schema'
import { parseSortParam, type ParsedSort } from '@/lib/pagination/sort'

export const INVOICE_STATUS_VALUES = invoiceStatus.enumValues

export type InvoiceStatusValue = (typeof INVOICE_STATUS_VALUES)[number]

export const INVOICE_STATUS_LABELS: Record<InvoiceStatusValue, string> = {
  DRAFT: 'Draft',
  SENT: 'Sent',
  VIEWED: 'Viewed',
  PAID: 'Paid',
  VOID: 'Void',
}

export function isInvoiceStatus(
  value: string | undefined
): value is InvoiceStatusValue {
  return (
    typeof value === 'string' &&
    (INVOICE_STATUS_VALUES as readonly string[]).includes(value)
  )
}

// PRD 004 §03: per-view sort allowlist (D6/R5). Offset pagination — each
// field maps to an ORDER BY swap in `listInvoices`.
const INVOICE_SORT_FIELDS = ['created', 'number'] as const
export type InvoiceSortField = (typeof INVOICE_SORT_FIELDS)[number]

export const DEFAULT_INVOICES_SORT = {
  field: 'created',
  direction: 'desc',
} as const satisfies ParsedSort<InvoiceSortField>

export function isInvoiceSortValue(value: string): boolean {
  const [field, direction] = value.split(':')
  return (
    (INVOICE_SORT_FIELDS as readonly string[]).includes(field) &&
    (direction === 'asc' || direction === 'desc')
  )
}

type RawSearchParams = Record<string, string | string[] | undefined>

export type InvoicesSearchParams = {
  page: number
  status: InvoiceStatusValue | undefined
  search: string | undefined
  sort: ParsedSort<InvoiceSortField>
}

function firstParam(value: string | string[] | undefined): string | undefined {
  if (typeof value === 'string') {
    return value
  }
  if (Array.isArray(value)) {
    return value[0]
  }
  return undefined
}

/**
 * Shared searchParams parsing for the invoices pages. Invalid status values
 * fail the type guard and are treated as unset (R4).
 */
export function parseInvoicesSearchParams(
  params: RawSearchParams
): InvoicesSearchParams {
  const page = Math.max(1, Number.parseInt(firstParam(params.page) ?? '1', 10) || 1)
  const statusParam = firstParam(params.status)
  const searchParam = firstParam(params.q)?.trim()
  const sort = parseSortParam(
    firstParam(params.sort),
    INVOICE_SORT_FIELDS,
    DEFAULT_INVOICES_SORT
  )

  return {
    page,
    status: isInvoiceStatus(statusParam) ? statusParam : undefined,
    search: searchParam || undefined,
    sort,
  }
}

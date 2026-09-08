import type { ClientRow, HourBlockInvoiceRow } from './hour-block-form'

export type ClientOption = {
  value: string
  label: string
  keywords: string[]
}

export type InvoiceOption = {
  value: string
  label: string
  description?: string
  keywords: string[]
}

export const buildClientOptions = (clients: ClientRow[]): ClientOption[] =>
  clients.map(client => ({
    value: client.id,
    label: client.deleted_at ? `${client.name} (Archived)` : client.name,
    keywords: client.deleted_at ? [client.name, 'archived'] : [client.name],
  }))

const NO_INVOICE_OPTION: InvoiceOption = {
  value: '',
  label: 'No invoice',
  keywords: ['none', 'no invoice'],
}

const formatStatus = (status: string) =>
  status.charAt(0) + status.slice(1).toLowerCase()

const formatTotal = (total: number) =>
  total.toLocaleString('en-US', { style: 'currency', currency: 'USD' })

/**
 * Invoice picker options, scoped to the selected client so a block can't be
 * linked to another client's invoice. The block's current invoice is always
 * included even if it fell out of the directory (archived invoice) so an
 * existing link stays visible in the edit sheet.
 */
export const buildInvoiceOptions = (
  invoices: HourBlockInvoiceRow[],
  selectedClientId: string | null,
  currentInvoiceId: string | null
): InvoiceOption[] => {
  const scoped = invoices.filter(
    invoice =>
      (!selectedClientId || invoice.client_id === selectedClientId) ||
      invoice.id === currentInvoiceId
  )

  return [
    NO_INVOICE_OPTION,
    ...scoped.map(invoice => ({
      value: invoice.id,
      label: invoice.invoice_number,
      description: [
        invoice.client_name,
        formatStatus(invoice.status),
        invoice.total > 0 ? formatTotal(invoice.total) : null,
      ]
        .filter(Boolean)
        .join(' · '),
      keywords: [
        invoice.invoice_number,
        invoice.client_name ?? '',
        invoice.status,
      ].filter(Boolean),
    })),
  ]
}

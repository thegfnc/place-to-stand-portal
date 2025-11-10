export const HOUR_BLOCKS_SETTINGS_PATH = '/settings/hour-blocks'

export function normalizeInvoiceNumber(
  invoiceNumber: string | null | undefined,
): string | null {
  if (!invoiceNumber) {
    return null
  }

  const trimmed = invoiceNumber.trim()
  return trimmed.length > 0 ? trimmed : null
}

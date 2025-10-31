import type {
  SupabaseQueryError,
  SupabaseServerClient,
  ClientSummary,
  HourBlockWithClient,
} from './types'

export const HOUR_BLOCKS_SETTINGS_PATH = '/settings/hour-blocks'

export function normalizeInvoiceNumber(
  invoiceNumber: string | null | undefined
): string | null {
  if (!invoiceNumber) {
    return null
  }

  const trimmed = invoiceNumber.trim()
  return trimmed.length > 0 ? trimmed : null
}

export async function fetchActiveClient(
  supabase: SupabaseServerClient,
  clientId: string
): Promise<{ client: ClientSummary | null; error: SupabaseQueryError }> {
  const result = await supabase
    .from('clients')
    .select('id, name')
    .eq('id', clientId)
    .is('deleted_at', null)
    .maybeSingle()

  return {
    client: result.data ? { id: result.data.id, name: result.data.name } : null,
    error: result.error,
  }
}

export async function fetchHourBlockWithClient(
  supabase: SupabaseServerClient,
  hourBlockId: string
): Promise<{
  hourBlock: HourBlockWithClient | null
  error: SupabaseQueryError
}> {
  const result = await supabase
    .from('hour_blocks')
    .select(
      `
        id,
        client_id,
        hours_purchased,
        invoice_number,
        deleted_at,
        client:clients ( name )
      `
    )
    .eq('id', hourBlockId)
    .maybeSingle()

  return {
    hourBlock: (result.data as HourBlockWithClient | null) ?? null,
    error: result.error,
  }
}

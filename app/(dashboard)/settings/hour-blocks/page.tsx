import type { Metadata } from 'next'

import { HourBlocksSettingsTable } from './hour-blocks-table'
import { requireRole } from '@/lib/auth/session'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import type { Database } from '@/supabase/types/database'

type HourBlockRow = Database['public']['Tables']['hour_blocks']['Row']
type ClientRow = Pick<
  Database['public']['Tables']['clients']['Row'],
  'id' | 'name' | 'deleted_at'
>

type HourBlockWithClient = HourBlockRow & { client: ClientRow | null }

export const metadata: Metadata = {
  title: 'Hour Blocks | Settings',
}

export default async function HourBlocksSettingsPage() {
  await requireRole('ADMIN')

  const supabase = getSupabaseServiceClient()

  const [
    { data: hourBlocks, error: hourBlocksError },
    { data: clients, error: clientsError },
  ] = await Promise.all([
    supabase
      .from('hour_blocks')
      .select(
        `
        id,
        client_id,
        hours_purchased,
        invoice_number,
        created_by,
        created_at,
        updated_at,
        deleted_at,
        client:clients (
          id,
          name,
          deleted_at
        )
      `
      )
      .order('updated_at', { ascending: false }),
    supabase.from('clients').select('id, name, deleted_at').order('name'),
  ])

  if (hourBlocksError) {
    console.error('Failed to load hour blocks for settings', hourBlocksError)
  }

  if (clientsError) {
    console.error(
      'Failed to load clients for hour block settings',
      clientsError
    )
  }

  return (
    <HourBlocksSettingsTable
      hourBlocks={(hourBlocks ?? []) as HourBlockWithClient[]}
      clients={(clients ?? []) as ClientRow[]}
    />
  )
}

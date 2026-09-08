import { NextResponse } from 'next/server'

import { requireUser } from '@/lib/auth/session'
import { listIntegrationConnections } from '@/lib/integrations/connections'
import { resolveProviderParam } from '@/lib/integrations/route-helpers'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ provider: string }> }
) {
  const user = await requireUser()
  const resolved = resolveProviderParam((await params).provider)
  if ('response' in resolved) {
    return resolved.response
  }

  const accounts = await listIntegrationConnections(user.id, resolved.provider)

  return NextResponse.json({
    connected: accounts.some(account => account.status === 'ACTIVE'),
    accounts,
  })
}

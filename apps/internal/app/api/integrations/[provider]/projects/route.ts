import { NextResponse } from 'next/server'

import { requireRole } from '@/lib/auth/session'
import { listExternalProjectsForUser } from '@/lib/integrations/connections'
import {
  integrationErrorResponse,
  resolveProviderParam,
} from '@/lib/integrations/route-helpers'

/** Every external project the signed-in staff member's tokens can see. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ provider: string }> }
) {
  const user = await requireRole('ADMIN')
  const resolved = resolveProviderParam((await params).provider)
  if ('response' in resolved) {
    return resolved.response
  }

  try {
    const projects = await listExternalProjectsForUser(
      user.id,
      resolved.provider
    )
    return NextResponse.json({ ok: true, data: projects })
  } catch (error) {
    return integrationErrorResponse(error)
  }
}

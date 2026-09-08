import { NextResponse } from 'next/server'
import { z } from 'zod'

import { requireUser } from '@/lib/auth/session'
import { connectIntegrationWithToken } from '@/lib/integrations/connections'
import {
  integrationErrorResponse,
  resolveProviderParam,
} from '@/lib/integrations/route-helpers'

const bodySchema = z.object({
  token: z.string().trim().min(8, 'Token is required'),
})

export async function POST(
  request: Request,
  { params }: { params: Promise<{ provider: string }> }
) {
  const user = await requireUser()
  const resolved = resolveProviderParam((await params).provider)
  if ('response' in resolved) {
    return resolved.response
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: 'Token is required' },
      { status: 400 }
    )
  }

  try {
    const account = await connectIntegrationWithToken(
      user,
      resolved.provider,
      parsed.data.token
    )
    return NextResponse.json({ ok: true, data: account })
  } catch (error) {
    return integrationErrorResponse(error)
  }
}

import { NextResponse } from 'next/server'
import { z } from 'zod'

import { ensureProjectAccess } from '@/lib/auth/permissions'
import { requireRole } from '@/lib/auth/session'
import {
  getProjectIntegrationLinks,
  linkExternalProject,
} from '@/lib/data/project-integration-links'
import { listExternalProjectsForUser } from '@/lib/integrations/connections'
import { integrationErrorResponse } from '@/lib/integrations/route-helpers'
import { NotFoundError } from '@/lib/errors/http'

const linkSchema = z.object({
  provider: z.enum(['VERCEL', 'SUPABASE']),
  externalId: z.string().trim().min(1),
})

type RouteContext = { params: Promise<{ projectId: string }> }

export async function GET(_request: Request, { params }: RouteContext) {
  const user = await requireRole('ADMIN')
  const { projectId } = await params

  try {
    await ensureProjectAccess(user, projectId)
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json(
        { ok: false, error: 'Project not found' },
        { status: 404 }
      )
    }
    throw error
  }

  const links = await getProjectIntegrationLinks(projectId)
  return NextResponse.json({ ok: true, data: links })
}

/**
 * Links an external project by id. The option is re-resolved from the
 * caller's own connections rather than trusted from the body, so a link can
 * only be created for a project the staff member can actually see.
 */
export async function POST(request: Request, { params }: RouteContext) {
  const user = await requireRole('ADMIN')
  const { projectId } = await params

  try {
    await ensureProjectAccess(user, projectId)
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json(
        { ok: false, error: 'Project not found' },
        { status: 404 }
      )
    }
    throw error
  }

  const parsed = linkSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: 'provider and externalId are required' },
      { status: 400 }
    )
  }

  try {
    const options = await listExternalProjectsForUser(
      user.id,
      parsed.data.provider
    )
    const option = options.find(
      candidate => candidate.externalId === parsed.data.externalId
    )
    if (!option) {
      return NextResponse.json(
        {
          ok: false,
          error: 'That project is not visible to your connected accounts',
        },
        { status: 404 }
      )
    }

    const link = await linkExternalProject(projectId, option, user.id)
    return NextResponse.json({ ok: true, data: link })
  } catch (error) {
    return integrationErrorResponse(error)
  }
}

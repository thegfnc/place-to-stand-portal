import { NextResponse } from 'next/server'

import { requireRole } from '@/lib/auth/session'
import {
  getIntegrationLinkById,
  unlinkExternalProject,
} from '@/lib/data/project-integration-links'

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ projectId: string; linkId: string }> }
) {
  const user = await requireRole('ADMIN')
  const { projectId, linkId } = await params

  const link = await getIntegrationLinkById(linkId)
  if (!link) {
    return NextResponse.json(
      { ok: false, error: 'Link not found' },
      { status: 404 }
    )
  }
  if (link.projectId !== projectId) {
    return NextResponse.json(
      { ok: false, error: 'Link does not belong to this project' },
      { status: 403 }
    )
  }

  await unlinkExternalProject(link, user.id)
  return NextResponse.json({ ok: true, success: true })
}

import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/session'
import { unlinkRepo, getRepoLinkById } from '@/lib/data/github-repos'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; linkId: string }> }
) {
  const user = await requireRole('ADMIN')
  const { projectId, linkId } = await params

  try {
    // Verify the link belongs to this project
    const link = await getRepoLinkById(linkId)
    if (!link) {
      return NextResponse.json({ error: 'Link not found' }, { status: 404 })
    }
    if (link.projectId !== projectId) {
      return NextResponse.json({ error: 'Link does not belong to this project' }, { status: 403 })
    }

    await unlinkRepo(linkId, user.id)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error unlinking repo:', error)
    return NextResponse.json({ error: 'Failed to unlink repository' }, { status: 500 })
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; linkId: string }> }
) {
  await requireRole('ADMIN')
  const { projectId, linkId } = await params

  const link = await getRepoLinkById(linkId)
  if (!link) {
    return NextResponse.json({ error: 'Link not found' }, { status: 404 })
  }
  if (link.projectId !== projectId) {
    return NextResponse.json({ error: 'Link does not belong to this project' }, { status: 403 })
  }

  return NextResponse.json({ link })
}

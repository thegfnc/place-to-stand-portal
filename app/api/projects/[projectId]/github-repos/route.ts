import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRole } from '@/lib/auth/session'
import { getProjectRepos, linkRepoToProject } from '@/lib/data/github-repos'
import { getRepo, getDefaultConnectionId } from '@/lib/github/client'

const linkSchema = z.object({
  repoFullName: z.string().regex(/^[^/]+\/[^/]+$/, 'Invalid repo format (expected owner/repo)'),
  connectionId: z.string().uuid().optional(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  await requireRole('ADMIN')
  const { projectId } = await params

  const repos = await getProjectRepos(projectId)

  return NextResponse.json({ repos })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const user = await requireRole('ADMIN')
  const { projectId } = await params

  const body = await request.json()
  const result = linkSchema.safeParse(body)

  if (!result.success) {
    return NextResponse.json(
      { error: 'Invalid repo format', details: result.error.flatten() },
      { status: 400 }
    )
  }

  const [owner, name] = result.data.repoFullName.split('/')

  try {
    // Get connection ID (use provided or default)
    const connectionId = result.data.connectionId ?? await getDefaultConnectionId(user.id)

    if (!connectionId) {
      return NextResponse.json(
        { error: 'No GitHub account connected', code: 'NOT_CONNECTED' },
        { status: 401 }
      )
    }

    // Verify repo exists and get details
    const repoDetails = await getRepo(user.id, owner, name, connectionId)

    const link = await linkRepoToProject(
      projectId,
      {
        oauthConnectionId: connectionId,
        repoOwner: repoDetails.owner.login,
        repoName: repoDetails.name,
        repoFullName: repoDetails.full_name,
        repoId: repoDetails.id,
        defaultBranch: repoDetails.default_branch,
      },
      user.id
    )

    return NextResponse.json({ success: true, link })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('unique')) {
        return NextResponse.json(
          { error: 'Repository already linked to this project' },
          { status: 400 }
        )
      }
      if (error.message.includes('No active GitHub')) {
        return NextResponse.json(
          { error: 'No GitHub account connected', code: 'NOT_CONNECTED' },
          { status: 401 }
        )
      }
      if (error.message.includes('GitHub API error (404)')) {
        return NextResponse.json(
          { error: 'Repository not found or no access' },
          { status: 404 }
        )
      }
    }
    console.error('Error linking repo:', error)
    return NextResponse.json({ error: 'Failed to link repository' }, { status: 500 })
  }
}

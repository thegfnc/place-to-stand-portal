import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/session'
import { listUserRepos, getDefaultConnectionId } from '@/lib/github/client'

export async function GET(request: NextRequest) {
  const user = await requireRole('ADMIN')
  const { searchParams } = new URL(request.url)
  const connectionId = searchParams.get('connectionId') ?? undefined

  try {
    // If no connection specified, try to get default
    const effectiveConnectionId = connectionId ?? await getDefaultConnectionId(user.id)

    if (!effectiveConnectionId) {
      return NextResponse.json(
        { error: 'GitHub not connected', code: 'NOT_CONNECTED' },
        { status: 401 }
      )
    }

    const repos = await listUserRepos(user.id, { connectionId: effectiveConnectionId })

    return NextResponse.json({
      repos: repos.map(r => ({
        id: r.id,
        name: r.name,
        fullName: r.full_name,
        owner: r.owner.login,
        ownerAvatar: r.owner.avatar_url,
        defaultBranch: r.default_branch,
        private: r.private,
        description: r.description,
        url: r.html_url,
      })),
      connectionId: effectiveConnectionId,
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('No active GitHub')) {
      return NextResponse.json(
        { error: 'GitHub not connected', code: 'NOT_CONNECTED' },
        { status: 401 }
      )
    }
    console.error('Error fetching GitHub repos:', error)
    return NextResponse.json({ error: 'Failed to fetch repos' }, { status: 500 })
  }
}

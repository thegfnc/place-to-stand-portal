import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/session'
import { listBranches } from '@/lib/github/client'

/**
 * GET /api/github/repos/[owner]/[repo]/branches
 * List branches for a GitHub repository
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ owner: string; repo: string }> }
) {
  const user = await requireRole('ADMIN')
  const { owner, repo } = await params

  try {
    const branches = await listBranches(user.id, owner, repo)

    return NextResponse.json({
      branches: branches.map(b => ({
        name: b.name,
        protected: b.protected,
      })),
    })
  } catch (error) {
    console.error('Failed to list branches:', error)
    return NextResponse.json(
      { error: 'Failed to list branches' },
      { status: 500 }
    )
  }
}

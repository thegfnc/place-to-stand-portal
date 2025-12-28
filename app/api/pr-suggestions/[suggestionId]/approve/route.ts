import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRole } from '@/lib/auth/session'
import { approveSuggestion } from '@/lib/data/suggestions'
import type { ApprovePRModifications } from '@/lib/data/suggestions'

const schema = z.object({
  title: z.string().min(1).max(100).optional(),
  body: z.string().max(10000).optional(),
  branch: z.string().max(100).optional(),
  baseBranch: z.string().max(100).optional(),
  createNewBranch: z.boolean().optional(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ suggestionId: string }> }
) {
  const user = await requireRole('ADMIN')
  const { suggestionId } = await params

  const body = await request.json().catch(() => ({}))
  const result = schema.safeParse(body)

  if (!result.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const modifications: ApprovePRModifications | undefined = Object.keys(result.data).length > 0
    ? result.data
    : undefined

  try {
    const pr = await approveSuggestion(suggestionId, user.id, modifications)

    return NextResponse.json({
      success: true,
      prNumber: pr.prNumber,
      prUrl: pr.prUrl,
    })
  } catch (error) {
    console.error('PR approval error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create PR' },
      { status: 400 }
    )
  }
}

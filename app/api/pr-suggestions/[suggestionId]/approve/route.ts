import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRole } from '@/lib/auth/session'
import { approvePRSuggestion } from '@/lib/data/pr-suggestions'

const schema = z.object({
  title: z.string().min(1).max(100).optional(),
  body: z.string().max(10000).optional(),
  branch: z.string().min(1).max(100).optional(),
  baseBranch: z.string().min(1).max(100).optional(),
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
    return NextResponse.json(
      { error: 'Invalid request', details: result.error.flatten() },
      { status: 400 }
    )
  }

  const modifications = result.data
  const hasModifications = Object.keys(modifications).length > 0

  try {
    const prResult = await approvePRSuggestion(
      suggestionId,
      user.id,
      hasModifications ? modifications : undefined
    )

    return NextResponse.json({
      success: true,
      prNumber: prResult.prNumber,
      prUrl: prResult.prUrl,
    })
  } catch (error) {
    console.error('Error approving PR suggestion:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create PR' },
      { status: 400 }
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/session'
import { createSuggestionsFromEmail } from '@/lib/ai/suggestion-service'

type RouteParams = { params: Promise<{ emailId: string }> }

export async function POST(request: NextRequest, { params }: RouteParams) {
  const user = await requireRole('ADMIN')
  const { emailId } = await params

  try {
    const result = await createSuggestionsFromEmail(emailId, user.id)

    return NextResponse.json({
      success: true,
      created: result.created,
      skipped: result.skipped,
      reason: result.reason,
    })
  } catch (error) {
    console.error('Email analysis error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Analysis failed' },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/session'
import { createSuggestionsFromMessage } from '@/lib/ai/suggestion-service'

type RouteParams = { params: Promise<{ emailId: string }> }

export async function POST(request: NextRequest, { params }: RouteParams) {
  const user = await requireRole('ADMIN')
  const { emailId } = await params

  try {
    // emailId is now messageId in the new schema
    const result = await createSuggestionsFromMessage(emailId, user.id)

    return NextResponse.json({
      success: true,
      created: result.created,
      skipped: result.skipped,
      reason: result.reason,
    })
  } catch (error) {
    console.error('Message analysis error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Analysis failed' },
      { status: 500 }
    )
  }
}

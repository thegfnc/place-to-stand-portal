import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/session'
import { rejectPRSuggestion } from '@/lib/data/pr-suggestions'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ suggestionId: string }> }
) {
  const user = await requireRole('ADMIN')
  const { suggestionId } = await params

  try {
    await rejectPRSuggestion(suggestionId, user.id)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error rejecting PR suggestion:', error)
    return NextResponse.json(
      { error: 'Failed to reject suggestion' },
      { status: 400 }
    )
  }
}

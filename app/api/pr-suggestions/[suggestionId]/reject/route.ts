import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/session'
import { rejectSuggestion } from '@/lib/data/suggestions'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ suggestionId: string }> }
) {
  const user = await requireRole('ADMIN')
  const { suggestionId } = await params

  try {
    await rejectSuggestion(suggestionId, user.id)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('PR rejection error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to reject' },
      { status: 400 }
    )
  }
}

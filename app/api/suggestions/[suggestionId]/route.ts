import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/session'
import { getSuggestionById } from '@/lib/data/suggestions'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ suggestionId: string }> }
) {
  await requireRole('ADMIN')
  const { suggestionId } = await params

  const suggestion = await getSuggestionById(suggestionId)

  if (!suggestion) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json(suggestion)
}

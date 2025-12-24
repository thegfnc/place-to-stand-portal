import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/session'
import { getPendingSuggestions, getSuggestionCounts } from '@/lib/data/suggestions'

export async function GET(request: NextRequest) {
  await requireRole('ADMIN')

  const { searchParams } = request.nextUrl
  const projectId = searchParams.get('projectId') || undefined
  const limit = parseInt(searchParams.get('limit') || '50', 10)

  const [suggestions, counts] = await Promise.all([
    getPendingSuggestions({ limit, projectId }),
    getSuggestionCounts(),
  ])

  return NextResponse.json({ suggestions, counts })
}

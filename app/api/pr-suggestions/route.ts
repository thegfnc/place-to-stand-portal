import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/session'
import { getPendingPRSuggestions } from '@/lib/data/pr-suggestions'

export async function GET() {
  await requireRole('ADMIN')

  try {
    const suggestions = await getPendingPRSuggestions()
    return NextResponse.json({ suggestions })
  } catch (error) {
    console.error('Error fetching PR suggestions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch PR suggestions' },
      { status: 500 }
    )
  }
}

import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/session'
import { getPendingSuggestions } from '@/lib/data/suggestions'

export async function GET() {
  await requireRole('ADMIN')

  try {
    // Get pending PR suggestions specifically
    const suggestions = await getPendingSuggestions({ type: 'PR' })
    return NextResponse.json({ suggestions })
  } catch (error) {
    console.error('Error fetching PR suggestions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch PR suggestions' },
      { status: 500 }
    )
  }
}

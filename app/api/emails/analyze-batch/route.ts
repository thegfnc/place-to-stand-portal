import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRole } from '@/lib/auth/session'
import { processUnanalyzedMessages } from '@/lib/ai/suggestion-service'

const requestSchema = z.object({
  limit: z.number().int().min(1).max(100).optional().default(20),
})

export async function POST(request: NextRequest) {
  const user = await requireRole('ADMIN')

  let limit = 20
  try {
    const body = await request.json()
    const parsed = requestSchema.parse(body)
    limit = parsed.limit
  } catch {
    // Use default limit
  }

  try {
    const result = await processUnanalyzedMessages(user.id, limit)

    return NextResponse.json({
      success: true,
      ...result,
    })
  } catch (error) {
    console.error('Batch analysis error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Batch analysis failed' },
      { status: 500 }
    )
  }
}

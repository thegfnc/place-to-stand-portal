import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRole } from '@/lib/auth/session'
import { createPRSuggestionFromTask } from '@/lib/ai/pr-suggestion-service'

const schema = z.object({
  repoLinkId: z.string().uuid(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ suggestionId: string }> }
) {
  const user = await requireRole('ADMIN')
  const { suggestionId } = await params

  const body = await request.json()
  const result = schema.safeParse(body)

  if (!result.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: result.error.flatten() },
      { status: 400 }
    )
  }

  try {
    const prSuggestion = await createPRSuggestionFromTask(
      suggestionId,
      result.data.repoLinkId,
      user.id
    )

    return NextResponse.json({ success: true, suggestion: prSuggestion })
  } catch (error) {
    console.error('PR generation error:', error)

    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return NextResponse.json({ error: error.message }, { status: 404 })
      }
      if (error.message.includes('not connected')) {
        return NextResponse.json({ error: error.message }, { status: 401 })
      }
    }

    return NextResponse.json(
      { error: 'Failed to generate PR suggestion' },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRole } from '@/lib/auth/session'
import { approveSuggestion } from '@/lib/data/suggestions'

const approveSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  projectId: z.string().uuid().optional(),
  dueDate: z.string().optional(),
  priority: z.enum(['HIGH', 'MEDIUM', 'LOW']).optional(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ suggestionId: string }> }
) {
  const user = await requireRole('ADMIN')
  const { suggestionId } = await params

  const body = await request.json().catch(() => ({}))
  const parsed = approveSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request body', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const modifications = parsed.data

  try {
    const result = await approveSuggestion(
      suggestionId,
      user.id,
      Object.keys(modifications).length > 0 ? modifications : undefined
    )

    return NextResponse.json({
      success: true,
      task: result.task,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to approve' },
      { status: 400 }
    )
  }
}

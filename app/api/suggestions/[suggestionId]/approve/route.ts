import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { requireRole } from '@/lib/auth/session'
import { approveSuggestion } from '@/lib/data/suggestions'
import { db } from '@/lib/db'
import { tasks } from '@/lib/db/schema'

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

    // For task suggestions, fetch the created task details
    let task = null
    if (result.taskId) {
      const [createdTask] = await db
        .select({
          id: tasks.id,
          title: tasks.title,
          status: tasks.status,
          projectId: tasks.projectId,
        })
        .from(tasks)
        .where(eq(tasks.id, result.taskId))
        .limit(1)
      task = createdTask
    }

    return NextResponse.json({
      success: true,
      task,
      taskId: result.taskId,
      prNumber: result.prNumber,
      prUrl: result.prUrl,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to approve' },
      { status: 400 }
    )
  }
}

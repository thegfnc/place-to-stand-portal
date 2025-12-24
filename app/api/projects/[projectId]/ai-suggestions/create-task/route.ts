import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { and, eq, isNull } from 'drizzle-orm'

import { requireRole } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { projects } from '@/lib/db/schema'
import { approveSuggestion, rejectSuggestion } from '@/lib/data/suggestions'
import { getProjectRepos } from '@/lib/data/github-repos'

const createTaskSchema = z.object({
  suggestionId: z.string().uuid(),
  status: z.enum(['BACKLOG', 'ON_DECK', 'IN_PROGRESS', 'IN_REVIEW', 'DONE']),
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  dueDate: z.string().optional(),
  priority: z.enum(['HIGH', 'MEDIUM', 'LOW']).optional(),
})

const rejectSchema = z.object({
  suggestionId: z.string().uuid(),
  reason: z.string().max(500).optional(),
})

/**
 * POST /api/projects/[projectId]/ai-suggestions/create-task
 *
 * Creates a task from an AI suggestion with the specified column/status.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const user = await requireRole('ADMIN')
  const { projectId } = await params

  // Verify project exists
  const [project] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(
      and(
        eq(projects.id, projectId),
        isNull(projects.deletedAt)
      )
    )
    .limit(1)

  if (!project) {
    return NextResponse.json(
      { error: 'Project not found' },
      { status: 404 }
    )
  }

  const body = await request.json()

  // Check if this is a reject action
  if (body.action === 'reject') {
    const parsed = rejectSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    try {
      await rejectSuggestion(parsed.data.suggestionId, user.id, parsed.data.reason)
      return NextResponse.json({ success: true, action: 'rejected' })
    } catch (error) {
      console.error('Failed to reject suggestion:', error)
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Failed to reject suggestion' },
        { status: 400 }
      )
    }
  }

  // Otherwise, create task
  const parsed = createTaskSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  try {
    const { task } = await approveSuggestion(
      parsed.data.suggestionId,
      user.id,
      {
        title: parsed.data.title,
        description: parsed.data.description,
        projectId,
        dueDate: parsed.data.dueDate,
        priority: parsed.data.priority,
        status: parsed.data.status,
      }
    )

    // Fetch GitHub repos linked to this project for PR generation
    const githubRepos = await getProjectRepos(projectId)

    return NextResponse.json({
      success: true,
      task: {
        id: task.id,
        title: task.title,
        status: task.status,
        projectId: task.projectId,
      },
      suggestionId: parsed.data.suggestionId,
      githubRepos: githubRepos.map(r => ({
        id: r.id,
        repoFullName: r.repoFullName,
        defaultBranch: r.defaultBranch,
      })),
    })
  } catch (error) {
    console.error('Failed to create task from suggestion:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create task' },
      { status: 400 }
    )
  }
}

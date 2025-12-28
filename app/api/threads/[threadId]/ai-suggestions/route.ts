import { NextResponse, type NextRequest } from 'next/server'
import { and, eq, isNull, or, desc } from 'drizzle-orm'

import { requireUser } from '@/lib/auth/session'
import { isAdmin } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { suggestions, threads, projects } from '@/lib/db/schema'
import { NotFoundError, ForbiddenError, toResponsePayload, type HttpError } from '@/lib/errors/http'

type RouteParams = {
  params: Promise<{ threadId: string }>
}

/**
 * GET /api/threads/[threadId]/ai-suggestions
 * Get pending AI-generated suggestions (tasks, PRs) for a thread
 */
export async function GET(_req: NextRequest, { params }: RouteParams) {
  const user = await requireUser()
  const { threadId } = await params

  try {
    // Verify thread exists and user has access
    const [thread] = await db
      .select()
      .from(threads)
      .where(and(eq(threads.id, threadId), isNull(threads.deletedAt)))
      .limit(1)

    if (!thread) throw new NotFoundError('Thread not found')

    if (!isAdmin(user) && thread.createdBy !== user.id) {
      throw new ForbiddenError('Access denied')
    }

    // Get pending suggestions for this thread
    const rows = await db
      .select({
        id: suggestions.id,
        type: suggestions.type,
        status: suggestions.status,
        confidence: suggestions.confidence,
        suggestedContent: suggestions.suggestedContent,
        createdAt: suggestions.createdAt,
        projectId: suggestions.projectId,
      })
      .from(suggestions)
      .where(
        and(
          eq(suggestions.threadId, threadId),
          isNull(suggestions.deletedAt),
          or(
            eq(suggestions.status, 'PENDING'),
            eq(suggestions.status, 'DRAFT'),
            eq(suggestions.status, 'MODIFIED')
          )
        )
      )
      .orderBy(desc(suggestions.confidence))

    // Get project names
    const projectIds = [...new Set(rows.map(s => s.projectId).filter(Boolean))] as string[]
    const projectRows = projectIds.length > 0
      ? await db
          .select({ id: projects.id, name: projects.name })
          .from(projects)
          .where(and(
            isNull(projects.deletedAt),
            or(...projectIds.map(id => eq(projects.id, id)))
          ))
      : []
    const projectMap = new Map(projectRows.map(p => [p.id, p.name]))

    const formattedSuggestions = rows.map(s => {
      const content = s.suggestedContent as Record<string, unknown>
      return {
        id: s.id,
        type: s.type,
        status: s.status,
        confidence: s.confidence,
        title: typeof content.title === 'string' ? content.title : undefined,
        createdAt: s.createdAt,
        projectName: s.projectId ? projectMap.get(s.projectId) ?? null : null,
      }
    })

    return NextResponse.json({ ok: true, suggestions: formattedSuggestions })
  } catch (err) {
    const error = err as HttpError
    console.error('Thread AI suggestions error:', error)
    const { status, body } = toResponsePayload(error)
    return NextResponse.json(body, { status })
  }
}

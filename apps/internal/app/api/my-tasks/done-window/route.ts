import { NextResponse } from 'next/server'
import { z } from 'zod'

import { requireUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { listAssignedDoneSlice } from '@/lib/data/tasks'
import { fetchProjectsWithRelationsByIds } from '@/lib/data/projects'
import { HIDEABLE_PROJECT_TYPE_VALUES } from '@/lib/my-tasks/project-scope'
import {
  DONE_WINDOW_WEEKS,
  MAX_DONE_WEEKS,
  resolveDoneWindowStart,
} from '@/lib/projects/tasks/done-window'

/**
 * One "load previous two weeks" step for the My Tasks board's Done column.
 *
 * Returns the slice of DONE tasks between two window widths plus the hydrated
 * projects they belong to, so the client can append without a full re-render
 * and without holding every finished task from the start.
 */
const payloadSchema = z.object({
  /** An admin id, `'all'` for every assignee, or absent for self. */
  assigneeId: z.union([z.string().uuid(), z.literal('all')]).optional(),
  /** Restrict the widened window to one client's projects. */
  clientId: z.string().uuid().nullable().optional(),
  /** Project types the board is hiding, so the wider window matches it. */
  hiddenProjectTypes: z.array(z.enum(HIDEABLE_PROJECT_TYPE_VALUES)).optional(),
  /** Window width already on screen, in weeks. */
  fromWeeks: z.number().int().min(0).max(MAX_DONE_WEEKS),
  /** Window width being opened up to, in weeks. */
  toWeeks: z.number().int().min(DONE_WINDOW_WEEKS).max(MAX_DONE_WEEKS),
  /** The board's render-time anchor, so steps line up with what's displayed. */
  now: z.string().datetime(),
})

export async function POST(request: Request) {
  const user = await requireUser()
  assertAdmin(user)

  let payload: z.infer<typeof payloadSchema>

  try {
    const parsed = payloadSchema.safeParse(await request.json())

    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: 'Invalid done window payload.' },
        { status: 400 }
      )
    }

    payload = parsed.data
  } catch (error) {
    console.error('Failed to parse done window payload', error)
    return NextResponse.json(
      { ok: false, error: 'Invalid done window payload.' },
      { status: 400 }
    )
  }

  if (payload.toWeeks <= payload.fromWeeks) {
    return NextResponse.json(
      { ok: false, error: 'The new window must be wider than the current one.' },
      { status: 400 }
    )
  }

  // The internal portal is admin-only, so any admin may view another admin's
  // board — same rule the reorder route applies.
  // 'all' widens to every assignee (null); absent defaults to self.
  const boardOwnerId =
    payload.assigneeId === 'all' ? null : (payload.assigneeId ?? user.id)

  try {
    const slice = await listAssignedDoneSlice({
      userId: boardOwnerId,
      clientId: payload.clientId ?? null,
      hiddenProjectTypes: payload.hiddenProjectTypes ?? [],
      since: resolveDoneWindowStart(payload.toWeeks, payload.now),
      before: resolveDoneWindowStart(payload.fromWeeks, payload.now),
    })

    const projectIds = Array.from(
      new Set(slice.items.map(item => item.project.id))
    )
    const projects = await fetchProjectsWithRelationsByIds(projectIds)

    return NextResponse.json({
      ok: true,
      data: {
        entries: slice.items.map(item => ({
          taskId: item.id,
          projectId: item.project.id,
          sortOrder: item.sortOrder,
        })),
        projects,
        olderDoneCount: slice.olderDoneCount,
      },
    })
  } catch (error) {
    console.error('Failed to load done window slice', error)
    return NextResponse.json(
      { ok: false, error: 'Unable to load older tasks. Please try again.' },
      { status: 500 }
    )
  }
}

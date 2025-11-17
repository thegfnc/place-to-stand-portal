import { NextResponse } from 'next/server'
import { z } from 'zod'
import { and, eq, inArray, isNull } from 'drizzle-orm'

import { requireUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import {
  taskAssigneeMetadata as taskAssigneeMetadataTable,
  taskAssignees as taskAssigneesTable,
  tasks as tasksTable,
} from '@/lib/db/schema'
import { changeTaskStatus } from '@/app/(dashboard)/projects/actions/change-task-status'
import {
  MY_TASK_STATUS_VALUES,
  type MyTaskStatus,
} from '@/lib/projects/tasks/my-tasks-constants'

const reorderPayloadSchema = z.object({
  taskId: z.string().uuid(),
  targetStatus: z.enum(MY_TASK_STATUS_VALUES),
  targetOrder: z.array(z.string().uuid()).min(1),
  sourceStatus: z.enum(MY_TASK_STATUS_VALUES).optional(),
  sourceOrder: z.array(z.string().uuid()).optional(),
})

export async function POST(request: Request) {
  const user = await requireUser()

  let payload: z.infer<typeof reorderPayloadSchema>

  try {
    const json = await request.json()
    const parsed = reorderPayloadSchema.safeParse(json)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid reorder payload.' },
        { status: 400 }
      )
    }

    payload = parsed.data
  } catch (error) {
    console.error('Failed to parse my tasks reorder payload', error)
    return NextResponse.json(
      { error: 'Invalid reorder payload.' },
      { status: 400 }
    )
  }

  if (!payload.targetOrder.includes(payload.taskId)) {
    return NextResponse.json(
      { error: 'Target column ordering must include the moved task.' },
      { status: 400 }
    )
  }

  if (
    payload.sourceStatus &&
    payload.sourceStatus !== payload.targetStatus &&
    !payload.sourceOrder
  ) {
    return NextResponse.json(
      { error: 'Source column ordering is required when moving columns.' },
      { status: 400 }
    )
  }

  const uniqueTaskIds = Array.from(
    new Set([
      ...payload.targetOrder,
      ...(payload.sourceOrder ?? []),
    ])
  )

  if (!uniqueTaskIds.length) {
    return NextResponse.json(
      { error: 'No tasks provided for reorder.' },
      { status: 400 }
    )
  }

  const assigneeRows = await db
    .select({ taskId: taskAssigneesTable.taskId })
    .from(taskAssigneesTable)
    .where(
      and(
        eq(taskAssigneesTable.userId, user.id),
        isNull(taskAssigneesTable.deletedAt),
        inArray(taskAssigneesTable.taskId, uniqueTaskIds)
      )
    )

  if (assigneeRows.length !== uniqueTaskIds.length) {
    return NextResponse.json(
      { error: 'You can only reorder tasks assigned to you.' },
      { status: 403 }
    )
  }

  const taskRecord = await db
    .select({
      id: tasksTable.id,
      status: tasksTable.status,
    })
    .from(tasksTable)
    .where(eq(tasksTable.id, payload.taskId))
    .limit(1)

  const task = taskRecord[0]

  if (!task) {
    return NextResponse.json({ error: 'Task not found.' }, { status: 404 })
  }

  if (task.status !== payload.targetStatus) {
    const result = await changeTaskStatus({
      taskId: payload.taskId,
      status: payload.targetStatus as MyTaskStatus,
    })

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
  }

  try {
    await db.transaction(async tx => {
      await upsertSortOrders({
        client: tx,
        userId: user.id,
        taskIds: payload.targetOrder,
      })

      if (
        payload.sourceStatus &&
        payload.sourceStatus !== payload.targetStatus &&
        payload.sourceOrder
      ) {
        await upsertSortOrders({
          client: tx,
          userId: user.id,
          taskIds: payload.sourceOrder,
        })
      }
    })
  } catch (error) {
    console.error('Failed to persist my tasks ordering', error)
    return NextResponse.json(
      { error: 'Unable to save your new ordering. Please try again.' },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true })
}

type DbInsertExecutor = Pick<typeof db, 'insert'>

async function upsertSortOrders({
  client,
  userId,
  taskIds,
}: {
  client: DbInsertExecutor
  userId: string
  taskIds: string[]
}) {
  if (!taskIds.length) {
    return
  }

  const timestamp = new Date().toISOString()

  for (let index = 0; index < taskIds.length; index++) {
    const taskId = taskIds[index]

    await client
      .insert(taskAssigneeMetadataTable)
      .values({
        taskId,
        userId,
        sortOrder: index + 1,
        createdAt: timestamp,
        updatedAt: timestamp,
        deletedAt: null,
      })
      .onConflictDoUpdate({
        target: [
          taskAssigneeMetadataTable.taskId,
          taskAssigneeMetadataTable.userId,
        ],
        set: {
          sortOrder: index + 1,
          updatedAt: timestamp,
          deletedAt: null,
        },
      })
  }
}


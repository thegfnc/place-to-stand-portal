import 'server-only'

import { and, eq, isNull } from 'drizzle-orm'

import type { AppUser } from '@/lib/auth/session'
import {
  ensureTaskAccess,
} from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { tasks } from '@/lib/db/schema'
import { NotFoundError } from '@/lib/errors/http'

import { taskFields, type SelectTask } from './common'

export async function getTaskById(
  user: AppUser,
  taskId: string,
): Promise<SelectTask> {
  await ensureTaskAccess(user, taskId)

  const result = await db
    .select(taskFields)
    .from(tasks)
    .where(and(eq(tasks.id, taskId), isNull(tasks.deletedAt)))
    .limit(1)

  if (!result.length) {
    throw new NotFoundError('Task not found')
  }

  return result[0]
}

export type { SelectTask } from './common'


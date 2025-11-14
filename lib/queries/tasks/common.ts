import { tasks } from '@/lib/db/schema'

export type SelectTask = typeof tasks.$inferSelect

export const taskFields = {
  id: tasks.id,
  projectId: tasks.projectId,
  title: tasks.title,
  description: tasks.description,
  status: tasks.status,
  dueOn: tasks.dueOn,
  createdBy: tasks.createdBy,
  updatedBy: tasks.updatedBy,
  createdAt: tasks.createdAt,
  updatedAt: tasks.updatedAt,
  deletedAt: tasks.deletedAt,
  acceptedAt: tasks.acceptedAt,
  rank: tasks.rank,
} as const


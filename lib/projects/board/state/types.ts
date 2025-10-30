import type { TaskWithRelations } from '@/lib/types'

export type TaskLookup = Map<string, TaskWithRelations[]>

export type NavigateOptions = {
  taskId?: string | null
  replace?: boolean
  view?: 'board' | 'activity'
}

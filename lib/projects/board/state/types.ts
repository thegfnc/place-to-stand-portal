import type { TaskWithRelations } from '@/lib/types'

import type { BoardView } from '../board-constants'

export type TaskLookup = Map<string, TaskWithRelations[]>

export type NavigateOptions = {
  taskId?: string | null
  replace?: boolean
  view?: BoardView
}

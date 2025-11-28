import { BOARD_COLUMNS } from '@/lib/projects/board/board-constants'

export type MyTaskStatus = (typeof BOARD_COLUMNS)[number]['id']

export const MY_TASK_STATUS_VALUES = BOARD_COLUMNS.map(
  column => column.id
) as MyTaskStatus[]

export const MY_TASK_BOARD_COLUMNS = BOARD_COLUMNS


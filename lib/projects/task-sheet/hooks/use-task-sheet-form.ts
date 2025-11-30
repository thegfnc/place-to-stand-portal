'use client'

import { useMemo } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, type UseFormReturn } from 'react-hook-form'

import type { TaskWithRelations } from '@/lib/types'
import type { BoardColumnId } from '@/lib/projects/board/board-constants'

import { createDefaultValues } from '../task-sheet-utils'
import {
  taskSheetFormSchema,
  type TaskSheetFormValues,
} from '../task-sheet-schema'

export type UseTaskSheetFormArgs = {
  task?: TaskWithRelations
  defaultStatus: BoardColumnId
  defaultDueOn: string | null
  defaultProjectId: string | null
  defaultAssigneeId: string | null
}

export type UseTaskSheetFormReturn = {
  form: UseFormReturn<TaskSheetFormValues>
  defaultValues: TaskSheetFormValues
  sheetTitle: string
  editorKey: string
}

export const useTaskSheetForm = ({
  task,
  defaultStatus,
  defaultDueOn,
  defaultProjectId,
  defaultAssigneeId,
}: UseTaskSheetFormArgs): UseTaskSheetFormReturn => {
  const currentAssigneeId = task?.assignees[0]?.user_id ?? null

  const defaultValues = useMemo(
    () =>
      createDefaultValues({
        task,
        currentAssigneeId,
        defaultStatus,
        defaultDueOn,
        defaultProjectId,
        defaultAssigneeId,
      }),
    [
      task,
      currentAssigneeId,
      defaultStatus,
      defaultDueOn,
      defaultProjectId,
      defaultAssigneeId,
    ]
  )

  const form = useForm<TaskSheetFormValues>({
    resolver: zodResolver(taskSheetFormSchema),
    defaultValues,
  })

  const sheetTitle = useMemo(() => (task ? 'Edit task' : 'Add task'), [task])

  const editorKey = useMemo(() => (task ? task.id : 'new-task'), [task])

  return {
    form,
    defaultValues,
    sheetTitle,
    editorKey,
  }
}

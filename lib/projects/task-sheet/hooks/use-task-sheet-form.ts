'use client'

import { useMemo } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, type UseFormReturn } from 'react-hook-form'

import type {
  DbUser,
  ProjectWithRelations,
  TaskWithRelations,
} from '@/lib/types'
import type { BoardColumnId } from '@/lib/projects/board/board-constants'

import {
  buildAssigneeItems,
  createDefaultValues,
} from '../task-sheet-utils'
import {
  taskSheetFormSchema,
  type TaskSheetFormValues,
} from '../task-sheet-schema'

export type UseTaskSheetFormArgs = {
  task?: TaskWithRelations
  project: ProjectWithRelations
  admins: DbUser[]
  defaultStatus: BoardColumnId
}

export type UseTaskSheetFormReturn = {
  form: UseFormReturn<TaskSheetFormValues>
  defaultValues: TaskSheetFormValues
  assigneeItems: ReturnType<typeof buildAssigneeItems>
  sheetTitle: string
  projectName: string
  editorKey: string
}

export const useTaskSheetForm = ({
  task,
  project,
  admins,
  defaultStatus,
}: UseTaskSheetFormArgs): UseTaskSheetFormReturn => {
  const currentAssigneeId = task?.assignees[0]?.user_id ?? null

  const defaultValues = useMemo(
    () =>
      createDefaultValues({
        task,
        currentAssigneeId,
        defaultStatus,
      }),
    [task, currentAssigneeId, defaultStatus]
  )

  const form = useForm<TaskSheetFormValues>({
    resolver: zodResolver(taskSheetFormSchema),
    defaultValues,
  })

  const assigneeItems = useMemo(
    () =>
      buildAssigneeItems({
        admins,
        members: project.members,
        currentAssigneeId,
      }),
    [admins, currentAssigneeId, project.members]
  )

  const sheetTitle = useMemo(
    () => (task ? 'Edit task' : 'Add task'),
    [task]
  )

  const editorKey = useMemo(() => (task ? task.id : 'new-task'), [task])

  return {
    form,
    defaultValues,
    assigneeItems,
    sheetTitle,
    projectName: project.name,
    editorKey,
  }
}

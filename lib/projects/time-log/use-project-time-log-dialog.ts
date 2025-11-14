'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'

import type { SearchableComboboxItem } from '@/components/ui/searchable-combobox'
import { useToast } from '@/components/ui/use-toast'

import {
  useProjectTimeLogMutation,
  type UseProjectTimeLogMutationOptions,
} from './use-project-time-log-mutation'
import { useTimeLogFormState } from './time-log-form-state'
import { useTimeLogOverage } from './time-log-overage'
import { useTimeLogTaskSelection } from './time-log-task-selection'
import type {
  ProjectTimeLogDialogParams,
  TimeLogEntry,
  TimeLogFormErrors,
} from './types'
import { TIME_LOGS_QUERY_KEY } from './types'

export type UseProjectTimeLogDialogOptions = ProjectTimeLogDialogParams & {
  onOpenChange: (open: boolean) => void
  mode: 'create' | 'edit'
  timeLogEntry: TimeLogEntry | null
}

export type ProjectTimeLogDialogState = {
  canLogTime: boolean
  canSelectUser: boolean
  projectLabel: string
  isEditMode: boolean
  isMutating: boolean
  disableSubmit: boolean
  formErrors: TimeLogFormErrors
  fieldErrorIds: {
    hours?: string
    loggedOn?: string
    user?: string
    general?: string
  }
  hoursInput: string
  onHoursChange: (value: string) => void
  loggedOnInput: string
  onLoggedOnChange: (value: string) => void
  noteInput: string
  onNoteChange: (value: string) => void
  selectedUserId: string
  onSelectUser: (value: string) => void
  userComboboxItems: SearchableComboboxItem[]
  getToday: () => string
  handleSubmit: (event: React.FormEvent<HTMLFormElement>) => void
  handleDialogOpenChange: (open: boolean) => void
  availableTasks: ProjectTimeLogDialogParams['tasks']
  selectedTasks: ProjectTimeLogDialogParams['tasks']
  onAddTask: (taskId: string) => void
  onTaskPickerOpenChange: (open: boolean) => void
  isTaskPickerOpen: boolean
  taskPickerButtonDisabled: boolean
  taskPickerReason: string | null
  requestTaskRemoval: (
    task: ProjectTimeLogDialogParams['tasks'][number]
  ) => void
  taskRemovalCandidate: ProjectTimeLogDialogParams['tasks'][number] | null
  confirmTaskRemoval: () => void
  cancelTaskRemoval: () => void
  overageDialog: {
    isOpen: boolean
    description: string
    confirm: () => void
    cancel: () => void
  }
  discardDialog: {
    isOpen: boolean
    confirm: () => void
    cancel: () => void
  }
}

export function useProjectTimeLogDialog(
  options: UseProjectTimeLogDialogOptions
): ProjectTimeLogDialogState {
  const {
    onOpenChange,
    projectId,
    projectName,
    clientId,
    clientName,
    clientRemainingHours,
    tasks,
    currentUserId,
    currentUserRole,
    projectMembers,
    admins,
    mode,
    timeLogEntry,
  } = options

  const canLogTime = currentUserRole !== 'CLIENT'
  const canSelectUser = currentUserRole === 'ADMIN'
  const isEditMode = mode === 'edit' && Boolean(timeLogEntry)

  const router = useRouter()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const getToday = useCallback(() => format(new Date(), 'yyyy-MM-dd'), [])
  const normalizeLoggedOnValue = useCallback(
    (value: string | null | undefined) => {
      if (!value) {
        return getToday()
      }
      return value.includes('T') ? value.split('T')[0] ?? getToday() : value
    },
    [getToday]
  )

  const {
    hoursInput,
    onHoursChange,
    loggedOnInput,
    onLoggedOnChange,
    noteInput,
    onNoteChange,
    selectedUserId,
    onSelectUser,
    formErrors,
    setFormErrors,
    fieldErrorIds,
    userComboboxItems,
    prepareForOpen,
    resetForClose,
    setFormValues,
  } = useTimeLogFormState({
    currentUserId,
    canSelectUser,
    admins,
    projectMembers,
    getToday,
  })

  const {
    selectedTaskIds,
    availableTasks,
    selectedTasks,
    isTaskPickerOpen,
    onTaskPickerOpenChange,
    onAddTask,
    requestTaskRemoval: rawRequestTaskRemoval,
    confirmTaskRemoval,
    cancelTaskRemoval: rawCancelTaskRemoval,
    taskRemovalCandidate,
    initializeSelection,
    resetSelection,
  } = useTimeLogTaskSelection(tasks)

  const {
    requestConfirmation,
    reset: resetOverage,
    overageDialog,
  } = useTimeLogOverage({ clientRemainingHours })

  const [showDiscardDialog, setShowDiscardDialog] = useState(false)
  const [pendingClose, setPendingClose] = useState(false)
  const [baselineState, setBaselineState] = useState(() => ({
    hours: '',
    note: '',
    loggedOn: getToday(),
    taskIds: [] as string[],
  }))

  const baseQueryKey = useMemo(
    () => [TIME_LOGS_QUERY_KEY, projectId] as const,
    [projectId]
  )

  const handleSuccessReset = useCallback(() => {
    resetForClose(currentUserId)
    resetSelection()
    resetOverage()
  }, [currentUserId, resetForClose, resetOverage, resetSelection])

  const handleClose = useCallback(() => {
    onOpenChange(false)
  }, [onOpenChange])

  const projectLabel = useMemo(() => {
    return clientName ? `${projectName} · ${clientName}` : projectName
  }, [clientName, projectName])

  const successToast = isEditMode
    ? {
        title: 'Time log updated',
        description: 'The entry now reflects your changes.',
      }
    : undefined

  const editTaskIds = useMemo(() => {
    if (!timeLogEntry?.linked_tasks) {
      return []
    }

    return timeLogEntry.linked_tasks
      .map(link => link?.task?.id ?? null)
      .filter((taskId): taskId is string => Boolean(taskId))
  }, [timeLogEntry])

  useEffect(() => {
    if (!isEditMode || !timeLogEntry) {
      return
    }

    const loggedOnValue = normalizeLoggedOnValue(timeLogEntry.logged_on)
    setFormValues({
      hoursInput: String(timeLogEntry.hours ?? ''),
      loggedOnInput: loggedOnValue,
      noteInput: timeLogEntry.note ?? '',
      selectedUserId: timeLogEntry.user_id,
    })
    initializeSelection(editTaskIds)
    const nextBaselineState = {
      hours: String(timeLogEntry.hours ?? ''),
      note: timeLogEntry.note ?? '',
      loggedOn: loggedOnValue,
      taskIds: editTaskIds,
    }
    let cancelled = false
    const scheduleBaselineUpdate =
      typeof queueMicrotask === 'function'
        ? queueMicrotask
        : (callback: () => void) => {
            Promise.resolve().then(callback)
          }

    scheduleBaselineUpdate(() => {
      if (!cancelled) {
        setBaselineState(nextBaselineState)
      }
    })

    return () => {
      cancelled = true
    }
  }, [
    editTaskIds,
    initializeSelection,
    isEditMode,
    normalizeLoggedOnValue,
    setBaselineState,
    setFormValues,
    timeLogEntry,
  ])

  const mutationOptions: UseProjectTimeLogMutationOptions = {
    queryClient,
    router,
    toast,
    baseQueryKey,
    project: {
      id: projectId,
      name: projectName,
      clientId,
    },
    currentUserId,
    canSelectUser,
    formValues: {
      hoursInput,
      loggedOnInput,
      noteInput,
      selectedUserId,
    },
    selectedTaskIds,
    onSuccessReset: handleSuccessReset,
    onClose: handleClose,
    setFormErrors,
    mode,
    timeLogId: timeLogEntry?.id ?? null,
    successToast,
  }

  const timeLogMutation = useProjectTimeLogMutation(mutationOptions)
  const isMutating = timeLogMutation.isPending

  const disableSubmit =
    !canLogTime ||
    isMutating ||
    !hoursInput.trim() ||
    !loggedOnInput.trim() ||
    (canSelectUser && !selectedUserId)

  const taskPickerButtonDisabled = isMutating || availableTasks.length === 0

  const taskPickerReason = isMutating
    ? 'Saving time log...'
    : availableTasks.length === 0
      ? 'All eligible tasks are already linked.'
      : null

  const requestTaskRemoval = useCallback(
    (task: ProjectTimeLogDialogParams['tasks'][number]) => {
      if (isMutating) {
        return
      }
      rawRequestTaskRemoval(task)
    },
    [isMutating, rawRequestTaskRemoval]
  )

  const cancelTaskRemoval = useCallback(() => {
    if (isMutating) {
      return
    }
    rawCancelTaskRemoval()
  }, [isMutating, rawCancelTaskRemoval])

  const runMutation = useCallback(() => {
    timeLogMutation.mutate()
  }, [timeLogMutation])

  const handleSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      if (!canLogTime || isMutating) {
        return
      }

      const nextErrors: TimeLogFormErrors = {}
      const trimmedHours = hoursInput.trim()
      let parsedHours = Number.NaN

      if (!trimmedHours) {
        nextErrors.hours = 'Enter the number of hours worked.'
      } else {
        parsedHours = Number.parseFloat(trimmedHours)
        if (!Number.isFinite(parsedHours) || parsedHours <= 0) {
          nextErrors.hours = 'Enter a valid number of hours greater than zero.'
        }
      }

      if (!loggedOnInput.trim()) {
        nextErrors.loggedOn = 'Select the date these hours were worked.'
      }

      if (canSelectUser && !selectedUserId) {
        nextErrors.user = 'Pick a teammate before logging time.'
      }

      if (Object.keys(nextErrors).length > 0) {
        setFormErrors(nextErrors)
        return
      }

      setFormErrors({})

      if (requestConfirmation(parsedHours, runMutation)) {
        return
      }

      runMutation()
    },
    [
      canLogTime,
      canSelectUser,
      hoursInput,
      isMutating,
      loggedOnInput,
      requestConfirmation,
      runMutation,
      selectedUserId,
      setFormErrors,
    ]
  )

  const isFormDirty = useMemo(() => {
    const trimmedHours = hoursInput.trim()
    const trimmedNote = noteInput.trim()
    const baselineHours = baselineState.hours.trim()
    const baselineNote = baselineState.note.trim()
    const tasksChanged =
      baselineState.taskIds.length !== selectedTaskIds.length ||
      baselineState.taskIds.some((taskId, index) => taskId !== selectedTaskIds[index])

    return (
      trimmedHours !== baselineHours ||
      trimmedNote !== baselineNote ||
      loggedOnInput !== baselineState.loggedOn ||
      tasksChanged
    )
  }, [baselineState, hoursInput, loggedOnInput, noteInput, selectedTaskIds])

  const handleDiscardConfirm = useCallback(() => {
    setShowDiscardDialog(false)
    if (pendingClose) {
      resetForClose(currentUserId)
      resetSelection()
      resetOverage()
      onOpenChange(false)
      setPendingClose(false)
    }
  }, [
    currentUserId,
    onOpenChange,
    pendingClose,
    resetForClose,
    resetOverage,
    resetSelection,
  ])

  const handleDiscardCancel = useCallback(() => {
    setShowDiscardDialog(false)
    setPendingClose(false)
  }, [])

  const handleDialogOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) {
        const initialUserId =
          isEditMode && timeLogEntry?.user_id ? timeLogEntry.user_id : currentUserId
        prepareForOpen(initialUserId)
        if (isEditMode && timeLogEntry) {
          const loggedOnValue = normalizeLoggedOnValue(timeLogEntry.logged_on)
          setFormValues({
            hoursInput: String(timeLogEntry.hours ?? ''),
            loggedOnInput: loggedOnValue,
            noteInput: timeLogEntry.note ?? '',
            selectedUserId: timeLogEntry.user_id,
          })
          initializeSelection(editTaskIds)
          setBaselineState({
            hours: String(timeLogEntry.hours ?? ''),
            note: timeLogEntry.note ?? '',
            loggedOn: loggedOnValue,
            taskIds: editTaskIds,
          })
        } else {
          initializeSelection()
          setBaselineState({
            hours: '',
            note: '',
            loggedOn: getToday(),
            taskIds: [],
          })
        }
        resetOverage()
        setShowDiscardDialog(false)
        setPendingClose(false)
        onOpenChange(true)
      } else {
        if (isFormDirty && !isMutating) {
          setPendingClose(true)
          setShowDiscardDialog(true)
          return
        }
        resetForClose(currentUserId)
        resetSelection()
        resetOverage()
        setBaselineState({
          hours: '',
          note: '',
          loggedOn: getToday(),
          taskIds: [],
        })
        onOpenChange(false)
      }
    },
    [
      currentUserId,
      editTaskIds,
      getToday,
      initializeSelection,
      isEditMode,
      isFormDirty,
      isMutating,
      onOpenChange,
      prepareForOpen,
      resetForClose,
      resetOverage,
      resetSelection,
      normalizeLoggedOnValue,
      setBaselineState,
      setFormValues,
      timeLogEntry,
    ]
  )

  const guardedOverageDialog = useMemo(() => {
    return {
      isOpen: overageDialog.isOpen,
      description: overageDialog.description,
      confirm: () => {
        if (isMutating) {
          return
        }
        overageDialog.confirm()
      },
      cancel: () => {
        if (isMutating) {
          return
        }
        overageDialog.cancel()
      },
    }
  }, [isMutating, overageDialog])

  const discardDialog = useMemo(() => {
    return {
      isOpen: showDiscardDialog,
      confirm: handleDiscardConfirm,
      cancel: handleDiscardCancel,
    }
  }, [showDiscardDialog, handleDiscardConfirm, handleDiscardCancel])

  return {
    canLogTime,
    canSelectUser,
    projectLabel,
    isEditMode,
    isMutating,
    disableSubmit,
    formErrors,
    fieldErrorIds,
    hoursInput,
    onHoursChange,
    loggedOnInput,
    onLoggedOnChange,
    noteInput,
    onNoteChange,
    selectedUserId,
    onSelectUser,
    userComboboxItems,
    getToday,
    handleSubmit,
    handleDialogOpenChange,
    availableTasks,
    selectedTasks,
    onAddTask,
    onTaskPickerOpenChange,
    isTaskPickerOpen,
    taskPickerButtonDisabled,
    taskPickerReason,
    requestTaskRemoval,
    taskRemovalCandidate,
    confirmTaskRemoval,
    cancelTaskRemoval,
    overageDialog: guardedOverageDialog,
    discardDialog,
  }
}

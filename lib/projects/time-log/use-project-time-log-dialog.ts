'use client'

import { useCallback, useMemo, useState } from 'react'
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
import type { ProjectTimeLogDialogParams, TimeLogFormErrors } from './types'
import { TIME_LOGS_QUERY_KEY } from './types'

export type UseProjectTimeLogDialogOptions = ProjectTimeLogDialogParams & {
  onOpenChange: (open: boolean) => void
}

export type ProjectTimeLogDialogState = {
  canLogTime: boolean
  canSelectUser: boolean
  projectLabel: string
  isMutating: boolean
  disableCreate: boolean
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
  } = options

  const canLogTime = currentUserRole !== 'CLIENT'
  const canSelectUser = currentUserRole === 'ADMIN'

  const router = useRouter()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const getToday = useCallback(() => format(new Date(), 'yyyy-MM-dd'), [])

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
  }

  const createLog = useProjectTimeLogMutation(mutationOptions)
  const isMutating = createLog.isPending

  const disableCreate =
    !canLogTime ||
    isMutating ||
    !hoursInput.trim() ||
    !loggedOnInput.trim() ||
    (canSelectUser && !selectedUserId)

  const projectLabel = useMemo(() => {
    return clientName ? `${projectName} · ${clientName}` : projectName
  }, [clientName, projectName])

  const taskPickerButtonDisabled = isMutating || availableTasks.length === 0

  const taskPickerReason = isMutating
    ? 'Logging time...'
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
    createLog.mutate()
  }, [createLog])

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
    const today = getToday()
    return (
      hoursInput.trim() !== '' ||
      noteInput.trim() !== '' ||
      selectedTaskIds.length > 0 ||
      loggedOnInput !== today
    )
  }, [hoursInput, noteInput, selectedTaskIds.length, loggedOnInput, getToday])

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
        prepareForOpen(currentUserId)
        initializeSelection()
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
        onOpenChange(false)
      }
    },
    [
      currentUserId,
      initializeSelection,
      isFormDirty,
      isMutating,
      onOpenChange,
      prepareForOpen,
      resetForClose,
      resetOverage,
      resetSelection,
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
    isMutating,
    disableCreate,
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

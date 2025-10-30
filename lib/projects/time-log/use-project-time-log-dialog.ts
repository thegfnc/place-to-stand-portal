'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { useToast } from '@/components/ui/use-toast'
import { logClientActivity } from '@/lib/activity/client'
import { timeLogCreatedEvent } from '@/lib/activity/events'
import { buildAssigneeItems } from '@/lib/projects/task-sheet/task-sheet-utils'
import { UNASSIGNED_ASSIGNEE_VALUE } from '@/lib/projects/task-sheet/task-sheet-constants'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import type { Json } from '@/supabase/types/database'
import type { SearchableComboboxItem } from '@/components/ui/searchable-combobox'

import type {
  FieldError,
  ProjectTimeLogDialogParams,
  TimeLogFormErrors,
  TimeLogFormField,
} from './types'
import { TIME_LOGS_QUERY_KEY } from './types'

const HOURS_ERROR_ID = 'time-log-hours-error'
const DATE_ERROR_ID = 'time-log-date-error'
const USER_ERROR_ID = 'time-log-user-error'
const GENERAL_ERROR_ID = 'time-log-general-error'

const makeFieldError = (
  field: TimeLogFormField,
  message: string
): FieldError => {
  const error = new Error(message) as FieldError
  error.field = field
  return error
}

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
  const supabase = getSupabaseBrowserClient()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const getToday = useCallback(() => format(new Date(), 'yyyy-MM-dd'), [])

  const [hoursInput, setHoursInput] = useState('')
  const [noteInput, setNoteInput] = useState('')
  const [loggedOnInput, setLoggedOnInput] = useState(() => getToday())
  const [selectedUserId, setSelectedUserId] = useState(currentUserId)
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([])
  const [isTaskPickerOpen, setIsTaskPickerOpen] = useState(false)
  const [taskRemovalCandidate, setTaskRemovalCandidate] = useState<
    ProjectTimeLogDialogParams['tasks'][number] | null
  >(null)
  const [overageConfirmOpen, setOverageConfirmOpen] = useState(false)
  const [pendingOverageHours, setPendingOverageHours] = useState<number | null>(
    null
  )
  const [formErrors, setFormErrors] = useState<TimeLogFormErrors>({})

  useEffect(() => {
    setSelectedUserId(currentUserId)
  }, [currentUserId])

  const clearFieldErrors = useCallback((fields: TimeLogFormField[]) => {
    setFormErrors(prev => {
      let updated = false
      const next: TimeLogFormErrors = { ...prev }

      for (const field of fields) {
        if (next[field]) {
          delete next[field]
          updated = true
        }
      }

      return updated ? next : prev
    })
  }, [])

  const baseQueryKey = useMemo(
    () => [TIME_LOGS_QUERY_KEY, projectId] as const,
    [projectId]
  )

  const eligibleTasks = useMemo(() => {
    return tasks.filter(task => {
      if (task.deleted_at !== null) {
        return false
      }
      if (task.status === 'DONE' || task.status === 'ARCHIVED') {
        return false
      }
      return true
    })
  }, [tasks])

  const availableTasks = useMemo(() => {
    if (selectedTaskIds.length === 0) {
      return eligibleTasks
    }

    const selectedSet = new Set(selectedTaskIds)
    return eligibleTasks.filter(task => !selectedSet.has(task.id))
  }, [eligibleTasks, selectedTaskIds])

  useEffect(() => {
    if (!isTaskPickerOpen) {
      return
    }
    if (availableTasks.length === 0) {
      setIsTaskPickerOpen(false)
    }
  }, [availableTasks, isTaskPickerOpen])

  const selectedTasks = useMemo(() => {
    if (selectedTaskIds.length === 0) {
      return []
    }

    const taskLookup = new Map<
      string,
      ProjectTimeLogDialogParams['tasks'][number]
    >()
    eligibleTasks.forEach(task => {
      taskLookup.set(task.id, task)
    })

    return selectedTaskIds
      .map(taskId => taskLookup.get(taskId))
      .filter((task): task is ProjectTimeLogDialogParams['tasks'][number] =>
        Boolean(task)
      )
  }, [eligibleTasks, selectedTaskIds])

  const userComboboxItems = useMemo<SearchableComboboxItem[]>(() => {
    if (!canSelectUser) {
      return []
    }

    return buildAssigneeItems({
      admins,
      members: projectMembers,
      currentAssigneeId: selectedUserId,
    }).filter(item => item.value !== UNASSIGNED_ASSIGNEE_VALUE)
  }, [admins, canSelectUser, projectMembers, selectedUserId])

  const createLog = useMutation({
    mutationFn: async () => {
      const parsedHours = Number.parseFloat(hoursInput)

      if (!Number.isFinite(parsedHours) || parsedHours <= 0) {
        throw makeFieldError(
          'hours',
          'Enter a valid number of hours greater than zero.'
        )
      }

      const logUserId = canSelectUser ? selectedUserId : currentUserId

      if (!logUserId) {
        throw makeFieldError('user', 'Select a teammate before logging time.')
      }

      const payload = {
        project_id: projectId,
        user_id: logUserId,
        hours: parsedHours,
        logged_on: loggedOnInput,
        note: noteInput.trim() ? noteInput.trim() : null,
      }

      const { data, error } = await supabase
        .from('time_logs')
        .insert(payload)
        .select('id')
        .single()

      if (error) {
        throw error
      }

      const timeLogId = data?.id ?? null

      if (!timeLogId) {
        throw new Error('Time log was created without an identifier.')
      }

      if (selectedTaskIds.length === 0) {
        return
      }

      const { error: linkError } = await supabase.from('time_log_tasks').insert(
        selectedTaskIds.map(taskId => ({
          time_log_id: timeLogId,
          task_id: taskId,
        }))
      )

      if (linkError) {
        await supabase
          .from('time_logs')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', timeLogId)
        throw linkError
      }

      const event = timeLogCreatedEvent({
        hours: parsedHours,
        projectName,
        linkedTaskCount: selectedTaskIds.length,
      })

      const metadata = {
        taskIds: selectedTaskIds,
        notePresent: Boolean(noteInput.trim()),
        loggedOn: loggedOnInput,
      }

      await logClientActivity(event, {
        actorId: logUserId,
        targetType: 'TIME_LOG',
        targetId: timeLogId,
        targetProjectId: projectId,
        targetClientId: clientId ?? null,
        metadata: JSON.parse(JSON.stringify(metadata)) as Json,
      })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: baseQueryKey })
      setHoursInput('')
      setNoteInput('')
      setLoggedOnInput(getToday())
      setSelectedTaskIds([])
      setSelectedUserId(currentUserId)
      setTaskRemovalCandidate(null)
      setFormErrors({})
      onOpenChange(false)
      toast({
        title: 'Time logged',
        description: 'Your hours are now included in the burndown.',
      })
      router.refresh()
    },
    onError: error => {
      console.error('Failed to log time', error)
      const field = (error as FieldError | null)?.field
      const message =
        error instanceof Error
          ? error.message
          : typeof error === 'object' &&
              error !== null &&
              'message' in error &&
              typeof (error as { message?: unknown }).message === 'string'
            ? ((error as { message?: string }).message ?? '')
            : ''
      const fallbackMessage = 'Please try again shortly.'
      const resolvedMessage =
        message && message.trim().length > 0 ? message : fallbackMessage

      if (field && field !== 'general') {
        setFormErrors({ [field]: resolvedMessage })
        return
      }

      setFormErrors({ general: resolvedMessage })
    },
  })

  const isMutating = createLog.isPending

  const disableCreate =
    !canLogTime ||
    isMutating ||
    !hoursInput.trim() ||
    !loggedOnInput.trim() ||
    (canSelectUser && !selectedUserId)

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

      const shouldConfirmOverage =
        Number.isFinite(parsedHours) &&
        parsedHours > 0 &&
        clientRemainingHours !== null &&
        parsedHours > clientRemainingHours

      if (shouldConfirmOverage) {
        setPendingOverageHours(parsedHours)
        setOverageConfirmOpen(true)
        return
      }

      createLog.mutate()
    },
    [
      canLogTime,
      canSelectUser,
      clientRemainingHours,
      createLog,
      hoursInput,
      isMutating,
      loggedOnInput,
      selectedUserId,
    ]
  )

  const handleDialogOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) {
        setLoggedOnInput(getToday())
        setSelectedUserId(currentUserId)
        setSelectedTaskIds([])
        setPendingOverageHours(null)
        setOverageConfirmOpen(false)
      } else {
        setHoursInput('')
        setNoteInput('')
        setLoggedOnInput(getToday())
        setSelectedTaskIds([])
        setSelectedUserId(currentUserId)
        setTaskRemovalCandidate(null)
        setPendingOverageHours(null)
        setOverageConfirmOpen(false)
      }

      setFormErrors({})
      onOpenChange(nextOpen)
    },
    [currentUserId, getToday, onOpenChange]
  )

  const projectLabel = useMemo(() => {
    return clientName ? `${projectName} · ${clientName}` : projectName
  }, [clientName, projectName])

  const taskPickerButtonDisabled = isMutating || availableTasks.length === 0

  const taskPickerReason = isMutating
    ? 'Logging time...'
    : availableTasks.length === 0
      ? 'All eligible tasks are already linked.'
      : null

  const onAddTask = useCallback((taskId: string) => {
    setSelectedTaskIds(prev => {
      if (prev.includes(taskId)) {
        return prev
      }
      return [...prev, taskId]
    })
  }, [])

  const requestTaskRemoval = useCallback(
    (task: ProjectTimeLogDialogParams['tasks'][number]) => {
      if (isMutating) {
        return
      }
      setTaskRemovalCandidate(task)
    },
    [isMutating]
  )

  const confirmTaskRemoval = useCallback(() => {
    if (!taskRemovalCandidate) {
      return
    }

    setSelectedTaskIds(prev =>
      prev.filter(taskId => taskId !== taskRemovalCandidate.id)
    )
    setTaskRemovalCandidate(null)
  }, [taskRemovalCandidate])

  const cancelTaskRemoval = useCallback(() => {
    if (isMutating) {
      return
    }
    setTaskRemovalCandidate(null)
  }, [isMutating])

  const overageDescription = useMemo(() => {
    if (pendingOverageHours === null || clientRemainingHours === null) {
      return "This log will exceed the client's remaining hours. Continue anyway?"
    }

    const remainingAfter = clientRemainingHours - pendingOverageHours
    return `Logging ${pendingOverageHours.toFixed(2)} hrs will push the client balance to ${remainingAfter.toFixed(2)} hrs. Continue?`
  }, [clientRemainingHours, pendingOverageHours])

  const handleOverageConfirm = useCallback(() => {
    if (isMutating) {
      return
    }
    setOverageConfirmOpen(false)
    setPendingOverageHours(null)
    createLog.mutate()
  }, [createLog, isMutating])

  const handleOverageCancel = useCallback(() => {
    if (isMutating) {
      return
    }
    setOverageConfirmOpen(false)
    setPendingOverageHours(null)
  }, [isMutating])

  const onHoursChange = useCallback(
    (value: string) => {
      setHoursInput(value)
      clearFieldErrors(['hours', 'general'])
    },
    [clearFieldErrors]
  )

  const onLoggedOnChange = useCallback(
    (value: string) => {
      setLoggedOnInput(value)
      clearFieldErrors(['loggedOn', 'general'])
    },
    [clearFieldErrors]
  )

  const onSelectUser = useCallback(
    (value: string) => {
      setSelectedUserId(value)
      clearFieldErrors(['user', 'general'])
    },
    [clearFieldErrors]
  )

  const onNoteChange = useCallback((value: string) => {
    setNoteInput(value)
  }, [])

  return {
    canLogTime,
    canSelectUser,
    projectLabel,
    isMutating,
    disableCreate,
    formErrors,
    fieldErrorIds: {
      hours: formErrors.hours ? HOURS_ERROR_ID : undefined,
      loggedOn: formErrors.loggedOn ? DATE_ERROR_ID : undefined,
      user: formErrors.user ? USER_ERROR_ID : undefined,
      general: formErrors.general ? GENERAL_ERROR_ID : undefined,
    },
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
    onTaskPickerOpenChange: setIsTaskPickerOpen,
    isTaskPickerOpen,
    taskPickerButtonDisabled,
    taskPickerReason,
    requestTaskRemoval,
    taskRemovalCandidate,
    confirmTaskRemoval,
    cancelTaskRemoval,
    overageDialog: {
      isOpen: overageConfirmOpen,
      description: overageDescription,
      confirm: handleOverageConfirm,
      cancel: handleOverageCancel,
    },
  }
}

'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { ChevronsUpDown, ListPlus, Loader2, PlusCircle, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'
import { Input } from '@/components/ui/input'
import {
  SearchableCombobox,
  type SearchableComboboxItem,
} from '@/components/ui/searchable-combobox'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/use-toast'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import type { UserRole } from '@/lib/auth/session'
import type {
  DbUser,
  ProjectMemberWithUser,
  TaskWithRelations,
} from '@/lib/types'
import { logClientActivity } from '@/lib/activity/client'
import { timeLogCreatedEvent } from '@/lib/activity/events'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { buildAssigneeItems } from '@/lib/projects/task-sheet/task-sheet-utils'
import { UNASSIGNED_ASSIGNEE_VALUE } from '@/lib/projects/task-sheet/task-sheet-constants'
import type { Json } from '@/supabase/types/database'

export const TIME_LOGS_QUERY_KEY = 'project-time-logs' as const

type TimeLogFormField = 'hours' | 'loggedOn' | 'user' | 'general'
type TimeLogFormErrors = Partial<Record<TimeLogFormField, string>>
type FieldError = Error & { field?: TimeLogFormField }

const makeFieldError = (
  field: TimeLogFormField,
  message: string
): FieldError => {
  const error = new Error(message) as FieldError
  error.field = field
  return error
}

type ProjectTimeLogDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  projectName: string
  clientId: string | null
  clientName: string | null
  clientRemainingHours: number | null
  tasks: TaskWithRelations[]
  currentUserId: string
  currentUserRole: UserRole
  projectMembers: ProjectMemberWithUser[]
  admins: DbUser[]
}

const formatTaskStatusLabel = (status: string | null) => {
  if (!status) {
    return null
  }

  return status
    .toLowerCase()
    .split('_')
    .map(part => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join(' ')
}

export function ProjectTimeLogDialog({
  open,
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
}: ProjectTimeLogDialogProps) {
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
  const [taskRemovalCandidate, setTaskRemovalCandidate] =
    useState<TaskWithRelations | null>(null)
  const [overageConfirmOpen, setOverageConfirmOpen] = useState(false)
  const [pendingOverageHours, setPendingOverageHours] = useState<number | null>(
    null
  )
  const [formErrors, setFormErrors] = useState<TimeLogFormErrors>({})

  useEffect(() => {
    setSelectedUserId(currentUserId)
  }, [currentUserId])

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
      return [] as TaskWithRelations[]
    }

    const taskLookup = new Map<string, TaskWithRelations>()
    eligibleTasks.forEach(task => {
      taskLookup.set(task.id, task)
    })

    return selectedTaskIds
      .map(taskId => taskLookup.get(taskId))
      .filter((task): task is TaskWithRelations => Boolean(task))
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

  const projectLabel = clientName
    ? `${projectName} · ${clientName}`
    : projectName

  const hoursErrorId = formErrors.hours ? 'time-log-hours-error' : undefined
  const dateErrorId = formErrors.loggedOn ? 'time-log-date-error' : undefined
  const userErrorId = formErrors.user ? 'time-log-user-error' : undefined
  const generalErrorId = formErrors.general
    ? 'time-log-general-error'
    : undefined

  const taskPickerButtonDisabled = isMutating || availableTasks.length === 0

  const taskPickerReason = isMutating
    ? 'Logging time...'
    : availableTasks.length === 0
      ? 'All eligible tasks are already linked.'
      : null

  const handleAddTaskLink = useCallback((taskId: string) => {
    setSelectedTaskIds(prev => {
      if (prev.includes(taskId)) {
        return prev
      }
      return [...prev, taskId]
    })
  }, [])

  return (
    <>
      <Dialog open={open} onOpenChange={handleDialogOpenChange}>
        <DialogContent className='w-full max-w-xl'>
          <DialogHeader>
            <DialogTitle>Add time log</DialogTitle>
            <DialogDescription>
              Entries logged here are reflected immediately in the burndown
              overview for {projectLabel}.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className='grid gap-4 sm:grid-cols-2'>
            <div className='space-y-2'>
              <label htmlFor='time-log-hours' className='text-sm font-medium'>
                Hours
              </label>
              <Input
                id='time-log-hours'
                type='number'
                step='0.25'
                min='0'
                inputMode='decimal'
                value={hoursInput}
                onChange={event => {
                  setHoursInput(event.currentTarget.value)
                  if (formErrors.hours || formErrors.general) {
                    setFormErrors(prev => {
                      if (!prev.hours && !prev.general) {
                        return prev
                      }
                      return { ...prev, hours: undefined, general: undefined }
                    })
                  }
                }}
                placeholder='e.g. 1.5'
                disabled={isMutating}
                aria-invalid={Boolean(formErrors.hours)}
                aria-describedby={hoursErrorId}
                required
              />
              {formErrors.hours ? (
                <p
                  id='time-log-hours-error'
                  className='text-destructive text-xs'
                  role='alert'
                >
                  {formErrors.hours}
                </p>
              ) : null}
            </div>
            <div className='space-y-2'>
              <label htmlFor='time-log-date' className='text-sm font-medium'>
                Date
              </label>
              <Input
                id='time-log-date'
                type='date'
                value={loggedOnInput}
                max={getToday()}
                onChange={event => {
                  setLoggedOnInput(event.currentTarget.value)
                  if (formErrors.loggedOn || formErrors.general) {
                    setFormErrors(prev => {
                      if (!prev.loggedOn && !prev.general) {
                        return prev
                      }
                      return {
                        ...prev,
                        loggedOn: undefined,
                        general: undefined,
                      }
                    })
                  }
                }}
                disabled={isMutating}
                aria-invalid={Boolean(formErrors.loggedOn)}
                aria-describedby={dateErrorId}
                required
              />
              {formErrors.loggedOn ? (
                <p
                  id='time-log-date-error'
                  className='text-destructive text-xs'
                  role='alert'
                >
                  {formErrors.loggedOn}
                </p>
              ) : null}
            </div>
            {canSelectUser ? (
              <div className='space-y-2 sm:col-span-2'>
                <label htmlFor='time-log-user' className='text-sm font-medium'>
                  Log hours for
                </label>
                <SearchableCombobox
                  id='time-log-user'
                  value={selectedUserId}
                  onChange={next => {
                    setSelectedUserId(next)
                    if (formErrors.user || formErrors.general) {
                      setFormErrors(prev => {
                        if (!prev.user && !prev.general) {
                          return prev
                        }
                        return { ...prev, user: undefined, general: undefined }
                      })
                    }
                  }}
                  items={userComboboxItems}
                  placeholder='Select teammate'
                  searchPlaceholder='Search collaborators...'
                  emptyMessage='No eligible collaborators found.'
                  disabled={isMutating}
                  ariaDescribedBy={userErrorId}
                  ariaInvalid={Boolean(formErrors.user)}
                />
                {formErrors.user ? (
                  <p
                    id='time-log-user-error'
                    className='text-destructive text-xs'
                    role='alert'
                  >
                    {formErrors.user}
                  </p>
                ) : null}
              </div>
            ) : null}
            <div className='space-y-2 sm:col-span-2'>
              <label htmlFor='time-log-task' className='text-sm font-medium'>
                Link to tasks (optional)
              </label>
              <Popover
                open={isTaskPickerOpen}
                onOpenChange={setIsTaskPickerOpen}
              >
                <DisabledFieldTooltip
                  disabled={taskPickerButtonDisabled}
                  reason={taskPickerReason}
                >
                  <div className='w-full'>
                    <PopoverTrigger asChild>
                      <Button
                        type='button'
                        variant='outline'
                        className='w-full justify-between'
                        disabled={taskPickerButtonDisabled}
                      >
                        <span className='flex items-center gap-2'>
                          <ListPlus className='h-4 w-4' />
                          {availableTasks.length > 0
                            ? 'Add task link'
                            : 'All tasks linked'}
                        </span>
                        <ChevronsUpDown className='h-4 w-4 opacity-50' />
                      </Button>
                    </PopoverTrigger>
                  </div>
                </DisabledFieldTooltip>
                <PopoverContent className='w-[320px] p-0' align='start'>
                  <Command>
                    <CommandInput placeholder='Search tasks...' />
                    <CommandEmpty>No matching tasks.</CommandEmpty>
                    <CommandList>
                      <CommandGroup heading='Tasks'>
                        {availableTasks.map(task => {
                          const formattedStatus = formatTaskStatusLabel(
                            task.status
                          )

                          return (
                            <CommandItem
                              key={task.id}
                              value={`${task.title} ${task.id}`}
                              onSelect={() => {
                                handleAddTaskLink(task.id)
                                setIsTaskPickerOpen(false)
                              }}
                            >
                              <div className='flex flex-col'>
                                <span className='font-medium'>
                                  {task.title}
                                </span>
                                {formattedStatus ? (
                                  <span className='text-muted-foreground text-xs'>
                                    {formattedStatus}
                                  </span>
                                ) : null}
                              </div>
                            </CommandItem>
                          )
                        })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              <p className='text-muted-foreground text-xs'>
                Leave empty to apply hours to the project only.
              </p>
              <div className='space-y-2'>
                {selectedTasks.length === 0
                  ? null
                  : selectedTasks.map(task => {
                      const formattedStatus = formatTaskStatusLabel(task.status)

                      return (
                        <div
                          key={task.id}
                          className='bg-muted/40 flex items-center justify-between rounded-md border px-3 py-2'
                        >
                          <div className='flex flex-col text-sm leading-tight'>
                            <span className='font-medium'>{task.title}</span>
                            {formattedStatus ? (
                              <span className='text-muted-foreground text-xs'>
                                {formattedStatus}
                              </span>
                            ) : null}
                          </div>
                          <DisabledFieldTooltip
                            disabled={isMutating}
                            reason={isMutating ? 'Logging time...' : null}
                          >
                            <Button
                              type='button'
                              variant='ghost'
                              size='icon'
                              className='text-muted-foreground hover:text-destructive'
                              onClick={() => {
                                if (isMutating) {
                                  return
                                }
                                setTaskRemovalCandidate(task)
                              }}
                              disabled={isMutating}
                              aria-label={`Remove ${task.title}`}
                            >
                              <X className='h-4 w-4' />
                            </Button>
                          </DisabledFieldTooltip>
                        </div>
                      )
                    })}
              </div>
            </div>
            <div className='space-y-2 sm:col-span-2'>
              <label htmlFor='time-log-note' className='text-sm font-medium'>
                Notes
              </label>
              <Textarea
                id='time-log-note'
                value={noteInput}
                onChange={event => setNoteInput(event.target.value)}
                rows={3}
                placeholder='Capture any context, like what was accomplished.'
                disabled={isMutating}
              />
            </div>
            {formErrors.general ? (
              <div
                id={generalErrorId}
                className='border-destructive/40 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm sm:col-span-2'
                role='alert'
                aria-live='assertive'
              >
                {formErrors.general}
              </div>
            ) : null}
            <div className='flex items-center justify-end gap-3 sm:col-span-2'>
              <DisabledFieldTooltip
                disabled={disableCreate}
                reason={
                  canLogTime
                    ? disableCreate
                      ? 'Complete the form before submitting.'
                      : null
                    : 'Only internal teammates can log time.'
                }
              >
                <Button
                  type='submit'
                  disabled={disableCreate}
                  className='inline-flex items-center gap-2'
                >
                  {isMutating ? (
                    <Loader2 className='size-4 animate-spin' />
                  ) : (
                    <PlusCircle className='size-4' />
                  )}
                  Log time
                </Button>
              </DisabledFieldTooltip>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(taskRemovalCandidate)}
        title='Remove linked task?'
        description='The task will no longer be associated with this log entry.'
        confirmLabel='Remove'
        confirmVariant='destructive'
        confirmDisabled={isMutating}
        onCancel={() => setTaskRemovalCandidate(null)}
        onConfirm={() => {
          if (!taskRemovalCandidate) {
            return
          }

          setSelectedTaskIds(prev =>
            prev.filter(taskId => taskId !== taskRemovalCandidate.id)
          )
          setTaskRemovalCandidate(null)
        }}
      />
      <ConfirmDialog
        open={overageConfirmOpen}
        title='Hours exceed client balance'
        description={(() => {
          if (pendingOverageHours === null || clientRemainingHours === null) {
            return "This log will exceed the client's remaining hours. Continue anyway?"
          }

          const remainingAfter = clientRemainingHours - pendingOverageHours
          return `Logging ${pendingOverageHours.toFixed(2)} hrs will push the client balance to ${remainingAfter.toFixed(2)} hrs. Continue?`
        })()}
        confirmLabel='Log anyway'
        confirmVariant='destructive'
        confirmDisabled={isMutating}
        onCancel={() => {
          if (isMutating) {
            return
          }
          setOverageConfirmOpen(false)
          setPendingOverageHours(null)
        }}
        onConfirm={() => {
          if (isMutating) {
            return
          }
          setOverageConfirmOpen(false)
          setPendingOverageHours(null)
          createLog.mutate()
        }}
      />
    </>
  )
}

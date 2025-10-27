'use client'

import { useCallback, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { Loader2, PlusCircle } from 'lucide-react'

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
import type { UserRole } from '@/lib/auth/session'
import type { TaskWithRelations } from '@/lib/types'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'

export const TIME_LOGS_QUERY_KEY = 'project-time-logs' as const
const TASK_NONE_VALUE = '__time_log_none__'

type ProjectTimeLogDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  projectName: string
  clientName: string | null
  tasks: TaskWithRelations[]
  currentUserId: string
  currentUserRole: UserRole
}

export function ProjectTimeLogDialog({
  open,
  onOpenChange,
  projectId,
  projectName,
  clientName,
  tasks,
  currentUserId,
  currentUserRole,
}: ProjectTimeLogDialogProps) {
  const canLogTime = currentUserRole !== 'CLIENT'
  const router = useRouter()
  const supabase = getSupabaseBrowserClient()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const getToday = useCallback(() => format(new Date(), 'yyyy-MM-dd'), [])

  const [hoursInput, setHoursInput] = useState('')
  const [noteInput, setNoteInput] = useState('')
  const [loggedOnInput, setLoggedOnInput] = useState(() => getToday())
  const [selectedTaskValue, setSelectedTaskValue] =
    useState<string>(TASK_NONE_VALUE)

  const baseQueryKey = useMemo(
    () => [TIME_LOGS_QUERY_KEY, projectId] as const,
    [projectId]
  )

  const comboboxItems = useMemo<SearchableComboboxItem[]>(() => {
    const eligibleTasks = tasks
      .filter(
        task =>
          task.deleted_at === null &&
          task.status !== 'DONE' &&
          task.status !== 'ARCHIVED'
      )
      .map<SearchableComboboxItem>(task => ({
        value: task.id,
        label: task.title,
        keywords: [task.title],
      }))

    return [
      {
        value: TASK_NONE_VALUE,
        label: 'Log without a task',
        description: 'Applies hours to the project only.',
      },
      ...eligibleTasks,
    ]
  }, [tasks])

  const createLog = useMutation({
    mutationFn: async () => {
      const parsedHours = Number.parseFloat(hoursInput)

      if (!Number.isFinite(parsedHours) || parsedHours <= 0) {
        throw new Error('Enter a valid number of hours greater than zero.')
      }

      const payload = {
        project_id: projectId,
        task_id:
          selectedTaskValue === TASK_NONE_VALUE ? null : selectedTaskValue,
        user_id: currentUserId,
        hours: parsedHours,
        logged_on: loggedOnInput,
        note: noteInput.trim() ? noteInput.trim() : null,
      }

      const { error } = await supabase.from('time_logs').insert(payload)

      if (error) {
        throw error
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: baseQueryKey })
      setHoursInput('')
      setNoteInput('')
      setLoggedOnInput(getToday())
      setSelectedTaskValue(TASK_NONE_VALUE)
      onOpenChange(false)
      toast({
        title: 'Time logged',
        description: 'Your hours are now included in the burndown.',
      })
      router.refresh()
    },
    onError: error => {
      console.error('Failed to log time', error)
      toast({
        title: 'Could not log time',
        description: error.message ?? 'Please try again shortly.',
        variant: 'destructive',
      })
    },
  })

  const isMutating = createLog.isPending

  const disableCreate =
    !canLogTime || isMutating || !hoursInput.trim() || !loggedOnInput.trim()

  const handleSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      if (!canLogTime || isMutating) {
        return
      }
      createLog.mutate()
    },
    [canLogTime, createLog, isMutating]
  )

  const handleDialogOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) {
        setLoggedOnInput(getToday())
      } else {
        setHoursInput('')
        setNoteInput('')
        setLoggedOnInput(getToday())
        setSelectedTaskValue(TASK_NONE_VALUE)
      }

      onOpenChange(nextOpen)
    },
    [getToday, onOpenChange]
  )

  const projectLabel = clientName
    ? `${projectName} · ${clientName}`
    : projectName

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
                onChange={event => setHoursInput(event.target.value)}
                placeholder='e.g. 1.5'
                disabled={isMutating}
                required
              />
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
                onChange={event => setLoggedOnInput(event.target.value)}
                disabled={isMutating}
                required
              />
            </div>
            <div className='space-y-2 sm:col-span-2'>
              <label htmlFor='time-log-task' className='text-sm font-medium'>
                Link to task (optional)
              </label>
              <SearchableCombobox
                id='time-log-task'
                value={selectedTaskValue}
                onChange={next => setSelectedTaskValue(next)}
                items={comboboxItems}
                placeholder='Search tasks...'
                emptyMessage='No matching tasks found.'
                disabled={isMutating}
              />
            </div>
            <div className='space-y-2 sm:col-span-2'>
              <label htmlFor='time-log-note' className='text-sm font-medium'>
                Notes (optional)
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
    </>
  )
}

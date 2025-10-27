'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format, formatDistanceToNow } from 'date-fns'
import { Loader2, PlusCircle, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/use-toast'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import type { TimeLogWithUser } from '@/lib/types'
import type { UserRole } from '@/lib/auth/session'

import { EmptyState, ErrorState, PanelShell } from './task-comments-panel'

const TIME_LOGS_QUERY_KEY = 'task-time-logs'

const HOURS_FORMATTER = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
})

type TaskTimeLogsPanelProps = {
  taskId: string | null
  projectId: string
  currentUserId: string
  currentUserRole: UserRole
}

export function TaskTimeLogsPanel({
  taskId,
  projectId,
  currentUserId,
  currentUserRole,
}: TaskTimeLogsPanelProps) {
  const supabase = getSupabaseBrowserClient()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const router = useRouter()

  const canLogTime = currentUserRole !== 'CLIENT'

  const today = useMemo(() => format(new Date(), 'yyyy-MM-dd'), [])
  const [hoursInput, setHoursInput] = useState('')
  const [noteInput, setNoteInput] = useState('')
  const [loggedOnInput, setLoggedOnInput] = useState(today)
  const [logAgainstTask, setLogAgainstTask] = useState(Boolean(taskId))

  useEffect(() => {
    setLogAgainstTask(Boolean(taskId))
  }, [taskId])

  const queryKey = useMemo(() => [TIME_LOGS_QUERY_KEY, projectId], [projectId])

  const {
    data: logs,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey,
    enabled: Boolean(projectId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('time_logs')
        .select(
          `
          id,
          project_id,
          task_id,
          user_id,
          hours,
          logged_on,
          note,
          created_at,
          updated_at,
          deleted_at,
          user:users (
            id,
            full_name,
            email
          )
        `
        )
        .eq('project_id', projectId)
        .is('deleted_at', null)
        .order('logged_on', { ascending: false })
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Failed to load time logs', error)
        throw error
      }

      return (data ?? []) as TimeLogWithUser[]
    },
  })

  const taskLogs = useMemo(
    () => (logs ?? []).filter(log => log.task_id === taskId),
    [logs, taskId]
  )

  const projectOnlyLogs = useMemo(
    () => (logs ?? []).filter(log => log.task_id === null),
    [logs]
  )

  const totalTaskHours = useMemo(
    () =>
      taskLogs.reduce((total, log) => {
        return total + Number(log.hours ?? 0)
      }, 0),
    [taskLogs]
  )

  const createLog = useMutation({
    mutationFn: async () => {
      const parsedHours = Number.parseFloat(hoursInput)

      if (!Number.isFinite(parsedHours) || parsedHours <= 0) {
        throw new Error('Enter a valid number of hours greater than zero.')
      }

      const targetTaskId = logAgainstTask ? taskId : null

      if (logAgainstTask && !taskId) {
        throw new Error('Save the task before logging time against it.')
      }

      const payload = {
        project_id: projectId,
        task_id: targetTaskId,
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
      await queryClient.invalidateQueries({ queryKey })
      setHoursInput('')
      setNoteInput('')
      setLoggedOnInput(today)
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

  const deleteLog = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('time_logs')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id)

      if (error) {
        throw error
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey })
      toast({
        title: 'Time entry removed',
        description: 'The log no longer counts toward the burndown total.',
      })
      router.refresh()
    },
    onError: error => {
      console.error('Failed to delete time log', error)
      toast({
        title: 'Could not delete time log',
        description: 'Please try again. If the issue persists contact support.',
        variant: 'destructive',
      })
    },
  })

  const isPending = createLog.isPending || deleteLog.isPending

  const handleSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      if (!canLogTime || isPending) {
        return
      }
      createLog.mutate()
    },
    [canLogTime, createLog, isPending]
  )

  const handleDelete = useCallback(
    (log: TimeLogWithUser) => {
      if (isPending) {
        return
      }
      deleteLog.mutate(log.id)
    },
    [deleteLog, isPending]
  )

  const disableCreate =
    !canLogTime ||
    isPending ||
    !hoursInput.trim() ||
    !loggedOnInput ||
    (logAgainstTask && !taskId)

  return (
    <PanelShell
      title='Time logs'
      description='Track the effort captured on this task and its parent project.'
      action={
        <Button
          type='button'
          variant='ghost'
          size='icon'
          onClick={() => {
            void refetch()
          }}
          disabled={isLoading}
          aria-label='Refresh time logs'
        >
          {isLoading ? (
            <Loader2 className='h-4 w-4 animate-spin' />
          ) : (
            <PlusCircle className='h-4 w-4' />
          )}
        </Button>
      }
    >
      {canLogTime ? (
        <form
          onSubmit={handleSubmit}
          className='grid gap-3 rounded-lg border p-4 shadow-sm md:grid-cols-2'
        >
          <div className='space-y-2'>
            <Label htmlFor='log-hours'>Hours</Label>
            <Input
              id='log-hours'
              type='number'
              step='0.25'
              min='0'
              inputMode='decimal'
              value={hoursInput}
              onChange={event => setHoursInput(event.target.value)}
              placeholder='e.g. 1.5'
              disabled={isPending}
            />
          </div>
          <div className='space-y-2'>
            <Label htmlFor='log-date'>Date</Label>
            <Input
              id='log-date'
              type='date'
              value={loggedOnInput}
              onChange={event => setLoggedOnInput(event.target.value)}
              max={today}
              disabled={isPending}
            />
          </div>
          <div className='space-y-2 md:col-span-2'>
            <Label htmlFor='log-note'>Notes (optional)</Label>
            <Textarea
              id='log-note'
              value={noteInput}
              onChange={event => setNoteInput(event.target.value)}
              rows={3}
              placeholder='Capture any context, like what was accomplished.'
              disabled={isPending}
            />
          </div>
          <div className='flex flex-col justify-between gap-3 md:col-span-2 md:flex-row md:items-center'>
            <label className='flex items-center gap-2 text-sm'>
              <Checkbox
                checked={logAgainstTask}
                onCheckedChange={value => {
                  if (typeof value === 'boolean') {
                    setLogAgainstTask(value)
                  }
                }}
                disabled={!taskId || isPending}
              />
              <span>
                Link this entry to the current task
                {!taskId ? ' (save the task to enable)' : ''}
              </span>
            </label>
            <DisabledFieldTooltip
              disabled={disableCreate}
              reason={
                canLogTime
                  ? logAgainstTask && !taskId
                    ? 'Save the task before logging time against it.'
                    : disableCreate
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
                {isPending ? (
                  <Loader2 className='h-4 w-4 animate-spin' />
                ) : (
                  <PlusCircle className='h-4 w-4' />
                )}
                Log time
              </Button>
            </DisabledFieldTooltip>
          </div>
        </form>
      ) : (
        <div className='text-muted-foreground rounded-lg border border-dashed px-4 py-6 text-sm'>
          Clients can review logged hours but cannot add new entries.
        </div>
      )}

      <Separator className='my-4' />

      {isLoading ? (
        <div className='text-muted-foreground flex items-center gap-2 text-sm'>
          <Loader2 className='h-4 w-4 animate-spin' /> Loading time logs…
        </div>
      ) : isError ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : (
        <div className='space-y-6'>
          <LogsList
            title='This task'
            subtitle={`Total logged: ${HOURS_FORMATTER.format(totalTaskHours)} hrs`}
            logs={taskLogs}
            emptyMessage={
              taskId
                ? 'No time recorded for this task yet.'
                : 'Log time will appear here after the task is created.'
            }
            currentUserId={currentUserId}
            currentUserRole={currentUserRole}
            onDelete={handleDelete}
            disableActions={isPending}
          />
          <LogsList
            title='Project (unassigned)'
            subtitle='Entries logged against the project without a specific task.'
            logs={projectOnlyLogs}
            emptyMessage='No project-only time logs recorded yet.'
            currentUserId={currentUserId}
            currentUserRole={currentUserRole}
            onDelete={handleDelete}
            disableActions={isPending}
          />
        </div>
      )}
    </PanelShell>
  )
}

type LogsListProps = {
  title: string
  subtitle: string
  logs: TimeLogWithUser[]
  emptyMessage: string
  currentUserId: string
  currentUserRole: UserRole
  onDelete: (log: TimeLogWithUser) => void
  disableActions: boolean
}

function LogsList({
  title,
  subtitle,
  logs,
  emptyMessage,
  currentUserId,
  currentUserRole,
  onDelete,
  disableActions,
}: LogsListProps) {
  const canDelete = useCallback(
    (log: TimeLogWithUser) => {
      return currentUserRole === 'ADMIN' || log.user_id === currentUserId
    },
    [currentUserId, currentUserRole]
  )

  if (!logs.length) {
    return (
      <section className='space-y-3'>
        <header>
          <h4 className='text-sm font-semibold'>{title}</h4>
          <p className='text-muted-foreground text-xs'>{subtitle}</p>
        </header>
        <EmptyState message={emptyMessage} />
      </section>
    )
  }

  return (
    <section className='space-y-3'>
      <header>
        <h4 className='text-sm font-semibold'>{title}</h4>
        <p className='text-muted-foreground text-xs'>{subtitle}</p>
      </header>
      <div className='space-y-3'>
        {logs.map(log => (
          <TimeLogItem
            key={log.id}
            log={log}
            canDelete={canDelete(log)}
            onDelete={() => onDelete(log)}
            disableActions={disableActions}
          />
        ))}
      </div>
    </section>
  )
}

type TimeLogItemProps = {
  log: TimeLogWithUser
  canDelete: boolean
  onDelete: () => void
  disableActions: boolean
}

function TimeLogItem({
  log,
  canDelete,
  onDelete,
  disableActions,
}: TimeLogItemProps) {
  const authorName = log.user?.full_name ?? log.user?.email ?? 'Unknown user'
  const loggedDate = log.logged_on
    ? format(new Date(log.logged_on), 'MMM d, yyyy')
    : 'Unknown date'
  const loggedAgo = log.logged_on
    ? formatDistanceToNow(new Date(log.logged_on), { addSuffix: true })
    : null

  return (
    <article className='rounded-lg border px-4 py-3 shadow-sm'>
      <header className='text-muted-foreground mb-2 flex flex-wrap items-center justify-between gap-2 text-xs'>
        <span className='text-foreground font-medium'>{authorName}</span>
        <span>
          {loggedDate}
          {loggedAgo ? (
            <span className='text-muted-foreground'> · {loggedAgo}</span>
          ) : null}
        </span>
      </header>
      <p className='text-foreground text-sm font-semibold'>
        {HOURS_FORMATTER.format(Number(log.hours ?? 0))} hrs
      </p>
      {log.note ? (
        <p className='text-muted-foreground mt-2 text-sm whitespace-pre-wrap'>
          {log.note}
        </p>
      ) : null}
      {canDelete ? (
        <footer className='mt-3 flex justify-end'>
          <Button
            type='button'
            variant='ghost'
            size='sm'
            className='text-muted-foreground hover:text-destructive h-7 px-2'
            onClick={onDelete}
            disabled={disableActions}
          >
            <Trash2 className='mr-1 h-3.5 w-3.5' /> Delete
          </Button>
        </footer>
      ) : null}
    </article>
  )
}

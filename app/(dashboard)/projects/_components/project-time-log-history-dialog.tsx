'use client'

import { useCallback, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { Loader2, RotateCcw, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/components/ui/use-toast'
import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'
import type { UserRole } from '@/lib/auth/session'
import type { TimeLogWithUser } from '@/lib/types'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

import { TIME_LOGS_QUERY_KEY } from './project-time-log-dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

const PAGE_SIZE = 10

const HOURS_FORMATTER = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
})

type ProjectTimeLogHistoryDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  projectName: string
  clientName: string | null
  currentUserId: string
  currentUserRole: UserRole
}

type TimeLogEntry = TimeLogWithUser & {
  task: {
    id: string
    title: string | null
    status: string | null
    deleted_at: string | null
  } | null
}

export function ProjectTimeLogHistoryDialog({
  open,
  onOpenChange,
  projectId,
  projectName,
  clientName,
  currentUserId,
  currentUserRole,
}: ProjectTimeLogHistoryDialogProps) {
  const supabase = getSupabaseBrowserClient()
  const queryClient = useQueryClient()
  const router = useRouter()
  const { toast } = useToast()

  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [pendingDelete, setPendingDelete] = useState<TimeLogEntry | null>(null)

  const baseQueryKey = useMemo(
    () => [TIME_LOGS_QUERY_KEY, projectId] as const,
    [projectId]
  )

  const queryKey = useMemo(
    () => [...baseQueryKey, visibleCount] as const,
    [baseQueryKey, visibleCount]
  )

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey,
    enabled: open,
    queryFn: async () => {
      const rangeEnd = Math.max(visibleCount - 1, 0)
      const {
        data: rows,
        error,
        count,
      } = await supabase
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
          ),
          task:tasks (
            id,
            title,
            status,
            deleted_at
          )
        `,
          { count: 'exact' }
        )
        .eq('project_id', projectId)
        .is('deleted_at', null)
        .order('logged_on', { ascending: false })
        .order('created_at', { ascending: false })
        .range(0, rangeEnd)

      if (error) {
        console.error('Failed to load time logs', error)
        throw error
      }

      return {
        logs: (rows ?? []) as TimeLogEntry[],
        totalCount: count ?? rows?.length ?? 0,
      }
    },
  })

  const logs = data?.logs ?? []
  const totalCount = data?.totalCount ?? 0
  const showLoadMore = totalCount > logs.length

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
      await queryClient.invalidateQueries({ queryKey: baseQueryKey })
      toast({
        title: 'Time entry removed',
        description: 'The log no longer counts toward the burndown total.',
      })
      setPendingDelete(null)
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

  const handleDialogOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) {
        setVisibleCount(PAGE_SIZE)
      } else {
        setPendingDelete(null)
      }

      onOpenChange(nextOpen)
    },
    [onOpenChange]
  )

  const handleLoadMore = () => {
    if (isLoading) {
      return
    }
    setVisibleCount(count => count + PAGE_SIZE)
  }

  const projectLabel = clientName
    ? `${projectName} · ${clientName}`
    : projectName

  const pendingDeleteId = pendingDelete?.id ?? null

  const resolveLoggedOnDate = useCallback((value: string | null) => {
    if (!value) {
      return null
    }

    if (value.includes('T')) {
      return new Date(value)
    }

    return new Date(`${value}T00:00:00`)
  }, [])

  return (
    <>
      <Dialog open={open} onOpenChange={handleDialogOpenChange}>
        <DialogContent className='max-h-[90vh] w-full max-w-[calc(100vw-2rem)] overflow-y-auto sm:max-w-7xl'>
          <DialogHeader>
            <DialogTitle>Project time logs</DialogTitle>
            <DialogDescription>
              Viewing the most recent entries recorded for {projectLabel}.
            </DialogDescription>
          </DialogHeader>
          <div className='space-y-3'>
            <div className='flex items-center justify-between gap-2'>
              <div className='text-muted-foreground text-sm'>
                Showing {logs.length} of {totalCount}
              </div>
              <Button
                type='button'
                variant='ghost'
                size='sm'
                onClick={() => {
                  void refetch()
                }}
                disabled={isLoading}
                className='inline-flex items-center gap-2'
              >
                {isLoading ? (
                  <Loader2 className='size-4 animate-spin' />
                ) : (
                  <RotateCcw className='size-4' />
                )}
                Refresh
              </Button>
            </div>
            {isLoading ? (
              <div className='text-muted-foreground flex items-center gap-2 text-sm'>
                <Loader2 className='size-4 animate-spin' /> Loading time logs…
              </div>
            ) : isError ? (
              <div className='text-destructive border-destructive/40 bg-destructive/10 flex items-center justify-between rounded-md border px-3 py-2 text-sm'>
                <span>Unable to load time logs.</span>
                <Button
                  type='button'
                  variant='outline'
                  size='sm'
                  onClick={() => void refetch()}
                >
                  Try again
                </Button>
              </div>
            ) : logs.length === 0 ? (
              <div className='text-muted-foreground rounded-md border border-dashed px-4 py-6 text-center text-sm'>
                No time entries logged for this project yet.
              </div>
            ) : (
              <div className='overflow-hidden rounded-lg border'>
                <Table>
                  <TableHeader>
                    <TableRow className='bg-muted/40'>
                      <TableHead className='min-w-28'>Logged on</TableHead>
                      <TableHead className='min-w-20'>Hours</TableHead>
                      <TableHead className='min-w-36'>Task</TableHead>
                      <TableHead className='min-w-36'>Member</TableHead>
                      <TableHead className='min-w-48'>Notes</TableHead>
                      <TableHead className='w-20 text-right'>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map(log => {
                      const authorName =
                        log.user?.full_name ?? log.user?.email ?? 'Unknown user'
                      const loggedOnDate = resolveLoggedOnDate(log.logged_on)
                      const loggedDate = loggedOnDate
                        ? format(loggedOnDate, 'MMM d, yyyy')
                        : 'Unknown date'
                      const canDelete =
                        currentUserRole === 'ADMIN' ||
                        log.user_id === currentUserId
                      const deleteDisabled = deleteLog.isPending
                      const deleteReason = deleteDisabled
                        ? 'Removing entry...'
                        : null

                      return (
                        <TableRow key={log.id}>
                          <TableCell>
                            <div className='flex flex-col'>
                              <span className='font-medium'>{loggedDate}</span>
                            </div>
                          </TableCell>
                          <TableCell className='font-semibold'>
                            {HOURS_FORMATTER.format(Number(log.hours ?? 0))} hrs
                          </TableCell>
                          <TableCell>
                            <span className='line-clamp-2 text-sm'>
                              {log.task?.title ?? 'Logged to project'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className='line-clamp-2 text-sm'>
                              {authorName}
                            </span>
                          </TableCell>
                          <TableCell>
                            {log.note ? (
                              <span className='text-muted-foreground line-clamp-3 text-sm whitespace-pre-wrap'>
                                {log.note}
                              </span>
                            ) : (
                              <span className='text-muted-foreground text-sm'>
                                —
                              </span>
                            )}
                          </TableCell>
                          <TableCell className='text-right'>
                            {canDelete ? (
                              <DisabledFieldTooltip
                                disabled={deleteDisabled}
                                reason={deleteReason}
                              >
                                <Button
                                  type='button'
                                  variant='destructive'
                                  size='icon'
                                  className={cn(
                                    'h-8 w-8 rounded-md',
                                    deleteLog.isPending &&
                                      pendingDeleteId === log.id
                                      ? 'pointer-events-none'
                                      : undefined
                                  )}
                                  onClick={() => setPendingDelete(log)}
                                  disabled={deleteDisabled}
                                  aria-label='Delete time entry'
                                >
                                  {deleteLog.isPending &&
                                  pendingDeleteId === log.id ? (
                                    <Loader2 className='size-4 animate-spin' />
                                  ) : (
                                    <Trash2 className='size-4' />
                                  )}
                                </Button>
                              </DisabledFieldTooltip>
                            ) : (
                              <span className='text-muted-foreground text-xs'>
                                No access
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
            {showLoadMore ? (
              <div className='flex justify-center'>
                <Button
                  type='button'
                  variant='outline'
                  onClick={handleLoadMore}
                  disabled={isLoading}
                >
                  Load more
                </Button>
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title='Delete time entry?'
        description='This removes the log from the project burndown.'
        confirmLabel='Delete'
        confirmVariant='destructive'
        confirmDisabled={deleteLog.isPending}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (!pendingDeleteId) {
            setPendingDelete(null)
            return
          }
          deleteLog.mutate(pendingDeleteId)
        }}
      />
    </>
  )
}

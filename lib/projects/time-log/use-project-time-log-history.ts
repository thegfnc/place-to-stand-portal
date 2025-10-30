'use client'

import { useCallback, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/components/ui/use-toast'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'

import {
  TIME_LOGS_QUERY_KEY,
  type ProjectTimeLogHistoryDialogParams,
  type TimeLogEntry,
} from './types'

const PAGE_SIZE = 10

export type UseProjectTimeLogHistoryOptions =
  ProjectTimeLogHistoryDialogParams & {
    open: boolean
    onOpenChange: (open: boolean) => void
  }

export type ProjectTimeLogHistoryState = {
  projectLabel: string
  logs: TimeLogEntry[]
  totalCount: number
  isLoading: boolean
  isError: boolean
  refresh: () => void
  showLoadMore: boolean
  loadMore: () => void
  handleDialogOpenChange: (open: boolean) => void
  deleteState: {
    pendingEntry: TimeLogEntry | null
    pendingEntryId: string | null
    request: (entry: TimeLogEntry) => void
    cancel: () => void
    confirm: () => void
    isMutating: boolean
  }
}

export function useProjectTimeLogHistory(
  options: UseProjectTimeLogHistoryOptions
): ProjectTimeLogHistoryState {
  const { open, onOpenChange, projectId, projectName, clientName } = options

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
          linked_tasks:time_log_tasks (
            id,
            deleted_at,
            task:tasks (
              id,
              title,
              status,
              deleted_at
            )
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

  const loadMore = useCallback(() => {
    if (isLoading) {
      return
    }
    setVisibleCount(count => count + PAGE_SIZE)
  }, [isLoading])

  const refresh = useCallback(() => {
    void refetch()
  }, [refetch])

  const projectLabel = useMemo(() => {
    return clientName ? `${projectName} · ${clientName}` : projectName
  }, [clientName, projectName])

  const pendingEntryId = pendingDelete?.id ?? null

  const requestDelete = useCallback((entry: TimeLogEntry) => {
    setPendingDelete(entry)
  }, [])

  const cancelDelete = useCallback(() => {
    if (deleteLog.isPending) {
      return
    }
    setPendingDelete(null)
  }, [deleteLog.isPending])

  const confirmDelete = useCallback(() => {
    if (!pendingEntryId || deleteLog.isPending) {
      return
    }
    deleteLog.mutate(pendingEntryId)
  }, [deleteLog, pendingEntryId])

  return {
    projectLabel,
    logs,
    totalCount,
    isLoading,
    isError,
    refresh,
    showLoadMore,
    loadMore,
    handleDialogOpenChange,
    deleteState: {
      pendingEntry: pendingDelete,
      pendingEntryId,
      request: requestDelete,
      cancel: cancelDelete,
      confirm: confirmDelete,
      isMutating: deleteLog.isPending,
    },
  }
}

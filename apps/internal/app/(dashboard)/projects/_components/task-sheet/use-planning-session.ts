'use client'

import { useCallback, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import {
  getOrCreatePlanningSession,
  addPlanThread,
  type PlanningSessionData,
} from '../../actions/planning'
import { DEFAULT_PLANNING_TIER, getModelLabel } from '@/lib/planning/models'

const PLANNING_SESSION_KEY = 'planning-session'

const DEFAULT_MODEL = DEFAULT_PLANNING_TIER
const DEFAULT_LABEL = getModelLabel(DEFAULT_PLANNING_TIER)

// While any thread is mid-generation, poll so a client that had this
// session closed (or never open) picks up the in-progress/finished state
// instead of only finding out on next manual refetch.
const GENERATION_POLL_INTERVAL = 2_000

export function usePlanningSession(taskId: string, repoLinkId: string) {
  const queryClient = useQueryClient()
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null)

  const queryKey = useMemo(() => [PLANNING_SESSION_KEY, taskId], [taskId])

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const result = await getOrCreatePlanningSession({ taskId, repoLinkId })
      if ('error' in result) throw new Error(result.error)
      return result.data
    },
    staleTime: 30_000,
    refetchInterval: query => {
      const result = query.state.data as PlanningSessionData | undefined
      const isAnyThreadStreaming = result?.threads.some(
        t => t.generationStatus === 'streaming'
      )
      return isAnyThreadStreaming ? GENERATION_POLL_INTERVAL : false
    },
  })

  const threads = data?.threads ?? []
  const sessionId = data?.sessionId ?? null
  // Derive effective thread ID: explicit selection, or fall back to first thread
  const effectiveThreadId = activeThreadId ?? threads[0]?.id ?? null
  const activeThread = threads.find(t => t.id === effectiveThreadId) ?? null

  const addThread = useCallback(
    async (model: string, modelLabel: string) => {
      if (!sessionId) return null

      const result = await addPlanThread({ sessionId, model, modelLabel })
      if ('error' in result) return null

      // Update cache
      queryClient.setQueryData<PlanningSessionData>(queryKey, prev => {
        if (!prev) return prev
        return { ...prev, threads: [...prev.threads, result.thread] }
      })

      setActiveThreadId(result.thread.id)
      return result.thread
    },
    [sessionId, queryClient, queryKey]
  )

  // Auto-create default thread if session has none
  const createDefaultThread = useCallback(async () => {
    if (!sessionId || threads.length > 0) return null
    return addThread(DEFAULT_MODEL, DEFAULT_LABEL)
  }, [sessionId, threads.length, addThread])

  return {
    sessionId,
    threads,
    activeThread,
    activeThreadId: effectiveThreadId,
    setActiveThreadId,
    addThread,
    createDefaultThread,
    isLoading,
  }
}

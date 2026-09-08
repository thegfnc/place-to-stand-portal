'use client'

import { useCallback, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import { fetchPlanRevisions } from '../../actions/planning'

const PLAN_REVISIONS_KEY = 'plan-revisions'

export function usePlanRevisions(threadId: string | null, enabled: boolean) {
  const queryClient = useQueryClient()
  const [viewingVersion, setViewingVersion] = useState<number | null>(null)

  const queryKey = useMemo(
    () => [PLAN_REVISIONS_KEY, threadId] as const,
    [threadId]
  )

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!threadId) return { revisions: [] }
      const result = await fetchPlanRevisions({ threadId })
      if ('error' in result) throw new Error(result.error)
      return result
    },
    enabled: enabled && Boolean(threadId),
    staleTime: 10_000,
  })

  const revisions = useMemo(() => data?.revisions ?? [], [data?.revisions])
  const latestVersion = revisions.length > 0 ? revisions[revisions.length - 1].version : 0
  const currentVersion = viewingVersion ?? latestVersion

  const currentRevision = useMemo(
    () => revisions.find(r => r.version === currentVersion) ?? null,
    [revisions, currentVersion]
  )

  const navigateTo = useCallback((version: number) => {
    setViewingVersion(version)
  }, [])

  const navigateToLatest = useCallback(() => {
    setViewingVersion(null)
  }, [])

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey })
    // Reset to latest on next refetch
    setViewingVersion(null)
  }, [queryClient, queryKey])

  return {
    revisions,
    currentVersion,
    latestVersion,
    currentRevision,
    isLoading,
    navigateTo,
    navigateToLatest,
    invalidate,
    queryKey,
  }
}

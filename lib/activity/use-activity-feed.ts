import { useMemo } from 'react'
import { useInfiniteQuery, type InfiniteData } from '@tanstack/react-query'

import type {
  ActivityLogWithActor,
  ActivityTargetType,
} from '@/lib/activity/types'

const ACTIVITY_FEED_QUERY_KEY = 'activity-feed' as const

export type ActivityFeedQueryTarget =
  | ActivityTargetType
  | string
  | ReadonlyArray<ActivityTargetType | string>

export type UseActivityFeedOptions = {
  targetType: ActivityFeedQueryTarget
  targetId?: string | null
  projectId?: string | null
  clientId?: string | null
  pageSize?: number
  requireContext?: boolean
}

export type UseActivityFeedResult = {
  logs: ActivityLogWithActor[]
  isLoading: boolean
  isError: boolean
  error: Error | null
  hasNextPage: boolean
  isFetchingNextPage: boolean
  fetchNextPage: () => Promise<unknown>
  refetch: () => Promise<unknown>
  queryEnabled: boolean
  requiresContext: boolean
}

const DEFAULT_PAGE_SIZE = 20

export function useActivityFeed(
  options: UseActivityFeedOptions
): UseActivityFeedResult {
  const {
    targetType,
    targetId = null,
    projectId = null,
    clientId = null,
    pageSize = DEFAULT_PAGE_SIZE,
    requireContext = true,
  } = options

  const normalizedTargetTypes = useMemo(
    () => normalizeTargetTypes(targetType),
    [targetType]
  )
  const targetTypeKey = normalizedTargetTypes.join(',')
  const hasContext = Boolean(targetId || projectId || clientId)
  const queryEnabled = requireContext
    ? Boolean(normalizedTargetTypes.length > 0 && hasContext)
    : normalizedTargetTypes.length > 0

  const queryKey = useMemo(
    () =>
      [
        ACTIVITY_FEED_QUERY_KEY,
        targetTypeKey,
        targetId,
        projectId,
        clientId,
        pageSize,
        requireContext,
      ] as const,
    [targetTypeKey, targetId, projectId, clientId, pageSize, requireContext]
  )

  const query = useInfiniteQuery<
    ActivityApiResponse,
    Error,
    ActivityApiResponse,
    typeof queryKey,
    string | null
  >({
    queryKey,
    enabled: queryEnabled,
    initialPageParam: null,
    getNextPageParam: lastPage => lastPage.nextCursor ?? undefined,
    queryFn: async ({ pageParam }) => {
      if (!queryEnabled || normalizedTargetTypes.length === 0) {
        return { logs: [], hasMore: false, nextCursor: null }
      }

      const params = new URLSearchParams()

      normalizedTargetTypes.forEach(type => {
        params.append('targetType', type)
      })

      appendIfDefined(params, 'targetId', targetId)
      appendIfDefined(params, 'projectId', projectId)
      appendIfDefined(params, 'clientId', clientId)

      params.set('limit', pageSize.toString())

      if (pageParam) {
        params.set('cursor', pageParam)
      }

      const response = await fetch(`/api/activity?${params.toString()}`)

      if (!response.ok) {
        throw new Error('Failed to load activity.')
      }

      return (await response.json()) as ActivityApiResponse
    },
  })

  const logs = useMemo(() => {
    const data = query.data as
      | InfiniteData<ActivityApiResponse, string | null>
      | undefined

    if (!data) {
      return []
    }

    return data.pages.flatMap(page => page.logs)
  }, [query.data])

  return {
    logs,
    isLoading: query.isLoading,
    isError: query.isError,
    error: (query.error as Error | null) ?? null,
    hasNextPage: Boolean(query.hasNextPage),
    isFetchingNextPage: query.isFetchingNextPage,
    fetchNextPage: query.fetchNextPage,
    refetch: query.refetch,
    queryEnabled,
    requiresContext: requireContext,
  }
}

export type ActivityApiResponse = {
  logs: ActivityLogWithActor[]
  hasMore: boolean
  nextCursor: string | null
}

function normalizeTargetTypes(target: ActivityFeedQueryTarget): string[] {
  if (!target) {
    return []
  }

  const values = Array.isArray(target) ? target : [target]

  return values
    .map(value => String(value))
    .map(value => value.trim())
    .filter(Boolean)
    .sort()
}

function appendIfDefined(
  params: URLSearchParams,
  key: string,
  value: string | null
) {
  if (!value) {
    return
  }

  params.set(key, value)
}

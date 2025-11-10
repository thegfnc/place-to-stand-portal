import { useInfiniteQuery } from '@tanstack/react-query'

import type { TaskCommentsPage } from '@/lib/queries/task-comments'

export type TaskCommentsQueryArgs = {
  queryKey: readonly [string, string, string | null]
  taskId: string | null
  pageSize?: number
}

export function useTaskCommentsQuery({
  queryKey,
  taskId,
  pageSize,
}: TaskCommentsQueryArgs) {
  return useInfiniteQuery({
    queryKey,
    enabled: Boolean(taskId),
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      if (!taskId) {
        return {
          items: [],
          pageInfo: { hasNextPage: false, nextCursor: null },
        } satisfies TaskCommentsPage
      }

      const params = new URLSearchParams()
      if (pageParam) {
        params.set('cursor', pageParam)
      }

      if (pageSize) {
        params.set('limit', String(pageSize))
      }

      const response = await fetch(
        `/api/tasks/${taskId}/comments?${params.toString()}`,
        {
          method: 'GET',
          headers: {
            accept: 'application/json',
          },
          cache: 'no-store',
        }
      )

      if (!response.ok) {
        const message = await extractErrorMessage(response)
        console.error('Failed to load task comments', {
          status: response.status,
          message,
        })
        throw new Error(message ?? 'Failed to load task comments.')
      }

      const data = (await response.json()) as TaskCommentsPage
      return data
    },
    getNextPageParam: lastPage =>
      lastPage.pageInfo.hasNextPage ? lastPage.pageInfo.nextCursor : undefined,
  })
}

async function extractErrorMessage(response: Response): Promise<string | null> {
  try {
    const payload = await response.json()

    if (
      payload &&
      typeof payload === 'object' &&
      'error' in payload &&
      typeof (payload as { error?: unknown }).error === 'string'
    ) {
      return (payload as { error?: string }).error ?? null
    }
  } catch {
    // Ignore JSON parsing errors – only needed for improved logging.
  }

  return null
}

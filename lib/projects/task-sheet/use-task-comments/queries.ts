import { useQuery } from '@tanstack/react-query'

import type { TaskCommentWithAuthor } from '@/lib/types'

export type TaskCommentsQueryArgs = {
  queryKey: readonly [string, string, string | null]
  taskId: string | null
}

export function useTaskCommentsQuery({
  queryKey,
  taskId,
}: TaskCommentsQueryArgs) {
  return useQuery({
    queryKey,
    enabled: Boolean(taskId),
    queryFn: async () => {
      if (!taskId) {
        return [] as TaskCommentWithAuthor[]
      }

      const response = await fetch(`/api/tasks/${taskId}/comments`, {
        method: 'GET',
        headers: {
          accept: 'application/json',
        },
        cache: 'no-store',
      })

      if (!response.ok) {
        const message = await extractErrorMessage(response)
        console.error('Failed to load task comments', {
          status: response.status,
          message,
        })
        throw new Error(message ?? 'Failed to load task comments.')
      }

      const data = (await response.json()) as TaskCommentWithAuthor[]
      return data ?? []
    },
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

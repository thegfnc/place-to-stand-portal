import { useMutation } from '@tanstack/react-query'
import type { InfiniteData, QueryClient } from '@tanstack/react-query'
import type { useRouter } from 'next/navigation'

import { logClientActivity } from '@/lib/activity/client'
import {
  taskCommentCreatedEvent,
  taskCommentDeletedEvent,
  taskCommentUpdatedEvent,
} from '@/lib/activity/events'
import type { useToast } from '@/components/ui/use-toast'
import type { TaskCommentsPage } from '@/lib/queries/task-comments'
import type { TaskCommentWithAuthor } from '@/lib/types'

import { serializeCommentMetadata } from './helpers'
import type { CommentActivityMetadata } from './types'

type CommentsCache = InfiniteData<TaskCommentsPage, string | null>

/** Marks a row that exists only until the server round-trip lands. */
const OPTIMISTIC_COMMENT_ID_PREFIX = 'optimistic-'

export function isOptimisticComment(commentId: string): boolean {
  return commentId.startsWith(OPTIMISTIC_COMMENT_ID_PREFIX)
}

type RouterInstance = ReturnType<typeof useRouter>
type ToastFn = ReturnType<typeof useToast>['toast']

type BaseMutationArgs = {
  taskId: string | null
  projectId: string
  clientId: string | null
  currentUserId: string
  taskTitle?: string | null
  queryKey: readonly [string, string, string | null]
  queryClient: QueryClient
  router: RouterInstance
  toast: ToastFn
}

type CreateMutationArgs = BaseMutationArgs & {
  /** Byline for the optimistic row before the refetch supplies the real one. */
  currentUserName?: string | null
  onSuccess?: () => void
  /** Fired once the optimistic row is in the cache — clear the composer here. */
  onOptimisticInsert?: () => void
  /** Fired when the post failed and the row was removed — restore the draft. */
  onRollback?: (body: string) => void
}

type UpdateMutationArgs = BaseMutationArgs & {
  onSuccess?: () => void
}

type DeleteMutationArgs = BaseMutationArgs & {
  onSuccess?: () => void
}

const logCommentActivity = async (
  metadata: CommentActivityMetadata,
  args: Pick<
    BaseMutationArgs,
    'currentUserId' | 'projectId' | 'clientId' | 'taskTitle'
  >,
  eventFactory:
    | typeof taskCommentCreatedEvent
    | typeof taskCommentUpdatedEvent
    | typeof taskCommentDeletedEvent
) => {
  const event = eventFactory({ taskTitle: args.taskTitle })

  await logClientActivity(event, {
    actorId: args.currentUserId,
    targetType: 'COMMENT',
    targetId: metadata.commentId,
    targetProjectId: args.projectId,
    targetClientId: args.clientId,
    metadata: serializeCommentMetadata(metadata),
  })
}

/**
 * Reuse the author record from a comment this user already has in the cache,
 * so the optimistic byline matches the real one exactly. Falls back to the
 * name the sheet supplied when they haven't commented on this task before.
 */
function resolveOptimisticAuthor(
  cache: CommentsCache | undefined,
  currentUserId: string,
  currentUserName: string | null | undefined
): TaskCommentWithAuthor['author'] {
  const known = cache?.pages
    .flatMap(page => page.items)
    .find(item => item.author_id === currentUserId && item.author)?.author

  return (
    known ?? {
      id: currentUserId,
      full_name: currentUserName ?? null,
      email: null,
      avatar_url: null,
    }
  )
}

export function useCreateTaskCommentMutation({
  taskId,
  projectId,
  clientId,
  currentUserId,
  currentUserName,
  taskTitle,
  queryKey,
  queryClient,
  router,
  toast,
  onSuccess,
  onOptimisticInsert,
  onRollback,
}: CreateMutationArgs) {
  return useMutation({
    mutationFn: async (body: string) => {
      if (!taskId) {
        throw new Error('Task ID is required to post a comment.')
      }

      const response = await fetch(`/api/tasks/${taskId}/comments`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json',
        },
        cache: 'no-store',
        body: JSON.stringify({ body }),
      })

      await ensureOk(response, 'Failed to add comment.')

      const payload = (await response.json()) as { commentId?: string }

      if (!payload?.commentId) {
        throw new Error('Comment was created without an identifier.')
      }

      await logCommentActivity(
        { taskId, commentId: payload.commentId, bodyLength: body.length },
        { currentUserId, projectId, clientId, taskTitle },
        taskCommentCreatedEvent
      )

      return payload.commentId
    },
    onMutate: async (body: string) => {
      if (!taskId) {
        return { previous: undefined }
      }

      // Stop any in-flight refetch from overwriting the row we're about to add.
      await queryClient.cancelQueries({ queryKey })

      const previous = queryClient.getQueryData<CommentsCache>(queryKey)

      // Nothing cached yet (the thread never loaded) — let the refetch handle
      // it rather than inventing a page shape the query would replace anyway.
      if (!previous?.pages?.length) {
        return { previous }
      }

      const now = new Date().toISOString()
      const optimistic: TaskCommentWithAuthor = {
        id: `${OPTIMISTIC_COMMENT_ID_PREFIX}${now}`,
        task_id: taskId,
        author_id: currentUserId,
        body,
        created_at: now,
        // Equal to created_at so the row doesn't render an "Edited" marker.
        updated_at: now,
        deleted_at: null,
        author: resolveOptimisticAuthor(previous, currentUserId, currentUserName),
      }

      queryClient.setQueryData<CommentsCache>(queryKey, {
        ...previous,
        // Pages are newest-first, and the panel reverses the flattened list —
        // so the head of page 0 is what renders last, next to the composer.
        pages: previous.pages.map((page, index) =>
          index === 0 ? { ...page, items: [optimistic, ...page.items] } : page
        ),
      })

      onOptimisticInsert?.()

      return { previous }
    },
    onSuccess: () => {
      onSuccess?.()
      if (taskId) {
        router.refresh()
      }
      toast({
        title: 'Comment added',
        description: 'Your message is now visible to project collaborators.',
      })
    },
    onError: (error, body, context) => {
      console.error('Failed to add comment', error)

      // Drop the optimistic row and hand the text back so the post isn't lost.
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous)
      }
      onRollback?.(body)

      toast({
        title: 'Could not add comment',
        description:
          'Please try again. If the issue continues contact support.',
        variant: 'destructive',
      })
    },
    // Reconcile against the server on both paths: success swaps the temporary
    // row for the real one, failure re-syncs after the rollback.
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey })
    },
  })
}

export function useUpdateTaskCommentMutation({
  taskId,
  projectId,
  clientId,
  currentUserId,
  taskTitle,
  queryKey,
  queryClient,
  router,
  toast,
  onSuccess,
}: UpdateMutationArgs) {
  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: string }) => {
      const response = await fetch(`/api/task-comments/${id}`, {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json',
        },
        cache: 'no-store',
        body: JSON.stringify({ body }),
      })

      await ensureOk(response, 'Failed to update comment.')

      await logCommentActivity(
        { taskId: taskId ?? '', commentId: id, bodyLength: body.length },
        { currentUserId, projectId, clientId, taskTitle },
        taskCommentUpdatedEvent
      )
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey })
      onSuccess?.()
      if (taskId) {
        router.refresh()
      }
      toast({
        title: 'Comment updated',
        description: 'Your message has been refreshed.',
      })
    },
    onError: error => {
      console.error('Failed to update comment', error)
      toast({
        title: 'Could not update comment',
        description:
          'Please try again. If the issue continues contact support.',
        variant: 'destructive',
      })
    },
  })
}

export function useDeleteTaskCommentMutation({
  taskId,
  projectId,
  clientId,
  currentUserId,
  taskTitle,
  queryKey,
  queryClient,
  router,
  toast,
  onSuccess,
}: DeleteMutationArgs) {
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/task-comments/${id}`, {
        method: 'DELETE',
        headers: {
          accept: 'application/json',
        },
        cache: 'no-store',
      })

      await ensureOk(response, 'Failed to delete comment.')

      await logCommentActivity(
        { taskId: taskId ?? '', commentId: id },
        { currentUserId, projectId, clientId, taskTitle },
        taskCommentDeletedEvent
      )
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey })
      onSuccess?.()
      if (taskId) {
        router.refresh()
      }
      toast({
        title: 'Comment removed',
        description: 'The comment is now hidden from collaborators.',
      })
    },
    onError: error => {
      console.error('Failed to delete comment', error)
      toast({
        title: 'Could not delete comment',
        description:
          'Please try again. If the issue continues contact support.',
        variant: 'destructive',
      })
    },
  })
}

async function ensureOk(response: Response, fallbackMessage: string): Promise<void> {
  if (response.ok) {
    return
  }

  const message = await extractErrorMessage(response)
  throw new Error(message ?? fallbackMessage)
}

async function extractErrorMessage(response: Response): Promise<string | null> {
  try {
    if (response.headers.get('content-type')?.includes('application/json')) {
      const payload = await response.json()

      if (
        payload &&
        typeof payload === 'object' &&
        'error' in payload &&
        typeof (payload as { error?: unknown }).error === 'string'
      ) {
        return (payload as { error?: string }).error ?? null
      }
    }
  } catch {
    // Ignore JSON parsing issues – we only need this for improved error messaging.
  }

  return null
}

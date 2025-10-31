import { useMutation } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import type { useRouter } from 'next/navigation'

import { logClientActivity } from '@/lib/activity/client'
import {
  taskCommentCreatedEvent,
  taskCommentDeletedEvent,
  taskCommentUpdatedEvent,
} from '@/lib/activity/events'
import type { useToast } from '@/components/ui/use-toast'

import { serializeCommentMetadata } from './helpers'
import type { CommentActivityMetadata } from './types'
import type { SupabaseBrowserClient } from './queries'

type RouterInstance = ReturnType<typeof useRouter>
type ToastFn = ReturnType<typeof useToast>['toast']

type BaseMutationArgs = {
  taskId: string | null
  projectId: string
  clientId: string | null
  currentUserId: string
  taskTitle?: string | null
  supabase: SupabaseBrowserClient
  queryKey: readonly [string, string, string | null]
  queryClient: QueryClient
  router: RouterInstance
  toast: ToastFn
}

type CreateMutationArgs = BaseMutationArgs & {
  onSuccess?: () => void
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

export function useCreateTaskCommentMutation({
  taskId,
  projectId,
  clientId,
  currentUserId,
  taskTitle,
  supabase,
  queryKey,
  queryClient,
  router,
  toast,
  onSuccess,
}: CreateMutationArgs) {
  return useMutation({
    mutationFn: async (body: string) => {
      if (!taskId) {
        throw new Error('Task ID is required to post a comment.')
      }

      const { data, error } = await supabase
        .from('task_comments')
        .insert({
          task_id: taskId,
          author_id: currentUserId,
          body,
        })
        .select('id')
        .single()

      if (error || !data) {
        throw error ?? new Error('Comment was created without an identifier.')
      }

      await logCommentActivity(
        { taskId, commentId: data.id, bodyLength: body.length },
        { currentUserId, projectId, clientId, taskTitle },
        taskCommentCreatedEvent
      )

      return data.id
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey })
      onSuccess?.()
      if (taskId) {
        router.refresh()
      }
      toast({
        title: 'Comment added',
        description: 'Your message is now visible to project collaborators.',
      })
    },
    onError: error => {
      console.error('Failed to add comment', error)
      toast({
        title: 'Could not add comment',
        description:
          'Please try again. If the issue continues contact support.',
        variant: 'destructive',
      })
    },
  })
}

export function useUpdateTaskCommentMutation({
  taskId,
  projectId,
  clientId,
  currentUserId,
  taskTitle,
  supabase,
  queryKey,
  queryClient,
  router,
  toast,
  onSuccess,
}: UpdateMutationArgs) {
  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: string }) => {
      const { error } = await supabase
        .from('task_comments')
        .update({ body })
        .eq('id', id)

      if (error) {
        throw error
      }

      await logCommentActivity(
        { taskId: taskId ?? '', commentId: id, bodyLength: body.length },
        { currentUserId, projectId, clientId, taskTitle },
        taskCommentUpdatedEvent
      )
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey })
      onSuccess?.()
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
  supabase,
  queryKey,
  queryClient,
  router,
  toast,
  onSuccess,
}: DeleteMutationArgs) {
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('task_comments')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id)

      if (error) {
        throw error
      }

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

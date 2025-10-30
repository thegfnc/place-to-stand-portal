'use client'

import { useCallback, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { useToast } from '@/components/ui/use-toast'
import { logClientActivity } from '@/lib/activity/client'
import {
  taskCommentCreatedEvent,
  taskCommentDeletedEvent,
  taskCommentUpdatedEvent,
} from '@/lib/activity/events'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { sanitizeEditorHtml } from '@/components/ui/rich-text-editor/utils'
import { normalizeRichTextContent } from '@/lib/projects/task-sheet/task-sheet-utils'
import type { TaskCommentWithAuthor } from '@/lib/types'
import type { Json } from '@/supabase/types/database'

export const TASK_COMMENTS_QUERY_KEY = 'task-comments'

const prepareCommentBody = (content: string) => {
  const sanitized = sanitizeEditorHtml(content)
  const normalized = normalizeRichTextContent(sanitized)

  if (!normalized) {
    return null
  }

  return sanitized
}

export type UseTaskCommentsOptions = {
  taskId: string | null
  projectId: string
  currentUserId: string
  canComment: boolean
  taskTitle?: string | null
  clientId?: string | null
}

export type UseTaskCommentsState = {
  taskId: string | null
  comments: TaskCommentWithAuthor[]
  isLoading: boolean
  isError: boolean
  refresh: () => void
  composer: {
    value: string
    onChange: (value: string) => void
    submit: () => void
    disabled: boolean
    isSubmitting: boolean
    canComment: boolean
  }
  editing: {
    commentId: string | null
    draft: string
    setDraft: (value: string) => void
    start: (comment: TaskCommentWithAuthor) => void
    cancel: () => void
    confirm: () => void
  }
  deletion: {
    targetId: string | null
    request: (id: string) => void
    cancel: () => void
    confirm: () => void
    isPending: boolean
  }
  isMutating: boolean
}

export function useTaskComments(
  options: UseTaskCommentsOptions
): UseTaskCommentsState {
  const { taskId, projectId, currentUserId, canComment, taskTitle, clientId } =
    options

  const router = useRouter()
  const supabase = getSupabaseBrowserClient()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const [draft, setDraft] = useState('')
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null)
  const [editingDraft, setEditingDraft] = useState('')
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)

  const commentsQueryKey = useMemo(
    () => [TASK_COMMENTS_QUERY_KEY, projectId, taskId],
    [projectId, taskId]
  )

  const {
    data: comments,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: commentsQueryKey,
    enabled: Boolean(taskId),
    queryFn: async () => {
      if (!taskId) {
        return [] as TaskCommentWithAuthor[]
      }

      const { data, error } = await supabase
        .from('task_comments')
        .select(
          `
          id,
          task_id,
          author_id,
          body,
          created_at,
          updated_at,
          deleted_at,
          author:users (
            id,
            full_name,
            email
          )
        `
        )
        .eq('task_id', taskId)
        .is('deleted_at', null)
        .order('created_at', { ascending: true })

      if (error) {
        console.error('Failed to load task comments', error)
        throw error
      }

      return (data ?? []) as TaskCommentWithAuthor[]
    },
  })

  const createComment = useMutation({
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

      const event = taskCommentCreatedEvent({ taskTitle })
      const metadata = {
        taskId,
        commentId: data.id,
        bodyLength: body.length,
      }

      await logClientActivity(event, {
        actorId: currentUserId,
        targetType: 'COMMENT',
        targetId: data.id,
        targetProjectId: projectId,
        targetClientId: clientId ?? null,
        metadata: JSON.parse(JSON.stringify(metadata)) as Json,
      })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: commentsQueryKey })
      setDraft('')
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

  const updateComment = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: string }) => {
      const { error } = await supabase
        .from('task_comments')
        .update({ body })
        .eq('id', id)

      if (error) {
        throw error
      }

      const event = taskCommentUpdatedEvent({ taskTitle })
      const metadata = {
        taskId,
        commentId: id,
        bodyLength: body.length,
      }

      await logClientActivity(event, {
        actorId: currentUserId,
        targetType: 'COMMENT',
        targetId: id,
        targetProjectId: projectId,
        targetClientId: clientId ?? null,
        metadata: JSON.parse(JSON.stringify(metadata)) as Json,
      })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: commentsQueryKey })
      setEditingCommentId(null)
      setEditingDraft('')
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

  const deleteComment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('task_comments')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id)

      if (error) {
        throw error
      }

      const event = taskCommentDeletedEvent({ taskTitle })
      const metadata = {
        taskId,
        commentId: id,
      }

      await logClientActivity(event, {
        actorId: currentUserId,
        targetType: 'COMMENT',
        targetId: id,
        targetProjectId: projectId,
        targetClientId: clientId ?? null,
        metadata: JSON.parse(JSON.stringify(metadata)) as Json,
      })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: commentsQueryKey })
      setDeleteTargetId(null)
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

  const handleSubmit = useCallback(() => {
    const prepared = prepareCommentBody(draft)

    if (!prepared) {
      return
    }

    createComment.mutate(prepared)
  }, [createComment, draft])

  const handleStartEdit = useCallback((comment: TaskCommentWithAuthor) => {
    setEditingCommentId(comment.id)
    setEditingDraft(sanitizeEditorHtml(comment.body ?? ''))
  }, [])

  const handleCancelEdit = useCallback(() => {
    setEditingCommentId(null)
    setEditingDraft('')
  }, [])

  const handleConfirmEdit = useCallback(() => {
    if (!editingCommentId) {
      return
    }

    const prepared = prepareCommentBody(editingDraft)
    if (!prepared) {
      return
    }

    updateComment.mutate({ id: editingCommentId, body: prepared })
  }, [editingCommentId, editingDraft, updateComment])

  const handleRequestDelete = useCallback((commentId: string) => {
    setDeleteTargetId(commentId)
  }, [])

  const handleCancelDeleteDialog = useCallback(() => {
    setDeleteTargetId(null)
  }, [])

  const handleConfirmDelete = useCallback(() => {
    if (!deleteTargetId) {
      return
    }

    deleteComment.mutate(deleteTargetId)
  }, [deleteComment, deleteTargetId])

  const isMutating =
    createComment.isPending ||
    updateComment.isPending ||
    deleteComment.isPending

  return {
    taskId,
    comments: comments ?? [],
    isLoading,
    isError,
    refresh: () => {
      void refetch()
    },
    composer: {
      value: draft,
      onChange: setDraft,
      submit: handleSubmit,
      disabled: !canComment || isMutating,
      isSubmitting: createComment.isPending,
      canComment,
    },
    editing: {
      commentId: editingCommentId,
      draft: editingDraft,
      setDraft: setEditingDraft,
      start: handleStartEdit,
      cancel: handleCancelEdit,
      confirm: handleConfirmEdit,
    },
    deletion: {
      targetId: deleteTargetId,
      request: handleRequestDelete,
      cancel: handleCancelDeleteDialog,
      confirm: handleConfirmDelete,
      isPending: deleteComment.isPending,
    },
    isMutating,
  }
}

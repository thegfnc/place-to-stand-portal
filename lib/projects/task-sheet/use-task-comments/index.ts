'use client'

import { useCallback, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'

import { useToast } from '@/components/ui/use-toast'
import { sanitizeEditorHtml } from '@/components/ui/rich-text-editor/utils'

import { TASK_COMMENTS_QUERY_KEY, prepareCommentBody } from './helpers'
import {
  useCreateTaskCommentMutation,
  useDeleteTaskCommentMutation,
  useUpdateTaskCommentMutation,
} from './mutations'
import { useTaskCommentsQuery } from './queries'
import type { UseTaskCommentsOptions, UseTaskCommentsState } from './types'
import type { TaskCommentWithAuthor } from '@/lib/types'

export function useTaskComments(
  options: UseTaskCommentsOptions
): UseTaskCommentsState {
  const { taskId, projectId, currentUserId, canComment, taskTitle, clientId } =
    options

  const router = useRouter()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const [draft, setDraft] = useState('')
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null)
  const [editingDraft, setEditingDraft] = useState('')
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)

  const commentsQueryKey = useMemo(
    () => [TASK_COMMENTS_QUERY_KEY, projectId, taskId] as const,
    [projectId, taskId]
  )

  const {
    data: comments,
    isLoading,
    isError,
    refetch,
  } = useTaskCommentsQuery({
    queryKey: commentsQueryKey,
    taskId,
  })

  const createComment = useCreateTaskCommentMutation({
    taskId,
    projectId,
    clientId: clientId ?? null,
    currentUserId,
    taskTitle,
    queryKey: commentsQueryKey,
    queryClient,
    router,
    toast,
    onSuccess: () => {
      setDraft('')
    },
  })

  const updateComment = useUpdateTaskCommentMutation({
    taskId,
    projectId,
    clientId: clientId ?? null,
    currentUserId,
    taskTitle,
    queryKey: commentsQueryKey,
    queryClient,
    router,
    toast,
    onSuccess: () => {
      setEditingCommentId(null)
      setEditingDraft('')
    },
  })

  const deleteComment = useDeleteTaskCommentMutation({
    taskId,
    projectId,
    clientId: clientId ?? null,
    currentUserId,
    taskTitle,
    queryKey: commentsQueryKey,
    queryClient,
    router,
    toast,
    onSuccess: () => {
      setDeleteTargetId(null)
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

export type { UseTaskCommentsOptions, UseTaskCommentsState } from './types'

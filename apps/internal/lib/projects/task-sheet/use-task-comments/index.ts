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
  const {
    taskId,
    projectId,
    currentUserId,
    currentUserName,
    canComment,
  } = options

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
    data,
    isLoading,
    isError,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useTaskCommentsQuery({
    queryKey: commentsQueryKey,
    taskId,
    pageSize: 20,
  })

  /**
   * The keyset query is newest-first (page 1 = the 20 most recent, page 2 the
   * 20 before that), which is what pagination needs — but the thread renders
   * chronologically, so the newest comment sits at the bottom next to the
   * composer. Reversing the FLATTENED list (not each page) keeps that correct
   * across pages: every older page lands above the ones already shown.
   */
  const flattenedComments = useMemo(() => {
    // flatMap returns a fresh array, so reversing in place can't mutate the
    // React Query cache.
    return (data?.pages?.flatMap(page => page.items) ?? []).reverse()
  }, [data?.pages])

  const loadMore = useCallback(() => {
    if (!hasNextPage) {
      return
    }
    void fetchNextPage()
  }, [fetchNextPage, hasNextPage])

  const createComment = useCreateTaskCommentMutation({
    taskId,
    currentUserId,
    currentUserName,
    queryKey: commentsQueryKey,
    queryClient,
    router,
    toast,
    // The composer empties the moment the optimistic row appears, not after
    // the round-trip — and the draft comes back if the post fails.
    onOptimisticInsert: () => {
      setDraft('')
    },
    onRollback: body => {
      setDraft(body)
    },
  })

  const updateComment = useUpdateTaskCommentMutation({
    taskId,
    currentUserId,
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
    currentUserId,
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
    comments: flattenedComments,
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
    pagination: {
      hasNextPage: Boolean(hasNextPage),
      isFetchingNextPage,
      loadMore,
    },
  }
}

export type { UseTaskCommentsOptions, UseTaskCommentsState } from './types'

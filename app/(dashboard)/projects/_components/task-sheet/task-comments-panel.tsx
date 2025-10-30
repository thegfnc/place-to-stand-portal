'use client'

import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { Loader2, Pencil, Send, Trash2, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'
import { RichTextEditor } from '@/components/ui/rich-text-editor'
import { useToast } from '@/components/ui/use-toast'
import {
  isContentEmpty,
  sanitizeEditorHtml,
} from '@/components/ui/rich-text-editor/utils'
import { logClientActivity } from '@/lib/activity/client'
import {
  taskCommentCreatedEvent,
  taskCommentDeletedEvent,
  taskCommentUpdatedEvent,
} from '@/lib/activity/events'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { normalizeRichTextContent } from '@/lib/projects/task-sheet/task-sheet-utils'
import type { TaskCommentWithAuthor } from '@/lib/types'
import type { Json } from '@/supabase/types/database'

const COMMENTS_QUERY_KEY = 'task-comments'

type TaskCommentsPanelProps = {
  taskId: string | null
  projectId: string
  currentUserId: string
  canComment: boolean
  taskTitle?: string | null
  clientId?: string | null
}

const prepareCommentBody = (content: string) => {
  const sanitized = sanitizeEditorHtml(content)
  const normalized = normalizeRichTextContent(sanitized)

  if (!normalized) {
    return null
  }

  return sanitized
}

export function TaskCommentsPanel({
  taskId,
  projectId,
  currentUserId,
  canComment,
  taskTitle,
  clientId,
}: TaskCommentsPanelProps) {
  const router = useRouter()
  const supabase = getSupabaseBrowserClient()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [draft, setDraft] = useState('')
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null)
  const [editingDraft, setEditingDraft] = useState('')
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)

  const commentsQueryKey = useMemo(
    () => [COMMENTS_QUERY_KEY, projectId, taskId],
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

  const isPending =
    createComment.isPending ||
    updateComment.isPending ||
    deleteComment.isPending

  if (!taskId) {
    return (
      <PanelShell
        title='Comments'
        description='Save the task to start a threaded conversation with collaborators.'
      >
        <EmptyState message='Comments activate after the task is created.' />
      </PanelShell>
    )
  }

  return (
    <>
      <h3 className='mb-4 text-base font-semibold'>Comments</h3>
      {isLoading ? (
        <div className='text-muted-foreground flex items-center gap-2 text-sm'>
          <Loader2 className='h-4 w-4 animate-spin' /> Loading comments…
        </div>
      ) : isError ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : (
        <div className='space-y-4'>
          <CommentComposer
            value={draft}
            onChange={setDraft}
            onSubmit={handleSubmit}
            disabled={!canComment || isPending}
            pending={createComment.isPending}
            canComment={canComment}
          />
          <div className='space-y-4'>
            {comments && comments.length > 0 ? (
              comments.map(comment => {
                const isAuthor = comment.author_id === currentUserId
                const isEditing = editingCommentId === comment.id

                return (
                  <CommentItem
                    key={comment.id}
                    comment={comment}
                    isAuthor={isAuthor}
                    isEditing={isEditing}
                    editingDraft={isEditing ? editingDraft : ''}
                    onChangeEditingDraft={setEditingDraft}
                    onStartEdit={handleStartEdit}
                    onCancelEdit={handleCancelEdit}
                    onConfirmEdit={handleConfirmEdit}
                    onRequestDelete={handleRequestDelete}
                    disableActions={isPending}
                  />
                )
              })
            ) : (
              <EmptyState message='No comments yet. Be the first to share an update.' />
            )}
          </div>
        </div>
      )}
      <ConfirmDialog
        open={Boolean(deleteTargetId)}
        title='Delete comment?'
        description='This comment will be removed from the task.'
        confirmLabel='Delete'
        confirmVariant='destructive'
        confirmDisabled={deleteComment.isPending}
        onCancel={handleCancelDeleteDialog}
        onConfirm={handleConfirmDelete}
      />
    </>
  )
}

type PanelShellProps = {
  title: string
  description: string
  children: ReactNode
  action?: ReactNode
}

export function PanelShell({
  title,
  description,
  children,
  action,
}: PanelShellProps) {
  return (
    <section className='space-y-4 rounded-xl border px-5 py-4 shadow-sm'>
      <div className='flex flex-wrap items-start justify-between gap-3'>
        <div>
          <h3 className='text-sm font-semibold'>{title}</h3>
          <p className='text-muted-foreground text-xs'>{description}</p>
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

type CommentComposerProps = {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  disabled: boolean
  pending: boolean
  canComment: boolean
}

function CommentComposer({
  value,
  onChange,
  onSubmit,
  disabled,
  pending,
  canComment,
}: CommentComposerProps) {
  const handleSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      if (!disabled) {
        onSubmit()
      }
    },
    [disabled, onSubmit]
  )

  const isEmpty = isContentEmpty(value)

  return (
    <form onSubmit={handleSubmit} className='space-y-3'>
      <RichTextEditor
        id='task-comment-composer'
        value={value}
        onChange={onChange}
        placeholder={
          canComment
            ? 'Share context, ask a question, or leave an update for the team.'
            : 'You do not have permission to post comments on this task.'
        }
        disabled={disabled}
        contentMinHeightClassName='[&_.ProseMirror]:min-h-20'
      />
      <div className='flex justify-end'>
        <DisabledFieldTooltip
          disabled={disabled}
          reason={
            canComment
              ? disabled
                ? 'Finish editing or wait for the previous action to complete.'
                : null
              : 'Only project collaborators can post comments.'
          }
        >
          <Button
            type='submit'
            disabled={disabled || isEmpty}
            className='flex items-center gap-2'
          >
            {pending ? (
              <Loader2 className='h-4 w-4 animate-spin' />
            ) : (
              <Send className='h-4 w-4' />
            )}
            Post comment
          </Button>
        </DisabledFieldTooltip>
      </div>
    </form>
  )
}

type CommentItemProps = {
  comment: TaskCommentWithAuthor
  isAuthor: boolean
  isEditing: boolean
  editingDraft: string
  onChangeEditingDraft: (value: string) => void
  onStartEdit: (comment: TaskCommentWithAuthor) => void
  onCancelEdit: () => void
  onConfirmEdit: () => void
  onRequestDelete: (id: string) => void
  disableActions: boolean
}

function CommentItem({
  comment,
  isAuthor,
  isEditing,
  editingDraft,
  onChangeEditingDraft,
  onStartEdit,
  onCancelEdit,
  onConfirmEdit,
  onRequestDelete,
  disableActions,
}: CommentItemProps) {
  const authorName =
    comment.author?.full_name ?? comment.author?.email ?? 'Unknown user'
  const createdAgo = formatDistanceToNow(new Date(comment.created_at), {
    addSuffix: true,
  })
  const edited = comment.updated_at && comment.updated_at !== comment.created_at
  const sanitizedBody = useMemo(
    () => sanitizeEditorHtml(comment.body ?? ''),
    [comment.body]
  )
  const isEditingEmpty = isContentEmpty(editingDraft)

  if (isEditing) {
    return (
      <div className='border-primary/30 bg-primary/5 rounded-lg border p-4 shadow-sm'>
        <div className='text-muted-foreground mb-2 flex items-center justify-between gap-2 text-xs'>
          <span className='text-foreground font-medium'>
            Editing your comment
          </span>
          <span>{createdAgo}</span>
        </div>
        <RichTextEditor
          key={`comment-edit-${comment.id}`}
          value={editingDraft}
          onChange={onChangeEditingDraft}
          disabled={disableActions}
          placeholder='Update your comment...'
          contentMinHeightClassName='[&_.ProseMirror]:min-h-20'
        />
        <div className='mt-3 flex items-center justify-end gap-2'>
          <Button
            type='button'
            variant='outline'
            size='sm'
            onClick={onCancelEdit}
          >
            <X className='mr-1 h-3.5 w-3.5' /> Cancel
          </Button>
          <Button
            type='button'
            size='sm'
            onClick={onConfirmEdit}
            disabled={isEditingEmpty || disableActions}
          >
            <Send className='mr-1 h-3.5 w-3.5' /> Save
          </Button>
        </div>
      </div>
    )
  }

  return (
    <article className='rounded-lg border px-4 py-3 shadow-sm'>
      <div
        className='text-foreground [&_a]:text-primary [&_code]:bg-muted [&_pre]:bg-muted space-y-2 text-sm leading-relaxed [&_a]:underline [&_a]:underline-offset-4 [&_code]:rounded [&_code]:px-1 [&_code]:py-0.5 [&_li]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded [&_pre]:p-3 [&_ul]:list-disc [&_ul]:pl-5'
        dangerouslySetInnerHTML={{ __html: sanitizedBody }}
      />
      <footer className='text-muted-foreground mt-3 flex flex-wrap items-center justify-between gap-2 text-xs'>
        <div className='flex flex-wrap items-center gap-2'>
          <span className='text-foreground font-medium'>{authorName}</span>
          <span>{createdAgo}</span>
          {edited ? <span>Edited</span> : null}
        </div>
        {isAuthor ? (
          <div className='flex items-center gap-2'>
            <Button
              type='button'
              variant='ghost'
              size='sm'
              className='text-muted-foreground hover:text-foreground'
              onClick={() => onStartEdit(comment)}
              disabled={disableActions}
            >
              <Pencil className='h-3.5! w-3.5!' />
            </Button>
            <Button
              type='button'
              variant='ghost'
              size='sm'
              className='text-muted-foreground hover:text-destructive'
              onClick={() => onRequestDelete(comment.id)}
              disabled={disableActions}
            >
              <Trash2 className='h-3.5! w-3.5!' />
            </Button>
          </div>
        ) : null}
      </footer>
    </article>
  )
}

type EmptyStateProps = {
  message: string
}

export function EmptyState({ message }: EmptyStateProps) {
  return (
    <div className='text-muted-foreground rounded-lg border border-dashed px-4 py-6 text-center text-sm'>
      {message}
    </div>
  )
}

type ErrorStateProps = {
  onRetry: () => void
}

export function ErrorState({ onRetry }: ErrorStateProps) {
  return (
    <div className='border-destructive/40 bg-destructive/10 text-destructive flex flex-col items-center gap-3 rounded-lg border px-4 py-6 text-center text-sm'>
      <p>We couldn&apos;t load the latest comments.</p>
      <Button variant='outline' size='sm' onClick={onRetry}>
        Retry
      </Button>
    </div>
  )
}

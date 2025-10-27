'use client'

import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { Loader2, Pencil, Send, Trash2, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/use-toast'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import type { TaskCommentWithAuthor } from '@/lib/types'

const COMMENTS_QUERY_KEY = 'task-comments'

type TaskCommentsPanelProps = {
  taskId: string | null
  projectId: string
  currentUserId: string
  canComment: boolean
}

export function TaskCommentsPanel({
  taskId,
  projectId,
  currentUserId,
  canComment,
}: TaskCommentsPanelProps) {
  const supabase = getSupabaseBrowserClient()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [draft, setDraft] = useState('')
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null)
  const [editingDraft, setEditingDraft] = useState('')

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

      const { error } = await supabase.from('task_comments').insert({
        task_id: taskId,
        author_id: currentUserId,
        body,
      })

      if (error) {
        throw error
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: commentsQueryKey })
      setDraft('')
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
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: commentsQueryKey })
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
    const trimmed = draft.trim()

    if (!trimmed) {
      return
    }

    createComment.mutate(trimmed)
  }, [createComment, draft])

  const handleStartEdit = useCallback((comment: TaskCommentWithAuthor) => {
    setEditingCommentId(comment.id)
    setEditingDraft(comment.body)
  }, [])

  const handleCancelEdit = useCallback(() => {
    setEditingCommentId(null)
    setEditingDraft('')
  }, [])

  const handleConfirmEdit = useCallback(() => {
    if (!editingCommentId) {
      return
    }

    const trimmed = editingDraft.trim()
    if (!trimmed) {
      return
    }

    updateComment.mutate({ id: editingCommentId, body: trimmed })
  }, [editingCommentId, editingDraft, updateComment])

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
    <PanelShell
      title='Comments'
      description='Collaborate with clients and teammates directly on this task.'
    >
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
          <Separator />
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
                    onDelete={id => deleteComment.mutate(id)}
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
    </PanelShell>
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

  return (
    <form onSubmit={handleSubmit} className='space-y-3'>
      <Textarea
        value={value}
        onChange={event => onChange(event.target.value)}
        placeholder={
          canComment
            ? 'Share context, ask a question, or leave an update for the team.'
            : 'You do not have permission to post comments on this task.'
        }
        disabled={disabled}
        minLength={1}
        maxLength={2000}
        rows={4}
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
            disabled={disabled || !value.trim()}
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
  onDelete: (id: string) => void
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
  onDelete,
  disableActions,
}: CommentItemProps) {
  const authorName =
    comment.author?.full_name ?? comment.author?.email ?? 'Unknown user'
  const createdAgo = formatDistanceToNow(new Date(comment.created_at), {
    addSuffix: true,
  })
  const edited = comment.updated_at && comment.updated_at !== comment.created_at

  if (isEditing) {
    return (
      <div className='border-primary/30 bg-primary/5 rounded-lg border p-4 shadow-sm'>
        <div className='text-muted-foreground mb-2 flex items-center justify-between gap-2 text-xs'>
          <span className='text-foreground font-medium'>
            Editing your comment
          </span>
          <span>{createdAgo}</span>
        </div>
        <Textarea
          value={editingDraft}
          onChange={event => onChangeEditingDraft(event.target.value)}
          rows={4}
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
            disabled={!editingDraft.trim() || disableActions}
          >
            <Send className='mr-1 h-3.5 w-3.5' /> Save
          </Button>
        </div>
      </div>
    )
  }

  return (
    <article className='rounded-lg border px-4 py-3 shadow-sm'>
      <header className='text-muted-foreground mb-2 flex flex-wrap items-center justify-between gap-2 text-xs'>
        <span className='text-foreground font-medium'>{authorName}</span>
        <span>{createdAgo}</span>
      </header>
      <p className='text-foreground text-sm leading-relaxed whitespace-pre-wrap'>
        {comment.body}
      </p>
      <footer className='text-muted-foreground mt-3 flex items-center justify-between gap-2 text-xs'>
        {edited ? <span>Edited</span> : <span aria-hidden='true' />}
        {isAuthor ? (
          <div className='flex items-center gap-2'>
            <Button
              type='button'
              variant='ghost'
              size='sm'
              className='text-muted-foreground hover:text-foreground h-7 px-2'
              onClick={() => onStartEdit(comment)}
              disabled={disableActions}
            >
              <Pencil className='mr-1 h-3.5 w-3.5' /> Edit
            </Button>
            <Button
              type='button'
              variant='ghost'
              size='sm'
              className='text-muted-foreground hover:text-destructive h-7 px-2'
              onClick={() => onDelete(comment.id)}
              disabled={disableActions}
            >
              <Trash2 className='mr-1 h-3.5 w-3.5' /> Delete
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

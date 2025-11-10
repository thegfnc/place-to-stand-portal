'use client'

import { useCallback, useMemo } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { Loader2, Pencil, Send, Trash2, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'
import { RichTextEditor } from '@/components/ui/rich-text-editor'
import {
  isContentEmpty,
  sanitizeEditorHtml,
} from '@/components/ui/rich-text-editor/utils'
import type { TaskCommentWithAuthor } from '@/lib/types'

export type TaskCommentsPanelShellProps = {
  title: string
  description: string
  children: ReactNode
  action?: ReactNode
}

export function TaskCommentsPanelShell(props: TaskCommentsPanelShellProps) {
  const { title, description, children, action } = props
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

export type TaskCommentComposerProps = {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  disabled: boolean
  pending: boolean
  canComment: boolean
}

export function TaskCommentComposer(props: TaskCommentComposerProps) {
  const { value, onChange, onSubmit, disabled, pending, canComment } = props

  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
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

export type TaskCommentItemProps = {
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

export function TaskCommentItem(props: TaskCommentItemProps) {
  const {
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
  } = props

  const authorName = comment.author?.full_name ?? 'Unknown user'
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
              <Pencil className='h-3.5 w-3.5' />
            </Button>
            <Button
              type='button'
              variant='ghost'
              size='sm'
              className='text-muted-foreground hover:text-destructive'
              onClick={() => onRequestDelete(comment.id)}
              disabled={disableActions}
            >
              <Trash2 className='h-3.5 w-3.5' />
            </Button>
          </div>
        ) : null}
      </footer>
    </article>
  )
}

export type TaskCommentsEmptyStateProps = {
  message: string
}

export function TaskCommentsEmptyState(props: TaskCommentsEmptyStateProps) {
  const { message } = props
  return (
    <div className='text-muted-foreground rounded-lg border border-dashed px-4 py-6 text-center text-sm'>
      {message}
    </div>
  )
}

export type TaskCommentsErrorStateProps = {
  onRetry: () => void
}

export function TaskCommentsErrorState(props: TaskCommentsErrorStateProps) {
  const { onRetry } = props
  return (
    <div className='border-destructive/40 bg-destructive/10 text-destructive flex flex-col items-center gap-3 rounded-lg border px-4 py-6 text-center text-sm'>
      <p>We couldn&apos;t load the latest comments.</p>
      <Button variant='outline' size='sm' onClick={onRetry}>
        Retry
      </Button>
    </div>
  )
}

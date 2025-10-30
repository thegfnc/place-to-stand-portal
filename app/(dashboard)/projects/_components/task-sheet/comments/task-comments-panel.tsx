'use client'

import { Loader2 } from 'lucide-react'

import { ConfirmDialog } from '@/components/ui/confirm-dialog'

import { useTaskComments } from '@/lib/projects/task-sheet/use-task-comments'

import {
  TaskCommentComposer,
  TaskCommentItem,
  TaskCommentsEmptyState,
  TaskCommentsErrorState,
  TaskCommentsPanelShell,
} from './task-comments-components'

export type TaskCommentsPanelProps = {
  taskId: string | null
  projectId: string
  currentUserId: string
  canComment: boolean
  taskTitle?: string | null
  clientId?: string | null
}

export function TaskCommentsPanel(props: TaskCommentsPanelProps) {
  const state = useTaskComments(props)

  if (!state.taskId) {
    return (
      <TaskCommentsPanelShell
        title='Comments'
        description='Save the task to start a threaded conversation with collaborators.'
      >
        <TaskCommentsEmptyState message='Comments activate after the task is created.' />
      </TaskCommentsPanelShell>
    )
  }

  return (
    <>
      <h3 className='mb-4 text-base font-semibold'>Comments</h3>
      {state.isLoading ? (
        <div className='text-muted-foreground flex items-center gap-2 text-sm'>
          <Loader2 className='h-4 w-4 animate-spin' /> Loading comments…
        </div>
      ) : state.isError ? (
        <TaskCommentsErrorState onRetry={state.refresh} />
      ) : (
        <div className='space-y-4'>
          <TaskCommentComposer
            value={state.composer.value}
            onChange={state.composer.onChange}
            onSubmit={state.composer.submit}
            disabled={state.composer.disabled}
            pending={state.composer.isSubmitting}
            canComment={state.composer.canComment}
          />
          <div className='space-y-4'>
            {state.comments.length > 0 ? (
              state.comments.map(comment => (
                <TaskCommentItem
                  key={comment.id}
                  comment={comment}
                  isAuthor={comment.author_id === props.currentUserId}
                  isEditing={state.editing.commentId === comment.id}
                  editingDraft={
                    state.editing.commentId === comment.id
                      ? state.editing.draft
                      : ''
                  }
                  onChangeEditingDraft={state.editing.setDraft}
                  onStartEdit={state.editing.start}
                  onCancelEdit={state.editing.cancel}
                  onConfirmEdit={state.editing.confirm}
                  onRequestDelete={state.deletion.request}
                  disableActions={state.isMutating}
                />
              ))
            ) : (
              <TaskCommentsEmptyState message='No comments yet. Be the first to share an update.' />
            )}
          </div>
        </div>
      )}
      <ConfirmDialog
        open={Boolean(state.deletion.targetId)}
        title='Delete comment?'
        description='This comment will be removed from the task.'
        confirmLabel='Delete'
        confirmVariant='destructive'
        confirmDisabled={state.deletion.isPending}
        onCancel={state.deletion.cancel}
        onConfirm={state.deletion.confirm}
      />
    </>
  )
}

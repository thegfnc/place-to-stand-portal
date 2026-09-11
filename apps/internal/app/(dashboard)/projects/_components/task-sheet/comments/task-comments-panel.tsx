'use client'

import { Loader2 } from 'lucide-react'

import { Button } from '@pts/ui/button'
import { ConfirmDialog } from '@pts/ui/confirm-dialog'

import { useTaskComments } from '@/lib/projects/task-sheet/use-task-comments'
import { isOptimisticComment } from '@/lib/projects/task-sheet/use-task-comments/mutations'

import { SheetEmptyState } from '@/components/sheets/sheet-empty-state'

import {
  TaskCommentComposer,
  TaskCommentItem,
  TaskCommentsErrorState,
  TaskCommentsPanelShell,
} from './task-comments-components'

export type TaskCommentsPanelProps = {
  taskId: string | null
  projectId: string
  currentUserId: string
  /** Byline for the optimistic comment until the refetch replaces it. */
  currentUserName?: string | null
  canComment: boolean
  taskTitle?: string | null
  clientId?: string | null
}

export function TaskCommentsPanel(props: TaskCommentsPanelProps) {
  const state = useTaskComments(props)

  if (!state.taskId) {
    return (
      <TaskCommentsPanelShell description='Save the task to start a threaded conversation with collaborators.'>
        <SheetEmptyState message='Comments activate after the task is created.' />
      </TaskCommentsPanelShell>
    )
  }

  return (
    <>
      {/* No heading here — the enclosing tab is already labelled "Comments". */}
      {state.isLoading ? (
        <div className='text-muted-foreground flex items-center gap-2 text-sm'>
          <Loader2 className='h-4 w-4 animate-spin' /> Loading comments…
        </div>
      ) : state.isError ? (
        <TaskCommentsErrorState onRetry={state.refresh} />
      ) : (
        <div className='space-y-4'>
          <div className='space-y-4'>
            {state.comments.length > 0 ? (
              <>
                {/* Older comments load in above the thread, so the control
                    sits at the top where they'll appear. */}
                {state.pagination.hasNextPage ? (
                  <div className='flex justify-center'>
                    <Button
                      type='button'
                      variant='ghost'
                      size='sm'
                      onClick={state.pagination.loadMore}
                      disabled={state.pagination.isFetchingNextPage}
                    >
                      {state.pagination.isFetchingNextPage
                        ? 'Loading…'
                        : 'Load older comments'}
                    </Button>
                  </div>
                ) : null}
                {state.comments.map(comment => (
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
                    // The optimistic row's id isn't a real comment yet, so it
                    // stays inert until the refetch swaps in the saved one.
                    disableActions={
                      state.isMutating || isOptimisticComment(comment.id)
                    }
                  />
                ))}
              </>
            ) : (
              <SheetEmptyState message='No comments yet. Be the first to share an update.' />
            )}
          </div>
          {/* Composer sits below the thread, directly under the newest
              comment — a posted comment lands immediately above it. */}
          <TaskCommentComposer
            value={state.composer.value}
            onChange={state.composer.onChange}
            onSubmit={state.composer.submit}
            disabled={state.composer.disabled}
            pending={state.composer.isSubmitting}
            canComment={state.composer.canComment}
          />
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

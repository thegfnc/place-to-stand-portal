import { useCallback, useState, useTransition } from 'react'

import type { ToastOptions } from '@/components/ui/use-toast'

import {
  acceptDoneTasks,
  acceptTask,
  destroyTask,
  restoreTask,
  unacceptTask,
} from '../actions'
import type { ActionResult } from '../actions/action-types'

export type ReviewActionKind = 'accept' | 'unaccept' | 'restore' | 'destroy'
export type ReviewActionState = { type: ReviewActionKind; taskId: string }

export type UseProjectsBoardReviewActionsArgs = {
  canAcceptTasks: boolean
  activeProjectId: string | null
  toast: (options: ToastOptions) => void
}

export type UseProjectsBoardReviewActionsResult = {
  handleAcceptAllDone: () => void
  handleAcceptTask: (taskId: string) => void
  handleUnacceptTask: (taskId: string) => void
  handleRestoreTask: (taskId: string) => void
  handleDestroyTask: (taskId: string) => void
  isAcceptingDone: boolean
  isReviewActionPending: boolean
  pendingReviewAction: ReviewActionState | null
}

export function useProjectsBoardReviewActions({
  canAcceptTasks,
  activeProjectId,
  toast,
}: UseProjectsBoardReviewActionsArgs): UseProjectsBoardReviewActionsResult {
  const [isAcceptingDone, startAcceptingDone] = useTransition()
  const [isReviewActionPending, startReviewAction] = useTransition()
  const [pendingReviewAction, setPendingReviewAction] =
    useState<ReviewActionState | null>(null)

  const ensureCanAccept = useCallback(() => {
    if (canAcceptTasks) {
      return true
    }

    toast({
      variant: 'destructive',
      title: 'Action not allowed',
      description: 'Only administrators can manage review tasks.',
    })

    return false
  }, [canAcceptTasks, toast])

  const handleAcceptAllDone = useCallback(() => {
    if (!activeProjectId) {
      return
    }

    if (!canAcceptTasks) {
      toast({
        variant: 'destructive',
        title: 'Action not allowed',
        description: 'Only administrators can accept tasks.',
      })
      return
    }

    startAcceptingDone(async () => {
      const result = await acceptDoneTasks({ projectId: activeProjectId })

      if (result.error) {
        toast({
          variant: 'destructive',
          title: 'Unable to accept tasks',
          description: result.error,
        })
        return
      }

      if (result.acceptedCount > 0) {
        const plural = result.acceptedCount === 1 ? '' : 's'
        toast({
          title: 'Tasks accepted',
          description: `${result.acceptedCount} task${plural} moved out of Done.`,
        })
        return
      }

      toast({
        title: 'No tasks to accept',
        description: 'All tasks in Done are already accepted.',
      })
    })
  }, [activeProjectId, canAcceptTasks, startAcceptingDone, toast])

  const performReviewAction = useCallback(
    (
      type: ReviewActionKind,
      taskId: string,
      action: () => Promise<ActionResult>,
      success: { title: string; description?: string },
      errorTitle: string
    ) => {
      if (!ensureCanAccept()) {
        return
      }

      if (
        pendingReviewAction &&
        pendingReviewAction.taskId === taskId &&
        pendingReviewAction.type === type
      ) {
        return
      }

      setPendingReviewAction({ type, taskId })
      startReviewAction(async () => {
        try {
          const result = await action()

          if (result.error) {
            toast({
              variant: 'destructive',
              title: errorTitle,
              description: result.error,
            })
            return
          }

          toast({
            title: success.title,
            description: success.description,
          })
        } catch (error) {
          console.error('Review action failed', error)
          toast({
            variant: 'destructive',
            title: errorTitle,
            description: 'An unexpected error occurred.',
          })
        } finally {
          setPendingReviewAction(null)
        }
      })
    },
    [ensureCanAccept, pendingReviewAction, startReviewAction, toast]
  )

  const handleAcceptTask = useCallback(
    (taskId: string) => {
      performReviewAction(
        'accept',
        taskId,
        () => acceptTask({ taskId }),
        {
          title: 'Task accepted',
          description: 'The task has been moved out of Done.',
        },
        'Unable to accept task'
      )
    },
    [performReviewAction]
  )

  const handleUnacceptTask = useCallback(
    (taskId: string) => {
      performReviewAction(
        'unaccept',
        taskId,
        () => unacceptTask({ taskId }),
        { title: 'Task reopened for client review.' },
        'Unable to unaccept task'
      )
    },
    [performReviewAction]
  )

  const handleRestoreTask = useCallback(
    (taskId: string) => {
      performReviewAction(
        'restore',
        taskId,
        () => restoreTask({ taskId }),
        {
          title: 'Task restored',
          description: 'The task has been returned to the project board.',
        },
        'Unable to restore task'
      )
    },
    [performReviewAction]
  )

  const handleDestroyTask = useCallback(
    (taskId: string) => {
      performReviewAction(
        'destroy',
        taskId,
        () => destroyTask({ taskId }),
        { title: 'Task permanently deleted' },
        'Unable to delete task'
      )
    },
    [performReviewAction]
  )

  return {
    handleAcceptAllDone,
    handleAcceptTask,
    handleUnacceptTask,
    handleRestoreTask,
    handleDestroyTask,
    isAcceptingDone,
    isReviewActionPending,
    pendingReviewAction,
  }
}

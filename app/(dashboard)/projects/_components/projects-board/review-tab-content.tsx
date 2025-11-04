'use client'

import { useMemo, useState } from 'react'

import { TabsContent } from '@/components/ui/tabs'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { ProjectsBoardEmpty } from '../projects-board-empty'
import {
  FEEDBACK_CLASSES,
  NO_SELECTION_DESCRIPTION,
  NO_SELECTION_TITLE,
} from './projects-board-tabs.constants'
import type { ProjectsBoardActiveProject } from './board-tab-content'
import type { TaskWithRelations } from '@/lib/types'
import type { RenderAssigneeFn } from '../../../../../lib/projects/board/board-selectors'
import { ReviewAcceptedSection } from './review-tab/review-accepted-section'
import { ReviewArchivedSection } from './review-tab/review-archived-section'
import { ReviewDoneSection } from './review-tab/review-done-section'
import type { ReviewActionKind } from './review-tab/review-tab.types'

export type ReviewTabContentProps = {
  isActive: boolean
  feedback: string | null
  activeProject: ProjectsBoardActiveProject
  doneTasks: TaskWithRelations[]
  acceptedTasks: TaskWithRelations[]
  archivedTasks: TaskWithRelations[]
  renderAssignees: RenderAssigneeFn
  onEditTask: (task: TaskWithRelations) => void
  onAcceptTask: (taskId: string) => void
  onAcceptAllDone: () => void
  acceptAllDisabled: boolean
  acceptAllDisabledReason: string | null
  isAcceptingDone: boolean
  activeSheetTaskId: string | null
  onUnacceptTask: (taskId: string) => void
  onRestoreTask: (taskId: string) => void
  onDestroyTask: (taskId: string) => void
  reviewActionTaskId: string | null
  reviewActionType: ReviewActionKind | null
  reviewActionDisabledReason: string | null
  isReviewActionPending: boolean
}

export function ReviewTabContent(props: ReviewTabContentProps) {
  const {
    isActive,
    feedback,
    activeProject,
    doneTasks,
    acceptedTasks,
    archivedTasks,
    renderAssignees,
    onEditTask,
    onAcceptTask,
    onAcceptAllDone,
    acceptAllDisabled,
    acceptAllDisabledReason,
    isAcceptingDone,
    activeSheetTaskId,
    onUnacceptTask,
    onRestoreTask,
    onDestroyTask,
    reviewActionTaskId,
    reviewActionType,
    reviewActionDisabledReason,
    isReviewActionPending,
  } = props

  const [destroyTarget, setDestroyTarget] = useState<TaskWithRelations | null>(
    null
  )

  const handleCancelDestroy = () => {
    setDestroyTarget(null)
  }

  const handleConfirmDestroy = () => {
    if (!destroyTarget) {
      return
    }

    onDestroyTask(destroyTarget.id)
    setDestroyTarget(null)
  }

  const sortedDone = useMemo(() => {
    return doneTasks.slice().sort((a, b) => {
      const aTime = a.updated_at ? Date.parse(a.updated_at) : 0
      const bTime = b.updated_at ? Date.parse(b.updated_at) : 0
      return bTime - aTime
    })
  }, [doneTasks])

  const sortedAccepted = useMemo(() => {
    return acceptedTasks.slice().sort((a, b) => {
      const aTime = a.accepted_at ? Date.parse(a.accepted_at) : 0
      const bTime = b.accepted_at ? Date.parse(b.accepted_at) : 0
      return bTime - aTime
    })
  }, [acceptedTasks])

  const sortedArchived = useMemo(() => {
    return archivedTasks.slice().sort((a, b) => {
      const aTime = a.deleted_at ? Date.parse(a.deleted_at) : 0
      const bTime = b.deleted_at ? Date.parse(b.deleted_at) : 0
      return bTime - aTime
    })
  }, [archivedTasks])

  if (!isActive) {
    return null
  }

  return (
    <TabsContent
      value='review'
      className='flex min-h-0 flex-1 flex-col gap-4 sm:gap-6'
    >
      {feedback ? <p className={FEEDBACK_CLASSES}>{feedback}</p> : null}
      <ConfirmDialog
        open={Boolean(destroyTarget)}
        title='Delete task permanently?'
        description={
          destroyTarget
            ? `This will permanently remove "${destroyTarget.title}" and all of its history.`
            : 'This action cannot be undone.'
        }
        confirmLabel='Delete forever'
        confirmVariant='destructive'
        confirmDisabled={Boolean(
          isReviewActionPending &&
            reviewActionType === 'destroy' &&
            reviewActionTaskId === destroyTarget?.id
        )}
        onCancel={handleCancelDestroy}
        onConfirm={handleConfirmDestroy}
      />
      {!activeProject ? (
        <ProjectsBoardEmpty
          title={NO_SELECTION_TITLE}
          description={NO_SELECTION_DESCRIPTION}
        />
      ) : (
        <div className='flex min-h-0 flex-1 flex-col gap-4 sm:gap-6'>
          <ReviewDoneSection
            tasks={sortedDone}
            renderAssignees={renderAssignees}
            onEditTask={onEditTask}
            onAcceptTask={onAcceptTask}
            onAcceptAllDone={onAcceptAllDone}
            acceptAllDisabled={acceptAllDisabled}
            acceptAllDisabledReason={acceptAllDisabledReason}
            isAcceptingDone={isAcceptingDone}
            activeSheetTaskId={activeSheetTaskId}
            reviewActionTaskId={reviewActionTaskId}
            reviewActionType={reviewActionType}
            reviewActionDisabledReason={reviewActionDisabledReason}
            isReviewActionPending={isReviewActionPending}
          />

          <ReviewAcceptedSection
            tasks={sortedAccepted}
            renderAssignees={renderAssignees}
            onEditTask={onEditTask}
            onUnacceptTask={onUnacceptTask}
            activeSheetTaskId={activeSheetTaskId}
            reviewActionTaskId={reviewActionTaskId}
            reviewActionType={reviewActionType}
            reviewActionDisabledReason={reviewActionDisabledReason}
            isReviewActionPending={isReviewActionPending}
          />

          <ReviewArchivedSection
            tasks={sortedArchived}
            renderAssignees={renderAssignees}
            onEditTask={onEditTask}
            onRestoreTask={onRestoreTask}
            activeSheetTaskId={activeSheetTaskId}
            reviewActionTaskId={reviewActionTaskId}
            reviewActionType={reviewActionType}
            reviewActionDisabledReason={reviewActionDisabledReason}
            isReviewActionPending={isReviewActionPending}
            onRequestDestroy={task => setDestroyTarget(task)}
          />
        </div>
      )}
    </TabsContent>
  )
}

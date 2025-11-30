'use client'

import { useCallback, useMemo, useRef, useState, type DragEvent } from 'react'

import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Sheet, SheetContent } from '@/components/ui/sheet'

import type {
  DbUser,
  ProjectWithRelations,
  TaskWithRelations,
} from '@/lib/types'
import { useTaskSheetState } from '@/lib/projects/task-sheet/use-task-sheet-state'

import { TaskSheetForm } from './_components/task-sheet/task-sheet-form'
import { TaskSheetHeader } from './_components/task-sheet/task-sheet-header'
import type { UserRole } from '@/lib/auth/session'
import { TaskCommentsPanel } from './_components/task-sheet/task-comments-panel'
import { TaskActivityPanel } from './_components/task-sheet/task-activity-panel'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { BoardColumnId } from '@/lib/projects/board/board-constants'

type TaskSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  task?: TaskWithRelations
  canManage: boolean
  admins: DbUser[]
  currentUserId: string
  currentUserRole: UserRole
  defaultStatus: BoardColumnId
  defaultDueOn: string | null
  projects: ProjectWithRelations[]
  projectSelectionProjects?: ProjectWithRelations[]
  defaultProjectId: string | null
  defaultAssigneeId: string | null
}

export function TaskSheet(props: TaskSheetProps) {
  const {
    form,
    feedback,
    isPending,
    isDeleteDialogOpen,
    assigneeItems,
    projectItems,
    projectGroups,
    sheetTitle,
    projectName,
    deleteDisabled,
    deleteDisabledReason,
    submitDisabled,
    submitDisabledReason,
    unsavedChangesDialog,
    handleSheetOpenChange,
    handleFormSubmit,
    handleRequestDelete,
    handleCancelDelete,
    handleConfirmDelete,
    resolveDisabledReason,
    editorKey,
    taskStatuses,
    unassignedValue,
    attachments,
    handleAttachmentUpload,
    handleAttachmentRemove,
    isUploadingAttachments,
    acceptedAttachmentTypes,
    maxAttachmentSize,
    attachmentsDisabledReason,
  } = useTaskSheetState({
    open: props.open,
    onOpenChange: props.onOpenChange,
    task: props.task,
    canManage: props.canManage,
    admins: props.admins,
    defaultStatus: props.defaultStatus,
    defaultDueOn: props.defaultDueOn,
    projects: props.projects,
    projectSelectionProjects: props.projectSelectionProjects,
    defaultProjectId: props.defaultProjectId,
    defaultAssigneeId: props.defaultAssigneeId,
  })

  const [isDragActive, setIsDragActive] = useState(false)
  const dragCounterRef = useRef(0)
  const attachmentsDisabled = isPending || !props.canManage
  const dropDisabled = attachmentsDisabled || isUploadingAttachments

  const hasDraggedFiles = useCallback(
    (event: DragEvent<HTMLDivElement>) =>
      Array.from(event.dataTransfer?.types ?? []).includes('Files'),
    []
  )

  const handleDragEnter = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      if (!hasDraggedFiles(event)) {
        return
      }

      event.preventDefault()
      event.stopPropagation()

      if (dropDisabled) {
        return
      }

      dragCounterRef.current += 1
      setIsDragActive(true)
    },
    [dropDisabled, hasDraggedFiles]
  )

  const handleDragOver = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      if (!hasDraggedFiles(event)) {
        return
      }

      event.preventDefault()
      event.stopPropagation()

      if (dropDisabled) {
        if (event.dataTransfer) {
          event.dataTransfer.dropEffect = 'none'
        }
        return
      }

      event.dataTransfer.dropEffect = 'copy'
    },
    [dropDisabled, hasDraggedFiles]
  )

  const handleDragLeave = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      if (!hasDraggedFiles(event)) {
        return
      }

      event.preventDefault()
      event.stopPropagation()

      if (dropDisabled) {
        dragCounterRef.current = 0
        setIsDragActive(false)
        return
      }

      dragCounterRef.current = Math.max(dragCounterRef.current - 1, 0)
      if (dragCounterRef.current === 0) {
        setIsDragActive(false)
      }
    },
    [dropDisabled, hasDraggedFiles]
  )

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      if (!hasDraggedFiles(event)) {
        return
      }

      event.preventDefault()
      event.stopPropagation()

      const files = event.dataTransfer?.files
      dragCounterRef.current = 0
      setIsDragActive(false)

      if (dropDisabled || !files || files.length === 0) {
        return
      }

      handleAttachmentUpload(files)
    },
    [dropDisabled, handleAttachmentUpload, hasDraggedFiles]
  )

  const taskProject = useMemo(() => {
    if (!props.task) {
      return null
    }
    return props.projects.find(project => project.id === props.task?.project_id)
  }, [props.projects, props.task])

  const taskPanelProjectId = props.task?.project_id ?? null
  const taskPanelClientId = taskProject?.client?.id ?? null

  const headerDescription = projectName ? (
    <>
      Task belongs to <span className='font-medium'>{projectName}</span>.
    </>
  ) : (
    'Select a project so we know where to track this task.'
  )

  return (
    <>
      <Sheet open={props.open} onOpenChange={handleSheetOpenChange}>
        <SheetContent className='flex w-full flex-col gap-6 overflow-y-auto pb-24 sm:max-w-[676px]'>
          <div
            className='flex flex-col gap-6'
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <TaskSheetHeader title={sheetTitle} description={headerDescription} />
            <TaskSheetForm
              form={form}
              onSubmit={handleFormSubmit}
              feedback={feedback}
              isPending={isPending}
              canManage={props.canManage}
              assigneeItems={assigneeItems}
              projectItems={projectItems}
              projectGroups={projectGroups}
              resolveDisabledReason={resolveDisabledReason}
              taskStatuses={taskStatuses}
              unassignedValue={unassignedValue}
              editorKey={editorKey}
              isEditing={Boolean(props.task)}
              onRequestDelete={handleRequestDelete}
              deleteDisabled={deleteDisabled}
              deleteDisabledReason={deleteDisabledReason}
              submitDisabled={submitDisabled}
              submitDisabledReason={submitDisabledReason}
              isSheetOpen={props.open}
              historyKey={props.task?.id ?? 'task:new'}
              attachments={attachments}
              onAttachmentUpload={handleAttachmentUpload}
              onAttachmentRemove={handleAttachmentRemove}
              isUploadingAttachments={isUploadingAttachments}
              acceptedAttachmentTypes={acceptedAttachmentTypes}
              maxAttachmentSize={maxAttachmentSize}
              attachmentsDisabledReason={attachmentsDisabledReason}
              isDragActive={!dropDisabled && isDragActive}
            />
            {props.task && taskPanelProjectId ? (
              <div className='px-6'>
                <Tabs defaultValue='comments' className='w-full'>
                  <TabsList className='grid w-full grid-cols-2'>
                    <TabsTrigger value='comments'>Comments</TabsTrigger>
                    <TabsTrigger value='activity'>Activity</TabsTrigger>
                  </TabsList>
                  <TabsContent value='comments' className='mt-6'>
                    <TaskCommentsPanel
                      taskId={props.task.id}
                      projectId={taskPanelProjectId}
                      currentUserId={props.currentUserId}
                      canComment
                      taskTitle={props.task.title}
                      clientId={taskPanelClientId}
                    />
                  </TabsContent>
                  <TabsContent value='activity' className='mt-6'>
                    <TaskActivityPanel
                      taskId={props.task.id}
                      projectId={taskPanelProjectId}
                      clientId={taskPanelClientId}
                    />
                  </TabsContent>
                </Tabs>
              </div>
            ) : null}
          </div>
        </SheetContent>
      </Sheet>
      <ConfirmDialog
        open={isDeleteDialogOpen}
        title='Archive task?'
        description='Archiving this task removes it from the project board. Proceed?'
        confirmLabel='Archive'
        confirmVariant='destructive'
        confirmDisabled={isPending}
        onCancel={handleCancelDelete}
        onConfirm={handleConfirmDelete}
      />
      {unsavedChangesDialog}
    </>
  )
}

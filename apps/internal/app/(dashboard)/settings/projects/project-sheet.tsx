'use client'

import { Sheet, SheetContent } from '@/components/ui/sheet'
import { SheetFormHeader } from '@/components/sheets/sheet-form-header'
import { useMemo } from 'react'

import {
  useProjectSheetState,
  type ContractorUserSummary,
  type ProjectWithClient,
} from '@/lib/settings/projects/use-project-sheet-state'
import type { ClientRow } from '@/lib/settings/projects/project-sheet-form'
import { buildOwnerOptions, type AdminUserForOwner } from '@/lib/settings/projects/project-sheet-ui-state'

import { ProjectSheetForm } from './_components/project-sheet/project-sheet-form'
import { ProjectSheetDialogs } from './_components/project-sheet/project-sheet-dialogs'
import { createProjectSheetFieldState } from './_components/project-sheet/project-sheet-field-state'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onComplete: () => void
  project: ProjectWithClient | null
  clients: ClientRow[]
  adminUsers?: AdminUserForOwner[]
  contractorDirectory?: ContractorUserSummary[]
  projectContractors?: Record<string, ContractorUserSummary[]>
}

export function ProjectSheet(props: Props) {
  const {
    form,
    feedback,
    isEditing,
    isPending,
    requiresClientSelection,
    clientOptions,
    submitButton,
    deleteButton,
    isDeleteDialogOpen,
    unsavedChangesDialog,
    handleSheetOpenChange,
    handleSubmit,
    handleReposDirtyChange,
    handleRequestDelete,
    handleCancelDelete,
    handleConfirmDelete,
  } = useProjectSheetState(props)

  const fieldState = useMemo(
    () =>
      createProjectSheetFieldState({
        isPending,
        hasClients: clientOptions.length > 0,
        requiresClientSelection,
      }),
    [clientOptions, isPending, requiresClientSelection]
  )

  const currentOwnerId = form.watch('ownerId')
  const ownerOptions = useMemo(
    () => buildOwnerOptions(props.adminUsers ?? [], currentOwnerId || null),
    [currentOwnerId, props.adminUsers]
  )

  return (
    <>
      <Sheet open={props.open} onOpenChange={handleSheetOpenChange}>
        <SheetContent
          hideCloseButton
          size='2xl'
          className='flex w-full flex-col gap-0 overflow-hidden p-0'
        >
          <SheetFormHeader
            entity='project'
            title={isEditing ? 'Edit project' : 'Add project'}
          />
          <ProjectSheetForm
            form={form}
            fieldState={fieldState}
            isEditing={isEditing}
            isPending={isPending}
            feedback={feedback}
            clientOptions={clientOptions}
            ownerOptions={ownerOptions}
            submitButton={submitButton}
            deleteButton={deleteButton}
            onSubmit={handleSubmit}
            onRequestDelete={handleRequestDelete}
            onReposDirtyChange={handleReposDirtyChange}
            isSheetOpen={props.open}
            historyKey={props.project?.id ?? 'project:new'}
            projectId={props.project?.id}
          />
        </SheetContent>
      </Sheet>
      <ProjectSheetDialogs
        isDeleteDialogOpen={isDeleteDialogOpen}
        isPending={isPending}
        unsavedChangesDialog={unsavedChangesDialog}
        onCancelDelete={handleCancelDelete}
        onConfirmDelete={handleConfirmDelete}
      />
    </>
  )
}

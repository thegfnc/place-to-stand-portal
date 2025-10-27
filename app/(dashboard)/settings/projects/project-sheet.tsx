'use client'

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { useMemo } from 'react'

import {
  useProjectSheetState,
  type ContractorUserSummary,
  type ProjectWithClient,
} from '@/lib/settings/projects/use-project-sheet-state'
import type { Database } from '@/supabase/types/database'

import { ProjectSheetForm } from './_components/project-sheet/project-sheet-form'
import { ProjectSheetDialogs } from './_components/project-sheet/project-sheet-dialogs'
import { createProjectSheetFieldState } from './_components/project-sheet/project-sheet-field-state'

type ClientRow = Pick<
  Database['public']['Tables']['clients']['Row'],
  'id' | 'name' | 'deleted_at'
>

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onComplete: () => void
  project: ProjectWithClient | null
  clients: ClientRow[]
  contractorDirectory: ContractorUserSummary[]
  projectContractors: Record<string, ContractorUserSummary[]>
}

export function ProjectSheet(props: Props) {
  const {
    form,
    feedback,
    isEditing,
    isPending,
    clientOptions,
    contractorButton,
    submitButton,
    deleteButton,
    availableContractors,
    selectedContractors,
    contractorRemovalCandidate,
    contractorRemovalName,
    contractorProjectName,
    isContractorPickerOpen,
    isDeleteDialogOpen,
    unsavedChangesDialog,
    handleSheetOpenChange,
    handleSubmit,
    handleAddContractor,
    handleContractorPickerOpenChange,
    handleRequestContractorRemoval,
    handleCancelContractorRemoval,
    handleConfirmContractorRemoval,
    handleRequestDelete,
    handleCancelDelete,
    handleConfirmDelete,
  } = useProjectSheetState(props)

  const fieldState = useMemo(
    () =>
      createProjectSheetFieldState({
        isPending,
        hasClients: clientOptions.length > 0,
      }),
    [clientOptions, isPending]
  )

  return (
    <>
      <Sheet open={props.open} onOpenChange={handleSheetOpenChange}>
        <SheetContent className='flex w-full flex-col gap-6 overflow-y-auto pb-32 sm:max-w-2xl'>
          <SheetHeader className='px-6 pt-6'>
            <SheetTitle>
              {isEditing ? 'Edit project' : 'Add project'}
            </SheetTitle>
            <SheetDescription>
              {isEditing
                ? 'Adjust metadata, update its client, or delete the project.'
                : 'Create a project linked to an existing client so work can be tracked.'}
            </SheetDescription>
          </SheetHeader>
          <ProjectSheetForm
            form={form}
            fieldState={fieldState}
            isEditing={isEditing}
            isPending={isPending}
            feedback={feedback}
            clientOptions={clientOptions}
            contractorButton={contractorButton}
            submitButton={submitButton}
            deleteButton={deleteButton}
            availableContractors={availableContractors}
            selectedContractors={selectedContractors}
            isContractorPickerOpen={isContractorPickerOpen}
            onSubmit={handleSubmit}
            onRequestDelete={handleRequestDelete}
            onAddContractor={handleAddContractor}
            onContractorPickerOpenChange={handleContractorPickerOpenChange}
            onRequestContractorRemoval={handleRequestContractorRemoval}
            isSheetOpen={props.open}
            historyKey={props.project?.id ?? 'project:new'}
          />
        </SheetContent>
      </Sheet>
      <ProjectSheetDialogs
        isDeleteDialogOpen={isDeleteDialogOpen}
        isPending={isPending}
        contractorRemovalCandidate={contractorRemovalCandidate}
        contractorRemovalName={contractorRemovalName}
        contractorProjectName={contractorProjectName}
        unsavedChangesDialog={unsavedChangesDialog}
        onCancelDelete={handleCancelDelete}
        onConfirmDelete={handleConfirmDelete}
        onCancelContractorRemoval={handleCancelContractorRemoval}
        onConfirmContractorRemoval={handleConfirmContractorRemoval}
      />
    </>
  )
}

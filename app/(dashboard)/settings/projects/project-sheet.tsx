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
import type { ClientRow } from '@/lib/settings/projects/project-sheet-form'

import { ProjectSheetForm } from './_components/project-sheet/project-sheet-form'
import { ProjectSheetDialogs } from './_components/project-sheet/project-sheet-dialogs'
import { createProjectSheetFieldState } from './_components/project-sheet/project-sheet-field-state'
import { GitHubReposSection } from './_components/project-sheet/github-repos-section'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onComplete: () => void
  project: ProjectWithClient | null
  clients: ClientRow[]
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

  return (
    <>
      <Sheet open={props.open} onOpenChange={handleSheetOpenChange}>
        <SheetContent className='flex w-full flex-col gap-6 overflow-y-auto pb-32 sm:max-w-2xl'>
          <SheetHeader className='border-b-2 border-b-emerald-500/60 px-6 pt-4'>
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
            submitButton={submitButton}
            deleteButton={deleteButton}
            onSubmit={handleSubmit}
            onRequestDelete={handleRequestDelete}
            isSheetOpen={props.open}
            historyKey={props.project?.id ?? 'project:new'}
          />
          {isEditing && props.project && (
            <div className='px-6 pb-6'>
              <GitHubReposSection
                projectId={props.project.id}
                projectName={props.project.name}
              />
            </div>
          )}
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

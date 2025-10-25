import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { PROJECT_SHEET_PENDING_REASON } from '@/lib/settings/projects/use-project-sheet-state'
import type { ContractorUserSummary } from '@/lib/settings/projects/use-project-sheet-state'

export type ProjectSheetDialogsProps = {
  isDeleteDialogOpen: boolean
  isPending: boolean
  contractorRemovalCandidate: ContractorUserSummary | null
  contractorRemovalName: string | null
  contractorProjectName: string
  unsavedChangesDialog: React.ReactNode
  onCancelDelete: () => void
  onConfirmDelete: () => void
  onCancelContractorRemoval: () => void
  onConfirmContractorRemoval: () => void
}

export function ProjectSheetDialogs(props: ProjectSheetDialogsProps) {
  const {
    isDeleteDialogOpen,
    isPending,
    contractorRemovalCandidate,
    contractorRemovalName,
    contractorProjectName,
    unsavedChangesDialog,
    onCancelDelete,
    onConfirmDelete,
    onCancelContractorRemoval,
    onConfirmContractorRemoval,
  } = props

  return (
    <>
      <ConfirmDialog
        open={isDeleteDialogOpen}
        title='Delete project?'
        description='Deleting this project hides it from active views but keeps the history intact.'
        confirmLabel='Delete'
        confirmVariant='destructive'
        confirmDisabled={isPending}
        onCancel={onCancelDelete}
        onConfirm={onConfirmDelete}
      />
      {unsavedChangesDialog}
      <Dialog
        open={Boolean(contractorRemovalCandidate)}
        onOpenChange={next => {
          if (!next) {
            onCancelContractorRemoval()
          }
        }}
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Remove contractor</DialogTitle>
            <DialogDescription>
              {contractorRemovalName
                ? `Remove ${contractorRemovalName} from ${contractorProjectName}?`
                : 'Remove this contractor from the project?'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type='button'
              variant='outline'
              onClick={onCancelContractorRemoval}
            >
              Cancel
            </Button>
            <DisabledFieldTooltip
              disabled={isPending}
              reason={isPending ? PROJECT_SHEET_PENDING_REASON : null}
            >
              <Button
                type='button'
                variant='destructive'
                onClick={onConfirmContractorRemoval}
                disabled={isPending}
              >
                Remove
              </Button>
            </DisabledFieldTooltip>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

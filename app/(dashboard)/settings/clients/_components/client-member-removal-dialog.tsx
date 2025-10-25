'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'

type ClientMemberRemovalDialogProps = {
  open: boolean
  isPending: boolean
  pendingReason: string
  memberName: string | null
  clientDisplayName: string
  onCancel: () => void
  onConfirm: () => void
}

export function ClientMemberRemovalDialog({
  open,
  isPending,
  pendingReason,
  memberName,
  clientDisplayName,
  onCancel,
  onConfirm,
}: ClientMemberRemovalDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={next => {
        if (!next) {
          onCancel()
        }
      }}
    >
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Remove client user</DialogTitle>
          <DialogDescription>
            {memberName
              ? `Remove ${memberName} from ${clientDisplayName}?`
              : 'Remove this user from the client?'}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type='button' variant='outline' onClick={onCancel}>
            Cancel
          </Button>
          <DisabledFieldTooltip
            disabled={isPending}
            reason={isPending ? pendingReason : null}
          >
            <Button
              type='button'
              variant='destructive'
              onClick={onConfirm}
              disabled={isPending}
            >
              Remove
            </Button>
          </DisabledFieldTooltip>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

import { Archive, Redo2, Undo2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'

export type TaskSheetFormFooterProps = {
  saveLabel: string
  submitDisabled: boolean
  submitDisabledReason: string | null
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
  isEditing: boolean
  deleteDisabled: boolean
  deleteDisabledReason: string | null
  onRequestDelete: () => void
}

export function TaskSheetFormFooter(props: TaskSheetFormFooterProps) {
  const {
    saveLabel,
    submitDisabled,
    submitDisabledReason,
    undo,
    redo,
    canUndo,
    canRedo,
    isEditing,
    deleteDisabled,
    deleteDisabledReason,
    onRequestDelete,
  } = props

  return (
    <div className='border-border/40 bg-muted/95 supports-backdrop-filter:bg-muted/90 fixed right-0 bottom-0 z-50 w-full border-t shadow-lg backdrop-blur sm:max-w-[676px]'>
      <div className='flex w-full items-center justify-between gap-3 px-6 py-4'>
        <div className='flex items-center gap-2'>
          <DisabledFieldTooltip
            disabled={submitDisabled}
            reason={submitDisabledReason}
          >
            <Button
              type='submit'
              disabled={submitDisabled}
              aria-label={`${saveLabel} (⌘S / Ctrl+S)`}
              title={`${saveLabel} (⌘S / Ctrl+S)`}
            >
              {saveLabel}
            </Button>
          </DisabledFieldTooltip>
          <Button
            type='button'
            variant='outline'
            size='icon'
            onClick={undo}
            disabled={!canUndo}
            aria-label='Undo (⌘Z / Ctrl+Z)'
            title='Undo (⌘Z / Ctrl+Z)'
          >
            <Undo2 className='h-4 w-4' />
          </Button>
          <Button
            type='button'
            variant='outline'
            size='icon'
            onClick={redo}
            disabled={!canRedo}
            aria-label='Redo (⇧⌘Z / Ctrl+Shift+Z)'
            title='Redo (⇧⌘Z / Ctrl+Shift+Z)'
          >
            <Redo2 className='h-4 w-4' />
          </Button>
        </div>
        {isEditing ? (
          <DisabledFieldTooltip
            disabled={deleteDisabled}
            reason={deleteDisabledReason}
          >
            <Button
              type='button'
              variant='destructive'
              onClick={onRequestDelete}
              disabled={deleteDisabled}
              aria-label='Delete task'
            >
              <Archive className='h-4 w-4' />
            </Button>
          </DisabledFieldTooltip>
        ) : null}
      </div>
    </div>
  )
}

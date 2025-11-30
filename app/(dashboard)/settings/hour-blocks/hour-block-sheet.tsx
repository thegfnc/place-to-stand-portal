'use client'

import { useCallback, useEffect, useRef } from 'react'
import { Archive, Redo2, Undo2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { SearchableCombobox } from '@/components/ui/searchable-combobox'
import {
  useHourBlockSheetState,
  type HourBlockFormValues,
} from '@/lib/settings/hour-blocks/use-hour-block-sheet-state'
import { useSheetFormControls } from '@/lib/hooks/use-sheet-form-controls'
import type {
  ClientRow,
  HourBlockWithClient,
} from '@/lib/settings/hour-blocks/hour-block-form'
import { HourBlockArchiveDialog } from './_components/hour-block-archive-dialog'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onComplete: () => void
  hourBlock: HourBlockWithClient | null
  clients: ClientRow[]
}

export function HourBlockSheet({
  open,
  onOpenChange,
  onComplete,
  hourBlock,
  clients,
}: Props) {
  const {
    form,
    feedback,
    isEditing,
    isPending,
    clientOptions,
    clientField,
    hoursField,
    invoiceField,
    submitButton,
    deleteButton,
    isDeleteDialogOpen,
    unsavedChangesDialog,
    handleSheetOpenChange,
    handleSubmit,
    handleRequestDelete,
    handleCancelDelete,
    handleConfirmDelete,
  } = useHourBlockSheetState({
    open,
    onOpenChange,
    onComplete,
    hourBlock,
    clients,
  })

  const handleSave = useCallback(
    () =>
      form.handleSubmit((values: HourBlockFormValues) =>
        handleSubmit(values)
      )(),
    [form, handleSubmit]
  )

  const { undo, redo, canUndo, canRedo } = useSheetFormControls({
    form,
    isActive: open,
    canSave: !submitButton.disabled,
    onSave: handleSave,
    historyKey: hourBlock?.id ?? 'hour-block:new',
  })

  const firstFieldRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (open && firstFieldRef.current) {
      // Small delay to ensure sheet animation completes
      const timeoutId = setTimeout(() => {
        firstFieldRef.current?.focus()
      }, 100)
      return () => clearTimeout(timeoutId)
    }
  }, [open])

  return (
    <>
      <Sheet open={open} onOpenChange={handleSheetOpenChange}>
        <SheetContent className='flex w-full flex-col gap-6 overflow-y-auto pb-32 sm:max-w-lg'>
          <SheetHeader className='px-6 pt-6'>
            <SheetTitle>
              {isEditing ? 'Edit hour block' : 'Add hour block'}
            </SheetTitle>
            <SheetDescription>
              {isEditing
                ? 'Adjust purchased hours or delete the block if it is no longer needed.'
                : 'Assign purchased hours to a client so the team can track usage.'}
            </SheetDescription>
          </SheetHeader>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit((values: HourBlockFormValues) =>
                handleSubmit(values)
              )}
              className='flex flex-1 flex-col gap-5 px-6 pb-32'
            >
              <div className='grid gap-4 sm:grid-cols-2'>
                <FormField
                  control={form.control}
                  name='clientId'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Client</FormLabel>
                      <FormControl>
                        <DisabledFieldTooltip
                          disabled={clientField.disabled}
                          reason={clientField.reason}
                        >
                          <SearchableCombobox
                            ref={firstFieldRef}
                            name={field.name}
                            value={field.value ?? ''}
                            onChange={field.onChange}
                            onBlur={field.onBlur}
                            items={clientOptions}
                            searchPlaceholder='Search clients...'
                            emptyMessage='No clients found.'
                            disabled={clientField.disabled}
                          />
                        </DisabledFieldTooltip>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name='hoursPurchased'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Hours purchased</FormLabel>
                      <FormControl>
                        <DisabledFieldTooltip
                          disabled={hoursField.disabled}
                          reason={hoursField.reason}
                        >
                          <Input
                            {...field}
                            value={field.value ?? ''}
                            type='number'
                            step='1'
                            min='1'
                            inputMode='numeric'
                            disabled={hoursField.disabled}
                          />
                        </DisabledFieldTooltip>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name='invoiceNumber'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Invoice #{' '}
                      <span className='text-muted-foreground text-xs'>
                        (optional)
                      </span>
                    </FormLabel>
                    <FormControl>
                      <DisabledFieldTooltip
                        disabled={invoiceField.disabled}
                        reason={invoiceField.reason}
                      >
                        <Input
                          {...field}
                          value={field.value ?? ''}
                          placeholder='INV-2025-01'
                          inputMode='text'
                          maxLength={64}
                          disabled={invoiceField.disabled}
                        />
                      </DisabledFieldTooltip>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {feedback ? (
                <p className='border-destructive/40 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm'>
                  {feedback}
                </p>
              ) : null}
              <div className='border-border/40 bg-muted/95 supports-backdrop-filter:bg-muted/90 fixed right-0 bottom-0 z-50 w-full border-t shadow-lg backdrop-blur sm:max-w-lg'>
                <div className='flex w-full items-center justify-between gap-3 px-6 py-4'>
                  <div className='flex items-center gap-2'>
                    <DisabledFieldTooltip
                      disabled={submitButton.disabled}
                      reason={submitButton.reason}
                    >
                      <Button
                        type='submit'
                        disabled={submitButton.disabled}
                        aria-label={`${submitButton.label} (⌘S / Ctrl+S)`}
                        title={`${submitButton.label} (⌘S / Ctrl+S)`}
                      >
                        {submitButton.label}
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
                      disabled={deleteButton.disabled}
                      reason={deleteButton.reason}
                    >
                      <Button
                        type='button'
                        variant='destructive'
                        size='icon'
                        title='Archive hour block'
                        aria-label='Archive hour block'
                        onClick={handleRequestDelete}
                        disabled={deleteButton.disabled}
                      >
                        <Archive className='h-4 w-4' />
                        <span className='sr-only'>Archive</span>
                      </Button>
                    </DisabledFieldTooltip>
                  ) : null}
                </div>
              </div>
            </form>
          </Form>
        </SheetContent>
      </Sheet>
      <HourBlockArchiveDialog
        open={isDeleteDialogOpen}
        confirmDisabled={isPending}
        onCancel={handleCancelDelete}
        onConfirm={handleConfirmDelete}
      />
      {unsavedChangesDialog}
    </>
  )
}

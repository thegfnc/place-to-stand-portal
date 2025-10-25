'use client'

import { Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
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
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { SearchableCombobox } from '@/components/ui/searchable-combobox'
import {
  useHourBlockSheetState,
  type HourBlockFormValues,
} from '@/lib/settings/hour-blocks/use-hour-block-sheet-state'
import type { Database } from '@/supabase/types/database'

type HourBlockRow = Database['public']['Tables']['hour_blocks']['Row']
type ClientRow = Pick<
  Database['public']['Tables']['clients']['Row'],
  'id' | 'name' | 'deleted_at'
>

type HourBlockWithClient = HourBlockRow & { client: ClientRow | null }

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

  return (
    <>
      <Sheet open={open} onOpenChange={handleSheetOpenChange}>
        <SheetContent className='flex w-full flex-col gap-6 overflow-y-auto sm:max-w-lg'>
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
              className='flex flex-1 flex-col gap-5 px-6 pb-6'
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
              <SheetFooter className='flex items-center justify-between gap-3 px-0 pt-6 pb-0'>
                <DisabledFieldTooltip
                  disabled={submitButton.disabled}
                  reason={submitButton.reason}
                >
                  <Button type='submit' disabled={submitButton.disabled}>
                    {submitButton.label}
                  </Button>
                </DisabledFieldTooltip>
                {isEditing ? (
                  <DisabledFieldTooltip
                    disabled={deleteButton.disabled}
                    reason={deleteButton.reason}
                  >
                    <Button
                      type='button'
                      variant='destructive'
                      onClick={handleRequestDelete}
                      disabled={deleteButton.disabled}
                    >
                      <Trash2 className='h-4 w-4' />
                    </Button>
                  </DisabledFieldTooltip>
                ) : null}
              </SheetFooter>
            </form>
          </Form>
        </SheetContent>
      </Sheet>
      <ConfirmDialog
        open={isDeleteDialogOpen}
        title='Delete hour block?'
        description='Deleting this block hides it from active reporting while keeping historical data intact.'
        confirmLabel='Delete'
        confirmVariant='destructive'
        confirmDisabled={isPending}
        onCancel={handleCancelDelete}
        onConfirm={handleConfirmDelete}
      />
      {unsavedChangesDialog}
    </>
  )
}

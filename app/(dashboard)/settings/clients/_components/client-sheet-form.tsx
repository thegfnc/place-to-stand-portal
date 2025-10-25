'use client'

import { Trash2 } from 'lucide-react'
import type { UseFormReturn } from 'react-hook-form'

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
import { SheetFooter } from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'

import type {
  ClientMemberOption,
  UseClientSheetStateReturn,
} from '@/lib/settings/clients/use-client-sheet-state'
import type { ClientSheetFormValues } from '@/lib/settings/clients/client-sheet-schema'

import { ClientMemberPicker } from './client-member-picker'

const FEEDBACK_CLASSES =
  'border-destructive/40 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm'

type ClientSheetFormProps = {
  form: UseFormReturn<ClientSheetFormValues>
  feedback: string | null
  isPending: boolean
  isEditing: boolean
  pendingReason: string
  addButtonDisabled: boolean
  addButtonDisabledReason: string | null
  submitDisabled: boolean
  submitDisabledReason: string | null
  deleteDisabled: boolean
  deleteDisabledReason: string | null
  selectedMembers: ClientMemberOption[]
  availableMembers: ClientMemberOption[]
  isPickerOpen: boolean
  onPickerOpenChange: (open: boolean) => void
  onAddMember: (member: ClientMemberOption) => void
  onRequestRemoval: (member: ClientMemberOption) => void
  onSubmit: UseClientSheetStateReturn['handleFormSubmit']
  onRequestDelete: () => void
}

export function ClientSheetForm({
  form,
  feedback,
  isPending,
  isEditing,
  pendingReason,
  addButtonDisabled,
  addButtonDisabledReason,
  submitDisabled,
  submitDisabledReason,
  deleteDisabled,
  deleteDisabledReason,
  selectedMembers,
  availableMembers,
  isPickerOpen,
  onPickerOpenChange,
  onAddMember,
  onRequestRemoval,
  onSubmit,
  onRequestDelete,
}: ClientSheetFormProps) {
  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className='flex flex-1 flex-col gap-5 px-6 pb-6'
      >
        <FormField
          control={form.control}
          name='name'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <DisabledFieldTooltip
                  disabled={isPending}
                  reason={isPending ? pendingReason : null}
                >
                  <Input
                    {...field}
                    value={field.value ?? ''}
                    placeholder='Acme Corp'
                    disabled={isPending}
                  />
                </DisabledFieldTooltip>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {isEditing ? (
          <FormField
            control={form.control}
            name='slug'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Slug</FormLabel>
                <FormControl>
                  <DisabledFieldTooltip
                    disabled={isPending}
                    reason={isPending ? pendingReason : null}
                  >
                    <Input
                      {...field}
                      value={field.value ?? ''}
                      placeholder='acme'
                      disabled={isPending}
                    />
                  </DisabledFieldTooltip>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        ) : null}
        <FormField
          control={form.control}
          name='notes'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes (optional)</FormLabel>
              <FormControl>
                <DisabledFieldTooltip
                  disabled={isPending}
                  reason={isPending ? pendingReason : null}
                >
                  <Textarea
                    {...field}
                    value={field.value ?? ''}
                    placeholder='Context or points of contact'
                    disabled={isPending}
                    rows={4}
                  />
                </DisabledFieldTooltip>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className='space-y-2'>
          <FormLabel>Client users</FormLabel>
          <ClientMemberPicker
            selectedMembers={selectedMembers}
            availableMembers={availableMembers}
            addButtonDisabled={addButtonDisabled}
            addButtonDisabledReason={addButtonDisabledReason}
            isPickerOpen={isPickerOpen}
            isPending={isPending}
            pendingReason={pendingReason}
            onPickerOpenChange={onPickerOpenChange}
            onAddMember={onAddMember}
            onRequestRemoval={onRequestRemoval}
          />
        </div>
        {feedback ? <p className={FEEDBACK_CLASSES}>{feedback}</p> : null}
        <SheetFooter className='flex items-center justify-between gap-3 px-0 pt-6 pb-0'>
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
              >
                <Trash2 className='h-4 w-4' />
              </Button>
            </DisabledFieldTooltip>
          ) : null}
          <DisabledFieldTooltip
            disabled={submitDisabled}
            reason={submitDisabledReason}
          >
            <Button type='submit' disabled={submitDisabled}>
              {isPending
                ? 'Saving...'
                : isEditing
                  ? 'Save changes'
                  : 'Create client'}
            </Button>
          </DisabledFieldTooltip>
        </SheetFooter>
      </form>
    </Form>
  )
}

'use client'

import { useCallback, useEffect, useMemo, useRef } from 'react'
import type React from 'react'
import { Check, UserPlus } from 'lucide-react'
import type { UseFormReturn } from 'react-hook-form'

import { Badge } from '@/components/ui/badge'
import { Button } from '@pts/ui/button'
import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'
import { SheetFormFooter } from '@/components/sheets/sheet-form-footer'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { PhoneInput } from '@/components/ui/phone-input'

import { useSheetFormControls } from '@/lib/hooks/use-sheet-form-controls'

import {
  ContactClientPicker,
  type ContactClientOption,
} from './contact-client-picker'

const FEEDBACK_CLASSES =
  'border-destructive/40 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm'

const CONTACT_FORM_ID = 'contact-form'

type ContactFormValues = {
  email: string
  name: string
  phone?: string
}

type ContactSheetFormProps = {
  form: UseFormReturn<ContactFormValues>
  feedback: string | null
  isPending: boolean
  isEditing: boolean
  pendingReason: string
  submitDisabled: boolean
  submitDisabledReason: string | null
  deleteDisabled: boolean
  deleteDisabledReason: string | null
  onSubmit: (data: ContactFormValues) => void
  onRequestDelete: () => void
  isSheetOpen: boolean
  historyKey: string
  // Client picker props
  selectedClients: ContactClientOption[]
  availableClients: ContactClientOption[]
  addClientButtonDisabled: boolean
  addClientButtonDisabledReason: string | null
  isClientPickerOpen: boolean
  onClientPickerOpenChange: (open: boolean) => void
  onAddClient: (client: ContactClientOption) => void
  onRemoveClient: (client: ContactClientOption) => void
  // Promote to client props
  promoteDisabled: boolean
  promoteDisabledReason: string | null
  onRequestPromote: () => void
  hasPortalAccess: boolean
}

export function ContactSheetForm({
  form,
  feedback,
  isPending,
  isEditing,
  pendingReason,
  submitDisabled,
  submitDisabledReason,
  deleteDisabled,
  deleteDisabledReason,
  onSubmit,
  onRequestDelete,
  isSheetOpen,
  historyKey,
  selectedClients,
  availableClients,
  addClientButtonDisabled,
  addClientButtonDisabledReason,
  isClientPickerOpen,
  onClientPickerOpenChange,
  onAddClient,
  onRemoveClient,
  promoteDisabled,
  promoteDisabledReason,
  onRequestPromote,
  hasPortalAccess,
}: ContactSheetFormProps) {
  const handleSave = useCallback(
    () => form.handleSubmit(onSubmit)(),
    [form, onSubmit]
  )

  const { undo, redo, canUndo, canRedo } = useSheetFormControls({
    form,
    isActive: isSheetOpen,
    canSave: !submitDisabled,
    onSave: handleSave,
    historyKey,
  })

  const saveLabel = useMemo(() => {
    if (isPending) {
      return 'Saving...'
    }

    return isEditing ? 'Save changes' : 'Create contact'
  }, [isEditing, isPending])

  const firstFieldRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isSheetOpen && firstFieldRef.current) {
      // Small delay to ensure sheet animation completes
      const timeoutId = setTimeout(() => {
        firstFieldRef.current?.focus()
      }, 100)
      return () => clearTimeout(timeoutId)
    }
  }, [isSheetOpen])

  return (
    <Form {...form}>
      <div className='flex-1 overflow-y-auto'>
        <form
          id={CONTACT_FORM_ID}
          onSubmit={form.handleSubmit(onSubmit)}
          className='flex flex-col gap-5 px-6 pt-6 pb-8'
        >
          <FormField
            control={form.control}
            name='name'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Full Name</FormLabel>
                <FormControl>
                  <DisabledFieldTooltip
                    disabled={isPending}
                    reason={isPending ? pendingReason : null}
                  >
                    <Input
                      {...field}
                      ref={node => {
                        firstFieldRef.current = node
                        if (typeof field.ref === 'function') {
                          field.ref(node)
                        } else if (field.ref) {
                          ;(
                            field.ref as React.MutableRefObject<HTMLInputElement | null>
                          ).current = node
                        }
                      }}
                      value={field.value ?? ''}
                      placeholder='John Doe'
                      disabled={isPending}
                    />
                  </DisabledFieldTooltip>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name='email'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <DisabledFieldTooltip
                    disabled={isPending}
                    reason={isPending ? pendingReason : null}
                  >
                    <Input
                      {...field}
                      type='email'
                      placeholder='contact@example.com'
                      disabled={isPending}
                    />
                  </DisabledFieldTooltip>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name='phone'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phone (optional)</FormLabel>
                <FormControl>
                  <DisabledFieldTooltip
                    disabled={isPending}
                    reason={isPending ? pendingReason : null}
                  >
                    <PhoneInput
                      value={field.value ?? ''}
                      onChange={field.onChange}
                      disabled={isPending}
                    />
                  </DisabledFieldTooltip>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className='space-y-2'>
            <FormLabel>Clients</FormLabel>
            <ContactClientPicker
              selectedClients={selectedClients}
              availableClients={availableClients}
              addButtonDisabled={addClientButtonDisabled}
              addButtonDisabledReason={addClientButtonDisabledReason}
              isPickerOpen={isClientPickerOpen}
              isPending={isPending}
              pendingReason={pendingReason}
              onPickerOpenChange={onClientPickerOpenChange}
              onAddClient={onAddClient}
              onRequestRemoval={onRemoveClient}
            />
          </div>
          {isEditing ? (
            <div className='space-y-2'>
              <FormLabel>Portal Access</FormLabel>
              {hasPortalAccess ? (
                <Badge variant='secondary' className='gap-1.5'>
                  <Check className='h-3 w-3' />
                  Portal access
                </Badge>
              ) : (
                <div>
                  <DisabledFieldTooltip
                    disabled={promoteDisabled}
                    reason={promoteDisabledReason}
                  >
                    <Button
                      type='button'
                      variant='outline'
                      size='sm'
                      disabled={promoteDisabled}
                      onClick={onRequestPromote}
                      className='gap-1.5'
                    >
                      <UserPlus className='h-3.5 w-3.5' />
                      Create Portal Account
                    </Button>
                  </DisabledFieldTooltip>
                </div>
              )}
            </div>
          ) : null}
          {feedback ? <p className={FEEDBACK_CLASSES}>{feedback}</p> : null}
        </form>
      </div>
      <SheetFormFooter
        formId={CONTACT_FORM_ID}
        saveLabel={saveLabel}
        submitDisabled={submitDisabled}
        submitDisabledReason={submitDisabledReason}
        undo={undo}
        redo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
        isEditing={isEditing}
        deleteDisabled={deleteDisabled}
        deleteDisabledReason={deleteDisabledReason}
        onRequestDelete={onRequestDelete}
        deleteAriaLabel='Archive contact'
      />
    </Form>
  )
}

'use client'

import { useCallback, useEffect, useMemo, useRef } from 'react'
import type React from 'react'
import { useWatch, type UseFormReturn } from 'react-hook-form'

import { Badge } from '@/components/ui/badge'
import { SheetFormFooter } from '@/components/sheets/sheet-form-footer'
import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@pts/ui/select'

import { useSheetFormControls } from '@/lib/hooks/use-sheet-form-controls'
import type {
  ClientContactOption,
  OriginationContactOption,
  OriginationMode,
  PartnerUserOption,
  UseClientSheetStateReturn,
} from '@/lib/settings/clients/use-client-sheet-state'
import { CLIENT_BILLING_TYPE_SELECT_OPTIONS } from '@/lib/settings/clients/billing-types'
import { US_STATES } from '@/lib/settings/clients/us-states'
import { cn } from '@/lib/utils'
import type { ClientSheetFormValues } from '@/lib/settings/clients/client-sheet-schema'

import { ClientContactPicker } from './client-contact-picker'
import { ClientCloserPicker } from './client-closer-picker'
import { ClientOriginationPicker } from './client-origination-picker'
import { getSubmitLabel } from '@/lib/forms/form-controls'

const FEEDBACK_CLASSES =
  'border-destructive/40 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm'

const CLIENT_FORM_ID = 'client-form'

/** "Sep 1, 2026"-style label for the first of the month `offset` months out. */
function formatMonthStart(offset: number): string {
  const now = new Date()
  const target = new Date(now.getFullYear(), now.getMonth() + offset, 1)
  return target.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

type ClientSheetFormProps = {
  form: UseFormReturn<ClientSheetFormValues>
  feedback: string | null
  isPending: boolean
  isEditing: boolean
  /** The saved billing type — reveals the boundary select when it differs. */
  initialBillingType: string | null
  pendingReason: string
  submitDisabled: boolean
  submitDisabledReason: string | null
  deleteDisabled: boolean
  deleteDisabledReason: string | null
  onSubmit: UseClientSheetStateReturn['handleFormSubmit']
  onRequestDelete: () => void
  isSheetOpen: boolean
  historyKey: string
  // Contacts
  selectedContacts: ClientContactOption[]
  availableContacts: ClientContactOption[]
  contactsAddButtonDisabled: boolean
  contactsAddButtonDisabledReason: string | null
  isContactPickerOpen: boolean
  onContactPickerOpenChange: (open: boolean) => void
  onAddContact: (contact: ClientContactOption) => void
  onRemoveContact: (contact: ClientContactOption) => void
  // Origination
  originationMode: OriginationMode
  selectedOriginationUser: PartnerUserOption | null
  selectedOriginationContact: OriginationContactOption | null
  availableOriginationUsers: PartnerUserOption[]
  availableOriginationContacts: OriginationContactOption[]
  isOriginationUserPickerOpen: boolean
  isOriginationContactPickerOpen: boolean
  originationPickerDisabled: boolean
  originationPickerDisabledReason: string | null
  originationError: string | null
  onOriginationModeChange: (mode: OriginationMode) => void
  onOriginationUserPickerOpenChange: (open: boolean) => void
  onOriginationContactPickerOpenChange: (open: boolean) => void
  onSelectOriginationUser: (user: PartnerUserOption) => void
  onSelectOriginationContact: (contact: OriginationContactOption) => void
  onClearOrigination: () => void
  // Closer
  selectedCloser: PartnerUserOption | null
  availableClosers: PartnerUserOption[]
  isCloserPickerOpen: boolean
  closerPickerDisabled: boolean
  closerPickerDisabledReason: string | null
  closerError: string | null
  onCloserPickerOpenChange: (open: boolean) => void
  onSelectCloser: (user: PartnerUserOption) => void
  onClearCloser: () => void
}

export function ClientSheetForm({
  form,
  feedback,
  isPending,
  isEditing,
  initialBillingType,
  pendingReason,
  submitDisabled,
  submitDisabledReason,
  deleteDisabled,
  deleteDisabledReason,
  onSubmit,
  onRequestDelete,
  isSheetOpen,
  historyKey,
  selectedContacts,
  availableContacts,
  contactsAddButtonDisabled,
  contactsAddButtonDisabledReason,
  isContactPickerOpen,
  onContactPickerOpenChange,
  onAddContact,
  onRemoveContact,
  originationMode,
  selectedOriginationUser,
  selectedOriginationContact,
  availableOriginationUsers,
  availableOriginationContacts,
  isOriginationUserPickerOpen,
  isOriginationContactPickerOpen,
  originationPickerDisabled,
  originationPickerDisabledReason,
  originationError,
  onOriginationModeChange,
  onOriginationUserPickerOpenChange,
  onOriginationContactPickerOpenChange,
  onSelectOriginationUser,
  onSelectOriginationContact,
  onClearOrigination,
  selectedCloser,
  availableClosers,
  isCloserPickerOpen,
  closerPickerDisabled,
  closerPickerDisabledReason,
  closerError,
  onCloserPickerOpenChange,
  onSelectCloser,
  onClearCloser,
}: ClientSheetFormProps) {
  // Subscribed value (not form.watch in JSX — that read proved unreliable
  // across the form-prop boundary): drives the boundary-select visibility.
  const watchedBillingType = useWatch({
    control: form.control,
    name: 'billingType',
  })

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

  const saveLabel = useMemo(
    () =>
      getSubmitLabel({
        isSaving: isPending,
        isEditing,
        createLabel: 'Create client',
      }),
    [isEditing, isPending]
  )

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
          id={CLIENT_FORM_ID}
          onSubmit={form.handleSubmit(onSubmit)}
          className='flex flex-col gap-5 px-6 pt-6 pb-8'
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
            name='billingType'
            render={({ field }) => {
              const selectedBillingType =
                CLIENT_BILLING_TYPE_SELECT_OPTIONS.find(
                  option => option.value === field.value
                ) ?? CLIENT_BILLING_TYPE_SELECT_OPTIONS[0]

              return (
                <FormItem>
                  <FormLabel>Billing Type</FormLabel>
                  <Select
                    value={field.value ?? selectedBillingType.value}
                    onValueChange={field.onChange}
                    disabled={isPending}
                  >
                    <FormControl>
                      <DisabledFieldTooltip
                        disabled={isPending}
                        reason={isPending ? pendingReason : null}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder='Select billing type'>
                            <Badge
                              variant='outline'
                              className={cn(
                                'text-xs',
                                selectedBillingType.badgeClassName
                              )}
                            >
                              {selectedBillingType.label}
                            </Badge>
                          </SelectValue>
                        </SelectTrigger>
                      </DisabledFieldTooltip>
                    </FormControl>
                    <SelectContent align='start'>
                      {CLIENT_BILLING_TYPE_SELECT_OPTIONS.map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          <Badge
                            variant='outline'
                            className={cn('text-xs', option.badgeClassName)}
                          >
                            {option.label}
                          </Badge>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedBillingType.description ? (
                    <FormDescription>
                      {selectedBillingType.description}
                    </FormDescription>
                  ) : null}
                  <FormMessage />
                </FormItem>
              )
            }}
          />
          {isEditing &&
          initialBillingType !== null &&
          watchedBillingType !== initialBillingType ? (
            <FormField
              control={form.control}
              name='billingEffective'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New billing starts</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={isPending}
                  >
                    <FormControl>
                      <DisabledFieldTooltip
                        disabled={isPending}
                        reason={isPending ? pendingReason : null}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </DisabledFieldTooltip>
                    </FormControl>
                    <SelectContent align='start'>
                      <SelectItem value='next_month'>
                        Next month ({formatMonthStart(1)})
                      </SelectItem>
                      <SelectItem value='current_month'>
                        This month ({formatMonthStart(0)})
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    {field.value === 'current_month'
                      ? "This month's close will re-derive under the new billing type."
                      : 'The new type applies to invoices right away; the Monthly Close switches this client at the boundary.'}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          ) : null}
          <FormField
            control={form.control}
            name='state'
            render={({ field }) => (
              <FormItem>
                <FormLabel>State (optional)</FormLabel>
                <Select
                  value={field.value ?? ''}
                  onValueChange={value => {
                    field.onChange(value === '' ? '' : value)
                  }}
                  disabled={isPending}
                >
                  <FormControl>
                    <DisabledFieldTooltip
                      disabled={isPending}
                      reason={isPending ? pendingReason : null}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder='Select state (optional)' />
                      </SelectTrigger>
                    </DisabledFieldTooltip>
                  </FormControl>
                  <SelectContent align='start'>
                    {US_STATES.map(state => (
                      <SelectItem key={state.value} value={state.value}>
                        {state.label} ({state.value})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormDescription>
                  Used to calculate tax rate on invoices.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name='website'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Website (optional)</FormLabel>
                <FormControl>
                  <DisabledFieldTooltip
                    disabled={isPending}
                    reason={isPending ? pendingReason : null}
                  >
                    <Input
                      {...field}
                      value={field.value ?? ''}
                      placeholder='https://example.com'
                      disabled={isPending}
                    />
                  </DisabledFieldTooltip>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className='grid gap-2'>
            <FormLabel
              data-error={Boolean(originationError)}
              className='data-[error=true]:text-destructive'
            >
              Origination
            </FormLabel>
            <ClientOriginationPicker
              mode={originationMode}
              selectedUser={selectedOriginationUser}
              selectedContact={selectedOriginationContact}
              availableUsers={availableOriginationUsers}
              availableContacts={availableOriginationContacts}
              disabled={originationPickerDisabled}
              disabledReason={originationPickerDisabledReason}
              isUserPickerOpen={isOriginationUserPickerOpen}
              isContactPickerOpen={isOriginationContactPickerOpen}
              isPending={isPending}
              pendingReason={pendingReason}
              onModeChange={onOriginationModeChange}
              onUserPickerOpenChange={onOriginationUserPickerOpenChange}
              onContactPickerOpenChange={onOriginationContactPickerOpenChange}
              onSelectUser={onSelectOriginationUser}
              onSelectContact={onSelectOriginationContact}
              onClear={onClearOrigination}
            />
            {originationError ? (
              <p className='text-destructive text-xs'>{originationError}</p>
            ) : null}
          </div>
          <div className='grid gap-2'>
            <FormLabel
              data-error={Boolean(closerError)}
              className='data-[error=true]:text-destructive'
            >
              Closer
            </FormLabel>
            <ClientCloserPicker
              selectedCloser={selectedCloser}
              availableClosers={availableClosers}
              disabled={closerPickerDisabled}
              disabledReason={closerPickerDisabledReason}
              isPickerOpen={isCloserPickerOpen}
              isPending={isPending}
              pendingReason={pendingReason}
              onPickerOpenChange={onCloserPickerOpenChange}
              onSelect={onSelectCloser}
              onClear={onClearCloser}
            />
            {closerError ? (
              <p className='text-destructive text-xs'>{closerError}</p>
            ) : null}
          </div>
          <div className='space-y-2'>
            <FormLabel>Contacts</FormLabel>
            <ClientContactPicker
              selectedContacts={selectedContacts}
              availableContacts={availableContacts}
              addButtonDisabled={contactsAddButtonDisabled}
              addButtonDisabledReason={contactsAddButtonDisabledReason}
              isPickerOpen={isContactPickerOpen}
              isPending={isPending}
              pendingReason={pendingReason}
              onPickerOpenChange={onContactPickerOpenChange}
              onAddContact={onAddContact}
              onRequestRemoval={onRemoveContact}
            />
          </div>
          {feedback ? <p className={FEEDBACK_CLASSES}>{feedback}</p> : null}
        </form>
      </div>
      <SheetFormFooter
        formId={CLIENT_FORM_ID}
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
        deleteAriaLabel='Archive client'
      />
    </Form>
  )
}

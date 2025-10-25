'use client'

import { ChevronsUpDown, Trash2, UserPlus, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { SearchableCombobox } from '@/components/ui/searchable-combobox'
import { PROJECT_STATUS_OPTIONS } from '@/lib/constants'
import {
  PROJECT_SHEET_MISSING_CLIENT_REASON,
  PROJECT_SHEET_PENDING_REASON,
  useProjectSheetState,
  type ContractorUserSummary,
  type ProjectSheetFormValues,
  type ProjectWithClient,
} from '@/lib/settings/projects/use-project-sheet-state'
import type { Database } from '@/supabase/types/database'

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

  const nameField = {
    disabled: isPending,
    reason: isPending ? PROJECT_SHEET_PENDING_REASON : null,
  }

  const slugField = nameField
  const statusField = nameField
  const dateField = nameField

  const clientField = {
    disabled: isPending || clientOptions.length === 0,
    reason: isPending
      ? PROJECT_SHEET_PENDING_REASON
      : clientOptions.length === 0
        ? PROJECT_SHEET_MISSING_CLIENT_REASON
        : null,
  }

  return (
    <>
      <Sheet open={props.open} onOpenChange={handleSheetOpenChange}>
        <SheetContent className='flex w-full flex-col gap-6 overflow-y-auto sm:max-w-2xl'>
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
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit((values: ProjectSheetFormValues) =>
                handleSubmit(values)
              )}
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
                        disabled={nameField.disabled}
                        reason={nameField.reason}
                      >
                        <Input
                          {...field}
                          value={field.value ?? ''}
                          placeholder='Website redesign'
                          disabled={nameField.disabled}
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
                          disabled={slugField.disabled}
                          reason={slugField.reason}
                        >
                          <Input
                            {...field}
                            value={field.value ?? ''}
                            placeholder='website-redesign'
                            disabled={slugField.disabled}
                          />
                        </DisabledFieldTooltip>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : null}
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
                  name='status'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select
                        value={field.value ?? ''}
                        onValueChange={field.onChange}
                        disabled={statusField.disabled}
                      >
                        <FormControl>
                          <DisabledFieldTooltip
                            disabled={statusField.disabled}
                            reason={statusField.reason}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder='Select status' />
                            </SelectTrigger>
                          </DisabledFieldTooltip>
                        </FormControl>
                        <SelectContent align='start'>
                          {PROJECT_STATUS_OPTIONS.map(status => (
                            <SelectItem key={status.value} value={status.value}>
                              {status.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className='grid gap-4 sm:grid-cols-2'>
                <FormField
                  control={form.control}
                  name='startsOn'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start date (optional)</FormLabel>
                      <FormControl>
                        <DisabledFieldTooltip
                          disabled={dateField.disabled}
                          reason={dateField.reason}
                        >
                          <Input
                            {...field}
                            value={field.value ?? ''}
                            type='date'
                            disabled={dateField.disabled}
                          />
                        </DisabledFieldTooltip>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name='endsOn'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>End date (optional)</FormLabel>
                      <FormControl>
                        <DisabledFieldTooltip
                          disabled={dateField.disabled}
                          reason={dateField.reason}
                        >
                          <Input
                            {...field}
                            value={field.value ?? ''}
                            type='date'
                            disabled={dateField.disabled}
                          />
                        </DisabledFieldTooltip>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className='space-y-2'>
                <FormLabel>Contractors</FormLabel>
                <Popover
                  open={isContractorPickerOpen}
                  onOpenChange={handleContractorPickerOpenChange}
                >
                  <DisabledFieldTooltip
                    disabled={contractorButton.disabled}
                    reason={contractorButton.reason}
                  >
                    <div className='w-full'>
                      <PopoverTrigger asChild>
                        <Button
                          type='button'
                          variant='outline'
                          className='w-full justify-between'
                          disabled={contractorButton.disabled}
                        >
                          <span className='flex items-center gap-2'>
                            <UserPlus className='h-4 w-4' />
                            {availableContractors.length > 0
                              ? 'Add contractor'
                              : 'All contractors assigned'}
                          </span>
                          <ChevronsUpDown className='h-4 w-4 opacity-50' />
                        </Button>
                      </PopoverTrigger>
                    </div>
                  </DisabledFieldTooltip>
                  <PopoverContent className='w-[320px] p-0' align='start'>
                    <Command>
                      <CommandInput placeholder='Search contractors...' />
                      <CommandEmpty>No matching contractors.</CommandEmpty>
                      <CommandList>
                        <CommandGroup heading='Contractors'>
                          {availableContractors.map(contractor => {
                            const displayName = contractor.fullName?.trim()
                              ? contractor.fullName.trim()
                              : contractor.email

                            return (
                              <CommandItem
                                key={contractor.id}
                                value={`${displayName} ${contractor.email}`}
                                onSelect={() => handleAddContractor(contractor)}
                              >
                                <div className='flex flex-col'>
                                  <span className='font-medium'>
                                    {displayName}
                                  </span>
                                  <span className='text-muted-foreground text-xs'>
                                    {contractor.email}
                                  </span>
                                </div>
                              </CommandItem>
                            )
                          })}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                <p className='text-muted-foreground text-xs'>
                  Assigned contractors can collaborate on this project&apos;s
                  tasks.
                </p>
                <div className='space-y-2'>
                  {selectedContractors.length === 0 ? (
                    <p className='text-muted-foreground text-sm'>
                      No contractors assigned yet.
                    </p>
                  ) : (
                    selectedContractors.map(contractor => {
                      const displayName = contractor.fullName?.trim()
                        ? contractor.fullName.trim()
                        : contractor.email

                      return (
                        <div
                          key={contractor.id}
                          className='bg-muted/40 flex items-center justify-between rounded-md border px-3 py-2'
                        >
                          <div className='flex flex-col text-sm leading-tight'>
                            <span className='font-medium'>{displayName}</span>
                            <span className='text-muted-foreground text-xs'>
                              {contractor.email}
                            </span>
                          </div>
                          <DisabledFieldTooltip
                            disabled={isPending}
                            reason={
                              isPending ? PROJECT_SHEET_PENDING_REASON : null
                            }
                          >
                            <Button
                              type='button'
                              variant='ghost'
                              size='icon'
                              className='text-muted-foreground hover:text-destructive'
                              onClick={() =>
                                handleRequestContractorRemoval(contractor)
                              }
                              disabled={isPending}
                              aria-label={`Remove ${displayName}`}
                            >
                              <X className='h-4 w-4' />
                            </Button>
                          </DisabledFieldTooltip>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>

              {feedback ? (
                <p className='border-destructive/40 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm'>
                  {feedback}
                </p>
              ) : null}
              <SheetFooter className='flex items-center justify-between gap-3 px-0 pt-6 pb-0'>
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
                <DisabledFieldTooltip
                  disabled={submitButton.disabled}
                  reason={submitButton.reason}
                >
                  <Button type='submit' disabled={submitButton.disabled}>
                    {submitButton.label}
                  </Button>
                </DisabledFieldTooltip>
              </SheetFooter>
            </form>
          </Form>
        </SheetContent>
      </Sheet>
      <ConfirmDialog
        open={isDeleteDialogOpen}
        title='Delete project?'
        description='Deleting this project hides it from active views but keeps the history intact.'
        confirmLabel='Delete'
        confirmVariant='destructive'
        confirmDisabled={isPending}
        onCancel={handleCancelDelete}
        onConfirm={handleConfirmDelete}
      />
      {unsavedChangesDialog}
      <Dialog
        open={Boolean(contractorRemovalCandidate)}
        onOpenChange={next => {
          if (!next) {
            handleCancelContractorRemoval()
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
              onClick={handleCancelContractorRemoval}
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
                onClick={handleConfirmContractorRemoval}
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

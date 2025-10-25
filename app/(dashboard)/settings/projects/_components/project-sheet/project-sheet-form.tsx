import { Trash2 } from 'lucide-react'
import { UseFormReturn } from 'react-hook-form'

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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SheetFooter } from '@/components/ui/sheet'
import { SearchableCombobox } from '@/components/ui/searchable-combobox'
import { PROJECT_STATUS_OPTIONS } from '@/lib/constants'
import type {
  ContractorUserSummary,
  ProjectSheetFormValues,
} from '@/lib/settings/projects/use-project-sheet-state'
import type { ContractorButtonState } from '@/lib/settings/projects/project-sheet-contractors'
import type {
  ClientOption,
  DeleteButtonState,
  SubmitButtonState,
} from '@/lib/settings/projects/project-sheet-ui-state'
import { ProjectContractorsSection } from './project-contractors-section'
import type { ProjectSheetFieldState } from './project-sheet-field-state'

export type ProjectSheetFormProps = {
  form: UseFormReturn<ProjectSheetFormValues>
  fieldState: ProjectSheetFieldState
  isEditing: boolean
  isPending: boolean
  feedback: string | null
  clientOptions: ClientOption[]
  contractorButton: ContractorButtonState
  submitButton: SubmitButtonState
  deleteButton: DeleteButtonState
  availableContractors: ContractorUserSummary[]
  selectedContractors: ContractorUserSummary[]
  isContractorPickerOpen: boolean
  onSubmit: (values: ProjectSheetFormValues) => void
  onRequestDelete: () => void
  onAddContractor: (user: ContractorUserSummary) => void
  onContractorPickerOpenChange: (open: boolean) => void
  onRequestContractorRemoval: (user: ContractorUserSummary) => void
}

export function ProjectSheetForm(props: ProjectSheetFormProps) {
  const {
    form,
    fieldState,
    isEditing,
    isPending,
    feedback,
    clientOptions,
    contractorButton,
    submitButton,
    deleteButton,
    availableContractors,
    selectedContractors,
    isContractorPickerOpen,
    onSubmit,
    onRequestDelete,
    onAddContractor,
    onContractorPickerOpenChange,
    onRequestContractorRemoval,
  } = props

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
                  disabled={fieldState.name.disabled}
                  reason={fieldState.name.reason}
                >
                  <Input
                    {...field}
                    value={field.value ?? ''}
                    placeholder='Website redesign'
                    disabled={fieldState.name.disabled}
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
                    disabled={fieldState.slug.disabled}
                    reason={fieldState.slug.reason}
                  >
                    <Input
                      {...field}
                      value={field.value ?? ''}
                      placeholder='website-redesign'
                      disabled={fieldState.slug.disabled}
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
                    disabled={fieldState.client.disabled}
                    reason={fieldState.client.reason}
                  >
                    <SearchableCombobox
                      name={field.name}
                      value={field.value ?? ''}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      items={clientOptions}
                      searchPlaceholder='Search clients...'
                      emptyMessage='No clients found.'
                      disabled={fieldState.client.disabled}
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
                  disabled={fieldState.status.disabled}
                >
                  <FormControl>
                    <DisabledFieldTooltip
                      disabled={fieldState.status.disabled}
                      reason={fieldState.status.reason}
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
                    disabled={fieldState.date.disabled}
                    reason={fieldState.date.reason}
                  >
                    <Input
                      {...field}
                      value={field.value ?? ''}
                      type='date'
                      disabled={fieldState.date.disabled}
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
                    disabled={fieldState.date.disabled}
                    reason={fieldState.date.reason}
                  >
                    <Input
                      {...field}
                      value={field.value ?? ''}
                      type='date'
                      disabled={fieldState.date.disabled}
                    />
                  </DisabledFieldTooltip>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <ProjectContractorsSection
          availableContractors={availableContractors}
          selectedContractors={selectedContractors}
          contractorButton={contractorButton}
          isContractorPickerOpen={isContractorPickerOpen}
          isPending={isPending}
          onContractorPickerOpenChange={onContractorPickerOpenChange}
          onAddContractor={onAddContractor}
          onRequestContractorRemoval={onRequestContractorRemoval}
        />

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
                onClick={onRequestDelete}
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
  )
}

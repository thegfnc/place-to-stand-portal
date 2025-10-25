'use client'

import { Trash2 } from 'lucide-react'

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
  SearchableCombobox,
  type SearchableComboboxItem,
} from '@/components/ui/searchable-combobox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SheetFooter } from '@/components/ui/sheet'
import { RichTextEditor } from '@/components/ui/rich-text-editor'
import type { UseFormReturn } from 'react-hook-form'

import type { TaskSheetFormValues } from '@/lib/projects/task-sheet/task-sheet-schema'
import { normalizeRichTextContent } from '@/lib/projects/task-sheet/task-sheet-utils'

const FEEDBACK_CLASSES =
  'border-destructive/40 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm'

type TaskSheetFormProps = {
  form: UseFormReturn<TaskSheetFormValues>
  onSubmit: (values: TaskSheetFormValues) => void
  feedback: string | null
  isPending: boolean
  canManage: boolean
  assigneeItems: SearchableComboboxItem[]
  resolveDisabledReason: (disabled: boolean) => string | null
  taskStatuses: Array<{ value: string; label: string }>
  unassignedValue: string
  editorKey: string
  isEditing: boolean
  onRequestDelete: () => void
  deleteDisabled: boolean
  deleteDisabledReason: string | null
  submitDisabled: boolean
  submitDisabledReason: string | null
}

export function TaskSheetForm({
  form,
  onSubmit,
  feedback,
  isPending,
  canManage,
  assigneeItems,
  resolveDisabledReason,
  taskStatuses,
  unassignedValue,
  editorKey,
  isEditing,
  onRequestDelete,
  deleteDisabled,
  deleteDisabledReason,
  submitDisabled,
  submitDisabledReason,
}: TaskSheetFormProps) {
  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className='flex flex-1 flex-col gap-6 px-6 pb-6'
      >
        <FormField
          control={form.control}
          name='title'
          render={({ field }) => {
            const disabled = isPending || !canManage
            const reason = resolveDisabledReason(disabled)

            return (
              <FormItem>
                <FormLabel>Title</FormLabel>
                <FormControl>
                  <DisabledFieldTooltip disabled={disabled} reason={reason}>
                    <Input
                      {...field}
                      value={field.value ?? ''}
                      disabled={disabled}
                      placeholder='Give the task a clear name'
                    />
                  </DisabledFieldTooltip>
                </FormControl>
                <FormMessage />
              </FormItem>
            )
          }}
        />
        <div className='grid gap-4 sm:grid-cols-2'>
          <FormField
            control={form.control}
            name='status'
            render={({ field }) => {
              const disabled = isPending || !canManage
              const reason = resolveDisabledReason(disabled)

              return (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={disabled}
                  >
                    <FormControl>
                      <DisabledFieldTooltip disabled={disabled} reason={reason}>
                        <SelectTrigger>
                          <SelectValue placeholder='Select status' />
                        </SelectTrigger>
                      </DisabledFieldTooltip>
                    </FormControl>
                    <SelectContent align='start'>
                      {taskStatuses.map(status => (
                        <SelectItem key={status.value} value={status.value}>
                          {status.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )
            }}
          />
          <FormField
            control={form.control}
            name='dueOn'
            render={({ field }) => {
              const disabled = isPending || !canManage
              const reason = resolveDisabledReason(disabled)

              return (
                <FormItem>
                  <FormLabel>Due date</FormLabel>
                  <FormControl>
                    <DisabledFieldTooltip disabled={disabled} reason={reason}>
                      <Input
                        type='date'
                        value={field.value ?? ''}
                        onChange={field.onChange}
                        disabled={disabled}
                      />
                    </DisabledFieldTooltip>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )
            }}
          />
        </div>
        <FormField
          control={form.control}
          name='assigneeId'
          render={({ field }) => {
            const disabled = isPending || !canManage
            const reason = resolveDisabledReason(disabled)
            const selectedValue = field.value ?? unassignedValue

            return (
              <FormItem>
                <FormLabel>Assignee</FormLabel>
                <FormControl>
                  <DisabledFieldTooltip disabled={disabled} reason={reason}>
                    <SearchableCombobox
                      items={assigneeItems}
                      value={selectedValue}
                      onChange={next => {
                        if (next === unassignedValue) {
                          field.onChange(null)
                          return
                        }
                        field.onChange(next)
                      }}
                      onBlur={field.onBlur}
                      name={field.name}
                      placeholder='Select assignee'
                      searchPlaceholder='Search collaborators...'
                      emptyMessage='No eligible collaborators found.'
                      disabled={disabled}
                    />
                  </DisabledFieldTooltip>
                </FormControl>
                <FormMessage />
              </FormItem>
            )
          }}
        />
        <FormField
          control={form.control}
          name='description'
          render={({ field }) => {
            const disabled = isPending || !canManage
            const reason = resolveDisabledReason(disabled)
            const editorValue = field.value ?? ''

            return (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <DisabledFieldTooltip disabled={disabled} reason={reason}>
                    <RichTextEditor
                      key={editorKey}
                      id='task-description'
                      value={editorValue}
                      onChange={(content: string) =>
                        field.onChange(
                          normalizeRichTextContent(content) ?? null
                        )
                      }
                      onBlur={field.onBlur}
                      disabled={disabled}
                      placeholder='Add helpful context for collaborators'
                    />
                  </DisabledFieldTooltip>
                </FormControl>
                <FormMessage />
              </FormItem>
            )
          }}
        />
        {feedback ? <p className={FEEDBACK_CLASSES}>{feedback}</p> : null}
        <SheetFooter className='flex items-center justify-between gap-3 px-0 pt-6 pb-0'>
          <DisabledFieldTooltip
            disabled={submitDisabled}
            reason={submitDisabledReason}
          >
            <Button type='submit' disabled={submitDisabled}>
              {isPending
                ? 'Saving...'
                : isEditing
                  ? 'Save changes'
                  : 'Create task'}
            </Button>
          </DisabledFieldTooltip>
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
                <Trash2 className='h-4 w-4' />
              </Button>
            </DisabledFieldTooltip>
          ) : null}
        </SheetFooter>
      </form>
    </Form>
  )
}

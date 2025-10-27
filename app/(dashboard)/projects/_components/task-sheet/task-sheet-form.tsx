'use client'

import { useCallback, useMemo } from 'react'
import { Redo2, Trash2, Undo2 } from 'lucide-react'

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
import { RichTextEditor } from '@/components/ui/rich-text-editor'
import type { UseFormReturn } from 'react-hook-form'

import { useSheetFormControls } from '@/lib/hooks/use-sheet-form-controls'
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
  isSheetOpen: boolean
  historyKey: string
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
  isSheetOpen,
  historyKey,
}: TaskSheetFormProps) {
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

    if (isEditing) {
      return 'Save changes'
    }

    return 'Create task'
  }, [isEditing, isPending])

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className='flex flex-1 flex-col gap-6 px-6 pb-32'
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
        <div className='border-border/40 bg-muted/95 supports-backdrop-filter:bg-muted/90 fixed right-0 bottom-0 z-50 w-full border-t shadow-lg backdrop-blur sm:max-w-2xl'>
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
                  <Trash2 className='h-4 w-4' />
                </Button>
              </DisabledFieldTooltip>
            ) : null}
          </div>
        </div>
      </form>
    </Form>
  )
}

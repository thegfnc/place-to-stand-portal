import { useEffect, useRef } from 'react'
import type React from 'react'
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  SearchableCombobox,
  type SearchableComboboxGroup,
  type SearchableComboboxItem,
} from '@/components/ui/searchable-combobox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { RichTextEditor } from '@/components/ui/rich-text-editor'
import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'
import type { UseFormReturn } from 'react-hook-form'

import type { TaskSheetFormValues } from '@/lib/projects/task-sheet/task-sheet-schema'
import { normalizeRichTextContent } from '@/lib/projects/task-sheet/task-sheet-utils'
import type { AttachmentItem } from '@/lib/projects/task-sheet/use-task-sheet-state'
import { cn } from '@/lib/utils'

import { TaskAttachmentsField } from '../task-attachments-field'

const FEEDBACK_CLASSES =
  'border-destructive/40 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm'

export type TaskSheetFormFieldsProps = {
  form: UseFormReturn<TaskSheetFormValues>
  isPending: boolean
  canManage: boolean
  resolveDisabledReason: (disabled: boolean) => string | null
  taskStatuses: Array<{ value: string; label: string; token: string }>
  assigneeItems: SearchableComboboxItem[]
  unassignedValue: string
  projectItems: SearchableComboboxItem[]
  projectGroups: SearchableComboboxGroup[]
  editorKey: string
  attachments: AttachmentItem[]
  onSelectFiles: (files: FileList | null) => void
  onAttachmentRemove: (key: string) => void
  attachmentsDisabled: boolean
  attachmentsDisabledReason: string | null
  isUploadingAttachments: boolean
  isDragActive: boolean
  acceptedAttachmentTypes: readonly string[]
  maxAttachmentSize: number
  feedback: string | null
  isSheetOpen: boolean
}

export function TaskSheetFormFields(props: TaskSheetFormFieldsProps) {
  const {
    form,
    isPending,
    canManage,
    resolveDisabledReason,
    taskStatuses,
    assigneeItems,
    unassignedValue,
    projectItems,
    projectGroups,
    editorKey,
    attachments,
    onSelectFiles,
    onAttachmentRemove,
    attachmentsDisabled,
    attachmentsDisabledReason,
    isUploadingAttachments,
    isDragActive,
    acceptedAttachmentTypes,
    maxAttachmentSize,
    feedback,
    isSheetOpen,
  } = props

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
    <>
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
                    ref={(node) => {
                      firstFieldRef.current = node
                      if (typeof field.ref === 'function') {
                        field.ref(node)
                      } else if (field.ref) {
                        ;(field.ref as React.MutableRefObject<HTMLInputElement | null>).current =
                          node
                      }
                    }}
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
            const selectedStatus = taskStatuses.find(
              s => s.value === field.value
            )

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
                        <SelectValue placeholder='Select status'>
                          {selectedStatus && (
                            <Badge
                              variant='outline'
                              className={cn(
                                'text-xs font-semibold tracking-wide uppercase',
                                selectedStatus.token
                              )}
                            >
                              {selectedStatus.label}
                            </Badge>
                          )}
                        </SelectValue>
                      </SelectTrigger>
                    </DisabledFieldTooltip>
                  </FormControl>
                  <SelectContent align='start'>
                    {taskStatuses.map(status => (
                      <SelectItem key={status.value} value={status.value}>
                        <Badge
                          variant='outline'
                          className={cn(
                            'text-xs font-semibold tracking-wide uppercase',
                            status.token
                          )}
                        >
                          {status.label}
                        </Badge>
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
      <div className='grid gap-4 sm:grid-cols-2'>
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
          name='projectId'
          render={({ field }) => {
            const disabled = isPending || !canManage
            const reason = resolveDisabledReason(disabled)
            const selectedValue = field.value ?? ''

            return (
              <FormItem>
                <FormLabel>Project</FormLabel>
                <FormControl>
                  <DisabledFieldTooltip disabled={disabled} reason={reason}>
                    <SearchableCombobox
                      items={projectItems}
                      groups={projectGroups}
                      value={selectedValue}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      name={field.name}
                      placeholder='Select project'
                      searchPlaceholder='Search projects...'
                      emptyMessage='No projects found.'
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
                      field.onChange(normalizeRichTextContent(content) ?? null)
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
      <TaskAttachmentsField
        attachments={attachments}
        onSelectFiles={onSelectFiles}
        onRemove={onAttachmentRemove}
        disabled={attachmentsDisabled}
        disabledReason={attachmentsDisabledReason}
        isUploading={isUploadingAttachments}
        isDragActive={!attachmentsDisabled && isDragActive}
        acceptedMimeTypes={acceptedAttachmentTypes}
        maxFileSize={maxAttachmentSize}
      />
      {feedback ? <p className={FEEDBACK_CLASSES}>{feedback}</p> : null}
    </>
  )
}

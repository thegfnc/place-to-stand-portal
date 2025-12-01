'use client'

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'

import { TaskSheetFormFooter } from '@/app/(dashboard)/projects/_components/task-sheet/form/task-sheet-form-footer'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
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
import { RichTextEditor } from '@/components/ui/rich-text-editor'
import { SearchableCombobox } from '@/components/ui/searchable-combobox'
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
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { useToast } from '@/components/ui/use-toast'
import { useSheetFormControls } from '@/lib/hooks/use-sheet-form-controls'
import { useUnsavedChangesWarning } from '@/lib/hooks/use-unsaved-changes-warning'
import {
  LEAD_SOURCE_LABELS,
  LEAD_SOURCE_TYPES,
  LEAD_STATUS_LABELS,
  LEAD_STATUS_VALUES,
  type LeadSourceTypeValue,
  type LeadStatusValue,
} from '@/lib/leads/constants'
import type { LeadAssigneeOption, LeadRecord } from '@/lib/leads/types'

import { archiveLead, saveLead } from '../actions'

const formSchema = z.object({
  contactName: z.string().trim().min(1, 'Contact name is required').max(160),
  contactEmail: z
    .string()
    .trim()
    .email('Enter a valid email address')
    .optional()
    .nullable(),
  contactPhone: z.string().trim().max(40).optional().nullable(),
  companyName: z.string().trim().max(160).optional().nullable(),
  companyWebsite: z
    .union([z.string().trim().url('Enter a valid URL'), z.literal('')])
    .transform(val => (val === '' ? null : val))
    .optional()
    .nullable(),
  sourceType: z.enum(LEAD_SOURCE_TYPES).optional().nullable(),
  sourceDetail: z.string().trim().max(160).optional().nullable(),
  status: z.enum(LEAD_STATUS_VALUES),
  assigneeId: z.string().uuid().optional().nullable(),
  notes: z.string().optional(),
})

type LeadFormValues = z.infer<typeof formSchema>

type LeadSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  lead: LeadRecord | null
  assignees: LeadAssigneeOption[]
  onSuccess: () => void
}

export function LeadSheet({
  open,
  onOpenChange,
  lead,
  assignees,
  onSuccess,
}: LeadSheetProps) {
  const isEditing = Boolean(lead)
  const [isSaving, startSaveTransition] = useTransition()
  const [isArchiving, startArchiveTransition] = useTransition()
  const [isArchiveDialogOpen, setArchiveDialogOpen] = useState(false)
  const { toast } = useToast()

  const defaultValues = useMemo<LeadFormValues>(
    () => ({
      contactName: lead?.contactName ?? '',
      contactEmail: lead?.contactEmail ?? '',
      contactPhone: lead?.contactPhone ?? '',
      companyName: lead?.companyName ?? '',
      companyWebsite: lead?.companyWebsite ?? '',
      sourceType: lead?.sourceType ?? null,
      sourceDetail: lead?.sourceDetail ?? '',
      status: lead?.status ?? 'NEW_OPPORTUNITIES',
      assigneeId: lead?.assigneeId ?? null,
      notes: lead?.notesHtml ?? '',
    }),
    [lead]
  )

  const form = useForm<LeadFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues,
  })

  useEffect(() => {
    form.reset(defaultValues)
  }, [defaultValues, form])

  const assigneeItems = useMemo(
    () => [
      {
        value: '',
        label: 'Unassigned',
        description: 'Leave unassigned for now.',
      },
      ...assignees.map(assignee => ({
        value: assignee.id,
        label: assignee.name,
        description: assignee.email ?? undefined,
      })),
    ],
    [assignees]
  )

  const submitDisabled = isSaving || isArchiving
  const historyKey = lead?.id ?? 'lead:new'
  const selectedSourceType = useWatch({
    control: form.control,
    name: 'sourceType',
  })

  useEffect(() => {
    if (!selectedSourceType) {
      const currentDetail = form.getValues('sourceDetail')
      if (currentDetail) {
        form.setValue('sourceDetail', '')
      }
    }
  }, [form, selectedSourceType])

  const handleFormSubmit = useCallback(
    (values: LeadFormValues) => {
      startSaveTransition(async () => {
        const result = await saveLead({
          id: lead?.id,
          ...values,
        })

        if (!result.success) {
          toast({
            variant: 'destructive',
            title: 'Unable to save lead',
            description: result.error ?? 'Please try again.',
          })
          return
        }

        toast({
          title: isEditing ? 'Lead updated' : 'Lead created',
          description: isEditing
            ? 'The lead has been updated successfully.'
            : 'Your new lead has been added to the pipeline.',
        })

        form.reset({
          ...values,
          contactName: values.contactName ?? '',
          contactEmail: values.contactEmail ?? '',
          contactPhone: values.contactPhone ?? '',
          companyName: values.companyName ?? '',
          companyWebsite: values.companyWebsite ?? '',
          sourceType: values.sourceType ?? null,
          sourceDetail: values.sourceDetail ?? '',
          status: values.status,
          assigneeId: values.assigneeId ?? null,
          notes: values.notes ?? '',
        })

        setArchiveDialogOpen(false)
        onOpenChange(false)
        onSuccess()
      })
    },
    [form, isEditing, lead?.id, onOpenChange, onSuccess, toast]
  )

  const handleSaveShortcut = useCallback(
    () => form.handleSubmit(handleFormSubmit)(),
    [form, handleFormSubmit]
  )

  const { undo, redo, canUndo, canRedo } = useSheetFormControls<LeadFormValues>(
    {
      form,
      isActive: open,
      canSave: !submitDisabled,
      onSave: handleSaveShortcut,
      historyKey,
    }
  )

  const saveLabel = useMemo(() => {
    if (isSaving) {
      return isEditing ? 'Saving...' : 'Creating...'
    }

    return isEditing ? 'Save changes' : 'Create lead'
  }, [isEditing, isSaving])

  const submitDisabledReason = isSaving
    ? 'Saving lead...'
    : isArchiving
      ? 'Archiving lead...'
      : null

  const archiveDisabledReason = isSaving
    ? 'Finish saving before archiving.'
    : isArchiving
      ? 'Archiving lead...'
      : null

  const handleArchive = useCallback(() => {
    if (!lead) return

    startArchiveTransition(async () => {
      const result = await archiveLead({ leadId: lead.id })

      if (!result.success) {
        toast({
          variant: 'destructive',
          title: 'Unable to archive lead',
          description: result.error ?? 'Please try again.',
        })
        return
      }

      toast({
        title: 'Lead archived',
        description: 'The lead has been archived and removed from the board.',
      })

      setArchiveDialogOpen(false)
      onOpenChange(false)
      onSuccess()
    })
  }, [lead, onOpenChange, onSuccess, startArchiveTransition, toast])

  const {
    requestConfirmation: requestCloseConfirmation,
    dialog: unsavedChangesDialog,
  } = useUnsavedChangesWarning({
    isDirty: form.formState.isDirty,
    title: 'Discard lead changes?',
    description:
      'You have unsaved updates for this lead. Continue without saving?',
    confirmLabel: 'Discard',
    cancelLabel: 'Keep editing',
  })

  const handleSheetOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) {
        onOpenChange(true)
        return
      }

      requestCloseConfirmation(() => {
        setArchiveDialogOpen(false)
        onOpenChange(false)
      })
    },
    [onOpenChange, requestCloseConfirmation]
  )

  return (
    <>
      <Sheet open={open} onOpenChange={handleSheetOpenChange}>
        <SheetContent className='flex w-full flex-col gap-6 overflow-y-auto pb-24 sm:max-w-[676px]'>
          <div className='flex flex-col gap-6'>
            <SheetHeader className='border-b-2 border-b-amber-500/60 px-6 pt-4'>
              <SheetTitle>{isEditing ? 'Edit lead' : 'New lead'}</SheetTitle>
              <SheetDescription>
                {isEditing
                  ? 'Keep this lead up to date so the pipeline stays accurate.'
                  : 'Capture lead context, assignees, and next steps to keep deals moving.'}
              </SheetDescription>
            </SheetHeader>
            <Form {...form}>
              <form
                className='flex flex-1 flex-col gap-6 px-6 pb-4'
                onSubmit={form.handleSubmit(handleFormSubmit)}
              >
                <div className='space-y-6'>
                  <FormField
                    control={form.control}
                    name='contactName'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contact Name</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            value={field.value ?? ''}
                            placeholder='Jordan Smith'
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className='grid gap-4 sm:grid-cols-2'>
                    <FormField
                      control={form.control}
                      name='contactEmail'
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Contact Email</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              value={field.value ?? ''}
                              type='email'
                              placeholder='name@org.com'
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name='contactPhone'
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Contact Phone</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              value={field.value ?? ''}
                              placeholder='+1 (555) 123-4567'
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className='grid gap-4 sm:grid-cols-2'>
                    <FormField
                      control={form.control}
                      name='companyName'
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Company Name</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              value={field.value ?? ''}
                              placeholder='Acme Corporation'
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name='companyWebsite'
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Company Website</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              value={field.value ?? ''}
                              type='url'
                              placeholder='https://acme.com'
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className='grid gap-4 sm:grid-cols-2'>
                    <FormField
                      control={form.control}
                      name='sourceType'
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Source</FormLabel>
                          <Select
                            value={field.value ?? undefined}
                            onValueChange={(value: LeadSourceTypeValue) =>
                              field.onChange(value)
                            }
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder='Select source' />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {LEAD_SOURCE_TYPES.map(source => (
                                <SelectItem key={source} value={source}>
                                  {LEAD_SOURCE_LABELS[source]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name='sourceDetail'
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Source Info</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              value={field.value ?? ''}
                              placeholder='Referral name, site URL, or event title'
                              disabled={!selectedSourceType}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name='status'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select
                          value={field.value}
                          onValueChange={(value: LeadStatusValue) =>
                            field.onChange(value)
                          }
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder='Select status' />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {LEAD_STATUS_VALUES.map(status => (
                              <SelectItem key={status} value={status}>
                                {LEAD_STATUS_LABELS[status]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name='assigneeId'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Assignee</FormLabel>
                        <FormControl>
                          <SearchableCombobox
                            items={assigneeItems}
                            value={field.value ?? ''}
                            onChange={value =>
                              field.onChange(value.length ? value : null)
                            }
                            placeholder='Assign teammate'
                            searchPlaceholder='Search teammates'
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name='notes'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notes</FormLabel>
                        <FormControl>
                          <RichTextEditor
                            id='lead-notes'
                            value={field.value ?? ''}
                            onChange={field.onChange}
                            contentMinHeightClassName='[&_.ProseMirror]:min-h-[180px]'
                          />
                        </FormControl>
                        <FormDescription>
                          Capture context, meeting notes, or next steps.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <TaskSheetFormFooter
                  saveLabel={saveLabel}
                  submitDisabled={submitDisabled}
                  submitDisabledReason={submitDisabledReason}
                  undo={undo}
                  redo={redo}
                  canUndo={canUndo}
                  canRedo={canRedo}
                  isEditing={isEditing}
                  deleteDisabled={submitDisabled}
                  deleteDisabledReason={archiveDisabledReason}
                  onRequestDelete={() => setArchiveDialogOpen(true)}
                  deleteAriaLabel='Archive lead'
                />
              </form>
            </Form>
          </div>
        </SheetContent>
      </Sheet>
      <ConfirmDialog
        open={isArchiveDialogOpen}
        title='Archive this lead?'
        description='Archiving removes the lead from the board without permanently deleting history.'
        confirmLabel={isArchiving ? 'Archiving...' : 'Archive'}
        confirmVariant='destructive'
        confirmDisabled={isArchiving}
        onCancel={() => {
          if (!isArchiving) {
            setArchiveDialogOpen(false)
          }
        }}
        onConfirm={handleArchive}
      />
      {unsavedChangesDialog}
    </>
  )
}

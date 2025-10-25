'use client'

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { formatISO, parseISO } from 'date-fns'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
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
  SearchableCombobox,
  type SearchableComboboxItem,
} from '@/components/ui/searchable-combobox'
import { useToast } from '@/components/ui/use-toast'
import { RichTextEditor } from '@/components/ui/rich-text-editor'

import type {
  DbUser,
  ProjectWithRelations,
  TaskWithRelations,
} from '@/lib/types'
import { useUnsavedChangesWarning } from '@/lib/hooks/use-unsaved-changes-warning'

import { removeTask, saveTask } from './actions'

const TASK_STATUSES = [
  { value: 'BACKLOG', label: 'Backlog' },
  { value: 'ON_DECK', label: 'On Deck' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'IN_REVIEW', label: 'In Review' },
  { value: 'BLOCKED', label: 'Blocked' },
  { value: 'DONE', label: 'Done' },
]

const formSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional().nullable(),
  status: z.enum([
    'BACKLOG',
    'ON_DECK',
    'IN_PROGRESS',
    'IN_REVIEW',
    'BLOCKED',
    'DONE',
    'ARCHIVED',
  ] as const),
  dueOn: z.string().optional(),
  assigneeId: z.string().uuid().optional().nullable(),
})

type FormValues = z.infer<typeof formSchema>

const UNASSIGNED_ASSIGNEE_VALUE = '__UNASSIGNED__'

const formatRoleLabel = (role: string | null) => {
  if (!role) return 'Unknown role'
  return role.charAt(0) + role.slice(1).toLowerCase()
}

const formatMemberRole = (role: string | null | undefined) => {
  if (!role) return null
  return role.charAt(0) + role.slice(1).toLowerCase()
}

function toDateInputValue(value: string | null) {
  if (!value) return ''
  try {
    return formatISO(parseISO(value), { representation: 'date' })
  } catch (error) {
    console.warn('Invalid date for task form', { value, error })
    return ''
  }
}

function normalizeRichTextContent(value: string | null | undefined) {
  if (!value) {
    return null
  }

  const stripped = value
    .replace(/<br\s*\/?>(\s|&nbsp;|\u00a0)*/gi, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (stripped.length === 0) {
    return null
  }

  return value
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  project: ProjectWithRelations
  task?: TaskWithRelations
  canManage: boolean
  admins: DbUser[]
}

export function TaskSheet({
  open,
  onOpenChange,
  project,
  task,
  canManage,
  admins,
}: Props) {
  const [feedback, setFeedback] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const { toast } = useToast()
  const pendingReason = 'Please wait for the current request to finish.'
  const managePermissionReason =
    'You need manage permissions to edit this task.'
  const currentAssigneeId = task?.assignees[0]?.user_id ?? null

  const getDisabledReason = (disabled: boolean) => {
    if (!disabled) {
      return null
    }

    if (!canManage) {
      return managePermissionReason
    }

    if (isPending) {
      return pendingReason
    }

    return null
  }

  const defaultValues: FormValues = useMemo(
    () => ({
      title: task?.title ?? '',
      description: task?.description ?? null,
      status: task?.status ?? 'BACKLOG',
      dueOn: toDateInputValue(task?.due_on ?? null),
      assigneeId: currentAssigneeId ?? null,
    }),
    [currentAssigneeId, task]
  )

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues,
  })

  const memberLookup = useMemo(() => {
    const map = new Map<string, ProjectWithRelations['members'][number]>()
    project.members.forEach(member => {
      map.set(member.user_id, member)
    })
    return map
  }, [project.members])

  const { assigneeItems } = useMemo(() => {
    const seen = new Set<string>()
    const adminLookup = new Map<string, DbUser>()
    const eligibleItems: SearchableComboboxItem[] = []
    const fallbackItems: SearchableComboboxItem[] = []

    admins.forEach(admin => {
      if (!admin || admin.deleted_at) {
        return
      }

      adminLookup.set(admin.id, admin)

      if (seen.has(admin.id)) {
        return
      }

      const label = admin.full_name?.trim() || admin.email
      eligibleItems.push({
        value: admin.id,
        label,
        description: `${formatRoleLabel(admin.role)} • ${admin.email}`,
        keywords: [admin.email, 'admin'],
      })
      seen.add(admin.id)
    })

    project.members.forEach(member => {
      if (!member || seen.has(member.user_id)) {
        return
      }

      const user = member.user
      if (!user || user.deleted_at || user.role !== 'CONTRACTOR') {
        return
      }

      const label = user.full_name?.trim() || user.email
      const memberRoleLabel = formatMemberRole(member.role)
      const descriptionParts = [formatRoleLabel(user.role)]
      if (memberRoleLabel) {
        descriptionParts.push(memberRoleLabel)
      }
      descriptionParts.push(user.email)

      eligibleItems.push({
        value: member.user_id,
        label,
        description: descriptionParts.join(' • '),
        keywords: [
          user.email,
          'contractor',
          memberRoleLabel ?? undefined,
        ].filter((keyword): keyword is string => Boolean(keyword)),
      })
      seen.add(member.user_id)
    })

    if (currentAssigneeId && !seen.has(currentAssigneeId)) {
      const currentMember = memberLookup.get(currentAssigneeId)
      const currentAdmin = adminLookup.get(currentAssigneeId)

      const label =
        currentMember?.user.full_name?.trim() ??
        currentAdmin?.full_name?.trim() ??
        currentMember?.user.email ??
        currentAdmin?.email ??
        'Unknown collaborator'

      const descriptionParts: string[] = []
      const userRole = currentMember?.user.role ?? currentAdmin?.role ?? null
      if (userRole) {
        descriptionParts.push(formatRoleLabel(userRole))
      }
      if (currentMember) {
        const memberRoleLabel = formatMemberRole(currentMember.role)
        if (memberRoleLabel) {
          descriptionParts.push(memberRoleLabel)
        }
        descriptionParts.push(currentMember.user.email)
      } else if (currentAdmin) {
        descriptionParts.push(currentAdmin.email)
      }

      fallbackItems.push({
        value: currentAssigneeId,
        label,
        description: descriptionParts.join(' • '),
        keywords: [
          currentMember?.user.email ?? currentAdmin?.email ?? 'unavailable',
        ],
        disabled: true,
      })
    }

    eligibleItems.sort((a, b) => a.label.localeCompare(b.label))
    fallbackItems.sort((a, b) => a.label.localeCompare(b.label))

    const items: SearchableComboboxItem[] = [
      {
        value: UNASSIGNED_ASSIGNEE_VALUE,
        label: 'Unassigned',
        description: 'No collaborator assigned yet.',
        keywords: ['unassigned'],
      },
      ...eligibleItems,
      ...fallbackItems,
    ]

    return {
      assigneeItems: items,
    }
  }, [admins, currentAssigneeId, memberLookup, project.members])

  const { requestConfirmation: confirmDiscard, dialog: unsavedChangesDialog } =
    useUnsavedChangesWarning({ isDirty: form.formState.isDirty })

  const resetFormState = useCallback(() => {
    form.reset(defaultValues)
    setFeedback(null)
  }, [defaultValues, form])

  useEffect(() => {
    startTransition(() => {
      resetFormState()
    })
  }, [resetFormState, startTransition])

  useEffect(() => {
    if (!open) {
      return
    }

    startTransition(() => {
      resetFormState()
    })
  }, [open, resetFormState, startTransition])

  const handleSheetOpenChange = (next: boolean) => {
    if (!next) {
      confirmDiscard(() => {
        startTransition(() => {
          resetFormState()
        })
        onOpenChange(false)
      })
      return
    }

    onOpenChange(next)
  }

  const handleSubmit = (values: FormValues) => {
    if (!canManage) return

    startTransition(async () => {
      setFeedback(null)
      const normalizedDescription = normalizeRichTextContent(
        values.description ?? null
      )
      const result = await saveTask({
        id: task?.id,
        projectId: project.id,
        title: values.title.trim(),
        description: normalizedDescription,
        status: values.status,
        dueOn: values.dueOn ? values.dueOn : null,
        assigneeIds: values.assigneeId ? [values.assigneeId] : [],
      })

      if (result.error) {
        setFeedback(result.error)
        return
      }

      toast({
        title: task ? 'Task updated' : 'Task created',
        description: task
          ? 'Changes saved successfully.'
          : 'The task was added to the project board.',
      })

      resetFormState()
      onOpenChange(false)
    })
  }

  const handleDelete = () => {
    if (!task?.id || !canManage) return

    startTransition(async () => {
      setFeedback(null)
      const result = await removeTask({ taskId: task.id })

      if (result.error) {
        setFeedback(result.error)
        return
      }

      toast({
        title: 'Task deleted',
        description: 'The task has been removed from the board.',
        variant: 'destructive',
      })

      resetFormState()
      onOpenChange(false)
    })
  }

  const deleteDisabled = isPending || !canManage
  const deleteDisabledReason = getDisabledReason(deleteDisabled)
  const submitDisabled = isPending || !canManage
  const submitDisabledReason = getDisabledReason(submitDisabled)

  return (
    <>
      <Sheet open={open} onOpenChange={handleSheetOpenChange}>
        <SheetContent className='flex w-full flex-col gap-6 overflow-y-auto sm:max-w-lg'>
          <SheetHeader className='px-6 pt-6'>
            <SheetTitle>{task ? 'Edit task' : 'Add task'}</SheetTitle>
            <SheetDescription>
              Task belongs to{' '}
              <span className='font-medium'>{project.name}</span>.
            </SheetDescription>
          </SheetHeader>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(handleSubmit)}
              className='flex flex-1 flex-col gap-6 px-6 pb-6'
            >
              <FormField
                control={form.control}
                name='title'
                render={({ field }) => {
                  const disabled = isPending || !canManage
                  const reason = getDisabledReason(disabled)

                  return (
                    <FormItem>
                      <FormLabel>Title</FormLabel>
                      <FormControl>
                        <DisabledFieldTooltip
                          disabled={disabled}
                          reason={reason}
                        >
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
                    const reason = getDisabledReason(disabled)

                    return (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                          disabled={disabled}
                        >
                          <FormControl>
                            <DisabledFieldTooltip
                              disabled={disabled}
                              reason={reason}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder='Select status' />
                              </SelectTrigger>
                            </DisabledFieldTooltip>
                          </FormControl>
                          <SelectContent align='start'>
                            {TASK_STATUSES.map(status => (
                              <SelectItem
                                key={status.value}
                                value={status.value}
                              >
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
                    const reason = getDisabledReason(disabled)

                    return (
                      <FormItem>
                        <FormLabel>Due date</FormLabel>
                        <FormControl>
                          <DisabledFieldTooltip
                            disabled={disabled}
                            reason={reason}
                          >
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
                  const reason = getDisabledReason(disabled)
                  const selectedValue = field.value ?? UNASSIGNED_ASSIGNEE_VALUE

                  return (
                    <FormItem>
                      <FormLabel>Assignee</FormLabel>
                      <FormControl>
                        <DisabledFieldTooltip
                          disabled={disabled}
                          reason={reason}
                        >
                          <SearchableCombobox
                            items={assigneeItems}
                            value={selectedValue}
                            onChange={nextValue => {
                              if (nextValue === UNASSIGNED_ASSIGNEE_VALUE) {
                                field.onChange(null)
                                return
                              }
                              field.onChange(nextValue)
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
                  const reason = getDisabledReason(disabled)
                  const editorValue = field.value ?? ''

                  return (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <DisabledFieldTooltip
                          disabled={disabled}
                          reason={reason}
                        >
                          <RichTextEditor
                            key={task ? task.id : 'new-task'}
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
              {feedback ? (
                <p className='border-destructive/40 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm'>
                  {feedback}
                </p>
              ) : null}
              <SheetFooter className='flex items-center justify-between gap-3 px-0 pt-6 pb-0'>
                {task ? (
                  <DisabledFieldTooltip
                    disabled={deleteDisabled}
                    reason={deleteDisabledReason}
                  >
                    <Button
                      type='button'
                      variant='destructive'
                      onClick={handleDelete}
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
                      : task
                        ? 'Save changes'
                        : 'Create task'}
                  </Button>
                </DisabledFieldTooltip>
              </SheetFooter>
            </form>
          </Form>
        </SheetContent>
      </Sheet>
      {unsavedChangesDialog}
    </>
  )
}

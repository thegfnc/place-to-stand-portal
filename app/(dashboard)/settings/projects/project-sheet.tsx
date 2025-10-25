'use client'

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ChevronsUpDown, Trash2, UserPlus, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useToast } from '@/components/ui/use-toast'
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
import {
  PROJECT_STATUS_ENUM_VALUES,
  PROJECT_STATUS_OPTIONS,
  PROJECT_STATUS_VALUES,
  type ProjectStatusValue,
} from '@/lib/constants'
import { useUnsavedChangesWarning } from '@/lib/hooks/use-unsaved-changes-warning'
import type { Database } from '@/supabase/types/database'

import { saveProject, softDeleteProject } from './actions'

type ProjectRow = Database['public']['Tables']['projects']['Row']
type ClientRow = Pick<
  Database['public']['Tables']['clients']['Row'],
  'id' | 'name' | 'deleted_at'
>

type ProjectWithClient = ProjectRow & { client: ClientRow | null }

type ContractorUserSummary = {
  id: string
  email: string
  fullName: string | null
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onComplete: () => void
  project: ProjectWithClient | null
  clients: ClientRow[]
  contractorDirectory: ContractorUserSummary[]
  projectContractors: Record<string, ContractorUserSummary[]>
}

const formSchema = z
  .object({
    name: z.string().min(1, 'Project name is required'),
    clientId: z.string().uuid('Select a client'),
    status: z.enum(PROJECT_STATUS_ENUM_VALUES),
    startsOn: z.string().optional().or(z.literal('')),
    endsOn: z.string().optional().or(z.literal('')),
    slug: z
      .string()
      .regex(/^[a-z0-9-]+$/, 'Lowercase letters, numbers, and dashes only')
      .or(z.literal(''))
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (data.startsOn && data.endsOn) {
      const start = new Date(data.startsOn)
      const end = new Date(data.endsOn)

      if (
        !Number.isNaN(start.valueOf()) &&
        !Number.isNaN(end.valueOf()) &&
        end < start
      ) {
        ctx.addIssue({
          path: ['endsOn'],
          code: z.ZodIssueCode.custom,
          message: 'End date must be on or after the start date.',
        })
      }
    }
  })

type FormValues = z.infer<typeof formSchema>

const PROJECT_FORM_FIELDS: Array<keyof FormValues> = [
  'name',
  'clientId',
  'status',
  'startsOn',
  'endsOn',
  'slug',
]

export function ProjectSheet({
  open,
  onOpenChange,
  onComplete,
  project,
  clients,
  contractorDirectory,
  projectContractors,
}: Props) {
  const isEditing = Boolean(project)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const { toast } = useToast()
  const pendingReason = 'Please wait for the current request to finish.'
  const missingClientReason = 'Add a client before creating a project.'
  const [selectedContractors, setSelectedContractors] = useState<
    ContractorUserSummary[]
  >([])
  const [isContractorPickerOpen, setIsContractorPickerOpen] = useState(false)
  const [contractorRemovalCandidate, setContractorRemovalCandidate] =
    useState<ContractorUserSummary | null>(null)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [savedContractorIds, setSavedContractorIds] = useState<string[]>([])

  const initialContractors = useMemo(
    () => (project ? (projectContractors[project.id] ?? []) : []),
    [project, projectContractors]
  )

  const availableContractors = useMemo(
    () =>
      contractorDirectory.filter(
        user => !selectedContractors.some(assigned => assigned.id === user.id)
      ),
    [contractorDirectory, selectedContractors]
  )

  const contractorButtonDisabled =
    isPending || availableContractors.length === 0
  const contractorButtonReason = contractorButtonDisabled
    ? isPending
      ? pendingReason
      : 'All contractor-role users are already assigned.'
    : null

  const contractorSelectionDirty = useMemo(() => {
    const currentIds = selectedContractors.map(member => member.id).sort()

    if (savedContractorIds.length !== currentIds.length) {
      return true
    }

    return savedContractorIds.some((id, index) => id !== currentIds[index])
  }, [savedContractorIds, selectedContractors])

  const sortedClients = useMemo(
    () =>
      [...clients].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
      ),
    [clients]
  )

  const clientOptions = useMemo(
    () =>
      sortedClients.map(client => ({
        value: client.id,
        label: client.deleted_at ? `${client.name} (Deleted)` : client.name,
        keywords: client.deleted_at ? [client.name, 'deleted'] : [client.name],
      })),
    [sortedClients]
  )

  const initialStatus = useMemo<ProjectStatusValue>(() => {
    if (
      project &&
      PROJECT_STATUS_VALUES.includes(project.status as ProjectStatusValue)
    ) {
      return project.status as ProjectStatusValue
    }

    return PROJECT_STATUS_OPTIONS[0]?.value ?? 'active'
  }, [project])

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: project?.name ?? '',
      clientId: project?.client_id ?? '',
      status: initialStatus,
      startsOn: project?.starts_on ? project.starts_on.slice(0, 10) : '',
      endsOn: project?.ends_on ? project.ends_on.slice(0, 10) : '',
      slug: project?.slug ?? '',
    },
  })

  const hasUnsavedChanges = form.formState.isDirty || contractorSelectionDirty

  const { requestConfirmation: confirmDiscard, dialog: unsavedChangesDialog } =
    useUnsavedChangesWarning({ isDirty: hasUnsavedChanges })

  const resetFormState = useCallback(() => {
    const statusDefault = project
      ? PROJECT_STATUS_VALUES.includes(project.status as ProjectStatusValue)
        ? (project.status as ProjectStatusValue)
        : initialStatus
      : initialStatus

    const defaults = {
      name: project?.name ?? '',
      clientId: project?.client_id ?? '',
      status: statusDefault,
      startsOn: project?.starts_on ? project.starts_on.slice(0, 10) : '',
      endsOn: project?.ends_on ? project.ends_on.slice(0, 10) : '',
      slug: project?.slug ?? '',
    }
    const contractorSnapshot = initialContractors.map(member => ({ ...member }))

    form.reset(defaults, { keepDefaultValues: false })
    form.clearErrors()
    setSavedContractorIds(contractorSnapshot.map(member => member.id).sort())
    setFeedback(null)
    setSelectedContractors(contractorSnapshot)
    setContractorRemovalCandidate(null)
    setIsContractorPickerOpen(false)
  }, [form, initialContractors, initialStatus, project])

  const applyServerFieldErrors = (fieldErrors?: Record<string, string[]>) => {
    if (!fieldErrors) return

    PROJECT_FORM_FIELDS.forEach(field => {
      const message = fieldErrors[field]?.[0]
      if (!message) return
      form.setError(field, { type: 'server', message })
    })
  }

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

  const handleAddContractor = (user: ContractorUserSummary) => {
    setSelectedContractors(prev => {
      if (prev.some(contractor => contractor.id === user.id)) {
        return prev
      }

      return [...prev, user]
    })
    setIsContractorPickerOpen(false)
  }

  const handleRequestContractorRemoval = (user: ContractorUserSummary) => {
    setContractorRemovalCandidate(user)
  }

  const handleConfirmContractorRemoval = () => {
    if (!contractorRemovalCandidate) {
      return
    }

    const removalId = contractorRemovalCandidate.id
    setSelectedContractors(prev =>
      prev.filter(contractor => contractor.id !== removalId)
    )
    setContractorRemovalCandidate(null)
  }

  const handleCancelContractorRemoval = () => {
    setContractorRemovalCandidate(null)
  }

  const getContractorDisplayName = (user: ContractorUserSummary) =>
    user.fullName?.trim() || user.email

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      setFeedback(null)
      form.clearErrors()

      if (isEditing && !values.slug?.trim()) {
        form.setError('slug', { type: 'manual', message: 'Slug is required' })
        return
      }

      const payload = {
        id: project?.id,
        name: values.name.trim(),
        clientId: values.clientId,
        status: values.status,
        startsOn: values.startsOn ? values.startsOn : null,
        endsOn: values.endsOn ? values.endsOn : null,
        slug: isEditing
          ? values.slug?.trim()
            ? values.slug.trim()
            : null
          : null,
        contractorIds: selectedContractors.map(contractor => contractor.id),
      }

      if (payload.slug && payload.slug.length < 3) {
        setFeedback('Slug must be at least 3 characters when provided.')
        return
      }

      const result = await saveProject(payload)

      applyServerFieldErrors(result.fieldErrors)

      if (result.error) {
        setFeedback(result.error)
        toast({
          title: 'Unable to save project',
          description: result.error,
          variant: 'destructive',
        })
        return
      }

      toast({
        title: isEditing ? 'Project updated' : 'Project created',
        description: isEditing
          ? 'Changes saved successfully.'
          : 'The project is ready to track activity.',
      })

      setSavedContractorIds(
        selectedContractors.map(contractor => contractor.id).sort()
      )
      form.reset({
        name: payload.name,
        clientId: payload.clientId,
        status: payload.status,
        startsOn: payload.startsOn ?? '',
        endsOn: payload.endsOn ?? '',
        slug: payload.slug ?? '',
      })

      onOpenChange(false)
      onComplete()
    })
  }

  const handleRequestDelete = () => {
    if (!project || project.deleted_at || isPending) {
      return
    }

    setIsDeleteDialogOpen(true)
  }

  const handleCancelDelete = () => {
    if (isPending) {
      return
    }

    setIsDeleteDialogOpen(false)
  }

  const handleConfirmDelete = () => {
    if (!project || project.deleted_at || isPending) {
      return
    }

    setIsDeleteDialogOpen(false)
    startTransition(async () => {
      setFeedback(null)
      form.clearErrors()
      const result = await softDeleteProject({ id: project.id })

      if (result.error) {
        setFeedback(result.error)
        toast({
          title: 'Unable to delete project',
          description: result.error,
          variant: 'destructive',
        })
        return
      }

      toast({
        title: 'Project deleted',
        description: 'You can still find it in historical reporting.',
      })

      onOpenChange(false)
      onComplete()
    })
  }

  const submitDisabled = isPending || (!isEditing && sortedClients.length === 0)
  const submitDisabledReason = submitDisabled
    ? isPending
      ? 'Please wait for the current request to finish.'
      : !isEditing && sortedClients.length === 0
        ? 'Add a client before creating a project.'
        : null
    : null

  const deleteDisabled = isPending || Boolean(project?.deleted_at)
  const deleteDisabledReason =
    isEditing && deleteDisabled
      ? isPending
        ? 'Please wait for the current request to finish.'
        : project?.deleted_at
          ? 'This project is already deleted.'
          : null
      : null

  const submitLabel = isPending
    ? 'Saving...'
    : isEditing
      ? 'Save changes'
      : 'Create project'
  const contractorRemovalName = contractorRemovalCandidate
    ? getContractorDisplayName(contractorRemovalCandidate)
    : null
  const contractorProjectName = project?.name ?? 'this project'

  return (
    <>
      <Sheet open={open} onOpenChange={handleSheetOpenChange}>
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
              onSubmit={form.handleSubmit(onSubmit)}
              className='flex flex-1 flex-col gap-5 px-6 pb-6'
            >
              <FormField
                control={form.control}
                name='name'
                render={({ field }) => {
                  const disabled = isPending
                  const reason = disabled ? pendingReason : null

                  return (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <DisabledFieldTooltip
                          disabled={disabled}
                          reason={reason}
                        >
                          <Input
                            {...field}
                            value={field.value ?? ''}
                            placeholder='Website redesign'
                            disabled={disabled}
                          />
                        </DisabledFieldTooltip>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )
                }}
              />
              {isEditing ? (
                <FormField
                  control={form.control}
                  name='slug'
                  render={({ field }) => {
                    const disabled = isPending
                    const reason = disabled ? pendingReason : null

                    return (
                      <FormItem>
                        <FormLabel>Slug</FormLabel>
                        <FormControl>
                          <DisabledFieldTooltip
                            disabled={disabled}
                            reason={reason}
                          >
                            <Input
                              {...field}
                              value={field.value ?? ''}
                              placeholder='website-redesign'
                              disabled={disabled}
                            />
                          </DisabledFieldTooltip>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )
                  }}
                />
              ) : null}
              <div className='grid gap-4 sm:grid-cols-2'>
                <FormField
                  control={form.control}
                  name='clientId'
                  render={({ field }) => {
                    const disabled = isPending || sortedClients.length === 0
                    const reason = disabled
                      ? isPending
                        ? pendingReason
                        : sortedClients.length === 0
                          ? missingClientReason
                          : null
                      : null

                    return (
                      <FormItem>
                        <FormLabel>Client</FormLabel>
                        <FormControl>
                          <DisabledFieldTooltip
                            disabled={disabled}
                            reason={reason}
                          >
                            <SearchableCombobox
                              name={field.name}
                              value={field.value ?? ''}
                              onChange={field.onChange}
                              onBlur={field.onBlur}
                              items={clientOptions}
                              searchPlaceholder='Search clients...'
                              emptyMessage='No clients found.'
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
                  name='status'
                  render={({ field }) => {
                    const disabled = isPending
                    const reason = disabled ? pendingReason : null

                    return (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select
                          value={field.value ?? ''}
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
                            {PROJECT_STATUS_OPTIONS.map(status => (
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
              </div>

              <div className='grid gap-4 sm:grid-cols-2'>
                <FormField
                  control={form.control}
                  name='startsOn'
                  render={({ field }) => {
                    const disabled = isPending
                    const reason = disabled ? pendingReason : null

                    return (
                      <FormItem>
                        <FormLabel>Start date (optional)</FormLabel>
                        <FormControl>
                          <DisabledFieldTooltip
                            disabled={disabled}
                            reason={reason}
                          >
                            <Input
                              {...field}
                              value={field.value ?? ''}
                              type='date'
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
                  name='endsOn'
                  render={({ field }) => {
                    const disabled = isPending
                    const reason = disabled ? pendingReason : null

                    return (
                      <FormItem>
                        <FormLabel>End date (optional)</FormLabel>
                        <FormControl>
                          <DisabledFieldTooltip
                            disabled={disabled}
                            reason={reason}
                          >
                            <Input
                              {...field}
                              value={field.value ?? ''}
                              type='date'
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
              <div className='space-y-2'>
                <FormLabel>Contractors</FormLabel>
                <Popover
                  open={isContractorPickerOpen}
                  onOpenChange={next => {
                    if (contractorButtonDisabled) {
                      setIsContractorPickerOpen(false)
                      return
                    }

                    setIsContractorPickerOpen(next)
                  }}
                >
                  <DisabledFieldTooltip
                    disabled={contractorButtonDisabled}
                    reason={contractorButtonReason}
                  >
                    <div className='w-full'>
                      <PopoverTrigger asChild>
                        <Button
                          type='button'
                          variant='outline'
                          className='w-full justify-between'
                          disabled={contractorButtonDisabled}
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
                            const displayName =
                              getContractorDisplayName(contractor)

                            return (
                              <CommandItem
                                key={contractor.id}
                                value={`${displayName} ${contractor.email}`}
                                onSelect={() => {
                                  if (isPending) {
                                    return
                                  }

                                  handleAddContractor(contractor)
                                }}
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
                      const displayName = getContractorDisplayName(contractor)

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
                            reason={isPending ? pendingReason : null}
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
                    disabled={deleteDisabled}
                    reason={deleteDisabledReason}
                  >
                    <Button
                      type='button'
                      variant='destructive'
                      onClick={handleRequestDelete}
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
                    {submitLabel}
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
              reason={isPending ? pendingReason : null}
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

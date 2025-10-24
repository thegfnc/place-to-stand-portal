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
import { Textarea } from '@/components/ui/textarea'
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
import type { Database } from '@/supabase/types/database'
import { useUnsavedChangesWarning } from '@/lib/hooks/use-unsaved-changes-warning'

import { saveClient, softDeleteClient } from './actions'

const formSchema = z.object({
  name: z.string().min(1, 'Client name is required'),
  slug: z
    .string()
    .regex(/^[a-z0-9-]+$/, 'Lowercase letters, numbers, and dashes only')
    .or(z.literal(''))
    .optional(),
  notes: z.string().optional(),
})

type FormValues = z.infer<typeof formSchema>

type ClientRow = Database['public']['Tables']['clients']['Row']

type ClientUserSummary = {
  id: string
  email: string
  fullName: string | null
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onComplete: () => void
  client: ClientRow | null
  allClientUsers: ClientUserSummary[]
  clientMembers: Record<string, ClientUserSummary[]>
}

export function ClientSheet({
  open,
  onOpenChange,
  onComplete,
  client,
  allClientUsers,
  clientMembers,
}: Props) {
  const isEditing = Boolean(client)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const { toast } = useToast()
  const pendingReason = 'Please wait for the current request to finish.'
  const [selectedMembers, setSelectedMembers] = useState<ClientUserSummary[]>(
    []
  )
  const [isPickerOpen, setIsPickerOpen] = useState(false)
  const [removalCandidate, setRemovalCandidate] =
    useState<ClientUserSummary | null>(null)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [savedMemberIds, setSavedMemberIds] = useState<string[]>([])

  const initialMembers = useMemo(
    () => (client ? (clientMembers[client.id] ?? []) : []),
    [client, clientMembers]
  )

  const availableClientUsers = useMemo(() => {
    return allClientUsers.filter(
      user => !selectedMembers.some(member => member.id === user.id)
    )
  }, [allClientUsers, selectedMembers])

  const membershipDirty = useMemo(() => {
    const currentIds = selectedMembers.map(member => member.id).sort()

    if (savedMemberIds.length !== currentIds.length) {
      return true
    }

    return savedMemberIds.some((id, index) => id !== currentIds[index])
  }, [savedMemberIds, selectedMembers])

  const addButtonDisabled = isPending || availableClientUsers.length === 0
  const addButtonDisabledReason = addButtonDisabled
    ? isPending
      ? pendingReason
      : 'All client-role users are already assigned.'
    : null

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: client?.name ?? '',
      slug: client?.slug ?? '',
      notes: client?.notes ?? '',
    },
  })

  const hasUnsavedChanges = form.formState.isDirty || membershipDirty

  const { requestConfirmation: confirmDiscard, dialog: unsavedChangesDialog } =
    useUnsavedChangesWarning({ isDirty: hasUnsavedChanges })

  const resetFormState = useCallback(() => {
    const defaults = {
      name: client?.name ?? '',
      slug: client?.slug ?? '',
      notes: client?.notes ?? '',
    }
    const memberSnapshot = initialMembers.map(member => ({ ...member }))

    form.reset(defaults)
    setSavedMemberIds(memberSnapshot.map(member => member.id).sort())
    setFeedback(null)
    setSelectedMembers(memberSnapshot)
    setRemovalCandidate(null)
    setIsPickerOpen(false)
  }, [client, form, initialMembers])

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

  const handleAddMember = (user: ClientUserSummary) => {
    setSelectedMembers(prev => {
      if (prev.some(member => member.id === user.id)) {
        return prev
      }

      return [...prev, user]
    })
    setIsPickerOpen(false)
  }

  const handleRequestRemoval = (user: ClientUserSummary) => {
    setRemovalCandidate(user)
  }

  const handleConfirmRemoval = () => {
    if (!removalCandidate) {
      return
    }

    const removalId = removalCandidate.id
    setSelectedMembers(prev => prev.filter(member => member.id !== removalId))
    setRemovalCandidate(null)
  }

  const handleCancelRemoval = () => {
    setRemovalCandidate(null)
  }

  const getDisplayName = (user: ClientUserSummary) =>
    user.fullName?.trim() || user.email

  const onSubmit = (values: FormValues) => {
    if (isEditing && !values.slug?.trim()) {
      form.setError('slug', { type: 'manual', message: 'Slug is required' })
      return
    }

    startTransition(async () => {
      setFeedback(null)

      const payload = {
        id: client?.id,
        name: values.name.trim(),
        slug: isEditing
          ? values.slug?.trim()
            ? values.slug.trim()
            : null
          : null,
        notes: values.notes?.trim() ? values.notes.trim() : null,
        memberIds: selectedMembers.map(member => member.id),
      } satisfies Parameters<typeof saveClient>[0]

      if (payload.slug && payload.slug.length < 3) {
        setFeedback('Slug must be at least 3 characters when provided.')
        return
      }

      const result = await saveClient(payload)

      if (result.error) {
        setFeedback(result.error)
        return
      }

      toast({
        title: isEditing ? 'Client updated' : 'Client created',
        description: isEditing
          ? 'Changes saved successfully.'
          : 'The client is ready for new projects.',
      })

      setSavedMemberIds(selectedMembers.map(member => member.id).sort())
      form.reset({
        name: payload.name,
        slug: payload.slug ?? '',
        notes: payload.notes ?? '',
      })

      onOpenChange(false)
      onComplete()
    })
  }

  const handleRequestDelete = () => {
    if (!client || isPending) {
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
    if (!client || isPending) {
      return
    }

    setIsDeleteDialogOpen(false)
    startTransition(async () => {
      setFeedback(null)
      const result = await softDeleteClient({ id: client.id })

      if (result.error) {
        setFeedback(result.error)
        return
      }

      toast({
        title: 'Client deleted',
        description: `${client.name} is hidden from selectors but remains available for history.`,
      })

      onOpenChange(false)
      onComplete()
    })
  }

  const deleteDisabled = isPending
  const deleteDisabledReason = deleteDisabled ? pendingReason : null
  const submitDisabled = isPending
  const submitDisabledReason = submitDisabled ? pendingReason : null
  const removalName = removalCandidate ? getDisplayName(removalCandidate) : null
  const clientDisplayName = client?.name ?? 'this client'

  return (
    <>
      <Sheet open={open} onOpenChange={handleSheetOpenChange}>
        <SheetContent className='flex w-full flex-col gap-6 overflow-y-auto sm:max-w-lg'>
          <SheetHeader className='px-6 pt-6'>
            <SheetTitle>{isEditing ? 'Edit client' : 'Add client'}</SheetTitle>
            <SheetDescription>
              {isEditing
                ? 'Adjust display details or delete the organization.'
                : 'Register a client so projects and reporting stay organized.'}
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
                            placeholder='Acme Corp'
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
                              placeholder='acme'
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

              <FormField
                control={form.control}
                name='notes'
                render={({ field }) => {
                  const disabled = isPending
                  const reason = disabled ? pendingReason : null

                  return (
                    <FormItem>
                      <FormLabel>Notes (optional)</FormLabel>
                      <FormControl>
                        <DisabledFieldTooltip
                          disabled={disabled}
                          reason={reason}
                        >
                          <Textarea
                            {...field}
                            value={field.value ?? ''}
                            placeholder='Context or points of contact'
                            disabled={disabled}
                            rows={4}
                          />
                        </DisabledFieldTooltip>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )
                }}
              />
              <div className='space-y-2'>
                <FormLabel>Client users</FormLabel>
                <Popover
                  open={isPickerOpen}
                  onOpenChange={next => {
                    if (addButtonDisabled) {
                      setIsPickerOpen(false)
                      return
                    }

                    setIsPickerOpen(next)
                  }}
                >
                  <DisabledFieldTooltip
                    disabled={addButtonDisabled}
                    reason={addButtonDisabledReason}
                  >
                    <div className='w-full'>
                      <PopoverTrigger asChild>
                        <Button
                          type='button'
                          variant='outline'
                          className='w-full justify-between'
                          disabled={addButtonDisabled}
                        >
                          <span className='flex items-center gap-2'>
                            <UserPlus className='h-4 w-4' />
                            {availableClientUsers.length > 0
                              ? 'Add client user'
                              : 'All client users assigned'}
                          </span>
                          <ChevronsUpDown className='h-4 w-4 opacity-50' />
                        </Button>
                      </PopoverTrigger>
                    </div>
                  </DisabledFieldTooltip>
                  <PopoverContent className='w-[320px] p-0' align='start'>
                    <Command>
                      <CommandInput placeholder='Search client users...' />
                      <CommandEmpty>No matching client users.</CommandEmpty>
                      <CommandList>
                        <CommandGroup heading='Client users'>
                          {availableClientUsers.map(user => {
                            const displayName = getDisplayName(user)

                            return (
                              <CommandItem
                                key={user.id}
                                value={`${displayName} ${user.email}`}
                                onSelect={() => {
                                  if (isPending) {
                                    return
                                  }

                                  handleAddMember(user)
                                }}
                              >
                                <div className='flex flex-col'>
                                  <span className='font-medium'>
                                    {displayName}
                                  </span>
                                  <span className='text-muted-foreground text-xs'>
                                    {user.email}
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
                  Assigned users can view this client&apos;s projects and
                  billing.
                </p>
                <div className='space-y-2'>
                  {selectedMembers.length === 0 ? (
                    <p className='text-muted-foreground text-sm'>
                      No client users assigned yet.
                    </p>
                  ) : (
                    selectedMembers.map(user => {
                      const displayName = getDisplayName(user)

                      return (
                        <div
                          key={user.id}
                          className='bg-muted/40 flex items-center justify-between rounded-md border px-3 py-2'
                        >
                          <div className='flex flex-col text-sm leading-tight'>
                            <span className='font-medium'>{displayName}</span>
                            <span className='text-muted-foreground text-xs'>
                              {user.email}
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
                              onClick={() => handleRequestRemoval(user)}
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
              <SheetFooter className='flex items-center justify-end gap-3 px-0 pt-6 pb-0'>
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
                      <Trash2 className='h-4 w-4' /> Delete
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
                      : isEditing
                        ? 'Save changes'
                        : 'Create client'}
                  </Button>
                </DisabledFieldTooltip>
              </SheetFooter>
            </form>
          </Form>
        </SheetContent>
      </Sheet>
      <ConfirmDialog
        open={isDeleteDialogOpen}
        title='Delete client?'
        description='Deleting this client hides it from selectors and reporting. Existing projects stay linked.'
        confirmLabel='Delete'
        confirmVariant='destructive'
        confirmDisabled={isPending}
        onCancel={handleCancelDelete}
        onConfirm={handleConfirmDelete}
      />
      {unsavedChangesDialog}
      <Dialog
        open={Boolean(removalCandidate)}
        onOpenChange={next => {
          if (!next) {
            handleCancelRemoval()
          }
        }}
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Remove client user</DialogTitle>
            <DialogDescription>
              {removalName
                ? `Remove ${removalName} from ${clientDisplayName}?`
                : 'Remove this user from the client?'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type='button'
              variant='outline'
              onClick={handleCancelRemoval}
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
                onClick={handleConfirmRemoval}
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

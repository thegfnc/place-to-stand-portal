'use client'

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { useForm, type UseFormReturn } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import { useUnsavedChangesWarning } from '@/lib/hooks/use-unsaved-changes-warning'
import { useToast } from '@/components/ui/use-toast'

import {
  saveClient,
  softDeleteClient,
} from '@/app/(dashboard)/settings/clients/actions'

import {
  CLIENT_MEMBERS_HELP_TEXT,
  NO_AVAILABLE_CLIENT_USERS_MESSAGE,
  PENDING_REASON,
} from './client-sheet-constants'
import {
  attachDisplayName,
  cloneMembers,
  formatUserDisplayName,
  type ClientMember,
  type ClientRow,
  type ClientUserSummary,
} from './client-sheet-utils'
import {
  clientSheetFormSchema,
  type ClientSheetFormValues,
} from './client-sheet-schema'

export type UseClientSheetStateArgs = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onComplete: () => void
  client: ClientRow | null
  allClientUsers: ClientUserSummary[]
  clientMembers: Record<string, ClientUserSummary[]>
}

export type ClientMemberOption = ClientMember

export type UseClientSheetStateReturn = {
  form: UseFormReturn<ClientSheetFormValues>
  isEditing: boolean
  feedback: string | null
  isPending: boolean
  addButtonDisabled: boolean
  addButtonDisabledReason: string | null
  submitDisabled: boolean
  submitDisabledReason: string | null
  deleteDisabled: boolean
  deleteDisabledReason: string | null
  selectedMembers: ClientMemberOption[]
  availableMembers: ClientMemberOption[]
  membersHelpText: string
  isPickerOpen: boolean
  removalCandidate: ClientMemberOption | null
  removalName: string | null
  clientDisplayName: string
  sheetTitle: string
  sheetDescription: string
  pendingReason: string
  isDeleteDialogOpen: boolean
  unsavedChangesDialog: ReturnType<typeof useUnsavedChangesWarning>['dialog']
  handleSheetOpenChange: (open: boolean) => void
  handleFormSubmit: (values: ClientSheetFormValues) => void
  handlePickerOpenChange: (open: boolean) => void
  handleAddMember: (member: ClientMemberOption) => void
  handleRequestRemoval: (member: ClientMemberOption) => void
  handleCancelRemoval: () => void
  handleConfirmRemoval: () => void
  handleRequestDelete: () => void
  handleCancelDelete: () => void
  handleConfirmDelete: () => void
}

export const useClientSheetState = ({
  open,
  onOpenChange,
  onComplete,
  client,
  allClientUsers,
  clientMembers,
}: UseClientSheetStateArgs): UseClientSheetStateReturn => {
  const isEditing = Boolean(client)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [isPickerOpen, setIsPickerOpen] = useState(false)
  const [removalCandidate, setRemovalCandidate] = useState<ClientMember | null>(
    null
  )
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [savedMemberIds, setSavedMemberIds] = useState<string[]>([])
  const [selectedMembers, setSelectedMembers] = useState<ClientMember[]>([])
  const { toast } = useToast()

  const initialMembers = useMemo(() => {
    if (!client) return [] as ClientMember[]
    const members = clientMembers[client.id] ?? []
    return members.map(attachDisplayName)
  }, [client, clientMembers])

  const allClientUserOptions = useMemo(
    () => allClientUsers.map(attachDisplayName),
    [allClientUsers]
  )

  const form = useForm<ClientSheetFormValues>({
    resolver: zodResolver(clientSheetFormSchema),
    defaultValues: {
      name: client?.name ?? '',
      slug: client?.slug ?? '',
      notes: client?.notes ?? '',
    },
  })

  const availableMembers = useMemo(() => {
    const selectedIds = new Set(selectedMembers.map(member => member.id))
    return allClientUserOptions.filter(option => !selectedIds.has(option.id))
  }, [allClientUserOptions, selectedMembers])

  const membershipDirty = useMemo(() => {
    const currentIds = selectedMembers.map(member => member.id).sort()

    if (savedMemberIds.length !== currentIds.length) {
      return true
    }

    return savedMemberIds.some((id, index) => id !== currentIds[index])
  }, [savedMemberIds, selectedMembers])

  const addButtonDisabled = isPending || availableMembers.length === 0
  const addButtonDisabledReason = addButtonDisabled
    ? isPending
      ? PENDING_REASON
      : NO_AVAILABLE_CLIENT_USERS_MESSAGE
    : null

  const submitDisabled = isPending
  const submitDisabledReason = submitDisabled ? PENDING_REASON : null
  const deleteDisabled = isPending
  const deleteDisabledReason = deleteDisabled ? PENDING_REASON : null

  const hasUnsavedChanges = form.formState.isDirty || membershipDirty

  const { requestConfirmation: confirmDiscard, dialog: unsavedChangesDialog } =
    useUnsavedChangesWarning({ isDirty: hasUnsavedChanges })

  const resetFormState = useCallback(() => {
    const defaults = {
      name: client?.name ?? '',
      slug: client?.slug ?? '',
      notes: client?.notes ?? '',
    }

    const memberSnapshot = cloneMembers(initialMembers)

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

  const handleSheetOpenChange = useCallback(
    (next: boolean) => {
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
    },
    [confirmDiscard, onOpenChange, resetFormState, startTransition]
  )

  const handlePickerOpenChange = useCallback(
    (next: boolean) => {
      if (addButtonDisabled) {
        setIsPickerOpen(false)
        return
      }
      setIsPickerOpen(next)
    },
    [addButtonDisabled]
  )

  const handleAddMember = useCallback((member: ClientMember) => {
    setSelectedMembers(prev => {
      if (prev.some(existing => existing.id === member.id)) {
        return prev
      }
      return [...prev, member]
    })
    setIsPickerOpen(false)
  }, [])

  const handleRequestRemoval = useCallback((member: ClientMember) => {
    setRemovalCandidate(member)
  }, [])

  const handleCancelRemoval = useCallback(() => {
    setRemovalCandidate(null)
  }, [])

  const handleConfirmRemoval = useCallback(() => {
    if (!removalCandidate) {
      return
    }

    const removalId = removalCandidate.id
    setSelectedMembers(prev => prev.filter(member => member.id !== removalId))
    setRemovalCandidate(null)
  }, [removalCandidate])

  const handleFormSubmit = useCallback(
    (values: ClientSheetFormValues) => {
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
    },
    [
      client?.id,
      form,
      isEditing,
      onComplete,
      onOpenChange,
      selectedMembers,
      startTransition,
      toast,
    ]
  )

  const handleRequestDelete = useCallback(() => {
    if (!client || isPending) {
      return
    }

    setIsDeleteDialogOpen(true)
  }, [client, isPending])

  const handleCancelDelete = useCallback(() => {
    if (isPending) {
      return
    }

    setIsDeleteDialogOpen(false)
  }, [isPending])

  const handleConfirmDelete = useCallback(() => {
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
  }, [client, isPending, onComplete, onOpenChange, startTransition, toast])

  const removalName = removalCandidate
    ? formatUserDisplayName(removalCandidate)
    : null

  const clientDisplayName = client?.name ?? 'this client'

  return {
    form,
    isEditing,
    feedback,
    isPending,
    addButtonDisabled,
    addButtonDisabledReason,
    submitDisabled,
    submitDisabledReason,
    deleteDisabled,
    deleteDisabledReason,
    selectedMembers,
    availableMembers,
    membersHelpText: CLIENT_MEMBERS_HELP_TEXT,
    isPickerOpen,
    removalCandidate,
    removalName,
    clientDisplayName,
    sheetTitle: isEditing ? 'Edit client' : 'Add client',
    sheetDescription: isEditing
      ? 'Adjust display details or delete the organization.'
      : 'Register a client so projects and reporting stay organized.',
    pendingReason: PENDING_REASON,
    isDeleteDialogOpen,
    unsavedChangesDialog,
    handleSheetOpenChange,
    handleFormSubmit,
    handlePickerOpenChange,
    handleAddMember,
    handleRequestRemoval,
    handleCancelRemoval,
    handleConfirmRemoval,
    handleRequestDelete,
    handleCancelDelete,
    handleConfirmDelete,
  }
}

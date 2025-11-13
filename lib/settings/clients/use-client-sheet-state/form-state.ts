import { useCallback, useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import { saveClient } from '@/app/(dashboard)/settings/clients/actions'
import { useUnsavedChangesWarning } from '@/lib/hooks/use-unsaved-changes-warning'
import { startClientInteraction } from '@/lib/posthog/client'
import { INTERACTION_EVENTS } from '@/lib/posthog/types'

import {
  CLIENT_MEMBERS_HELP_TEXT,
  NO_AVAILABLE_CLIENT_USERS_MESSAGE,
  PENDING_REASON,
} from '../client-sheet-constants'
import {
  attachDisplayName,
  cloneMembers,
  formatUserDisplayName,
  type ClientMember,
} from '../client-sheet-utils'
import {
  clientSheetFormSchema,
  type ClientSheetFormValues,
} from '../client-sheet-schema'

import type {
  BaseFormState,
  ClientMemberOption,
  ClientSheetFormStateArgs,
} from './types'

export function useClientSheetFormState({
  open,
  onOpenChange,
  onComplete,
  client,
  clientMembers,
  allClientUsers,
  isEditing,
  isPending,
  startTransition,
  setFeedback,
  toast,
}: ClientSheetFormStateArgs): BaseFormState {
  const [isPickerOpen, setIsPickerOpen] = useState(false)
  const [removalCandidate, setRemovalCandidate] = useState<ClientMember | null>(
    null
  )
  const [savedMemberIds, setSavedMemberIds] = useState<string[]>([])
  const [selectedMembers, setSelectedMembers] = useState<ClientMember[]>([])

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
  }, [client, form, initialMembers, setFeedback])

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

  const handleAddMember = useCallback((member: ClientMemberOption) => {
    setSelectedMembers(prev => {
      if (prev.some(existing => existing.id === member.id)) {
        return prev
      }
      return [...prev, member]
    })
    setIsPickerOpen(false)
  }, [])

  const handleRequestRemoval = useCallback((member: ClientMemberOption) => {
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

  const replaceMembers = useCallback((members: ClientMemberOption[]) => {
    setSelectedMembers(cloneMembers(members))
    setRemovalCandidate(null)
    setIsPickerOpen(false)
  }, [])

  const handleFormSubmit = useCallback(
    (values: ClientSheetFormValues) => {
      if (isEditing && !values.slug?.trim()) {
        form.setError('slug', { type: 'manual', message: 'Slug is required' })
        return
      }

      startTransition(async () => {
        setFeedback(null)

        const payload = {
          id: client?.id ?? undefined,
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

        const interaction = startClientInteraction(
          INTERACTION_EVENTS.SETTINGS_SAVE,
          {
            metadata: {
              entity: 'client',
              mode: isEditing ? 'edit' : 'create',
              hasMembers: payload.memberIds.length > 0,
            },
            baseProperties: {
              entity: 'client',
              mode: isEditing ? 'edit' : 'create',
            },
          }
        )

        try {
          const result = await saveClient(payload)

          if (result.error) {
            interaction.end({
              status: 'error',
              entity: 'client',
              mode: isEditing ? 'edit' : 'create',
              error: result.error,
            })
            setFeedback(result.error)
            return
          }

          interaction.end({
            status: 'success',
            entity: 'client',
            mode: isEditing ? 'edit' : 'create',
            clientId: payload.id ?? null,
          })

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
        } catch (error) {
          interaction.end({
            status: 'error',
            entity: 'client',
            mode: isEditing ? 'edit' : 'create',
            error: error instanceof Error ? error.message : 'Unknown error',
          })
          setFeedback('We could not save this client. Please try again.')
          return
        }
      })
    },
    [
      client?.id,
      form,
      isEditing,
      onComplete,
      onOpenChange,
      selectedMembers,
      setFeedback,
      startTransition,
      toast,
    ]
  )

  const removalName = removalCandidate
    ? formatUserDisplayName(removalCandidate)
    : null

  return {
    form,
    addButtonDisabled,
    addButtonDisabledReason,
    submitDisabled,
    submitDisabledReason,
    availableMembers,
    selectedMembers,
    membersHelpText: CLIENT_MEMBERS_HELP_TEXT,
    isPickerOpen,
    removalCandidate,
    removalName,
    unsavedChangesDialog,
    handleSheetOpenChange,
    handleFormSubmit,
    handlePickerOpenChange,
    handleAddMember,
    handleRequestRemoval,
    handleCancelRemoval,
    handleConfirmRemoval,
    replaceMembers,
  }
}

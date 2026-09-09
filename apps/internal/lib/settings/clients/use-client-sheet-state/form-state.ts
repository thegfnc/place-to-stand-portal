import { useCallback, useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import {
  saveClient,
  getClientSheetContactData,
  syncClientContacts,
} from '@/app/(dashboard)/clients/actions'
import { useSheetLifecycle } from '@/lib/sheets/use-sheet-lifecycle'
import {
  finishSettingsInteraction,
  startSettingsInteraction,
} from '@/lib/posthog/settings'

import { PENDING_REASON } from '../client-sheet-constants'
import { isSelectableUser } from '@/lib/users/selectable'
import {
  clientSheetFormSchema,
  type ClientSheetFormValues,
} from '../client-sheet-schema'

import type {
  BaseFormState,
  ClientContactOption,
  ClientSheetFormStateArgs,
  OriginationContactOption,
  OriginationMode,
  PartnerUserOption,
} from './types'

export function useClientSheetFormState({
  open,
  onOpenChange,
  onComplete,
  client,
  allContacts: allContactsProp,
  clientContacts: clientContactsProp,
  allAdminUsers: allAdminUsersProp,
  isEditing,
  setFeedback,
  toast,
}: ClientSheetFormStateArgs): BaseFormState {
  // Contact state
  const [isContactPickerOpen, setIsContactPickerOpen] = useState(false)
  const [fetchedAllContacts, setFetchedAllContacts] = useState<ClientContactOption[]>([])
  const [fetchedAllAdminUsers, setFetchedAllAdminUsers] = useState<PartnerUserOption[]>([])
  const [selectedContacts, setSelectedContacts] = useState<ClientContactOption[]>([])
  const [initialContacts, setInitialContacts] = useState<ClientContactOption[]>([])
  const [isLoadingContacts, setIsLoadingContacts] = useState(false)

  // Origination state — defaults to 'internal' for new clients; existing
  // clients with an external contact set get flipped to 'external' in the
  // open effect below.
  const [originationMode, setOriginationMode] = useState<OriginationMode>(
    'internal'
  )
  const [isOriginationUserPickerOpen, setIsOriginationUserPickerOpen] =
    useState(false)
  const [isOriginationContactPickerOpen, setIsOriginationContactPickerOpen] =
    useState(false)
  const [selectedOriginationUser, setSelectedOriginationUser] =
    useState<PartnerUserOption | null>(null)
  const [selectedOriginationContact, setSelectedOriginationContact] =
    useState<OriginationContactOption | null>(null)
  const [initialOriginationUserId, setInitialOriginationUserId] = useState<
    string | null
  >(null)
  const [initialOriginationContactId, setInitialOriginationContactId] =
    useState<string | null>(null)

  // Closer state
  const [isCloserPickerOpen, setIsCloserPickerOpen] = useState(false)
  const [selectedCloser, setSelectedCloser] = useState<PartnerUserOption | null>(
    null
  )
  const [initialCloserUserId, setInitialCloserUserId] = useState<string | null>(
    null
  )

  // Field-level errors for the pickers — rendered inline (shadcn
  // FormMessage pattern) below each picker. Cleared as the user interacts
  // so they don't linger after a fix.
  const [originationError, setOriginationError] = useState<string | null>(null)
  const [closerError, setCloserError] = useState<string | null>(null)

  const form = useForm<ClientSheetFormValues>({
    resolver: zodResolver(clientSheetFormSchema),
    defaultValues: {
      name: client?.name ?? '',
      slug: client?.slug ?? '',
      billingType: client?.billing_type ?? 'prepaid',
      billingEffective: 'next_month',
      state: client?.state ?? '',
      website: client?.website ?? '',
      notes: client?.notes ?? '',
    },
  })

  // Use provided data or fetched data
  const allContacts = allContactsProp ?? fetchedAllContacts
  const allAdminUsers = allAdminUsersProp ?? fetchedAllAdminUsers

  // Compute available contacts (all contacts minus selected ones)
  const availableContacts = useMemo(() => {
    const selectedIds = new Set(selectedContacts.map(c => c.id))
    return allContacts.filter(c => !selectedIds.has(c.id))
  }, [allContacts, selectedContacts])

  // Check if contact links have changed
  const contactsDirty = useMemo(() => {
    const initialIds = new Set(initialContacts.map(c => c.id))
    const selectedIds = new Set(selectedContacts.map(c => c.id))

    if (initialIds.size !== selectedIds.size) return true
    for (const id of initialIds) {
      if (!selectedIds.has(id)) return true
    }
    return false
  }, [initialContacts, selectedContacts])

  // Origination user picker: any selectable admin except the one already
  // selected. Disabled admins stay in `allAdminUsers` so an existing
  // origination/closer still resolves for display, but are never offered.
  const availableOriginationUsers = useMemo<PartnerUserOption[]>(() => {
    return allAdminUsers.filter(
      u => isSelectableUser(u) && u.id !== selectedOriginationUser?.id
    )
  }, [allAdminUsers, selectedOriginationUser])

  // Origination contact picker: any contact except the one already selected
  const availableOriginationContacts = useMemo<OriginationContactOption[]>(
    () =>
      allContacts
        .filter(c => c.id !== selectedOriginationContact?.id)
        .map(c => ({ id: c.id, name: c.name, email: c.email })),
    [allContacts, selectedOriginationContact]
  )

  // Closer picker: any selectable admin except the one already selected
  const availableClosers = useMemo<PartnerUserOption[]>(() => {
    return allAdminUsers.filter(
      u => isSelectableUser(u) && u.id !== selectedCloser?.id
    )
  }, [allAdminUsers, selectedCloser])

  // Origination dirty: either side differs from initial
  const originationDirty = useMemo(() => {
    const currentUserId = selectedOriginationUser?.id ?? null
    const currentContactId = selectedOriginationContact?.id ?? null
    return (
      currentUserId !== initialOriginationUserId ||
      currentContactId !== initialOriginationContactId
    )
  }, [
    selectedOriginationUser,
    selectedOriginationContact,
    initialOriginationUserId,
    initialOriginationContactId,
  ])

  const closerDirty = useMemo(() => {
    const currentCloserId = selectedCloser?.id ?? null
    return currentCloserId !== initialCloserUserId
  }, [selectedCloser, initialCloserUserId])

  const resetFormState = useCallback(() => {
    const defaults = {
      name: client?.name ?? '',
      slug: client?.slug ?? '',
      billingType: client?.billing_type ?? 'prepaid',
      billingEffective: 'next_month' as const,
      state: client?.state ?? '',
      website: client?.website ?? '',
      notes: client?.notes ?? '',
    }

    form.reset(defaults)
    setFeedback(null)
    setOriginationError(null)
    setCloserError(null)

    // Reset pickers
    setIsContactPickerOpen(false)
    setIsOriginationUserPickerOpen(false)
    setIsOriginationContactPickerOpen(false)
    setIsCloserPickerOpen(false)
  }, [client, form, setFeedback])

  const hasUnsavedChanges =
    form.formState.isDirty || contactsDirty || originationDirty || closerDirty

  const {
    isSaving: isPending,
    startSave,
    handleSheetOpenChange,
    unsavedChangesDialog,
  } = useSheetLifecycle({
    open,
    onOpenChange,
    isDirty: hasUnsavedChanges,
    onReset: resetFormState,
    resetKey: client?.id ?? null,
  })

  const contactsAddButtonDisabled = isPending || isLoadingContacts || availableContacts.length === 0
  const contactsAddButtonDisabledReason = contactsAddButtonDisabled
    ? isPending
      ? PENDING_REASON
      : isLoadingContacts
        ? 'Loading contacts...'
        : 'All contacts are already linked.'
    : null

  const originationPickerDisabled = isPending || isLoadingContacts
  const originationPickerDisabledReason = originationPickerDisabled
    ? isPending
      ? PENDING_REASON
      : 'Loading contacts...'
    : null

  const closerPickerDisabled = isPending || isLoadingContacts
  const closerPickerDisabledReason = closerPickerDisabled
    ? isPending
      ? PENDING_REASON
      : 'Loading contacts...'
    : null

  const submitDisabled = isPending
  const submitDisabledReason = submitDisabled ? PENDING_REASON : null

  useEffect(() => {
    if (!open) {
      return
    }

    // Initialize contacts from props if provided
    // Intentional: Sync contact state with props when sheet opens
    /* eslint-disable react-hooks/set-state-in-effect */
    if (clientContactsProp) {
      setSelectedContacts(clientContactsProp)
      setInitialContacts(clientContactsProp)
    } else {
      setSelectedContacts([])
      setInitialContacts([])
    }
    /* eslint-enable react-hooks/set-state-in-effect */

    // Fetch contact data if not provided via props
    const clientId = client?.id
    const clientOriginationContactId = client?.origination_contact_id ?? null
    const clientOriginationUserId = client?.origination_user_id ?? null
    const clientCloserUserId = client?.closer_user_id ?? null
    const shouldFetch =
      !allContactsProp ||
      allContactsProp.length === 0 ||
      !allAdminUsersProp ||
      allAdminUsersProp.length === 0

    // Initialize origination/closer "initial" references
    setInitialOriginationUserId(clientOriginationUserId)
    setInitialOriginationContactId(clientOriginationContactId)
    setInitialCloserUserId(clientCloserUserId)

    // Default origination mode: 'external' only if an external contact is
    // already set on this client; otherwise default to 'internal' (for new
    // clients and existing clients with an internal user or no origination).
    setOriginationMode(clientOriginationContactId ? 'external' : 'internal')

    const hydrateSelectionsFromData = (
      contacts: ClientContactOption[],
      adminUsers: PartnerUserOption[]
    ) => {
      // Origination contact
      if (clientOriginationContactId) {
        const contact = contacts.find(c => c.id === clientOriginationContactId)
        setSelectedOriginationContact(
          contact
            ? { id: contact.id, name: contact.name, email: contact.email }
            : null
        )
      } else {
        setSelectedOriginationContact(null)
      }

      // Origination user
      if (clientOriginationUserId) {
        const u = adminUsers.find(u => u.id === clientOriginationUserId)
        setSelectedOriginationUser(u ?? null)
      } else {
        setSelectedOriginationUser(null)
      }

      // Closer
      if (clientCloserUserId) {
        const u = adminUsers.find(u => u.id === clientCloserUserId)
        setSelectedCloser(u ?? null)
      } else {
        setSelectedCloser(null)
      }
    }

    if (shouldFetch) {
      setIsLoadingContacts(true)
      getClientSheetContactData(clientId)
        .then(data => {
          setFetchedAllContacts(data.allContacts)
          setFetchedAllAdminUsers(data.allAdminUsers)
          if (clientId && data.linkedContacts.length > 0) {
            setSelectedContacts(data.linkedContacts)
            setInitialContacts(data.linkedContacts)
          }
          hydrateSelectionsFromData(data.allContacts, data.allAdminUsers)
        })
        .catch(err => {
          console.error('Failed to fetch contact sheet data:', err)
        })
        .finally(() => {
          setIsLoadingContacts(false)
        })
    } else {
      hydrateSelectionsFromData(
        allContactsProp ?? [],
        allAdminUsersProp ?? []
      )
    }
  }, [
    open,
    client?.id,
    client?.origination_contact_id,
    client?.origination_user_id,
    client?.closer_user_id,
    allContactsProp,
    clientContactsProp,
    allAdminUsersProp,
  ])

  // Contact handlers
  const handleContactPickerOpenChange = useCallback(
    (next: boolean) => {
      if (contactsAddButtonDisabled) {
        setIsContactPickerOpen(false)
        return
      }
      setIsContactPickerOpen(next)
    },
    [contactsAddButtonDisabled]
  )

  const handleAddContact = useCallback((contact: ClientContactOption) => {
    setSelectedContacts(prev => {
      if (prev.some(existing => existing.id === contact.id)) {
        return prev
      }
      return [...prev, contact]
    })
    setIsContactPickerOpen(false)
  }, [])

  const handleRemoveContact = useCallback((contact: ClientContactOption) => {
    setSelectedContacts(prev => prev.filter(c => c.id !== contact.id))
  }, [])

  // Origination handlers
  const handleOriginationModeChange = useCallback(
    (mode: OriginationMode) => {
      setOriginationMode(mode)
      setOriginationError(null)
      // Switching modes clears the opposite side to enforce mutex in UI
      if (mode === 'internal') {
        setSelectedOriginationContact(null)
      } else {
        setSelectedOriginationUser(null)
      }
    },
    []
  )

  const handleOriginationUserPickerOpenChange = useCallback(
    (next: boolean) => {
      if (originationPickerDisabled) {
        setIsOriginationUserPickerOpen(false)
        return
      }
      setIsOriginationUserPickerOpen(next)
    },
    [originationPickerDisabled]
  )

  const handleOriginationContactPickerOpenChange = useCallback(
    (next: boolean) => {
      if (originationPickerDisabled) {
        setIsOriginationContactPickerOpen(false)
        return
      }
      setIsOriginationContactPickerOpen(next)
    },
    [originationPickerDisabled]
  )

  const handleSelectOriginationUser = useCallback(
    (user: PartnerUserOption) => {
      setSelectedOriginationUser(user)
      setSelectedOriginationContact(null)
      setIsOriginationUserPickerOpen(false)
      setOriginationError(null)
    },
    []
  )

  const handleSelectOriginationContact = useCallback(
    (contact: OriginationContactOption) => {
      setSelectedOriginationContact(contact)
      setSelectedOriginationUser(null)
      setIsOriginationContactPickerOpen(false)
      setOriginationError(null)
    },
    []
  )

  const handleClearOrigination = useCallback(() => {
    setSelectedOriginationUser(null)
    setSelectedOriginationContact(null)
  }, [])

  // Closer handlers
  const handleCloserPickerOpenChange = useCallback(
    (next: boolean) => {
      if (closerPickerDisabled) {
        setIsCloserPickerOpen(false)
        return
      }
      setIsCloserPickerOpen(next)
    },
    [closerPickerDisabled]
  )

  const handleSelectCloser = useCallback((user: PartnerUserOption) => {
    setSelectedCloser(user)
    setIsCloserPickerOpen(false)
    setCloserError(null)
  }, [])

  const handleClearCloser = useCallback(() => {
    setSelectedCloser(null)
  }, [])

  const handleFormSubmit = useCallback(
    (values: ClientSheetFormValues) => {
      if (isEditing && !values.slug?.trim()) {
        form.setError('slug', { type: 'manual', message: 'Slug is required' })
        return
      }

      // Origination is required — exactly one of user OR contact must be set.
      const hasOriginationUser =
        originationMode === 'internal' && selectedOriginationUser !== null
      const hasOriginationContact =
        originationMode === 'external' && selectedOriginationContact !== null
      const originationMissing = !hasOriginationUser && !hasOriginationContact
      const closerMissing = !selectedCloser

      if (originationMissing || closerMissing) {
        setOriginationError(
          originationMissing
            ? originationMode === 'internal'
              ? 'Pick an internal partner.'
              : 'Pick an external referrer.'
            : null
        )
        setCloserError(closerMissing ? 'Pick a closer.' : null)
        return
      }

      setOriginationError(null)
      setCloserError(null)

      startSave(async () => {
        setFeedback(null)

        const payload = {
          id: client?.id ?? undefined,
          name: values.name.trim(),
          slug: isEditing
            ? values.slug?.trim()
              ? values.slug.trim()
              : null
            : null,
          billingType: values.billingType,
          billingEffective: values.billingEffective,
          state: values.state?.trim() ? values.state.trim() : null,
          website: values.website?.trim() ? values.website.trim() : null,
          originationContactId:
            originationMode === 'external'
              ? (selectedOriginationContact?.id ?? null)
              : null,
          originationUserId:
            originationMode === 'internal'
              ? (selectedOriginationUser?.id ?? null)
              : null,
          closerUserId: selectedCloser?.id ?? null,
          notes: values.notes?.trim() ? values.notes.trim() : null,
        } satisfies Parameters<typeof saveClient>[0]

        if (payload.slug && payload.slug.length < 3) {
          setFeedback('Slug must be at least 3 characters when provided.')
          return
        }

        const interaction = startSettingsInteraction({
          entity: 'client',
          mode: isEditing ? 'edit' : 'create',
          targetId: payload.id ?? null,
        })

        try {
          const result = await saveClient(payload)

          if (result.error) {
            finishSettingsInteraction(interaction, {
              status: 'error',
              error: result.error,
            })
            setFeedback(result.error)
            return
          }

          // Sync contact links if contacts changed
          // For new clients, use the returned clientId; for existing, use payload.id
          const clientIdForContacts = payload.id ?? result.clientId
          if (clientIdForContacts && contactsDirty) {
            const contactIds = selectedContacts.map(c => c.id)
            const syncResult = await syncClientContacts(clientIdForContacts, contactIds)

            if (!syncResult.ok) {
              setFeedback(syncResult.error ?? 'Failed to update contact links.')
              toast({
                title: 'Warning',
                description: 'Client saved but contact links could not be updated.',
                variant: 'destructive',
              })
              // Still complete since the client was saved
            }
          }

          finishSettingsInteraction(interaction, {
            status: 'success',
            targetId: payload.id ?? result.clientId ?? null,
          })

          toast({
            title: isEditing ? 'Client updated' : 'Client created',
            description: isEditing
              ? 'Changes saved successfully.'
              : 'The client is ready for new projects.',
          })

          setInitialContacts(selectedContacts)
          setInitialOriginationUserId(payload.originationUserId)
          setInitialOriginationContactId(payload.originationContactId)
          setInitialCloserUserId(payload.closerUserId)
          form.reset({
            name: payload.name,
            slug: payload.slug ?? '',
            billingType: payload.billingType,
            billingEffective: 'next_month',
            state: payload.state ?? '',
            website: payload.website ?? '',
            notes: payload.notes ?? '',
          })

          onOpenChange(false)
          onComplete()
        } catch (error) {
          finishSettingsInteraction(interaction, {
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error',
          })
          setFeedback('We could not save this client. Please try again.')
          return
        }
      })
    },
    [
      client?.id,
      contactsDirty,
      form,
      isEditing,
      onComplete,
      onOpenChange,
      originationMode,
      selectedCloser,
      selectedContacts,
      selectedOriginationContact,
      selectedOriginationUser,
      setFeedback,
      startSave,
      toast,
    ]
  )

  return {
    form,
    isSaving: isPending,
    startSave,
    submitDisabled,
    submitDisabledReason,
    unsavedChangesDialog,
    handleSheetOpenChange,
    handleFormSubmit,
    // Contacts
    availableContacts,
    selectedContacts,
    isContactPickerOpen,
    contactsAddButtonDisabled,
    contactsAddButtonDisabledReason,
    isLoadingContacts,
    handleContactPickerOpenChange,
    handleAddContact,
    handleRemoveContact,
    // Origination
    originationMode,
    selectedOriginationUser,
    selectedOriginationContact,
    availableOriginationUsers,
    availableOriginationContacts,
    isOriginationUserPickerOpen,
    isOriginationContactPickerOpen,
    originationPickerDisabled,
    originationPickerDisabledReason,
    originationError,
    handleOriginationModeChange,
    handleOriginationUserPickerOpenChange,
    handleOriginationContactPickerOpenChange,
    handleSelectOriginationUser,
    handleSelectOriginationContact,
    handleClearOrigination,
    // Closer
    selectedCloser,
    availableClosers,
    isCloserPickerOpen,
    closerPickerDisabled,
    closerPickerDisabledReason,
    closerError,
    handleCloserPickerOpenChange,
    handleSelectCloser,
    handleClearCloser,
  }
}

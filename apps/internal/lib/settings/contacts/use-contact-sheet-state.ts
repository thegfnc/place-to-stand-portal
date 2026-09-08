'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { useToast } from '@/components/ui/use-toast'
import { useUnsavedChangesWarning } from '@/lib/hooks/use-unsaved-changes-warning'
import {
  saveContact,
  softDeleteContact,
  promoteContactToUser,
  getContactSheetData,
  syncContactClients,
} from '@/app/(dashboard)/contacts/actions'
import type { ContactsTableContact } from '@/lib/settings/contacts/use-contacts-table-state'
import type { ContactClientOption } from '@/app/(dashboard)/contacts/_components/contact-sheet/contact-client-picker'
import { PENDING_REASON } from '@/lib/forms/form-controls'

const contactFormSchema = z.object({
  email: z.string().email({ message: 'Valid email is required' }),
  name: z.string().min(1, 'Name is required').max(160),
  phone: z.string().max(40).optional(),
})

export type ContactFormData = z.infer<typeof contactFormSchema>

/** Minimal contact data needed for the sheet form */
export type ContactSheetInput = {
  id: string
  email: string
  name: string
  phone: string | null
}

export type UseContactSheetStateOptions = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onComplete: () => void
  /** Called with the new contact ID when a contact is created (not on edit) */
  onCreated?: (contactId: string) => void
  contact?: ContactsTableContact | ContactSheetInput | null
  /** All available clients for the client picker (fetched when not provided) */
  allClients?: ContactClientOption[]
}



function hasMetrics(
  c: ContactsTableContact | ContactSheetInput | null | undefined
): c is ContactsTableContact {
  return Boolean(c && 'metrics' in c && c.metrics)
}

export function useContactSheetState({
  open,
  onOpenChange,
  onComplete,
  onCreated,
  contact,
  allClients: allClientsProp,
}: UseContactSheetStateOptions) {
  const [isPending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<string | null>(null)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isPromoteDialogOpen, setIsPromoteDialogOpen] = useState(false)
  const [isClientPickerOpen, setIsClientPickerOpen] = useState(false)

  // Client data state - can come from props or be fetched
  const [fetchedAllClients, setFetchedAllClients] = useState<
    ContactClientOption[]
  >([])
  const [selectedClients, setSelectedClients] = useState<ContactClientOption[]>(
    []
  )
  const [initialClients, setInitialClients] = useState<ContactClientOption[]>(
    []
  )
  const [isLoadingClients, setIsLoadingClients] = useState(false)

  const { toast } = useToast()
  const isEditing = Boolean(contact?.id)

  // Use provided allClients or fetched ones
  const allClients = allClientsProp ?? fetchedAllClients

  const form = useForm<ContactFormData>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: {
      email: '',
      name: '',
      phone: '',
    },
  })

  // Track the contact ID to detect changes
  const prevContactIdRef = useRef<string | null | undefined>(null)

  // Initialize form and fetch client data when sheet opens
  useEffect(() => {
    if (!open) {
      return
    }

    const contactId = contact?.id

    // Reset form - intentional setState during effect to sync UI with prop changes
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFeedback(null)
    form.reset({
      email: contact?.email ?? '',
      name: contact?.name ?? '',
      phone: contact?.phone ?? '',
    })

    // If we have metrics (from ContactsTableContact), use them directly
    if (hasMetrics(contact)) {
      const clients = contact.metrics.clients.map(c => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
      }))
      setSelectedClients(clients)
      setInitialClients(clients)

      // If we already have allClients from props, we're done
      if (allClientsProp && allClientsProp.length > 0) {
        return
      }
    } else {
      // No metrics - reset to empty
      setSelectedClients([])
      setInitialClients([])
    }

    // Fetch client data if not provided via props or if contact changed
    const shouldFetch =
      !allClientsProp ||
      allClientsProp.length === 0 ||
      (isEditing &&
        !hasMetrics(contact) &&
        prevContactIdRef.current !== contactId)

    if (shouldFetch) {
      setIsLoadingClients(true)
      getContactSheetData(contactId || undefined)
        .then(data => {
          setFetchedAllClients(data.allClients)
          if (contactId && data.linkedClients.length > 0) {
            setSelectedClients(data.linkedClients)
            setInitialClients(data.linkedClients)
          }
        })
        .catch(err => {
          console.error('Failed to fetch contact sheet data:', err)
        })
        .finally(() => {
          setIsLoadingClients(false)
        })
    }

    prevContactIdRef.current = contactId
  }, [open, contact, form, allClientsProp, isEditing])

  // Check if client links have changed
  const clientsHaveChanged = useMemo(() => {
    const initialIds = new Set(initialClients.map(c => c.id))
    const selectedIds = new Set(selectedClients.map(c => c.id))

    if (initialIds.size !== selectedIds.size) return true
    for (const id of initialIds) {
      if (!selectedIds.has(id)) return true
    }
    return false
  }, [initialClients, selectedClients])

  // Compute available clients (all clients minus selected ones)
  const availableClients = useMemo(() => {
    const selectedIds = new Set(selectedClients.map(c => c.id))
    return allClients.filter(c => !selectedIds.has(c.id))
  }, [allClients, selectedClients])

  const contactDisplayName = contact?.name || contact?.email || 'this contact'
  const sheetTitle = isEditing ? 'Edit Contact' : 'Add Contact'
  const sheetDescription = isEditing
    ? `Update the details for ${contactDisplayName}.`
    : 'Add a new contact to your organization.'

  // hasChanges is true if form is dirty OR client links have changed from initial state
  const hasChanges = form.formState.isDirty || clientsHaveChanged

  // Unsaved changes warning
  const { requestConfirmation, dialog: unsavedChangesDialog } =
    useUnsavedChangesWarning({ isDirty: hasChanges })

  const submitDisabled = isPending
  const submitDisabledReason = isPending ? PENDING_REASON : null

  const deleteDisabled = isPending || !isEditing
  const deleteDisabledReason = isPending
    ? PENDING_REASON
    : !isEditing
      ? 'Cannot archive a new contact.'
      : null

  const handleSheetOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen && isPending) {
        return
      }
      if (!nextOpen) {
        requestConfirmation(() => onOpenChange(false))
      } else {
        onOpenChange(true)
      }
    },
    [isPending, onOpenChange, requestConfirmation]
  )

  const handleFormSubmit = useCallback(
    (data: ContactFormData) => {
      setFeedback(null)
      startTransition(async () => {
        // Save contact data
        const result = await saveContact({
          id: contact?.id || undefined,
          email: data.email,
          name: data.name,
          phone: data.phone || null,
        })

        if (result.error) {
          setFeedback(result.error)
          toast({
            title: isEditing
              ? 'Unable to update contact'
              : 'Unable to create contact',
            description: result.error,
            variant: 'destructive',
          })
          return
        }

        const contactId = contact?.id || result.id

        // Sync client links if editing and clients changed
        if (contactId && clientsHaveChanged) {
          const clientIds = selectedClients.map(c => c.id)
          const syncResult = await syncContactClients(contactId, clientIds)

          if (!syncResult.ok) {
            setFeedback(syncResult.error ?? 'Failed to update client links.')
            toast({
              title: 'Warning',
              description:
                'Contact saved but client links could not be updated.',
              variant: 'destructive',
            })
            // Still complete since the contact was saved
          }
        }

        toast({
          title: isEditing ? 'Contact updated' : 'Contact created',
          description: isEditing
            ? `${data.name || data.email} has been updated.`
            : `${data.name || data.email} has been created.`,
        })

        // Call onCreated with the new contact ID if this was a create operation
        if (!isEditing && result.id && onCreated) {
          onCreated(result.id)
        }

        onComplete()
      })
    },
    [
      contact?.id,
      isEditing,
      clientsHaveChanged,
      selectedClients,
      toast,
      onComplete,
      onCreated,
    ]
  )

  const handleRequestDelete = useCallback(() => {
    if (!isEditing || isPending) {
      return
    }
    setIsDeleteDialogOpen(true)
  }, [isEditing, isPending])

  const handleCancelDelete = useCallback(() => {
    if (isPending) {
      return
    }
    setIsDeleteDialogOpen(false)
  }, [isPending])

  const hasPortalAccess = Boolean(
    contact && 'userId' in contact && contact.userId
  )

  const promoteDisabled = isPending || !isEditing || hasPortalAccess
  const promoteDisabledReason = isPending
    ? PENDING_REASON
    : !isEditing
      ? 'Save the contact first.'
      : hasPortalAccess
        ? 'This contact already has portal access.'
        : null

  const handleRequestPromote = useCallback(() => {
    if (promoteDisabled) return
    setIsPromoteDialogOpen(true)
  }, [promoteDisabled])

  const handleConfirmPromote = useCallback(() => {
    const contactId = contact?.id
    if (!contactId || isPending) {
      setIsPromoteDialogOpen(false)
      return
    }

    setIsPromoteDialogOpen(false)
    startTransition(async () => {
      const result = await promoteContactToUser(contactId)

      if (result.error) {
        setFeedback(result.error)
        toast({
          title: 'Unable to create portal account',
          description: result.error,
          variant: 'destructive',
        })
        return
      }

      toast({
        title: 'Portal account created',
        description: `A portal invite has been sent to ${contact?.name || contact?.email || 'the contact'}.`,
      })
      onComplete()
    })
  }, [contact, isPending, toast, onComplete])

  const handleConfirmDelete = useCallback(() => {
    const contactId = contact?.id
    const displayName = contact?.name || contact?.email || 'this contact'

    if (!contactId || isPending) {
      setIsDeleteDialogOpen(false)
      return
    }

    setIsDeleteDialogOpen(false)
    startTransition(async () => {
      const result = await softDeleteContact({ id: contactId })

      if (result.error) {
        setFeedback(result.error)
        toast({
          title: 'Unable to archive contact',
          description: result.error,
          variant: 'destructive',
        })
        return
      }

      toast({
        title: 'Contact archived',
        description: `${displayName} has been archived.`,
      })
      onComplete()
    })
  }, [contact, isPending, toast, onComplete])

  // Client picker handlers - these only update local state; links are synced on save
  const handleAddClient = useCallback((client: ContactClientOption) => {
    setSelectedClients(prev => [...prev, client])
    setIsClientPickerOpen(false)
  }, [])

  const handleRemoveClient = useCallback((client: ContactClientOption) => {
    setSelectedClients(prev => prev.filter(c => c.id !== client.id))
  }, [])

  const addClientButtonDisabled =
    isPending || isLoadingClients || availableClients.length === 0
  const addClientButtonDisabledReason = isPending
    ? PENDING_REASON
    : isLoadingClients
      ? 'Loading clients...'
      : availableClients.length === 0
        ? 'All clients are already linked.'
        : null

  return {
    form,
    feedback,
    isPending,
    isEditing,
    pendingReason: PENDING_REASON,
    sheetTitle,
    sheetDescription,
    contactDisplayName,
    submitDisabled,
    submitDisabledReason,
    deleteDisabled,
    deleteDisabledReason,
    isDeleteDialogOpen,
    isPromoteDialogOpen,
    setIsPromoteDialogOpen,
    isClientPickerOpen,
    setIsClientPickerOpen,
    selectedClients,
    availableClients,
    addClientButtonDisabled,
    addClientButtonDisabledReason,
    hasPortalAccess,
    promoteDisabled,
    promoteDisabledReason,
    unsavedChangesDialog,
    handleSheetOpenChange,
    handleFormSubmit,
    handleRequestDelete,
    handleCancelDelete,
    handleConfirmDelete,
    handleRequestPromote,
    handleConfirmPromote,
    handleAddClient,
    handleRemoveClient,
  }
}

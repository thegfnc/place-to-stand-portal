'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

import { useToast } from '@/components/ui/use-toast'
import {
  destroyContact,
  restoreContact,
  softDeleteContact,
} from '@/app/(dashboard)/contacts/actions'
import type { LinkedClient } from '@/lib/queries/contacts'
import { useSheetParamSelection } from '@/lib/sheets/use-sheet-params'

import type { ContactSheetInput } from './use-contact-sheet-state'
import { PENDING_REASON } from '@/lib/forms/form-controls'
export type ContactsTableContact = {
  id: string
  email: string
  name: string
  phone: string | null
  userId: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  metrics: {
    totalClients: number
    clients: LinkedClient[]
  }
}

/** What the contact sheet can be handed: a table row or the minimal row. */
type ContactSheetRecord = ContactsTableContact | ContactSheetInput

type UseContactsTableStateArgs = {
  /** The page's fresh rows — the open sheet re-resolves from them by id. */
  contacts: ContactsTableContact[]
  /**
   * Row resolved server-side from `?contact=<id>`. The list is paginated, so
   * a shared link can point at a contact this page doesn't render.
   */
  deepLinkedContact?: ContactSheetInput | null
}

export function useContactsTableState({
  contacts,
  deepLinkedContact = null,
}: UseContactsTableStateArgs) {
  const router = useRouter()
  // `?contact=` drives which sheet is open, so an open sheet is a shareable
  // link; local state keeps it opening instantly while the URL catches up.
  const { selectedId, isCreating, select, openCreate, clear } =
    useSheetParamSelection('contact')

  const selectedContact: ContactSheetRecord | null = selectedId
    ? (contacts.find(contact => contact.id === selectedId) ??
      (deepLinkedContact?.id === selectedId ? deepLinkedContact : null))
    : null

  // `?contact=new` opens the create sheet; an id that resolves to nothing (a
  // deleted row) keeps the sheet closed — the table shows the notice instead.
  const resolvedContact = isCreating ? null : selectedContact
  const sheetOpen = isCreating || selectedContact !== null

  // Keep the last-rendered record mounted after close so the sheet's exit
  // animation can play; only `open` toggles.
  const [lastContact, setLastContact] = useState<ContactSheetRecord | null>(
    null
  )
  if (sheetOpen && resolvedContact !== lastContact) {
    setLastContact(resolvedContact)
  }

  const [deleteTarget, setDeleteTarget] = useState<ContactsTableContact | null>(
    null
  )
  const [destroyTarget, setDestroyTarget] = useState<ContactsTableContact | null>(
    null
  )
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [pendingRestoreId, setPendingRestoreId] = useState<string | null>(null)
  const [pendingDestroyId, setPendingDestroyId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const { toast } = useToast()

  const pendingReason = PENDING_REASON

  const openEdit = (contact: ContactsTableContact) => {
    select(contact.id)
  }

  const handleSheetOpenChange = (open: boolean) => {
    if (!open) {
      clear()
    }
  }

  const handleSheetComplete = () => {
    clear()
    router.refresh()
  }

  /**
   * The row is about to leave this tab — drop `?contact=` first so the
   * refresh can't reopen a stale sheet or trip the not-found notice.
   */
  const clearIfSelected = (contactId: string) => {
    if (selectedId === contactId) {
      clear()
    }
  }

  const handleRequestDelete = (contact: ContactsTableContact) => {
    if (contact.deletedAt || isPending) {
      return
    }

    setDeleteTarget(contact)
  }

  const handleCancelDelete = () => {
    if (isPending) {
      return
    }

    setDeleteTarget(null)
  }

  const handleConfirmDelete = () => {
    if (!deleteTarget || deleteTarget.deletedAt) {
      setDeleteTarget(null)
      return
    }

    const contact = deleteTarget
    setDeleteTarget(null)
    setPendingDeleteId(contact.id)

    startTransition(async () => {
      try {
        const result = await softDeleteContact({ id: contact.id })

        if (result.error) {
          toast({
            title: 'Unable to archive contact',
            description: result.error,
            variant: 'destructive',
          })
          return
        }

        toast({
          title: 'Contact archived',
          description: `${contact.name || contact.email} has been archived.`,
        })
        clearIfSelected(contact.id)
        router.refresh()
      } finally {
        setPendingDeleteId(null)
      }
    })
  }

  const handleRestore = (contact: ContactsTableContact) => {
    if (!contact.deletedAt || isPending) {
      return
    }

    setPendingRestoreId(contact.id)
    startTransition(async () => {
      try {
        const result = await restoreContact({ id: contact.id })

        if (result.error) {
          toast({
            title: 'Unable to restore contact',
            description: result.error,
            variant: 'destructive',
          })
          return
        }

        toast({
          title: 'Contact restored',
          description: `${contact.name || contact.email} is active again.`,
        })
        clearIfSelected(contact.id)
        router.refresh()
      } finally {
        setPendingRestoreId(null)
      }
    })
  }

  const handleRequestDestroy = (contact: ContactsTableContact) => {
    if (!contact.deletedAt || isPending) {
      return
    }

    setDestroyTarget(contact)
  }

  const handleCancelDestroy = () => {
    if (isPending) {
      return
    }

    setDestroyTarget(null)
  }

  const handleConfirmDestroy = () => {
    if (!destroyTarget || !destroyTarget.deletedAt) {
      setDestroyTarget(null)
      return
    }

    const contact = destroyTarget
    setDestroyTarget(null)
    setPendingDestroyId(contact.id)

    startTransition(async () => {
      try {
        const result = await destroyContact({ id: contact.id })

        if (result.error) {
          toast({
            title: 'Unable to permanently delete contact',
            description: result.error,
            variant: 'destructive',
          })
          return
        }

        toast({
          title: 'Contact permanently deleted',
          description: `${contact.name || contact.email} has been removed.`,
        })
        clearIfSelected(contact.id)
        router.refresh()
      } finally {
        setPendingDestroyId(null)
      }
    })
  }

  return {
    sheetOpen,
    selectedContact: sheetOpen ? resolvedContact : lastContact,
    deleteTarget,
    destroyTarget,
    isPending,
    pendingReason,
    pendingDeleteId,
    pendingRestoreId,
    pendingDestroyId,
    openCreate,
    openEdit,
    clearSelection: clear,
    handleSheetOpenChange,
    handleSheetComplete,
    handleRequestDelete,
    handleCancelDelete,
    handleConfirmDelete,
    handleRestore,
    handleRequestDestroy,
    handleCancelDestroy,
    handleConfirmDestroy,
  }
}

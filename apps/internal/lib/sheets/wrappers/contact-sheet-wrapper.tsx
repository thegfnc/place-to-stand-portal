'use client'

import { useRouter } from 'next/navigation'

import { ContactsSheet } from '@/app/(dashboard)/contacts/_components/contacts-sheet'

import { emitSheetCreated } from '../created'
import { NEW_SHEET_VALUE } from '../entities'
import { useSheetParams } from '../use-sheet-params'
import { useSheetInit } from './use-sheet-init'
import type { SheetWrapperProps } from './types'

export function ContactSheetWrapper({ value, open, onRequestClose }: SheetWrapperProps) {
  const router = useRouter()
  const { getAux } = useSheetParams()
  const data = useSheetInit('contact', value)
  // Create-from-picker: the host picker passes the typed name along.
  const initialName =
    value === NEW_SHEET_VALUE ? (getAux('contactName') ?? undefined) : undefined

  if (!data) {
    return null
  }

  return (
    <ContactsSheet
      open={open}
      onOpenChange={next => {
        if (!next) {
          onRequestClose()
        }
      }}
      onComplete={() => {
        router.refresh()
        onRequestClose()
      }}
      contact={data.contact}
      initialName={initialName}
      onCreated={record => emitSheetCreated('contact', record)}
    />
  )
}

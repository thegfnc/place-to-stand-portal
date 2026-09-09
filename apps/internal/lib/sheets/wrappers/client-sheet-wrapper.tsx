'use client'

import { useRouter } from 'next/navigation'

import { ClientSheet } from '@/app/(dashboard)/clients/_components/clients-sheet'

import { emitSheetCreated } from '../created'
import { NEW_SHEET_VALUE } from '../entities'
import { useSheetParams } from '../use-sheet-params'
import { useSheetInit } from './use-sheet-init'
import type { SheetWrapperProps } from './types'

export function ClientSheetWrapper({ value, open, onRequestClose }: SheetWrapperProps) {
  const router = useRouter()
  const { getAux } = useSheetParams()
  const data = useSheetInit('client', value)
  const isCreating = value === NEW_SHEET_VALUE
  // Create-from-picker: the host picker passes the typed name along.
  const initialName = isCreating ? (getAux('clientName') ?? undefined) : undefined

  if (!data) {
    return null
  }

  return (
    <ClientSheet
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
      client={isCreating ? null : data.client}
      initialName={initialName}
      onCreated={record => emitSheetCreated('client', record)}
    />
  )
}

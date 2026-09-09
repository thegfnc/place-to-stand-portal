'use client'

/**
 * Return channel for "create from inside a picker" (the sibling of
 * pending-open.ts). A picker opens a create sheet stacked above its own
 * (`?client=<id>&contact=new`); when that sheet saves, its wrapper emits the
 * new record here and the host picker — still mounted underneath — selects
 * it locally. Links are persisted with the host's own save, so nothing hits
 * the server twice.
 */
export type SheetCreatedRecords = {
  contact: { id: string; name: string; email: string; phone: string | null }
  client: { id: string; name: string; slug: string }
}

export type SheetCreatedEntity = keyof SheetCreatedRecords

type Listener<E extends SheetCreatedEntity> = (
  record: SheetCreatedRecords[E]
) => void

const listeners: { [E in SheetCreatedEntity]: Set<Listener<E>> } = {
  contact: new Set(),
  client: new Set(),
}

export function emitSheetCreated<E extends SheetCreatedEntity>(
  entity: E,
  record: SheetCreatedRecords[E]
) {
  for (const listener of listeners[entity]) {
    listener(record)
  }
}

export function subscribeSheetCreated<E extends SheetCreatedEntity>(
  entity: E,
  listener: Listener<E>
) {
  listeners[entity].add(listener)
  return () => {
    listeners[entity].delete(listener)
  }
}

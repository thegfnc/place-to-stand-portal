'use client'

import { useCallback, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import {
  NEW_SHEET_VALUE,
  SHEET_ENTITIES,
  isSheetEntityKey,
  isValidSheetParamValue,
  type SheetEntityKey,
} from './entities'
import { emitSheetOpen } from './pending-open'

export type SheetStackItem = {
  entity: SheetEntityKey
  value: string
}

/**
 * The one hook implementing the sheet deep-link conventions:
 * - open = `router.push` (Back closes the sheet), close = `router.replace`
 *   (Back after close doesn't reopen it), always `{ scroll: false }`
 * - all other params are preserved on every write
 * - param order in the URL is the sheet stack order — `open` appends,
 *   `close` removes only its own param (plus its aux params)
 * - `replaceValue` rewrites a param in place (e.g. an active/archive swap)
 */
export function useSheetParams() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  /** Entity params present in the URL, in stack (mount) order. */
  const stack = useMemo(() => {
    const items: SheetStackItem[] = []
    for (const [key, value] of searchParams.entries()) {
      if (
        isSheetEntityKey(key) &&
        value &&
        isValidSheetParamValue(value) &&
        !items.some(item => item.entity === key)
      ) {
        items.push({ entity: key, value })
      }
    }
    return items
  }, [searchParams])

  const get = useCallback(
    (entity: SheetEntityKey) => searchParams.get(entity),
    [searchParams]
  )

  const getAux = useCallback(
    (aux: string) => searchParams.get(aux),
    [searchParams]
  )

  const buildUrl = useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams.toString())
      mutate(params)
      const queryString = params.toString()
      return queryString ? `${pathname}?${queryString}` : pathname
    },
    [pathname, searchParams]
  )

  const open = useCallback(
    (
      entity: SheetEntityKey,
      value: string,
      /** Aux params written in the same push (e.g. a create-sheet prefill). */
      aux?: Record<string, string>
    ) => {
      // Let the host mount now; the URL write below round-trips first.
      emitSheetOpen(entity, value)
      router.push(
        buildUrl(params => {
          // `set` keeps an existing param's stack position; `append` puts a
          // newly opened sheet on top.
          if (params.has(entity)) {
            params.set(entity, value)
          } else {
            params.append(entity, value)
          }
          for (const [key, auxValue] of Object.entries(aux ?? {})) {
            if (auxValue) {
              params.set(key, auxValue)
            } else {
              params.delete(key)
            }
          }
        }),
        { scroll: false }
      )
    },
    [buildUrl, router]
  )

  const openNew = useCallback(
    (entity: SheetEntityKey, aux?: Record<string, string>) =>
      open(entity, NEW_SHEET_VALUE, aux),
    [open]
  )

  const close = useCallback(
    (entity: SheetEntityKey) => {
      router.replace(
        buildUrl(params => {
          params.delete(entity)
          for (const aux of SHEET_ENTITIES[entity].auxParams) {
            params.delete(aux)
          }
        }),
        { scroll: false }
      )
    },
    [buildUrl, router]
  )

  /** Swap the param value in place, keeping its stack position. */
  const replaceValue = useCallback(
    (entity: SheetEntityKey, value: string) => {
      router.replace(
        buildUrl(params => params.set(entity, value)),
        { scroll: false }
      )
    },
    [buildUrl, router]
  )

  /** Set/remove an entity's aux param (e.g. `leadMode=convert`). */
  const setAux = useCallback(
    (aux: string, value: string | null) => {
      router.replace(
        buildUrl(params => {
          if (value === null) {
            params.delete(aux)
          } else {
            params.set(aux, value)
          }
        }),
        { scroll: false }
      )
    },
    [buildUrl, router]
  )

  return { stack, get, getAux, open, openNew, close, replaceValue, setAux }
}

/**
 * Param-mirrored selection for a host page's own sheet: local state opens the
 * sheet instantly while the URL catches up, and external URL changes
 * (back/forward, shared-link navigation) are adopted via the
 * adjust-state-during-render pattern rather than an effect. Mirrors the
 * submissions table precedent.
 */
export function useSheetParamSelection(entity: SheetEntityKey) {
  const { get, open, openNew, close } = useSheetParams()
  const param = get(entity)

  const [selectedValue, setSelectedValue] = useState<string | null>(param)
  const [lastParam, setLastParam] = useState<string | null>(param)
  if (param !== lastParam) {
    setLastParam(param)
    setSelectedValue(param)
  }

  const select = useCallback(
    (id: string) => {
      setSelectedValue(id)
      open(entity, id)
    },
    [entity, open]
  )

  const openCreate = useCallback(() => {
    setSelectedValue(NEW_SHEET_VALUE)
    openNew(entity)
  }, [entity, openNew])

  const clear = useCallback(() => {
    setSelectedValue(null)
    close(entity)
  }, [close, entity])

  return {
    selectedValue,
    selectedId:
      selectedValue && selectedValue !== NEW_SHEET_VALUE
        ? selectedValue
        : null,
    isCreating: selectedValue === NEW_SHEET_VALUE,
    isOpen: selectedValue !== null,
    select,
    openCreate,
    clear,
  }
}

import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

type AssignedFilterState = Record<string, boolean>

type UseBoardAssignedFilterOptions = {
  activeProjectId: string | null
  storageNamespace: string | null
}

export type UseBoardAssignedFilterReturn = {
  onlyAssignedToMe: boolean
  handleAssignedFilterChange: (value: boolean) => void
  assignedFilterMap: AssignedFilterState
}

export function useBoardAssignedFilter(
  options: UseBoardAssignedFilterOptions
): UseBoardAssignedFilterReturn {
  const { activeProjectId, storageNamespace } = options
  const [assignedFilterMap, setAssignedFilterMap] =
    useState<AssignedFilterState>({})
  const bootstrappedNamespaceRef = useRef<string | null>(null)
  const hasBootstrappedRef = useRef(false)

  const onlyAssignedToMe = useMemo(() => {
    if (!activeProjectId) {
      return false
    }

    return assignedFilterMap[activeProjectId] ?? false
  }, [activeProjectId, assignedFilterMap])

  const handleAssignedFilterChange = useCallback(
    (value: boolean) => {
      if (!activeProjectId) {
        return
      }

      setAssignedFilterMap(prev => {
        if (value) {
          if (prev[activeProjectId]) {
            return prev
          }

          return { ...prev, [activeProjectId]: true }
        }

        if (!prev[activeProjectId]) {
          return prev
        }

        const next = { ...prev }
        delete next[activeProjectId]
        return next
      })
    },
    [activeProjectId]
  )

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    if (!storageNamespace) {
      hasBootstrappedRef.current = false
      bootstrappedNamespaceRef.current = null

      startTransition(() => {
        setAssignedFilterMap(current => {
          hasBootstrappedRef.current = true
          return Object.keys(current).length ? {} : current
        })
      })

      return
    }

    if (bootstrappedNamespaceRef.current === storageNamespace) {
      return
    }

    hasBootstrappedRef.current = false
    bootstrappedNamespaceRef.current = storageNamespace

    let nextMap: AssignedFilterState = {}

    try {
      const raw = window.sessionStorage.getItem(storageNamespace)

      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, unknown>
        nextMap = Object.fromEntries(
          Object.entries(parsed).filter(
            (entry): entry is [string, boolean] => typeof entry[1] === 'boolean'
          )
        )
      }
    } catch {
      nextMap = {}
    }

    const nextEntries = Object.entries(nextMap)

    startTransition(() => {
      setAssignedFilterMap(current => {
        const currentEntries = Object.entries(current)

        if (currentEntries.length === nextEntries.length) {
          const hasDifference = nextEntries.some(
            ([key, value]) => current[key] !== value
          )

          if (!hasDifference) {
            hasBootstrappedRef.current = true
            return current
          }
        }

        if (!nextEntries.length && !currentEntries.length) {
          hasBootstrappedRef.current = true
          return current
        }

        hasBootstrappedRef.current = true
        return nextMap
      })
    })
  }, [storageNamespace])

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      !storageNamespace ||
      !hasBootstrappedRef.current
    ) {
      return
    }

    try {
      if (Object.keys(assignedFilterMap).length === 0) {
        window.sessionStorage.removeItem(storageNamespace)
        return
      }

      window.sessionStorage.setItem(
        storageNamespace,
        JSON.stringify(assignedFilterMap)
      )
    } catch {
      // Ignore storage failures (private browsing, quota, etc.)
    }
  }, [assignedFilterMap, storageNamespace])

  return {
    onlyAssignedToMe,
    handleAssignedFilterChange,
    assignedFilterMap,
  }
}

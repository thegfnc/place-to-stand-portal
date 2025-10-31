import { useEffect } from 'react'

export type KeyboardShortcutArgs = {
  isActive: boolean
  canSave: boolean
  onSave: () => void
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
  flushPendingSnapshots: () => void
}

export function useHistoryKeyboardShortcuts({
  isActive,
  canSave,
  onSave,
  undo,
  redo,
  canUndo,
  canRedo,
  flushPendingSnapshots,
}: KeyboardShortcutArgs) {
  useEffect(() => {
    if (!isActive) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase()
      const hasMeta = event.metaKey
      const hasCtrl = event.ctrlKey
      const modifierActive = hasMeta || hasCtrl

      if (!modifierActive) {
        return
      }

      if (key === 's') {
        if (!canSave) {
          return
        }

        event.preventDefault()
        flushPendingSnapshots()
        onSave()
        return
      }

      if (key === 'z') {
        if (event.shiftKey) {
          if (!canRedo) {
            return
          }

          event.preventDefault()
          flushPendingSnapshots()
          redo()
          return
        }

        if (!canUndo) {
          return
        }

        event.preventDefault()
        flushPendingSnapshots()
        undo()
        return
      }

      if (key === 'y' && hasCtrl && !hasMeta) {
        if (!canRedo) {
          return
        }

        event.preventDefault()
        flushPendingSnapshots()
        redo()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      flushPendingSnapshots()
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [canRedo, canSave, canUndo, flushPendingSnapshots, isActive, onSave, redo, undo])
}

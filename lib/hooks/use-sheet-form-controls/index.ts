'use client'

import type { FieldValues } from 'react-hook-form'

import { useHistoryKeyboardShortcuts } from './keyboard'
import { useFormHistory } from './history'
import type {
  UseSheetFormControlsOptions,
  UseSheetFormControlsReturn,
} from './types'

export function useSheetFormControls<T extends FieldValues>(
  options: UseSheetFormControlsOptions<T>
): UseSheetFormControlsReturn {
  const history = useFormHistory<T>({
    form: options.form,
    isActive: options.isActive,
    historyKey: options.historyKey,
    maxSnapshots: options.maxSnapshots,
    debounceMs: options.debounceMs,
    getExternalState: options.getExternalState,
    applyExternalState: options.applyExternalState,
  })

  useHistoryKeyboardShortcuts({
    isActive: options.isActive,
    canSave: options.canSave,
    onSave: options.onSave,
    undo: history.undo,
    redo: history.redo,
    canUndo: history.canUndo,
    canRedo: history.canRedo,
    flushPendingSnapshots: history.flushPendingSnapshots,
  })

  return {
    undo: history.undo,
    redo: history.redo,
    canUndo: history.canUndo,
    canRedo: history.canRedo,
    notifyExternalChange: history.notifyExternalChange,
  }
}

export type {
  UseSheetFormControlsOptions,
  UseSheetFormControlsReturn,
} from './types'

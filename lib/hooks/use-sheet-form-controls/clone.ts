import type { FieldValues } from 'react-hook-form'

export const cloneValues = <T extends FieldValues>(values: T): T => {
  if (typeof structuredClone === 'function') {
    return structuredClone(values)
  }

  return JSON.parse(JSON.stringify(values)) as T
}

export const cloneData = <T>(value: T): T => {
  if (value === undefined || value === null) {
    return value
  }

  if (typeof structuredClone === 'function') {
    return structuredClone(value)
  }

  return JSON.parse(JSON.stringify(value)) as T
}

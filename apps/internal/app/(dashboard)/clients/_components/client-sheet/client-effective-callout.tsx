'use client'

import type { UseFormReturn } from 'react-hook-form'

import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'
import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@pts/ui/select'

import type { ClientSheetFormValues } from '@/lib/settings/clients/client-sheet-schema'

/** "Sep 1, 2026"-style label for the first of the month `offset` months out. */
function formatMonthStart(offset: number): string {
  const now = new Date()
  const target = new Date(now.getFullYear(), now.getMonth() + offset, 1)
  return target.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

type EffectiveField = 'billingEffective' | 'commissionEffective'

type ClientEffectiveCalloutProps = {
  form: UseFormReturn<ClientSheetFormValues>
  name: EffectiveField
  title: string
  /** Note shown under the select, keyed by the chosen boundary. */
  notes: Record<ClientSheetFormValues[EffectiveField], string>
  isPending: boolean
  pendingReason: string
}

/**
 * The one shape for "when does this change take effect": a tinted callout
 * that appears under the field that changed, carrying the month-boundary
 * select and a single line explaining the consequence. Used for the billing
 * type and the commission assignment so the two read as the same thing.
 */
export function ClientEffectiveCallout({
  form,
  name,
  title,
  notes,
  isPending,
  pendingReason,
}: ClientEffectiveCalloutProps) {
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem className='bg-muted/40 gap-2 rounded-md border p-3'>
          <div className='flex items-center justify-between gap-3'>
            <span className='text-sm font-medium'>{title}</span>
            <Select
              value={field.value}
              onValueChange={field.onChange}
              disabled={isPending}
            >
              <FormControl>
                <DisabledFieldTooltip
                  disabled={isPending}
                  reason={isPending ? pendingReason : null}
                  className='w-auto'
                >
                  <SelectTrigger className='w-58 shrink-0'>
                    <SelectValue />
                  </SelectTrigger>
                </DisabledFieldTooltip>
              </FormControl>
              <SelectContent>
                <SelectItem value='next_month'>
                  Next month ({formatMonthStart(1)})
                </SelectItem>
                <SelectItem value='current_month'>
                  This month ({formatMonthStart(0)})
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <p className='text-muted-foreground text-xs'>{notes[field.value]}</p>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

'use client'

import { useState, useCallback, useMemo, useTransition } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Pencil, Plus } from 'lucide-react'

import { Button } from '@pts/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@pts/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@pts/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@pts/ui/select'
import { Switch } from '@pts/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@pts/ui/table'
import {
  SortableTableHead,
  type SortValue,
} from '@/components/table-toolbar/sortable-table-head'
import { useUnsavedChangesWarning } from '@/lib/hooks/use-unsaved-changes-warning'
import type { TaxRateRow } from '@/lib/queries/tax-rates'
import { US_STATES } from '@/lib/settings/clients/us-states'
import { FullWidthCell } from '@/components/table-toolbar/full-width-cell'

import { saveTaxRate, toggleTaxRateActiveAction } from '../actions'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DISCARD_TITLE = 'Discard changes?'
const DISCARD_DESCRIPTION =
  'You have unsaved tax rate changes that will be lost. Continue without saving?'

// ---------------------------------------------------------------------------
// Form Schema
// ---------------------------------------------------------------------------

const taxRateFormSchema = z.object({
  state: z.string().trim().min(1, 'State is required').max(50),
  rate: z.string().min(1, 'Rate is required'),
  label: z.string().trim().min(1, 'Label is required').max(100),
  isActive: z.boolean(),
})

type TaxRateFormValues = z.infer<typeof taxRateFormSchema>

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

type TaxRatesSectionProps = {
  initialRates: TaxRateRow[]
}

export function TaxRatesSection({ initialRates }: TaxRatesSectionProps) {
  const [rates, setRates] = useState(initialRates)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingRate, setEditingRate] = useState<TaxRateRow | null>(null)
  const [isPending, startTransition] = useTransition()
  // Local sort state (PRD 004 §03): two small config tables share this page,
  // so sort stays out of the URL. undefined = the 'label:asc' default.
  const [sort, setSort] = useState<SortValue | undefined>(undefined)

  const sortedRates = useMemo(() => {
    const factor = sort === 'label:desc' ? -1 : 1
    return [...rates].sort(
      (a, b) =>
        a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }) *
        factor
    )
  }, [rates, sort])

  const form = useForm<TaxRateFormValues>({
    resolver: zodResolver(taxRateFormSchema),
    defaultValues: {
      state: '',
      rate: '',
      label: '',
      isActive: true,
    },
  })

  const isActive = useWatch({ control: form.control, name: 'isActive' })
  const watchedState = useWatch({ control: form.control, name: 'state' })

  const { requestConfirmation, dialog: discardDialog } =
    useUnsavedChangesWarning({
      isDirty: form.formState.isDirty,
      title: DISCARD_TITLE,
      description: DISCARD_DESCRIPTION,
    })

  const handleDialogOpenChange = useCallback(
    (open: boolean) => {
      if (open) {
        setDialogOpen(true)
        return
      }
      requestConfirmation(() => setDialogOpen(false))
    },
    [requestConfirmation]
  )

  const openAddDialog = useCallback(() => {
    setEditingRate(null)
    form.reset({
      state: '',
      rate: '',
      label: '',
      isActive: true,
    })
    setDialogOpen(true)
  }, [form])

  const openEditDialog = useCallback(
    (rate: TaxRateRow) => {
      setEditingRate(rate)
      form.reset({
        state: rate.state,
        rate: (Number(rate.rate) * 100).toString(),
        label: rate.label,
        isActive: rate.is_active,
      })
      setDialogOpen(true)
    },
    [form]
  )

  const handleToggleActive = useCallback((rate: TaxRateRow) => {
    startTransition(async () => {
      const result = await toggleTaxRateActiveAction(
        rate.id,
        !rate.is_active
      )

      if (result.ok) {
        setRates(prev =>
          prev.map(r =>
            r.id === rate.id ? { ...r, is_active: !r.is_active } : r
          )
        )
      }
    })
  }, [])

  const onSubmit = useCallback(
    (values: TaxRateFormValues) => {
      startTransition(async () => {
        const rateDecimal = (Number(values.rate) / 100).toString()

        const result = await saveTaxRate({
          id: editingRate?.id,
          state: values.state,
          rate: rateDecimal,
          label: values.label,
          isActive: values.isActive,
        })

        if (result.ok) {
          setDialogOpen(false)
          if (editingRate) {
            setRates(prev =>
              prev.map(r =>
                r.id === editingRate.id
                  ? {
                      ...r,
                      state: values.state,
                      rate: rateDecimal,
                      label: values.label,
                      is_active: values.isActive,
                    }
                  : r
              )
            )
          } else {
            setRates(prev => [
              ...prev,
              {
                id: crypto.randomUUID(),
                state: values.state,
                rate: rateDecimal,
                label: values.label,
                is_active: values.isActive,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
            ])
          }
        }
      })
    },
    [editingRate]
  )

  return (
    <section className='space-y-4'>
      <div className='flex items-center justify-between'>
        <h2 className='text-lg font-semibold'>Tax Rates</h2>
        <Button size='sm' onClick={openAddDialog}>
          <Plus className='mr-1.5 h-4 w-4' />
          Add Tax Rate
        </Button>
      </div>

      <div className='rounded-lg border'>
        <Table density='compact' layout='fixed'>
          <TableHeader>
            <TableRow className='bg-muted/40'>
              <TableHead className='w-[max(5rem,7%)]'>State</TableHead>
              <TableHead className='w-[max(6rem,8%)]'>Rate (%)</TableHead>
              <SortableTableHead
                field='label'
                sort={sort}
                defaultSort='label:asc'
                onSortChange={setSort}
              >
                Label
              </SortableTableHead>
              <TableHead className='hidden w-[max(4rem,5%)] md:table-cell'>Active</TableHead>
              <TableHead className='w-12' />
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedRates.length === 0 ? (
              <TableRow>
                <FullWidthCell
                  counts={{ base: 4, md: 5 }}
                  className='text-muted-foreground py-8 text-center'
                >
                  No tax rates configured. Click &ldquo;Add Tax Rate&rdquo; to
                  get started.
                </FullWidthCell>
              </TableRow>
            ) : (
              sortedRates.map(rate => (
                <TableRow key={rate.id}>
                  <TableCell className='truncate font-medium'>{rate.state}</TableCell>
                  <TableCell className='truncate'>
                    {(Number(rate.rate) * 100).toFixed(2).replace(/\.?0+$/, '')}%
                  </TableCell>
                  <TableCell className='truncate'>{rate.label}</TableCell>
                  <TableCell className='hidden md:table-cell'>
                    <Switch
                      size='sm'
                      className='data-[state=checked]:bg-emerald-600'
                      checked={rate.is_active}
                      disabled={isPending}
                      onCheckedChange={() => handleToggleActive(rate)}
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      variant='ghost'
                      size='icon-sm'
                      className='h-7 w-7'
                      onClick={() => openEditDialog(rate)}
                    >
                      <Pencil className='h-3.5 w-3.5' />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Tax Rate Form Dialog */}
      <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingRate ? 'Edit Tax Rate' : 'Add Tax Rate'}
            </DialogTitle>
            <DialogDescription>
              {editingRate
                ? 'Update tax rate details.'
                : 'Add a new tax rate for invoicing.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-4'>
            <div className='flex items-center gap-3'>
              <Switch
                id='tax-is-active'
                className='data-[state=checked]:bg-emerald-600'
                checked={isActive}
                onCheckedChange={(checked: boolean) =>
                  form.setValue('isActive', checked, { shouldDirty: true })
                }
              />
              <Label htmlFor='tax-is-active' className='text-sm font-normal'>
                Active
              </Label>
            </div>

            <div className='space-y-2'>
              <Label htmlFor='tax-state'>State</Label>
              <Select
                value={watchedState}
                onValueChange={value => form.setValue('state', value, { shouldValidate: true, shouldDirty: true })}
              >
                <SelectTrigger id='tax-state'>
                  <SelectValue placeholder='Select state' />
                </SelectTrigger>
                <SelectContent align='start'>
                  {US_STATES.map(state => (
                    <SelectItem key={state.value} value={state.value}>
                      {state.label} ({state.value})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.state && (
                <p className='text-destructive text-sm'>
                  {form.formState.errors.state.message}
                </p>
              )}
            </div>

            <div className='space-y-2'>
              <Label htmlFor='tax-rate'>Rate (%)</Label>
              <Input
                id='tax-rate'
                placeholder='e.g., 8.25'
                {...form.register('rate')}
              />
              {form.formState.errors.rate && (
                <p className='text-destructive text-sm'>
                  {form.formState.errors.rate.message}
                </p>
              )}
            </div>

            <div className='space-y-2'>
              <Label htmlFor='tax-label'>Label</Label>
              <Input
                id='tax-label'
                placeholder='e.g., CA Sales Tax'
                {...form.register('label')}
              />
              {form.formState.errors.label && (
                <p className='text-destructive text-sm'>
                  {form.formState.errors.label.message}
                </p>
              )}
            </div>

            <DialogFooter>
              <Button
                type='button'
                variant='outline'
                onClick={() => handleDialogOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type='submit' disabled={isPending}>
                {isPending ? 'Saving...' : editingRate ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {discardDialog}
    </section>
  )
}

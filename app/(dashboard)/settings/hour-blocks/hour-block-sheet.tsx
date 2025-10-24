'use client'

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { useToast } from '@/components/ui/use-toast'
import type { Database } from '@/supabase/types/database'

import { saveHourBlock, softDeleteHourBlock } from './actions'
import { useUnsavedChangesWarning } from '@/lib/hooks/use-unsaved-changes-warning'

type HourBlockRow = Database['public']['Tables']['hour_blocks']['Row']
type ClientRow = Pick<
  Database['public']['Tables']['clients']['Row'],
  'id' | 'name' | 'deleted_at'
>

type HourBlockWithClient = HourBlockRow & { client: ClientRow | null }

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onComplete: () => void
  hourBlock: HourBlockWithClient | null
  clients: ClientRow[]
}

const invoicePattern = /^[A-Za-z0-9-]+$/

const formSchema = z.object({
  clientId: z.string().uuid('Select a client'),
  hoursPurchased: z.coerce
    .number()
    .int('Hours purchased must be a whole number.')
    .positive('Hours purchased must be greater than zero'),
  invoiceNumber: z
    .string()
    .trim()
    .optional()
    .refine(
      value => !value || value === '' || invoicePattern.test(value),
      'Invoice number may only contain letters, numbers, and dashes.'
    ),
})

type FormValues = z.infer<typeof formSchema>

const HOUR_BLOCK_FORM_FIELDS: Array<keyof FormValues> = [
  'clientId',
  'hoursPurchased',
  'invoiceNumber',
]

export function HourBlockSheet({
  open,
  onOpenChange,
  onComplete,
  hourBlock,
  clients,
}: Props) {
  const isEditing = Boolean(hourBlock)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const { toast } = useToast()
  const pendingReason = 'Please wait for the current request to finish.'
  const missingClientReason = 'Create a client before logging hour blocks.'

  const sortedClients = useMemo(
    () =>
      [...clients].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
      ),
    [clients]
  )

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema) as Resolver<FormValues>,
    defaultValues: {
      clientId: hourBlock?.client_id ?? sortedClients[0]?.id ?? '',
      hoursPurchased: hourBlock?.hours_purchased ?? 5,
      invoiceNumber: hourBlock?.invoice_number ?? '',
    },
  })

  const { requestConfirmation: confirmDiscard, dialog: unsavedChangesDialog } =
    useUnsavedChangesWarning({ isDirty: form.formState.isDirty })

  const resetFormState = useCallback(() => {
    form.reset({
      clientId: hourBlock?.client_id ?? sortedClients[0]?.id ?? '',
      hoursPurchased: hourBlock?.hours_purchased ?? 5,
      invoiceNumber: hourBlock?.invoice_number ?? '',
    })
    form.clearErrors()
    setFeedback(null)
  }, [form, hourBlock, sortedClients])

  const applyServerFieldErrors = (fieldErrors?: Record<string, string[]>) => {
    if (!fieldErrors) return

    HOUR_BLOCK_FORM_FIELDS.forEach(field => {
      const message = fieldErrors[field]?.[0]
      if (!message) return
      form.setError(field, { type: 'server', message })
    })
  }

  useEffect(() => {
    startTransition(() => {
      resetFormState()
    })
  }, [resetFormState, startTransition])

  const handleSheetOpenChange = (next: boolean) => {
    if (!next) {
      confirmDiscard(() => {
        startTransition(() => {
          resetFormState()
        })
        onOpenChange(false)
      })
      return
    }

    onOpenChange(next)
  }

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      setFeedback(null)
      form.clearErrors()

      const payload = {
        id: hourBlock?.id,
        clientId: values.clientId,
        hoursPurchased: values.hoursPurchased,
        invoiceNumber:
          values.invoiceNumber && values.invoiceNumber.trim().length > 0
            ? values.invoiceNumber.trim()
            : null,
      }

      const result = await saveHourBlock(payload)

      applyServerFieldErrors(result.fieldErrors)

      if (result.error) {
        setFeedback(result.error)
        toast({
          title: 'Unable to save hour block',
          description: result.error,
          variant: 'destructive',
        })
        return
      }

      toast({
        title: isEditing ? 'Hour block updated' : 'Hour block created',
        description: isEditing
          ? 'Changes saved successfully.'
          : 'The hour block is ready for tracking.',
      })

      resetFormState()
      onOpenChange(false)
      onComplete()
    })
  }

  const handleRequestDelete = () => {
    if (!hourBlock || hourBlock.deleted_at || isPending) {
      return
    }

    setIsDeleteDialogOpen(true)
  }

  const handleCancelDelete = () => {
    if (isPending) {
      return
    }

    setIsDeleteDialogOpen(false)
  }

  const handleConfirmDelete = () => {
    if (!hourBlock || hourBlock.deleted_at || isPending) {
      return
    }

    setIsDeleteDialogOpen(false)
    startTransition(async () => {
      setFeedback(null)
      form.clearErrors()
      const result = await softDeleteHourBlock({ id: hourBlock.id })

      if (result.error) {
        setFeedback(result.error)
        toast({
          title: 'Unable to delete hour block',
          description: result.error,
          variant: 'destructive',
        })
        return
      }

      toast({
        title: 'Hour block deleted',
        description:
          'It will be hidden from active tracking but remains available historically.',
      })

      onOpenChange(false)
      onComplete()
    })
  }

  const submitDisabled = isPending || (!isEditing && sortedClients.length === 0)
  const submitDisabledReason = submitDisabled
    ? isPending
      ? 'Please wait for the current request to finish.'
      : !isEditing && sortedClients.length === 0
        ? 'Create a client before logging hour blocks.'
        : null
    : null

  const deleteDisabled = isPending || Boolean(hourBlock?.deleted_at)
  const deleteDisabledReason =
    isEditing && deleteDisabled
      ? isPending
        ? 'Please wait for the current request to finish.'
        : hourBlock?.deleted_at
          ? 'This hour block is already deleted.'
          : null
      : null

  const submitLabel = isPending
    ? 'Saving...'
    : isEditing
      ? 'Save changes'
      : 'Create hour block'

  return (
    <>
      <Sheet open={open} onOpenChange={handleSheetOpenChange}>
        <SheetContent className='flex w-full flex-col gap-6 overflow-y-auto sm:max-w-2xl'>
          <SheetHeader className='px-6 pt-6'>
            <SheetTitle>
              {isEditing ? 'Edit hour block' : 'Add hour block'}
            </SheetTitle>
            <SheetDescription>
              {isEditing
                ? 'Adjust purchased hours or delete the block if it is no longer needed.'
                : 'Assign purchased hours to a client so the team can track usage.'}
            </SheetDescription>
          </SheetHeader>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className='flex flex-1 flex-col gap-5 px-6 pb-6'
            >
              <div className='grid gap-4 sm:grid-cols-2'>
                <FormField
                  control={form.control}
                  name='clientId'
                  render={({ field }) => {
                    const disabled = isPending || sortedClients.length === 0
                    const reason = disabled
                      ? isPending
                        ? pendingReason
                        : sortedClients.length === 0
                          ? missingClientReason
                          : null
                      : null

                    return (
                      <FormItem>
                        <FormLabel>Client</FormLabel>
                        <Select
                          value={field.value ?? ''}
                          onValueChange={field.onChange}
                          disabled={disabled}
                        >
                          <FormControl>
                            <DisabledFieldTooltip
                              disabled={disabled}
                              reason={reason}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder='Select client' />
                              </SelectTrigger>
                            </DisabledFieldTooltip>
                          </FormControl>
                          <SelectContent>
                            {sortedClients.map(client => (
                              <SelectItem key={client.id} value={client.id}>
                                {client.name}
                                {client.deleted_at ? ' (Deleted)' : ''}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )
                  }}
                />
                <FormField
                  control={form.control}
                  name='hoursPurchased'
                  render={({ field }) => {
                    const disabled = isPending
                    const reason = disabled ? pendingReason : null

                    return (
                      <FormItem>
                        <FormLabel>Hours purchased</FormLabel>
                        <FormControl>
                          <DisabledFieldTooltip
                            disabled={disabled}
                            reason={reason}
                          >
                            <Input
                              {...field}
                              value={field.value ?? ''}
                              type='number'
                              step='1'
                              min='1'
                              inputMode='numeric'
                              disabled={disabled}
                            />
                          </DisabledFieldTooltip>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )
                  }}
                />
              </div>
              <FormField
                control={form.control}
                name='invoiceNumber'
                render={({ field }) => {
                  const disabled = isPending
                  const reason = disabled ? pendingReason : null

                  return (
                    <FormItem>
                      <FormLabel>
                        Invoice #{' '}
                        <span className='text-muted-foreground text-xs'>
                          (optional)
                        </span>
                      </FormLabel>
                      <FormControl>
                        <DisabledFieldTooltip
                          disabled={disabled}
                          reason={reason}
                        >
                          <Input
                            {...field}
                            value={field.value ?? ''}
                            placeholder='INV-2025-01'
                            inputMode='text'
                            maxLength={64}
                            disabled={disabled}
                          />
                        </DisabledFieldTooltip>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )
                }}
              />
              {feedback ? (
                <p className='border-destructive/40 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm'>
                  {feedback}
                </p>
              ) : null}
              <SheetFooter className='flex items-center justify-end gap-3 px-0 pt-6 pb-0'>
                {isEditing ? (
                  <DisabledFieldTooltip
                    disabled={deleteDisabled}
                    reason={deleteDisabledReason}
                  >
                    <Button
                      type='button'
                      variant='destructive'
                      onClick={handleRequestDelete}
                      disabled={deleteDisabled}
                    >
                      <Trash2 className='h-4 w-4' /> Delete
                    </Button>
                  </DisabledFieldTooltip>
                ) : null}
                <DisabledFieldTooltip
                  disabled={submitDisabled}
                  reason={submitDisabledReason}
                >
                  <Button type='submit' disabled={submitDisabled}>
                    {submitLabel}
                  </Button>
                </DisabledFieldTooltip>
              </SheetFooter>
            </form>
          </Form>
        </SheetContent>
      </Sheet>
      <ConfirmDialog
        open={isDeleteDialogOpen}
        title='Delete hour block?'
        description='Deleting this block hides it from active reporting while keeping historical data intact.'
        confirmLabel='Delete'
        confirmVariant='destructive'
        confirmDisabled={isPending}
        onCancel={handleCancelDelete}
        onConfirm={handleConfirmDelete}
      />
      {unsavedChangesDialog}
    </>
  )
}

'use client'

import { useState, useCallback, useMemo, useTransition } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Pencil, Plus } from 'lucide-react'

import { Button } from '@pts/ui/button'
import { Checkbox } from '@pts/ui/checkbox'
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
import type { ProductCatalogItemRow } from '@/lib/queries/product-catalog'
import { FullWidthCell } from '@/components/table-toolbar/full-width-cell'

import { saveProductCatalogItem } from '../actions'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DISCARD_TITLE = 'Discard changes?'
const DISCARD_DESCRIPTION =
  'You have unsaved product changes that will be lost. Continue without saving?'

// ---------------------------------------------------------------------------
// Form Schema
// ---------------------------------------------------------------------------

const productFormSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  description: z.string().trim().max(500).optional().or(z.literal('')),
  unitPrice: z.string().min(1, 'Unit price is required'),
  unitLabel: z.string().trim().min(1, 'Unit label is required').max(50),
  createsHourBlockDefault: z.boolean(),
  isActive: z.boolean(),
  minQuantity: z.string().optional().or(z.literal('')),
})

type ProductFormValues = z.infer<typeof productFormSchema>

// ---------------------------------------------------------------------------
// Product Row
// ---------------------------------------------------------------------------

type ProductRowProps = {
  item: ProductCatalogItemRow
  onEdit: (item: ProductCatalogItemRow) => void
  onToggleActive: (item: ProductCatalogItemRow) => void
  isPending: boolean
}

function ProductRow({
  item,
  onEdit,
  onToggleActive,
  isPending,
}: ProductRowProps) {
  return (
    <TableRow>
      <TableCell className='truncate font-medium'>{item.name}</TableCell>
      <TableCell className='truncate'>${item.unit_price}</TableCell>
      <TableCell className='hidden truncate md:table-cell'>
        {item.unit_label}
      </TableCell>
      <TableCell className='hidden md:table-cell'>
        {item.min_quantity ?? '\u2014'}
      </TableCell>
      <TableCell className='hidden md:table-cell'>
        {item.creates_hour_block_default ? 'Yes' : 'No'}
      </TableCell>
      <TableCell>
        <Switch
          size='sm'
          className='data-[state=checked]:bg-emerald-600'
          checked={item.is_active}
          disabled={isPending}
          onCheckedChange={() => onToggleActive(item)}
        />
      </TableCell>
      <TableCell>
        <Button
          variant='ghost'
          size='icon-sm'
          className='h-7 w-7'
          onClick={() => onEdit(item)}
        >
          <Pencil className='h-3.5 w-3.5' />
        </Button>
      </TableCell>
    </TableRow>
  )
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

type ProductCatalogSectionProps = {
  initialItems: ProductCatalogItemRow[]
}

export function ProductCatalogSection({
  initialItems,
}: ProductCatalogSectionProps) {
  const [items, setItems] = useState(initialItems)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<ProductCatalogItemRow | null>(
    null
  )
  const [isPending, startTransition] = useTransition()
  // Local sort state (PRD 004 §03): two small config tables share this page,
  // so sort stays out of the URL. undefined = the 'name:asc' default.
  const [sort, setSort] = useState<SortValue | undefined>(undefined)

  const sortedItems = useMemo(() => {
    const factor = sort === 'name:desc' ? -1 : 1
    return [...items].sort(
      (a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }) *
        factor
    )
  }, [items, sort])

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      name: '',
      description: '',
      unitPrice: '',
      unitLabel: 'hour',
      createsHourBlockDefault: false,
      isActive: true,
      minQuantity: '',
    },
  })

  const isActive = useWatch({ control: form.control, name: 'isActive' })
  const createsHourBlockDefault = useWatch({ control: form.control, name: 'createsHourBlockDefault' })

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
    setEditingItem(null)
    form.reset({
      name: '',
      description: '',
      unitPrice: '',
      unitLabel: 'hour',
      createsHourBlockDefault: false,
      isActive: true,
      minQuantity: '',
    })
    setDialogOpen(true)
  }, [form])

  const openEditDialog = useCallback(
    (item: ProductCatalogItemRow) => {
      setEditingItem(item)
      form.reset({
        name: item.name,
        description: item.description ?? '',
        unitPrice: item.unit_price,
        unitLabel: item.unit_label,
        createsHourBlockDefault: item.creates_hour_block_default,
        isActive: item.is_active,
        minQuantity:
          item.min_quantity != null ? String(item.min_quantity) : '',
      })
      setDialogOpen(true)
    },
    [form]
  )

  const handleToggleActive = useCallback(
    (item: ProductCatalogItemRow) => {
      startTransition(async () => {
        const result = await saveProductCatalogItem({
          id: item.id,
          name: item.name,
          description: item.description,
          unitPrice: item.unit_price,
          unitLabel: item.unit_label,
          createsHourBlockDefault: item.creates_hour_block_default,
          isActive: !item.is_active,
          minQuantity: item.min_quantity,
          sortOrder: item.sort_order,
        })

        if (result.ok) {
          setItems(prev =>
            prev.map(p =>
              p.id === item.id ? { ...p, is_active: !p.is_active } : p
            )
          )
        }
      })
    },
    []
  )

  const onSubmit = useCallback(
    (values: ProductFormValues) => {
      startTransition(async () => {
        const minQty =
          values.minQuantity && values.minQuantity.trim() !== ''
            ? parseInt(values.minQuantity, 10)
            : null

        const result = await saveProductCatalogItem({
          id: editingItem?.id,
          name: values.name,
          description: values.description?.trim() || null,
          unitPrice: values.unitPrice,
          unitLabel: values.unitLabel,
          createsHourBlockDefault: values.createsHourBlockDefault,
          isActive: values.isActive,
          minQuantity: minQty,
          sortOrder: editingItem?.sort_order ?? items.length,
        })

        if (result.ok) {
          setDialogOpen(false)
          // Optimistic: update local state for edits, or append for new
          if (editingItem) {
            setItems(prev =>
              prev.map(p =>
                p.id === editingItem.id
                  ? {
                      ...p,
                      name: values.name,
                      description: values.description?.trim() || null,
                      unit_price: values.unitPrice,
                      unit_label: values.unitLabel,
                      creates_hour_block_default:
                        values.createsHourBlockDefault,
                      is_active: values.isActive,
                      min_quantity: minQty,
                    }
                  : p
              )
            )
          } else {
            // For new items we need the server to give us the ID,
            // so we rely on revalidation. Add a placeholder meanwhile.
            setItems(prev => [
              ...prev,
              {
                id: crypto.randomUUID(),
                name: values.name,
                description: values.description?.trim() || null,
                unit_price: values.unitPrice,
                unit_label: values.unitLabel,
                creates_hour_block_default: values.createsHourBlockDefault,
                is_active: values.isActive,
                min_quantity: minQty,
                sort_order: prev.length,
              },
            ])
          }
        }
      })
    },
    [editingItem, items.length]
  )

  return (
    <section className='space-y-4'>
      <div className='flex items-center justify-between'>
        <h2 className='text-lg font-semibold'>Product Catalog</h2>
        <Button size='sm' onClick={openAddDialog}>
          <Plus className='mr-1.5 h-4 w-4' />
          Add Product
        </Button>
      </div>

      <div className='rounded-lg border'>
        <Table density='compact' layout='fixed'>
          <TableHeader>
            <TableRow className='bg-muted/40'>
              <SortableTableHead
                field='name'
                sort={sort}
                defaultSort='name:asc'
                onSortChange={setSort}
              >
                Name
              </SortableTableHead>
              <TableHead className='w-24'>Unit Price</TableHead>
              <TableHead className='hidden md:table-cell'>Unit Label</TableHead>
              <TableHead className='hidden w-20 md:table-cell'>Min Qty</TableHead>
              <TableHead className='hidden w-24 md:table-cell'>
                Hour Block
              </TableHead>
              <TableHead className='w-16'>Active</TableHead>
              <TableHead className='w-12' />
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedItems.length === 0 ? (
              <TableRow>
                <FullWidthCell
                  counts={{ base: 4, md: 7 }}
                  className='text-muted-foreground py-8 text-center'
                >
                  No products yet. Click &ldquo;Add Product&rdquo; to get
                  started.
                </FullWidthCell>
              </TableRow>
            ) : (
              sortedItems.map(item => (
                <ProductRow
                  key={item.id}
                  item={item}
                  onEdit={openEditDialog}
                  onToggleActive={handleToggleActive}
                  isPending={isPending}
                />
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Product Form Dialog */}
      <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingItem ? 'Edit Product' : 'Add Product'}
            </DialogTitle>
            <DialogDescription>
              {editingItem
                ? 'Update product catalog item details.'
                : 'Add a new item to the product catalog.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-4'>
            <div className='flex items-center gap-3'>
              <Switch
                id='product-is-active'
                className='data-[state=checked]:bg-emerald-600'
                checked={isActive}
                onCheckedChange={(checked: boolean) =>
                  form.setValue('isActive', checked, { shouldDirty: true })
                }
              />
              <Label htmlFor='product-is-active' className='text-sm font-normal'>
                Active
              </Label>
            </div>

            <div className='space-y-2'>
              <Label htmlFor='product-name'>Name</Label>
              <Input
                id='product-name'
                placeholder='e.g., Development Hours'
                {...form.register('name')}
              />
              {form.formState.errors.name && (
                <p className='text-destructive text-sm'>
                  {form.formState.errors.name.message}
                </p>
              )}
            </div>

            <div className='space-y-2'>
              <Label htmlFor='product-description'>Description</Label>
              <Input
                id='product-description'
                placeholder='Optional description'
                {...form.register('description')}
              />
            </div>

            <div className='grid grid-cols-2 gap-4'>
              <div className='space-y-2'>
                <Label htmlFor='product-unit-price'>Unit Price</Label>
                <Input
                  id='product-unit-price'
                  placeholder='0.00'
                  {...form.register('unitPrice')}
                />
                {form.formState.errors.unitPrice && (
                  <p className='text-destructive text-sm'>
                    {form.formState.errors.unitPrice.message}
                  </p>
                )}
              </div>
              <div className='space-y-2'>
                <Label htmlFor='product-unit-label'>Unit Label</Label>
                <Input
                  id='product-unit-label'
                  placeholder='hour'
                  {...form.register('unitLabel')}
                />
                {form.formState.errors.unitLabel && (
                  <p className='text-destructive text-sm'>
                    {form.formState.errors.unitLabel.message}
                  </p>
                )}
              </div>
            </div>

            <div className='space-y-2'>
              <Label htmlFor='product-min-quantity'>
                Min Quantity (optional)
              </Label>
              <Input
                id='product-min-quantity'
                placeholder='e.g., 10'
                {...form.register('minQuantity')}
              />
            </div>

            <div className='flex items-start gap-3'>
              <Checkbox
                id='product-creates-hour-block'
                className='mt-0.5'
                checked={createsHourBlockDefault}
                onCheckedChange={(checked: boolean) =>
                  form.setValue('createsHourBlockDefault', checked === true, { shouldDirty: true })
                }
              />
              <div className='space-y-1'>
                <Label htmlFor='product-creates-hour-block' className='text-sm font-normal'>
                  Creates Hour Block
                </Label>
                <p className='text-muted-foreground text-xs'>
                  Automatically creates a prepaid hour block for the client when the invoice is paid.
                </p>
              </div>
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
                {isPending ? 'Saving...' : editingItem ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {discardDialog}
    </section>
  )
}

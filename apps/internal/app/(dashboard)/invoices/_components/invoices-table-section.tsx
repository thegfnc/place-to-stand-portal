'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { formatCalendarDate } from '@/lib/dates'
import {
  Archive,
  Building2,
  Check,
  Copy,
  ExternalLink,
  Link2,
  Loader2,
  RefreshCw,
  Trash2,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@pts/ui/button'
import { ConfirmDialog } from '@pts/ui/confirm-dialog'
import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'
import { SortableTableHead } from '@/components/table-toolbar/sortable-table-head'
import { useListParams } from '@/hooks/use-list-params'
import { isInvoiceSortValue } from '@/lib/invoices/filters'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@pts/ui/table'
import { useToast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'
import type { InvoiceWithClient } from '@/lib/invoices/invoice-form'
import { ARCHIVED_ROW_CLASS } from '@/lib/table/archived-row'
import {
  CLICKABLE_ROW_CLASS,
  getClickableRowProps,
} from '@/lib/table/clickable-row'

type InvoicesTableMode = 'active' | 'archive'

export type InvoicesTableSectionProps = {
  invoices: InvoiceWithClient[]
  mode: InvoicesTableMode
  isPending: boolean
  pendingReason: string
  pendingDeleteId: string | null
  pendingRestoreId: string | null
  pendingDestroyId: string | null
  onEdit: (invoice: InvoiceWithClient) => void
  onRequestDelete: (invoice: InvoiceWithClient) => void
  onRestore: (invoice: InvoiceWithClient) => void
  onRequestDestroy: (invoice: InvoiceWithClient) => void
  onSendInvoice: (invoiceId: string) => void
  onRefresh: () => void
  emptyMessage: string
  /** Route the sort/filter params live on (PRD 004 §03). */
  basePath: string
}

const formatCurrency = (value: string) => {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(Number(value))
  } catch {
    return value
  }
}

const formatDate = (value: string | null) => formatCalendarDate(value) ?? '\u2014'

function StatusBadge({ status }: { status: string }) {
  return (
    <div className='flex items-center gap-1.5'>
      {status === 'DRAFT' ? (
        <Badge variant='secondary' className='text-xs'>
          Draft
        </Badge>
      ) : status === 'SENT' ? (
        <Badge variant='default' className='text-xs'>
          Sent
        </Badge>
      ) : status === 'VIEWED' ? (
        <Badge
          variant='outline'
          className='border-transparent bg-amber-100 text-xs text-amber-800 dark:bg-amber-900/40 dark:text-amber-200'
        >
          Viewed
        </Badge>
      ) : status === 'PAID' ? (
        <Badge
          variant='outline'
          className='border-transparent bg-emerald-100 text-xs text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200'
        >
          Paid
        </Badge>
      ) : status === 'VOID' ? (
        <Badge variant='destructive' className='text-xs'>
          Void
        </Badge>
      ) : (
        <Badge variant='secondary' className='text-xs'>
          {status}
        </Badge>
      )}
    </div>
  )
}

function BillingTypeBadge() {
  return (
    <Badge
      variant='outline'
      className='border-transparent bg-amber-100 text-[10px] px-1.5 py-0 leading-4 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300'
    >
      Net 30
    </Badge>
  )
}

function ShareLinkCell({
  invoice,
  onSendInvoice,
  onRefresh,
}: {
  invoice: InvoiceWithClient
  onSendInvoice: (invoiceId: string) => void
  onRefresh: () => void
}) {
  const { toast } = useToast()
  const [copied, setCopied] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [showSendPrompt, setShowSendPrompt] = useState(false)

  const handleCopy = useCallback(() => {
    if (!invoice.share_token) return
    const url = `${window.location.origin}/share/invoices/${invoice.share_token}`
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [invoice.share_token])

  const handleGenerateLink = useCallback(async () => {
    setIsGenerating(true)
    try {
      const res = await fetch(`/api/invoices/${invoice.id}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const data = await res.json()
      if (data.ok) {
        toast({
          title: 'Sharing enabled',
          description: 'The invoice link is ready to share.',
        })
        if (invoice.status === 'DRAFT') {
          // Show dialog before refreshing — refresh would unmount the dialog
          setShowSendPrompt(true)
        } else {
          onRefresh()
        }
      } else {
        toast({
          variant: 'destructive',
          title: 'Failed to generate link',
          description: data.error ?? 'Please try again.',
        })
      }
    } catch {
      toast({
        variant: 'destructive',
        title: 'Failed to generate link',
        description: 'Network error. Please check your connection.',
      })
    } finally {
      setIsGenerating(false)
    }
  }, [invoice.id, invoice.status, toast, onRefresh])

  const handleConfirmSend = useCallback(() => {
    setShowSendPrompt(false)
    onSendInvoice(invoice.id)
    onRefresh()
  }, [invoice.id, onSendInvoice, onRefresh])

  const handleDeclineSend = useCallback(() => {
    setShowSendPrompt(false)
    onRefresh()
  }, [onRefresh])

  if (!invoice.share_enabled || !invoice.share_token) {
    return (
      <>
        <ConfirmDialog
          open={showSendPrompt}
          title='Mark invoice as sent?'
          description='The invoice must be marked as sent before the client can make a payment. Would you like to mark it as sent now?'
          confirmLabel='Mark as Sent'
          cancelLabel='Not Now'
          onConfirm={handleConfirmSend}
          onCancel={handleDeclineSend}
        />
        <Button
          size='sm'
          className='h-7 gap-1.5 px-3 text-xs'
          onClick={handleGenerateLink}
          disabled={isGenerating}
        >
          {isGenerating ? (
            <Loader2 className='h-3 w-3 animate-spin' />
          ) : (
            <Link2 className='h-3 w-3' />
          )}
          {isGenerating ? 'Generating...' : 'Generate Shareable Link'}
        </Button>
      </>
    )
  }

  const truncatedPath = `/share/invoices/${invoice.share_token.slice(0, 8)}...`

  const shareUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/share/invoices/${invoice.share_token}`

  return (
    <div className='flex min-w-0 items-center gap-1.5'>
      <span className='text-muted-foreground min-w-0 truncate text-xs font-mono'>
        {truncatedPath}
      </span>
      <Button
        variant='ghost'
        size='icon-sm'
        className='h-6 w-6 flex-shrink-0'
        onClick={handleCopy}
        title='Copy share link'
      >
        {copied ? (
          <Check className='h-3 w-3 text-green-600' />
        ) : (
          <Copy className='h-3 w-3' />
        )}
      </Button>
      <Button
        variant='ghost'
        size='icon-sm'
        className='h-6 w-6 flex-shrink-0'
        onClick={() => window.open(shareUrl, '_blank')}
        title='Open share link'
      >
        <ExternalLink className='h-3 w-3' />
      </Button>
    </div>
  )
}

export function InvoicesTableSection({
  invoices: invoiceList,
  mode,
  isPending,
  pendingReason,
  pendingDeleteId,
  pendingRestoreId,
  pendingDestroyId,
  onEdit,
  onRequestDelete,
  onRestore,
  onRequestDestroy,
  onSendInvoice,
  onRefresh,
  emptyMessage,
  basePath,
}: InvoicesTableSectionProps) {
  const { update, getParam } = useListParams({
    basePath,
    resetKeys: ['page'],
  })
  const rawSort = getParam('sort')
  const sort = rawSort && isInvoiceSortValue(rawSort) ? rawSort : undefined

  return (
    <div className='overflow-hidden rounded-lg border'>
      <Table density='compact' layout='fixed'>
        <TableHeader>
          <TableRow className='bg-muted/40'>
            <SortableTableHead
              field='number'
              sort={sort}
              defaultSort='created:desc'
              onSortChange={next => update({ sort: next })}
              className='w-[12%]'
            >
              Invoice #
            </SortableTableHead>
            <TableHead className='w-[18%]'>Client</TableHead>
            <TableHead className='w-[12%]'>Status</TableHead>
            <TableHead className='w-[10%]'>Total</TableHead>
            <SortableTableHead
              field='created'
              sort={sort}
              defaultSort='created:desc'
              onSortChange={next => update({ sort: next })}
              className='w-[20%]'
            >
              Issued
            </SortableTableHead>
            <TableHead>Share Link</TableHead>
            <TableHead className='w-28 text-right'>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invoiceList.map(invoice => {
            const client = invoice.client
            const isArchived = Boolean(invoice.deleted_at)
            const isDeleting = isPending && pendingDeleteId === invoice.id
            const isRestoring = isPending && pendingRestoreId === invoice.id
            const isDestroying = isPending && pendingDestroyId === invoice.id
            const isBusy = isDeleting || isRestoring || isDestroying

            const showArchive = mode === 'active'
            const showRestore = mode === 'archive'
            const showDestroy = mode === 'archive'

            const archiveDisabled = isBusy || isArchived
            const restoreDisabled = isBusy || !isArchived
            const destroyDisabled = isBusy || !isArchived

            const archiveDisabledReason = archiveDisabled
              ? isArchived
                ? 'Invoice already archived.'
                : pendingReason
              : null

            const restoreDisabledReason = restoreDisabled
              ? isArchived
                ? pendingReason
                : 'Invoice is already active.'
              : null

            const destroyDisabledReason = destroyDisabled
              ? !isArchived
                ? 'Archive the invoice before permanently deleting.'
                : pendingReason
              : null

            return (
              <TableRow
                key={invoice.id}
                {...getClickableRowProps(() => onEdit(invoice))}
                className={cn(
                  CLICKABLE_ROW_CLASS,
                  isArchived && ARCHIVED_ROW_CLASS
                )}
              >
                <TableCell className='text-sm font-medium'>
                  <div className='flex items-center gap-2'>
                    {invoice.invoice_number ? (
                      invoice.invoice_number
                    ) : (
                      <Badge variant='secondary' className='text-xs'>
                        Draft
                      </Badge>
                    )}
                    {invoice.billing_type === 'net_30' ? (
                      <BillingTypeBadge />
                    ) : null}
                  </div>
                </TableCell>
                <TableCell>
                  <div className='flex min-w-0 items-center gap-2 text-sm'>
                    <Building2 className='text-muted-foreground h-4 w-4 shrink-0' />
                    {client ? (
                      client.slug ? (
                        <Link
                          href={`/clients/${client.slug}`}
                          className='hover:text-foreground truncate hover:underline'
                        >
                          {client.name}
                        </Link>
                      ) : (
                        <span className='truncate'>{client.name}</span>
                      )
                    ) : (
                      <span>Unassigned</span>
                    )}
                  </div>
                  {client?.deleted_at ? (
                    <p className='text-destructive text-xs'>Client archived</p>
                  ) : null}
                </TableCell>
                <TableCell>
                  <StatusBadge status={invoice.status} />
                </TableCell>
                <TableCell className='text-sm'>
                  {formatCurrency(invoice.total)}
                </TableCell>
                <TableCell className='text-muted-foreground text-sm'>
                  {formatDate(invoice.issued_date)}
                </TableCell>
                <TableCell>
                  <ShareLinkCell
                    invoice={invoice}
                    onSendInvoice={onSendInvoice}
                    onRefresh={onRefresh}
                  />
                </TableCell>
                <TableCell className='text-right'>
                  <div className='flex justify-end gap-2'>
                    {showArchive ? (
                      <DisabledFieldTooltip
                        disabled={archiveDisabled}
                        reason={archiveDisabledReason}
                      >
                        <Button
                          variant='destructive'
                          size='icon-sm'
                          onClick={() => onRequestDelete(invoice)}
                          title='Archive invoice'
                          aria-label='Archive invoice'
                          disabled={archiveDisabled}
                        >
                          <Archive className='h-4 w-4' />
                          <span className='sr-only'>Archive</span>
                        </Button>
                      </DisabledFieldTooltip>
                    ) : null}
                    {showRestore ? (
                      <DisabledFieldTooltip
                        disabled={restoreDisabled}
                        reason={restoreDisabledReason}
                      >
                        <Button
                          variant='outline'
                          size='icon-sm'
                          onClick={() => onRestore(invoice)}
                          title='Restore invoice'
                          aria-label='Restore invoice'
                          disabled={restoreDisabled}
                        >
                          <RefreshCw className='h-4 w-4' />
                          <span className='sr-only'>Restore</span>
                        </Button>
                      </DisabledFieldTooltip>
                    ) : null}
                    {showDestroy ? (
                      <DisabledFieldTooltip
                        disabled={destroyDisabled}
                        reason={destroyDisabledReason}
                      >
                        <Button
                          variant='destructive'
                          size='icon-sm'
                          onClick={() => onRequestDestroy(invoice)}
                          title='Permanently delete invoice'
                          aria-label='Permanently delete invoice'
                          disabled={destroyDisabled}
                        >
                          <Trash2 className='h-4 w-4' />
                          <span className='sr-only'>Delete permanently</span>
                        </Button>
                      </DisabledFieldTooltip>
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            )
          })}
          {invoiceList.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={7}
                className='text-muted-foreground py-10 text-center text-sm'
              >
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </div>
  )
}

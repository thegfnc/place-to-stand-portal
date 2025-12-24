'use client'

import { useState } from 'react'
import { RefreshCw, Mail, Filter } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'
import type { EmailWithLinks } from '@/lib/queries/emails'
import { EmailDetailSheet } from './email-detail-sheet'

type FilterType = 'all' | 'linked' | 'unlinked'

type Props = {
  initialEmails: EmailWithLinks[]
  syncStatus: { connected: boolean; lastSyncAt: string | null; totalEmails: number }
  isAdmin: boolean
}

export function EmailsPanel({ initialEmails, syncStatus, isAdmin }: Props) {
  const { toast } = useToast()
  const [emails, setEmails] = useState(initialEmails)
  const [syncing, setSyncing] = useState(false)
  const [selectedEmail, setSelectedEmail] = useState<EmailWithLinks | null>(null)
  const [filter, setFilter] = useState<FilterType>('all')

  const handleSync = async () => {
    setSyncing(true)
    try {
      const res = await fetch('/api/integrations/gmail/sync', { method: 'POST' })
      const result = await res.json()

      if (res.ok) {
        toast({ title: 'Sync complete', description: `Synced ${result.synced} new emails.` })
        // Refresh list
        const listRes = await fetch('/api/emails')
        if (listRes.ok) {
          const data = await listRes.json()
          setEmails(data.emails)
        }
      } else {
        throw new Error(result.error || 'Sync failed')
      }
    } catch (err) {
      toast({ title: 'Sync failed', description: err instanceof Error ? err.message : 'Unknown error', variant: 'destructive' })
    } finally {
      setSyncing(false)
    }
  }

  const filteredEmails = emails.filter(email => {
    if (filter === 'linked') return email.links.length > 0
    if (filter === 'unlinked') return email.links.length === 0
    return true
  })

  const handleEmailUpdate = (updated: EmailWithLinks) => {
    setEmails(prev => prev.map(e => (e.id === updated.id ? updated : e)))
    setSelectedEmail(updated)
  }

  return (
    <div className='space-y-4'>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-4'>
          <Select value={filter} onValueChange={v => setFilter(v as FilterType)}>
            <SelectTrigger className='w-40'>
              <Filter className='mr-2 h-4 w-4' />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>All Emails</SelectItem>
              <SelectItem value='linked'>Linked</SelectItem>
              <SelectItem value='unlinked'>Unlinked</SelectItem>
            </SelectContent>
          </Select>
          <span className='text-sm text-muted-foreground'>
            {syncStatus.totalEmails} emails
            {syncStatus.lastSyncAt && (
              <> · Last sync {formatDistanceToNow(new Date(syncStatus.lastSyncAt))} ago</>
            )}
          </span>
        </div>
        {syncStatus.connected && (
          <Button onClick={handleSync} disabled={syncing} variant='outline' size='sm'>
            <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing...' : 'Sync Now'}
          </Button>
        )}
      </div>

      {/* Email Table */}
      {filteredEmails.length === 0 ? (
        <div className='rounded-lg border border-dashed p-8 text-center'>
          <Mail className='mx-auto h-8 w-8 text-muted-foreground' />
          <p className='mt-2 text-sm text-muted-foreground'>
            {!syncStatus.connected
              ? 'Connect Google in Settings to sync emails.'
              : filter === 'all'
                ? 'No emails synced yet. Click Sync Now to fetch emails.'
                : `No ${filter} emails found.`}
          </p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className='w-[200px]'>From</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead className='w-[150px]'>Linked To</TableHead>
              <TableHead className='w-[100px]'>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredEmails.map(email => (
              <TableRow
                key={email.id}
                className='cursor-pointer hover:bg-muted/50'
                onClick={() => setSelectedEmail(email)}
              >
                <TableCell>
                  <div className='font-medium truncate max-w-[180px]'>
                    {email.fromName || email.fromEmail}
                  </div>
                  {email.fromName && (
                    <div className='text-xs text-muted-foreground truncate max-w-[180px]'>
                      {email.fromEmail}
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  <div className='truncate max-w-[400px]'>{email.subject || '(no subject)'}</div>
                </TableCell>
                <TableCell>
                  {email.links.length > 0 ? (
                    <div className='flex flex-wrap gap-1'>
                      {email.links.slice(0, 2).map(link => (
                        <Badge key={link.id} variant='outline' className='text-xs'>
                          {link.client?.name || link.project?.name}
                        </Badge>
                      ))}
                      {email.links.length > 2 && (
                        <Badge variant='secondary' className='text-xs'>+{email.links.length - 2}</Badge>
                      )}
                    </div>
                  ) : (
                    <span className='text-muted-foreground text-sm'>—</span>
                  )}
                </TableCell>
                <TableCell className='text-sm text-muted-foreground'>
                  {formatDistanceToNow(new Date(email.receivedAt), { addSuffix: true })}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Detail Sheet */}
      <EmailDetailSheet
        email={selectedEmail}
        onClose={() => setSelectedEmail(null)}
        onUpdate={handleEmailUpdate}
        isAdmin={isAdmin}
      />
    </div>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { Link2, X, Building2, FolderKanban, Loader2 } from 'lucide-react'
import { format } from 'date-fns'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'
import type { EmailWithLinks } from '@/lib/queries/emails'

type Suggestion = { clientId: string; clientName: string; confidence: number; matchedContacts: string[] }
type SelectOption = { id: string; name: string }

type Props = {
  email: EmailWithLinks | null
  onClose: () => void
  onUpdate: (email: EmailWithLinks) => void
  isAdmin: boolean
}

export function EmailDetailSheet({ email, onClose, onUpdate, isAdmin }: Props) {
  const { toast } = useToast()
  const [clients, setClients] = useState<SelectOption[]>([])
  const [selectedClient, setSelectedClient] = useState<string>('')
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [linking, setLinking] = useState(false)

  // Load clients on mount
  useEffect(() => {
    fetch('/api/clients')
      .then(r => r.json())
      .then(data => setClients(Array.isArray(data) ? data : data.clients || []))
      .catch(() => {})
  }, [])

  // Load suggestions when email changes
  const emailId = email?.id
  useEffect(() => {
    if (!emailId) {
      setSuggestions([])
      return
    }
    fetch(`/api/emails/${emailId}/suggestions`)
      .then(r => r.json())
      .then(data => setSuggestions(data.suggestions || []))
      .catch(() => setSuggestions([]))
  }, [emailId])

  const handleLink = async (clientId: string) => {
    if (!email || !clientId) return

    setLinking(true)
    try {
      const res = await fetch('/api/emails/links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailMetadataId: email.id, clientId, source: 'MANUAL_LINK' }),
      })

      if (!res.ok) throw new Error('Failed to link')

      // Refresh email data
      const refreshRes = await fetch(`/api/emails/${email.id}`)
      if (refreshRes.ok) {
        const updated = await refreshRes.json()
        onUpdate(updated)
      }

      toast({ title: 'Email linked' })
      setSelectedClient('')
      // Remove from suggestions
      setSuggestions(prev => prev.filter(s => s.clientId !== clientId))
    } catch {
      toast({ title: 'Error', description: 'Failed to link email.', variant: 'destructive' })
    } finally {
      setLinking(false)
    }
  }

  const handleUnlink = async (linkId: string) => {
    if (!email) return

    try {
      await fetch(`/api/emails/links/${linkId}`, { method: 'DELETE' })

      const updated: EmailWithLinks = {
        ...email,
        links: email.links.filter(l => l.id !== linkId),
      }
      onUpdate(updated)
      toast({ title: 'Link removed' })
    } catch {
      toast({ title: 'Error', description: 'Failed to remove link.', variant: 'destructive' })
    }
  }

  if (!email) return null

  // Filter out already-linked clients from options
  const linkedClientIds = new Set(email.links.map(l => l.client?.id).filter(Boolean))
  const availableClients = clients.filter(c => !linkedClientIds.has(c.id))

  return (
    <Sheet open={!!email} onOpenChange={open => !open && onClose()}>
      <SheetContent className='w-[480px] sm:max-w-[480px] overflow-y-auto'>
        <SheetHeader>
          <SheetTitle className='text-lg pr-8'>{email.subject || '(no subject)'}</SheetTitle>
        </SheetHeader>

        <div className='mt-6 space-y-6'>
          {/* Email Metadata */}
          <div className='space-y-2 text-sm'>
            <div>
              <span className='text-muted-foreground'>From:</span>{' '}
              <span className='font-medium'>{email.fromName || email.fromEmail}</span>
              {email.fromName && <span className='text-muted-foreground'> ({email.fromEmail})</span>}
            </div>
            <div>
              <span className='text-muted-foreground'>Date:</span>{' '}
              {format(new Date(email.receivedAt), 'PPp')}
            </div>
            {email.snippet && (
              <div className='mt-3 p-3 bg-muted rounded-md text-muted-foreground text-sm'>
                {email.snippet}
              </div>
            )}
          </div>

          {/* Current Links */}
          <div>
            <h4 className='font-medium mb-2 flex items-center gap-2'>
              <Link2 className='h-4 w-4' /> Linked To
            </h4>
            {email.links.length === 0 ? (
              <p className='text-sm text-muted-foreground'>Not linked to any client.</p>
            ) : (
              <div className='space-y-2'>
                {email.links.map(link => (
                  <div key={link.id} className='flex items-center justify-between p-2 border rounded-md'>
                    <div className='flex items-center gap-2'>
                      {link.client ? (
                        <Building2 className='h-4 w-4 text-muted-foreground' />
                      ) : (
                        <FolderKanban className='h-4 w-4 text-muted-foreground' />
                      )}
                      <span>{link.client?.name || link.project?.name}</span>
                      <Badge variant='outline' className='text-xs'>
                        {link.source === 'AUTOMATIC'
                          ? `Auto (${Math.round(Number(link.confidence || 0) * 100)}%)`
                          : 'Manual'}
                      </Badge>
                    </div>
                    {isAdmin && (
                      <Button variant='ghost' size='icon' className='h-8 w-8' onClick={() => handleUnlink(link.id)}>
                        <X className='h-4 w-4' />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Suggestions */}
          {suggestions.length > 0 && (
            <div>
              <h4 className='font-medium mb-2'>Suggestions</h4>
              <div className='space-y-2'>
                {suggestions.map(s => (
                  <div key={s.clientId} className='flex items-center justify-between p-2 border rounded-md bg-muted/50'>
                    <div className='flex items-center gap-2'>
                      <Building2 className='h-4 w-4 text-muted-foreground' />
                      <span>{s.clientName}</span>
                      <Badge variant='secondary' className='text-xs'>
                        {Math.round(s.confidence * 100)}% match
                      </Badge>
                    </div>
                    <Button size='sm' variant='outline' onClick={() => handleLink(s.clientId)} disabled={linking}>
                      Link
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Manual Link */}
          {isAdmin && availableClients.length > 0 && (
            <div>
              <h4 className='font-medium mb-2'>Link to Client</h4>
              <div className='flex gap-2'>
                <Select value={selectedClient} onValueChange={setSelectedClient}>
                  <SelectTrigger className='flex-1'>
                    <SelectValue placeholder='Select a client...' />
                  </SelectTrigger>
                  <SelectContent>
                    {availableClients.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={() => handleLink(selectedClient)} disabled={!selectedClient || linking}>
                  {linking ? <Loader2 className='h-4 w-4 animate-spin' /> : 'Link'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

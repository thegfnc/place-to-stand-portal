"use client"

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

type ClientRow = { id: string; name: string }
type EmailRow = {
  id: string
  subject: string | null
  snippet: string | null
  fromEmail: string
  receivedAt: string
}

type LinkRow = {
  id: string
  clientId: string | null
  projectId: string | null
  source: string
  confidence: string | null
}

export function EmailCard({ email, clients }: { email: EmailRow; clients: ClientRow[] }) {
  const [linking, setLinking] = useState(false)
  const [matching, setMatching] = useState(false)
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)
  const [links, setLinks] = useState<LinkRow[]>([])

  async function refreshLinks() {
    const res = await fetch(`/api/emails/${email.id}/links`, { cache: 'no-store' })
    if (res.ok) {
      const json = await res.json()
      setLinks(json.links ?? [])
    }
  }

  useEffect(() => {
    void refreshLinks()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function runMatch() {
    setMatching(true)
    try {
      await fetch('/api/emails/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailMetadataId: email.id }),
      })
      await refreshLinks()
    } finally {
      setMatching(false)
    }
  }

  async function linkToClient() {
    if (!selectedClientId) return
    setLinking(true)
    try {
      await fetch('/api/emails/links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailMetadataId: email.id, clientId: selectedClientId, notes: 'dev link' }),
      })
      setSelectedClientId(null)
      await refreshLinks()
    } finally {
      setLinking(false)
    }
  }

  async function unlink(linkId: string) {
    await fetch(`/api/emails/links/${linkId}`, { method: 'DELETE' })
    await refreshLinks()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{email.subject || '(no subject)'}</CardTitle>
        <CardDescription>
          From: {email.fromEmail} • {new Date(email.receivedAt).toLocaleString()}
        </CardDescription>
        <div className="text-xs text-muted-foreground break-all">ID: {email.id}</div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-sm text-muted-foreground line-clamp-2">{email.snippet}</div>

        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={runMatch} disabled={matching}>
            {matching ? 'Matching…' : 'Run Auto-Match'}
          </Button>

          <Select value={selectedClientId ?? ''} onValueChange={setSelectedClientId}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Select client to link…" />
            </SelectTrigger>
            <SelectContent>
              {clients.map(c => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={linkToClient} disabled={!selectedClientId || linking}>
            {linking ? 'Linking…' : 'Link to Client'}
          </Button>
        </div>

        <div className="text-sm">Links:</div>
        {links.length === 0 ? (
          <div className="text-sm text-muted-foreground">No links yet.</div>
        ) : (
          <ul className="text-sm space-y-1">
            {links.map(link => {
              const clientName = link.clientId ? clients.find(c => c.id === link.clientId)?.name : undefined
              return (
                <li key={link.id} className="flex items-center justify-between">
                  <span>
                    {link.clientId ? `Client: ${clientName ?? link.clientId}` : ''}
                    {link.projectId ? ` • Project: ${link.projectId}` : ''}
                    {link.source ? ` • Source: ${link.source}` : ''}
                    {link.confidence ? ` • Conf: ${link.confidence}` : ''}
                  </span>
                  <Button size="sm" variant="outline" onClick={() => unlink(link.id)}>
                    Unlink
                  </Button>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

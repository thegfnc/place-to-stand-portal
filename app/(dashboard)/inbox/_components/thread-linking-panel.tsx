'use client'

import { useState } from 'react'
import {
  Building2,
  X,
  Loader2,
  Sparkles,
  Link2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import type { ThreadSummary } from '@/lib/types/messages'

type Client = {
  id: string
  name: string
}

type Suggestion = {
  clientId: string
  clientName: string
  confidence: number
  matchedContacts: string[]
  reasoning?: string
  matchType?: 'EXACT_EMAIL' | 'DOMAIN' | 'CONTENT' | 'CONTEXTUAL'
}

type ThreadLinkingPanelProps = {
  thread: ThreadSummary
  clients: Client[]
  suggestions: Suggestion[]
  suggestionsLoading: boolean
  isLinking: boolean
  onLinkClient: (clientId: string) => void
  onUnlinkClient: () => void
}

export function ThreadLinkingPanel({
  thread,
  clients,
  suggestions,
  suggestionsLoading,
  isLinking,
  onLinkClient,
  onUnlinkClient,
}: ThreadLinkingPanelProps) {
  const [selectedClient, setSelectedClient] = useState('')
  const [isManualOpen, setIsManualOpen] = useState(false)

  // Filter out already-linked client from options
  const availableClients = thread.client
    ? clients.filter(c => c.id !== thread.client?.id)
    : clients

  const handleLinkFromSuggestion = (clientId: string) => {
    onLinkClient(clientId)
    setSelectedClient('')
  }

  const handleLinkFromManual = () => {
    if (selectedClient) {
      onLinkClient(selectedClient)
      setSelectedClient('')
      setIsManualOpen(false)
    }
  }

  return (
    <div className='space-y-4'>
      {/* Section Header */}
      <div className='flex items-center gap-2'>
        <Link2 className='text-muted-foreground h-4 w-4' />
        <span className='text-sm font-medium'>Client Association</span>
      </div>

      {/* Current Link Status */}
      {thread.client ? (
        <div className='bg-muted/30 rounded-lg border p-3'>
          <div className='flex items-center justify-between'>
            <div className='flex items-center gap-2'>
              <Building2 className='text-muted-foreground h-4 w-4' />
              <span className='font-medium'>{thread.client.name}</span>
              <Badge variant='secondary' className='text-xs'>
                Linked
              </Badge>
            </div>
            <Button
              variant='ghost'
              size='icon'
              className='h-7 w-7'
              onClick={onUnlinkClient}
              disabled={isLinking}
            >
              {isLinking ? (
                <Loader2 className='h-4 w-4 animate-spin' />
              ) : (
                <X className='h-4 w-4' />
              )}
            </Button>
          </div>
        </div>
      ) : (
        <>
          {/* AI Suggestions */}
          <div className='space-y-2'>
            <div className='text-muted-foreground flex items-center gap-2 text-xs'>
              <Sparkles className='h-3 w-3' />
              <span>Suggestions</span>
            </div>

            {suggestionsLoading ? (
              <div className='bg-muted/30 flex items-center gap-2 rounded-lg border p-3'>
                <Loader2 className='text-muted-foreground h-4 w-4 animate-spin' />
                <span className='text-muted-foreground text-sm'>
                  Analyzing...
                </span>
              </div>
            ) : suggestions.length > 0 ? (
              <div className='space-y-2'>
                {suggestions.map(s => (
                  <div
                    key={s.clientId}
                    className='bg-muted/30 rounded-lg border p-3'
                  >
                    <div className='flex items-center justify-between'>
                      <div className='flex items-center gap-2'>
                        <Building2 className='text-muted-foreground h-4 w-4' />
                        <span className='text-sm font-medium'>
                          {s.clientName}
                        </span>
                        <Badge
                          variant={
                            s.confidence >= 0.8 ? 'default' : 'secondary'
                          }
                          className='text-xs'
                        >
                          {Math.round(s.confidence * 100)}%
                        </Badge>
                      </div>
                      <Button
                        size='sm'
                        variant='outline'
                        className='h-7 text-xs'
                        onClick={() => handleLinkFromSuggestion(s.clientId)}
                        disabled={isLinking}
                      >
                        {isLinking ? (
                          <Loader2 className='h-3 w-3 animate-spin' />
                        ) : (
                          'Link'
                        )}
                      </Button>
                    </div>
                    {s.reasoning && (
                      <p className='text-muted-foreground mt-1.5 text-xs italic'>
                        {s.reasoning}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className='text-muted-foreground text-sm'>
                No client matches found.
              </p>
            )}
          </div>

          {/* Manual Link - Collapsible */}
          {availableClients.length > 0 && (
            <Collapsible open={isManualOpen} onOpenChange={setIsManualOpen}>
              <CollapsibleTrigger asChild>
                <Button
                  variant='ghost'
                  size='sm'
                  className='text-muted-foreground w-full justify-between text-xs'
                >
                  <span>Link manually</span>
                  {isManualOpen ? (
                    <ChevronUp className='h-3 w-3' />
                  ) : (
                    <ChevronDown className='h-3 w-3' />
                  )}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className='pt-2'>
                <div className='flex gap-2'>
                  <Select
                    value={selectedClient}
                    onValueChange={setSelectedClient}
                  >
                    <SelectTrigger className='h-8 flex-1 text-sm'>
                      <SelectValue placeholder='Select client...' />
                    </SelectTrigger>
                    <SelectContent>
                      {availableClients.map(client => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size='sm'
                    className='h-8'
                    onClick={handleLinkFromManual}
                    disabled={!selectedClient || isLinking}
                  >
                    {isLinking ? (
                      <Loader2 className='h-4 w-4 animate-spin' />
                    ) : (
                      'Link'
                    )}
                  </Button>
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}
        </>
      )}
    </div>
  )
}

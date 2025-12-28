'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { formatDistanceToNow, format } from 'date-fns'
import {
  Mail,
  RefreshCw,
  CheckCircle,
  Circle,
  Building2,
  FolderKanban,
  ArrowLeft,
  ArrowRight,
  Filter,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'

import { AppShellHeader } from '@/components/layout/app-shell'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'
import type { ThreadSummary, Message } from '@/lib/types/messages'

import { EmailIframe } from './email-iframe'
import { ThreadLinkingPanel } from './thread-linking-panel'
import { ThreadSuggestionsPanel } from './thread-suggestions-panel'

type FilterType = 'all' | 'linked' | 'unlinked'

const ROWS_PER_PAGE = 25

/**
 * Sanitize email HTML for safe display in iframe
 * - Proxies external images through our API to bypass CORS/referrer issues
 * - Removes potentially dangerous elements
 */
function sanitizeEmailHtml(html: string): string {
  return html
    // Proxy external images through our API
    .replace(
      /<img\s+([^>]*?)src=["']((https?:\/\/[^"']+))["']([^>]*)>/gi,
      (_match, before, src, _fullSrc, after) => {
        const proxiedSrc = `/api/emails/image-proxy?url=${encodeURIComponent(src)}`
        return `<img ${before}src="${proxiedSrc}" loading="lazy"${after}>`
      }
    )
    // Remove script tags
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    // Remove onclick and similar event handlers
    .replace(/\s+on\w+="[^"]*"/gi, '')
    .replace(/\s+on\w+='[^']*'/gi, '')
}

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

type InboxPanelProps = {
  threads: ThreadSummary[]
  syncStatus: {
    connected: boolean
    lastSyncAt: string | null
    totalMessages: number
    unread: number
  }
  clients: Client[]
  isAdmin: boolean
}

export function InboxPanel({ threads: initialThreads, syncStatus, clients, isAdmin }: InboxPanelProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()

  const [threads, setThreads] = useState(initialThreads)
  const [isSyncing, setIsSyncing] = useState(false)
  const [selectedThread, setSelectedThread] = useState<ThreadSummary | null>(null)
  const [threadMessages, setThreadMessages] = useState<Message[]>([])
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const [filter, setFilter] = useState<FilterType>('all')
  const [isLinking, setIsLinking] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)

  // AI Suggestions state (for client matching)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [suggestionsLoading, setSuggestionsLoading] = useState(false)

  // Filter threads
  const filteredThreads = useMemo(() => {
    return threads.filter(thread => {
      if (filter === 'linked') return !!thread.client
      if (filter === 'unlinked') return !thread.client
      return true
    })
  }, [threads, filter])

  // Pagination
  const totalPages = Math.ceil(filteredThreads.length / ROWS_PER_PAGE)
  const paginatedThreads = useMemo(() => {
    const start = (currentPage - 1) * ROWS_PER_PAGE
    return filteredThreads.slice(start, start + ROWS_PER_PAGE)
  }, [filteredThreads, currentPage])

  // Reset to page 1 when filter changes
  useEffect(() => {
    setCurrentPage(1)
  }, [filter])

  // Handle URL-based thread selection on mount and URL changes
  useEffect(() => {
    const threadId = searchParams.get('thread')
    if (threadId) {
      const thread = threads.find(t => t.id === threadId)
      if (thread && (!selectedThread || selectedThread.id !== threadId)) {
        handleThreadClick(thread, false) // Don't update URL since it's already set
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, threads])

  const handleSync = async () => {
    setIsSyncing(true)
    try {
      const res = await fetch('/api/integrations/gmail/sync', { method: 'POST' })
      if (res.ok) {
        toast({ title: 'Sync complete', description: 'Emails synced successfully.' })
        window.location.reload()
      }
    } catch {
      toast({ title: 'Sync failed', variant: 'destructive' })
    } finally {
      setIsSyncing(false)
    }
  }

  const handleThreadClick = useCallback(async (thread: ThreadSummary, updateUrl = true) => {
    setSelectedThread(thread)
    setIsLoadingMessages(true)
    setThreadMessages([])
    setSuggestions([])

    // Update URL with thread ID
    if (updateUrl) {
      const params = new URLSearchParams(searchParams.toString())
      params.set('thread', thread.id)
      router.push(`/inbox?${params.toString()}`, { scroll: false })
    }

    try {
      const res = await fetch(`/api/threads/${thread.id}/messages`)
      if (res.ok) {
        const data = await res.json()
        setThreadMessages(data.messages || [])

        // Mark as read if there are unread messages
        const hasUnread = (data.messages || []).some((m: Message) => !m.isRead)
        if (hasUnread) {
          // Fire and forget - don't block UI
          fetch(`/api/threads/${thread.id}/read`, { method: 'POST' }).then(() => {
            // Update local thread state to show as read
            setThreads(prev =>
              prev.map(t =>
                t.id === thread.id && t.latestMessage
                  ? { ...t, latestMessage: { ...t.latestMessage, isRead: true } }
                  : t
              )
            )
            // Also update messages state
            setThreadMessages(prev => prev.map(m => ({ ...m, isRead: true })))
          })
        }
      }
    } catch (err) {
      console.error('Failed to load messages:', err)
    } finally {
      setIsLoadingMessages(false)
    }
  }, [router, searchParams])

  // Load AI suggestions when thread changes and has no client
  useEffect(() => {
    if (!selectedThread || selectedThread.client) {
      setSuggestions([])
      return
    }

    setSuggestionsLoading(true)
    fetch(`/api/threads/${selectedThread.id}/suggestions`)
      .then(r => r.json())
      .then(data => setSuggestions(data.suggestions || []))
      .catch(() => setSuggestions([]))
      .finally(() => setSuggestionsLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedThread?.id, selectedThread?.client])

  const handleCloseSheet = useCallback(() => {
    setSelectedThread(null)
    setThreadMessages([])
    setSuggestions([])

    // Remove thread from URL
    const params = new URLSearchParams(searchParams.toString())
    params.delete('thread')
    const newUrl = params.toString() ? `/inbox?${params.toString()}` : '/inbox'
    router.push(newUrl, { scroll: false })
  }, [router, searchParams])

  const handleLinkClient = async (clientId: string) => {
    if (!selectedThread) return

    setIsLinking(true)
    try {
      const res = await fetch(`/api/threads/${selectedThread.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId }),
      })

      if (res.ok) {
        const client = clients.find(c => c.id === clientId)

        // Update local state
        const updatedThread: ThreadSummary = {
          ...selectedThread,
          client: client ? { id: client.id, name: client.name } : null,
        }
        setSelectedThread(updatedThread)
        setThreads(prev => prev.map(t => (t.id === selectedThread.id ? updatedThread : t)))
        setSuggestions([]) // Clear suggestions after linking

        toast({ title: 'Thread linked to client' })
      } else {
        throw new Error('Failed to link')
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to link thread.', variant: 'destructive' })
    } finally {
      setIsLinking(false)
    }
  }

  const handleUnlinkClient = async () => {
    if (!selectedThread) return

    setIsLinking(true)
    try {
      const res = await fetch(`/api/threads/${selectedThread.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: null }),
      })

      if (res.ok) {
        const updatedThread: ThreadSummary = {
          ...selectedThread,
          client: null,
        }
        setSelectedThread(updatedThread)
        setThreads(prev => prev.map(t => (t.id === selectedThread.id ? updatedThread : t)))

        toast({ title: 'Client unlinked' })
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to unlink.', variant: 'destructive' })
    } finally {
      setIsLinking(false)
    }
  }

  // Navigate between threads
  const currentIndex = selectedThread ? filteredThreads.findIndex(t => t.id === selectedThread.id) : -1
  const canGoPrev = currentIndex > 0
  const canGoNext = currentIndex < filteredThreads.length - 1

  const goToPrev = () => {
    if (canGoPrev) handleThreadClick(filteredThreads[currentIndex - 1])
  }

  const goToNext = () => {
    if (canGoNext) handleThreadClick(filteredThreads[currentIndex + 1])
  }

  return (
    <>
      <AppShellHeader>
        <h1 className='text-2xl font-semibold tracking-tight'>Inbox</h1>
        <p className='text-muted-foreground text-sm'>
          View and manage synced communications.
        </p>
      </AppShellHeader>

      {/* Main Container with Background */}
      <section className='bg-background rounded-xl border p-6 shadow-sm'>
        <div className='space-y-4'>
          {/* Header Row */}
          <div className='flex flex-wrap items-center gap-4'>
            <Select value={filter} onValueChange={v => setFilter(v as FilterType)}>
              <SelectTrigger className='w-40'>
                <Filter className='mr-2 h-4 w-4' />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>All Threads</SelectItem>
                <SelectItem value='linked'>Linked</SelectItem>
                <SelectItem value='unlinked'>Unlinked</SelectItem>
              </SelectContent>
            </Select>

            <div className='flex items-center gap-2 text-sm text-muted-foreground'>
              {syncStatus.connected ? (
                <CheckCircle className='h-4 w-4 text-green-500' />
              ) : (
                <Circle className='h-4 w-4' />
              )}
              <span>{filteredThreads.length} threads</span>
              {syncStatus.unread > 0 && (
                <Badge variant='secondary' className='text-xs'>
                  {syncStatus.unread} unread
                </Badge>
              )}
            </div>

            <div className='ml-auto flex items-center gap-4'>
              {syncStatus.lastSyncAt && (
                <span className='text-xs text-muted-foreground'>
                  Last sync {formatDistanceToNow(new Date(syncStatus.lastSyncAt))} ago
                </span>
              )}
              {syncStatus.connected && (
                <Button variant='outline' size='sm' onClick={handleSync} disabled={isSyncing}>
                  <RefreshCw className={cn('mr-2 h-4 w-4', isSyncing && 'animate-spin')} />
                  {isSyncing ? 'Syncing...' : 'Sync Now'}
                </Button>
              )}
            </div>
          </div>

          {/* Thread List */}
          {filteredThreads.length === 0 ? (
            <div className='flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center'>
              <Mail className='mb-4 h-12 w-12 text-muted-foreground' />
              <h3 className='text-lg font-medium'>No threads found</h3>
              <p className='mt-1 text-sm text-muted-foreground'>
                {!syncStatus.connected
                  ? 'Connect Gmail in Settings → Integrations to get started'
                  : filter === 'all'
                    ? 'Click "Sync Now" to fetch your emails'
                    : `No ${filter} threads found.`}
              </p>
            </div>
          ) : (
            <>
              <div className='rounded-lg border overflow-hidden'>
                {paginatedThreads.map((thread, idx) => (
                  <ThreadRow
                    key={thread.id}
                    thread={thread}
                    isSelected={selectedThread?.id === thread.id}
                    isFirst={idx === 0}
                    onClick={() => handleThreadClick(thread)}
                  />
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className='flex items-center justify-between pt-2'>
                  <p className='text-sm text-muted-foreground'>
                    Showing {((currentPage - 1) * ROWS_PER_PAGE) + 1}–{Math.min(currentPage * ROWS_PER_PAGE, filteredThreads.length)} of {filteredThreads.length}
                  </p>
                  <div className='flex items-center gap-1'>
                    <Button
                      variant='outline'
                      size='sm'
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className='h-4 w-4' />
                      <span className='sr-only'>Previous</span>
                    </Button>
                    <div className='flex items-center gap-1 px-2'>
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum: number
                        if (totalPages <= 5) {
                          pageNum = i + 1
                        } else if (currentPage <= 3) {
                          pageNum = i + 1
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i
                        } else {
                          pageNum = currentPage - 2 + i
                        }
                        return (
                          <Button
                            key={pageNum}
                            variant={currentPage === pageNum ? 'default' : 'ghost'}
                            size='sm'
                            className='h-8 w-8 p-0'
                            onClick={() => setCurrentPage(pageNum)}
                          >
                            {pageNum}
                          </Button>
                        )
                      })}
                    </div>
                    <Button
                      variant='outline'
                      size='sm'
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      <ChevronRight className='h-4 w-4' />
                      <span className='sr-only'>Next</span>
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {/* Thread Detail Sheet - Two Column Layout (rendered via portal) */}
      <Sheet open={!!selectedThread} onOpenChange={(open) => !open && handleCloseSheet()}>
        <SheetContent className='flex h-full w-full flex-col overflow-hidden p-0 sm:max-w-4xl lg:max-w-5xl'>
          {/* Custom Header - Outside the scroll area */}
          <div className='flex-shrink-0 border-b-2 border-b-blue-500/60 bg-muted/50 px-6 pt-4 pb-3'>
            <div className='flex items-start justify-between gap-4'>
              <div className='min-w-0 flex-1 pr-10'>
                <SheetTitle className='line-clamp-2 text-lg'>
                  {selectedThread?.subject || '(no subject)'}
                </SheetTitle>
                <SheetDescription className='mt-1'>
                  {selectedThread?.messageCount} message{selectedThread?.messageCount !== 1 && 's'}
                  {selectedThread?.lastMessageAt && (
                    <> · {format(new Date(selectedThread.lastMessageAt), 'PPp')}</>
                  )}
                </SheetDescription>
              </div>
              {/* Navigation arrows - positioned to avoid close button */}
              <div className='flex items-center gap-1 flex-shrink-0'>
                <Button
                  variant='ghost'
                  size='icon'
                  onClick={goToPrev}
                  disabled={!canGoPrev}
                  className='h-8 w-8'
                  title='Previous thread'
                >
                  <ArrowLeft className='h-4 w-4' />
                </Button>
                <Button
                  variant='ghost'
                  size='icon'
                  onClick={goToNext}
                  disabled={!canGoNext}
                  className='h-8 w-8'
                  title='Next thread'
                >
                  <ArrowRight className='h-4 w-4' />
                </Button>
              </div>
            </div>
          </div>

          {/* Two Column Content */}
          <div className='flex min-h-0 flex-1'>
            {/* Left Column - Email Messages */}
            <div className='flex-1 overflow-y-auto border-r'>
              <div className='p-6'>
                {isLoadingMessages ? (
                  <div className='flex items-center justify-center py-12'>
                    <RefreshCw className='h-6 w-6 animate-spin text-muted-foreground' />
                  </div>
                ) : threadMessages.length === 0 ? (
                  <div className='flex items-center justify-center py-12 text-muted-foreground'>
                    No messages found
                  </div>
                ) : (
                  <div className='space-y-6'>
                    {threadMessages.map((message) => (
                      <MessageCard key={message.id} message={message} />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right Column - Metadata & Actions */}
            <div className='w-80 flex-shrink-0 overflow-y-auto bg-muted/20 lg:w-96'>
              <div className='space-y-6 p-6'>
                {/* Client Linking Section */}
                {isAdmin && selectedThread && (
                  <ThreadLinkingPanel
                    thread={selectedThread}
                    clients={clients}
                    suggestions={suggestions}
                    suggestionsLoading={suggestionsLoading}
                    isLinking={isLinking}
                    onLinkClient={handleLinkClient}
                    onUnlinkClient={handleUnlinkClient}
                  />
                )}

                {isAdmin && selectedThread && (
                  <>
                    <Separator />
                    {/* AI Task/PR Suggestions */}
                    <ThreadSuggestionsPanel
                      threadId={selectedThread.id}
                      isAdmin={isAdmin}
                    />
                  </>
                )}
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}

function ThreadRow({
  thread,
  isSelected,
  isFirst,
  onClick,
}: {
  thread: ThreadSummary
  isSelected: boolean
  isFirst: boolean
  onClick: () => void
}) {
  const latestMessage = thread.latestMessage
  const isUnread = latestMessage && !latestMessage.isRead

  return (
    <button
      type='button'
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors cursor-pointer',
        'hover:bg-muted/60',
        isUnread && 'bg-blue-50/50 dark:bg-blue-950/20 hover:bg-blue-100/50 dark:hover:bg-blue-950/40',
        isSelected && 'bg-muted ring-1 ring-inset ring-border',
        !isFirst && 'border-t border-border/50'
      )}
    >
      {/* Unread indicator */}
      <div className='flex-shrink-0 w-2'>
        {isUnread && <div className='h-2 w-2 rounded-full bg-blue-500' />}
      </div>

      {/* Center: Sender, count, timestamp / Subject */}
      <div className='min-w-0 flex-1'>
        <div className='flex items-center gap-2'>
          <span className={cn('text-sm truncate', isUnread ? 'font-semibold' : 'font-medium')}>
            {latestMessage?.fromName || latestMessage?.fromEmail || 'Unknown'}
          </span>
          {thread.messageCount > 1 && (
            <Badge variant='secondary' className='text-xs tabular-nums flex-shrink-0'>
              {thread.messageCount}
            </Badge>
          )}
          <span className='text-xs text-muted-foreground whitespace-nowrap tabular-nums flex-shrink-0'>
            {thread.lastMessageAt
              ? formatDistanceToNow(new Date(thread.lastMessageAt), { addSuffix: false })
              : ''}
          </span>
        </div>
        <div className={cn(
          'text-sm truncate',
          isUnread ? 'text-foreground' : 'text-muted-foreground'
        )}>
          {thread.subject || '(no subject)'}
        </div>
      </div>

      {/* Right: Client badge */}
      {thread.client && (
        <Badge
          variant='default'
          className='flex-shrink-0 text-xs font-medium bg-blue-100 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/50 dark:text-blue-300 border-0'
        >
          <Building2 className='mr-1 h-3 w-3' />
          <span className='truncate max-w-[100px]'>{thread.client.name}</span>
        </Badge>
      )}

      {/* Far right: Project badge */}
      {thread.project && (
        <Badge
          variant='default'
          className='flex-shrink-0 text-xs font-medium bg-violet-100 text-violet-700 hover:bg-violet-100 dark:bg-violet-900/50 dark:text-violet-300 border-0'
        >
          <FolderKanban className='mr-1 h-3 w-3' />
          <span className='truncate max-w-[100px]'>{thread.project.name}</span>
        </Badge>
      )}
    </button>
  )
}

function MessageCard({ message }: { message: Message }) {
  const [isExpanded, setIsExpanded] = useState(true)

  return (
    <div className='rounded-lg border bg-card'>
      {/* Header */}
      <button
        type='button'
        onClick={() => setIsExpanded(!isExpanded)}
        className='flex w-full items-start justify-between p-4 text-left hover:bg-muted/50'
      >
        <div className='min-w-0 flex-1'>
          <div className='flex items-center gap-2'>
            <span className='font-medium'>
              {message.fromName || message.fromEmail}
            </span>
            {message.isInbound ? (
              <Badge variant='secondary' className='text-xs'>Received</Badge>
            ) : (
              <Badge variant='outline' className='text-xs'>Sent</Badge>
            )}
          </div>
          {message.fromName && message.fromEmail && (
            <div className='mt-0.5 text-xs text-muted-foreground'>
              {message.fromEmail}
            </div>
          )}
          <div className='mt-1 text-sm text-muted-foreground'>
            To: {message.toEmails?.join(', ') || 'Unknown'}
          </div>
        </div>
        <div className='text-xs text-muted-foreground'>
          {format(new Date(message.sentAt), 'MMM d, yyyy h:mm a')}
        </div>
      </button>

      {/* Snippet preview when collapsed */}
      {!isExpanded && message.snippet && (
        <div className='border-t px-4 py-2 text-sm text-muted-foreground'>
          {message.snippet}
        </div>
      )}

      {/* Body - Using iframe for style isolation */}
      {isExpanded && (
        <>
          <Separator />
          <div className='p-4'>
            {message.bodyHtml ? (
              <EmailIframe html={sanitizeEmailHtml(message.bodyHtml)} />
            ) : message.bodyText ? (
              <pre className='whitespace-pre-wrap text-sm'>{message.bodyText}</pre>
            ) : message.snippet ? (
              <p className='text-sm text-muted-foreground'>{message.snippet}</p>
            ) : (
              <p className='text-sm italic text-muted-foreground'>No content</p>
            )}
          </div>
        </>
      )}
    </div>
  )
}

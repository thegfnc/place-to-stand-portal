'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ExternalLink, Loader2, Plus, Trash2 } from 'lucide-react'

import { Button } from '@pts/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@pts/ui/dialog'
import { ConfirmDialog } from '@pts/ui/confirm-dialog'
import { IntegrationProviderIcon } from '@/components/integrations/provider-icon'
import { integrationStatusQueryKey } from '@/components/integrations/token-integration-card'
import {
  SearchableCombobox,
  type SearchableComboboxGroup,
} from '@/components/ui/searchable-combobox'
import { toast } from '@/components/ui/use-toast'
import {
  INTEGRATION_PROVIDERS,
  formatIntegrationLinkLabel,
  type ExternalProjectOption,
  type IntegrationProvider,
  type ProjectIntegrationLink,
} from '@/lib/types/integrations'

/**
 * A link chosen in the picker but not yet saved. Mirrors the shape the
 * sheet state hook sends to `POST /api/projects/[id]/integration-links`.
 */
export type PendingIntegrationLink = {
  provider: IntegrationProvider
  externalId: string
  externalName: string
  ownerName: string | null
}

type IntegrationLinksSectionProps = {
  provider: IntegrationProvider
  projectId?: string
  disabled?: boolean
  // Controlled by the parent so undo/redo can snapshot it. Arrays hold
  // every provider's changes; this section filters to its own.
  pendingLinks: PendingIntegrationLink[]
  removedLinkIds: Set<string>
  onPendingLinksChange: (links: PendingIntegrationLink[]) => void
  onRemovedLinkIdsChange: (ids: Set<string>) => void
}

const rowClasses =
  'bg-muted/40 flex items-center justify-between rounded-md border px-3 py-2'

async function fetchJson<T>(url: string, fallbackError: string): Promise<T> {
  const res = await fetch(url)
  const body = (await res.json().catch(() => ({}))) as T & { error?: string }
  if (!res.ok) {
    throw new Error(body.error ?? fallbackError)
  }
  return body
}

export function IntegrationLinksSection({
  provider,
  projectId,
  disabled,
  pendingLinks,
  removedLinkIds,
  onPendingLinksChange,
  onRemovedLinkIdsChange,
}: IntegrationLinksSectionProps) {
  const config = INTEGRATION_PROVIDERS[provider]
  const isCreateMode = !projectId

  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [unlinkConfirm, setUnlinkConfirm] =
    useState<ProjectIntegrationLink | null>(null)
  const [pendingRemoveConfirm, setPendingRemoveConfirm] =
    useState<PendingIntegrationLink | null>(null)

  const statusQuery = useQuery({
    queryKey: integrationStatusQueryKey(provider),
    queryFn: () =>
      fetchJson<{ connected: boolean }>(
        `/api/integrations/${config.slug}/status`,
        `Could not check ${config.label} status`
      ),
  })
  const isConnected = statusQuery.data?.connected ?? false

  const linksQuery = useQuery({
    queryKey: ['projectIntegrationLinks', projectId],
    enabled: Boolean(projectId),
    queryFn: () =>
      fetchJson<{ data: ProjectIntegrationLink[] }>(
        `/api/projects/${projectId}/integration-links`,
        'Could not load linked projects'
      ),
  })
  const links = useMemo(
    () =>
      (linksQuery.data?.data ?? []).filter(link => link.provider === provider),
    [linksQuery.data, provider]
  )

  const ownPending = useMemo(
    () => pendingLinks.filter(link => link.provider === provider),
    [pendingLinks, provider]
  )
  const activeLinks = links.filter(link => !removedLinkIds.has(link.id))
  const removedLinks = links.filter(link => removedLinkIds.has(link.id))

  const optionsQuery = useQuery({
    queryKey: ['integrationProjects', provider],
    enabled: dialogOpen && isConnected,
    queryFn: () =>
      fetchJson<{ data: ExternalProjectOption[] }>(
        `/api/integrations/${config.slug}/projects`,
        `Could not load ${config.label} projects`
      ),
  })

  const options = useMemo(() => {
    const taken = new Set([
      ...links.map(link => link.externalId),
      ...ownPending.map(link => link.externalId),
    ])
    return (optionsQuery.data?.data ?? []).filter(
      option => !taken.has(option.externalId)
    )
  }, [optionsQuery.data, links, ownPending])

  const optionGroups = useMemo<SearchableComboboxGroup[]>(() => {
    const byOwner = new Map<string, ExternalProjectOption[]>()
    options.forEach(option => {
      const key = option.ownerName ?? 'Other'
      byOwner.set(key, [...(byOwner.get(key) ?? []), option])
    })
    return Array.from(byOwner.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([label, items]) => ({
        label,
        items: items.map(option => ({
          value: option.externalId,
          label: option.externalName,
          keywords: [option.ownerName ?? '', option.ownerSlug ?? ''],
        })),
      }))
  }, [options])

  const handleDialogOpenChange = (open: boolean) => {
    setDialogOpen(open)
    if (!open) setSelectedId(null)
  }

  const handleAdd = () => {
    const option = options.find(candidate => candidate.externalId === selectedId)
    if (!option) return
    onPendingLinksChange([
      ...pendingLinks,
      {
        provider,
        externalId: option.externalId,
        externalName: option.externalName,
        ownerName: option.ownerName,
      },
    ])
    toast({
      title: `${config.label} project added`,
      description: `${option.externalName} will be linked when you save.`,
    })
    handleDialogOpenChange(false)
  }

  const handleRemovePending = () => {
    if (!pendingRemoveConfirm) return
    onPendingLinksChange(
      pendingLinks.filter(
        link =>
          !(
            link.provider === provider &&
            link.externalId === pendingRemoveConfirm.externalId
          )
      )
    )
    setPendingRemoveConfirm(null)
  }

  const handleUnlink = () => {
    if (!unlinkConfirm) return
    onRemovedLinkIdsChange(new Set([...removedLinkIds, unlinkConfirm.id]))
    setUnlinkConfirm(null)
    toast({
      title: `${config.label} project marked for removal`,
      description: 'The change will be applied when you save.',
    })
  }

  const heading = `${config.label} Projects`

  if (statusQuery.isSuccess && !isConnected) {
    return (
      <div className='space-y-1'>
        <h3 className='text-sm font-medium'>{heading}</h3>
        <div className='rounded-lg border border-dashed p-4 text-center'>
          <IntegrationProviderIcon
            provider={provider}
            className='text-muted-foreground mx-auto h-5 w-5'
          />
          <p className='text-muted-foreground mt-2 text-sm'>
            Connect your {config.label} account in Settings to link{' '}
            {config.projectNoun}s.
          </p>
          <Button variant='outline' size='sm' className='mt-3' asChild>
            <a href='/settings/integrations'>Go to Integrations</a>
          </Button>
        </div>
      </div>
    )
  }

  if (statusQuery.isPending || (!isCreateMode && linksQuery.isPending)) {
    return (
      <div className='space-y-1'>
        <h3 className='text-sm font-medium'>{heading}</h3>
        <div className='text-muted-foreground flex items-center gap-2 text-sm'>
          <Loader2 className='h-4 w-4 animate-spin' />
          Loading linked {config.projectNoun}s...
        </div>
      </div>
    )
  }

  const isEmpty =
    activeLinks.length === 0 &&
    ownPending.length === 0 &&
    removedLinks.length === 0

  return (
    <div className='space-y-1'>
      <div className='flex items-center justify-between gap-3'>
        <h3 className='text-sm font-medium'>{heading}</h3>
        <Button
          type='button'
          variant='ghost'
          size='xs'
          onClick={() => handleDialogOpenChange(true)}
          disabled={disabled}
          aria-label={`Link ${config.label} ${config.projectNoun}`}
        >
          <Plus className='h-4 w-4' />
        </Button>
      </div>

      {isEmpty ? (
        <div className='rounded-lg border border-dashed p-4 text-center'>
          <IntegrationProviderIcon
            provider={provider}
            className='text-muted-foreground mx-auto h-6 w-6'
          />
          <p className='text-muted-foreground mt-2 text-sm'>
            {isCreateMode
              ? `No ${config.label} ${config.projectNoun}s selected. Add one to link when you save.`
              : `No ${config.label} ${config.projectNoun}s linked.`}
          </p>
        </div>
      ) : (
        <div className='space-y-2'>
          {activeLinks.map(link => (
            <div key={link.id} className={rowClasses}>
              <div className='flex min-w-0 flex-col gap-1'>
                <div className='flex items-center gap-2 text-sm'>
                  <IntegrationProviderIcon
                    provider={provider}
                    className='text-muted-foreground h-4 w-4'
                  />
                  <a
                    href={link.url}
                    target='_blank'
                    rel='noopener noreferrer'
                    className='truncate hover:underline'
                  >
                    {link.externalName}
                    <ExternalLink className='text-muted-foreground ml-1 inline h-3 w-3' />
                  </a>
                </div>
                {link.ownerName ? (
                  <div className='text-muted-foreground pl-6 text-xs'>
                    {link.ownerName}
                  </div>
                ) : null}
              </div>
              <Button
                type='button'
                variant='ghost'
                size='icon'
                className='text-muted-foreground hover:text-destructive h-7 w-7 shrink-0'
                onClick={() => setUnlinkConfirm(link)}
                disabled={disabled}
                aria-label={`Remove ${link.externalName}`}
              >
                <Trash2 className='h-4 w-4' />
              </Button>
            </div>
          ))}
          {ownPending.map(link => (
            <div key={`pending-${link.externalId}`} className={rowClasses}>
              <div className='flex min-w-0 flex-col gap-1'>
                <div className='flex items-center gap-2 text-sm'>
                  <IntegrationProviderIcon
                    provider={provider}
                    className='text-muted-foreground h-4 w-4'
                  />
                  <span className='truncate'>
                    {formatIntegrationLinkLabel(link)}
                  </span>
                </div>
                <div className='pl-6 text-xs text-amber-600'>Pending save</div>
              </div>
              <Button
                type='button'
                variant='ghost'
                size='icon'
                className='text-muted-foreground hover:text-destructive h-7 w-7 shrink-0'
                onClick={() => setPendingRemoveConfirm(link)}
                disabled={disabled}
                aria-label={`Remove ${link.externalName}`}
              >
                <Trash2 className='h-4 w-4' />
              </Button>
            </div>
          ))}
          {removedLinks.map(link => (
            <div
              key={`removed-${link.id}`}
              className={`${rowClasses} opacity-60`}
            >
              <div className='flex min-w-0 flex-col gap-1'>
                <div className='flex items-center gap-2 text-sm line-through'>
                  <IntegrationProviderIcon
                    provider={provider}
                    className='text-muted-foreground h-4 w-4'
                  />
                  <span className='truncate'>
                    {formatIntegrationLinkLabel(link)}
                  </span>
                </div>
                <div className='pl-6 text-xs text-red-600'>Pending removal</div>
              </div>
              <Button
                type='button'
                variant='ghost'
                size='icon'
                className='text-muted-foreground h-7 w-7 shrink-0'
                onClick={() => {
                  const next = new Set(removedLinkIds)
                  next.delete(link.id)
                  onRemovedLinkIdsChange(next)
                }}
                disabled={disabled}
                aria-label='Undo removal'
                title='Undo removal'
              >
                <span className='text-xs'>Undo</span>
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Add {config.label} {config.projectNoun}
            </DialogTitle>
          </DialogHeader>
          <div className='space-y-4 pt-4'>
            {optionsQuery.isPending || optionsQuery.isFetching ? (
              <div className='text-muted-foreground flex items-center gap-2 text-sm'>
                <Loader2 className='h-4 w-4 animate-spin' />
                Loading {config.projectNoun}s...
              </div>
            ) : optionsQuery.isError ? (
              <p className='text-destructive text-sm'>
                {optionsQuery.error.message}
              </p>
            ) : (
              <SearchableCombobox
                groups={optionGroups}
                value={selectedId ?? ''}
                onChange={setSelectedId}
                searchPlaceholder={`Search ${config.label} ${config.projectNoun}s...`}
                emptyMessage={`No ${config.projectNoun}s found`}
              />
            )}
            <div className='flex justify-end gap-2'>
              <Button
                variant='outline'
                onClick={() => handleDialogOpenChange(false)}
              >
                Cancel
              </Button>
              <Button onClick={handleAdd} disabled={!selectedId}>
                Add {config.projectNoun}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!pendingRemoveConfirm}
        title={`Remove ${config.projectNoun}?`}
        description={`Remove ${pendingRemoveConfirm?.externalName} from the list?`}
        confirmLabel='Remove'
        cancelLabel='Cancel'
        confirmVariant='destructive'
        onConfirm={handleRemovePending}
        onCancel={() => setPendingRemoveConfirm(null)}
      />

      <ConfirmDialog
        open={!!unlinkConfirm}
        title={`Remove ${config.projectNoun}?`}
        description={`Remove ${unlinkConfirm?.externalName}? The change will be applied when you save.`}
        confirmLabel='Remove'
        cancelLabel='Cancel'
        confirmVariant='destructive'
        onConfirm={handleUnlink}
        onCancel={() => setUnlinkConfirm(null)}
      />
    </div>
  )
}

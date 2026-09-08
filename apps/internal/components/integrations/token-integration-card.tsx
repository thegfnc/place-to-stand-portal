'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ExternalLink } from 'lucide-react'

import { Button } from '@pts/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@pts/ui/dialog'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { toast } from '@/components/ui/use-toast'
import {
  ConnectedAccountsList,
  type ConnectedAccount,
} from '@/components/integrations/connected-accounts-list'
import { IntegrationProviderIcon } from '@/components/integrations/provider-icon'
import {
  INTEGRATION_PROVIDERS,
  type IntegrationProvider,
} from '@/lib/types/integrations'

type StatusResponse = {
  connected: boolean
  accounts: Array<{
    id: string
    email: string | null
    displayName: string | null
    status: string
    connectedAt: string
    metadata: Record<string, unknown>
  }>
}

export const integrationStatusQueryKey = (provider: IntegrationProvider) =>
  ['integrationStatus', provider] as const

/**
 * Settings card for a token-based provider (Vercel, Supabase). Unlike the
 * OAuth cards there is no redirect: the staff member pastes a personal
 * access token, which we validate against the provider and store encrypted.
 */
export function TokenIntegrationCard({
  provider,
  description,
}: {
  provider: IntegrationProvider
  description: string
}) {
  const config = INTEGRATION_PROVIDERS[provider]
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [token, setToken] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: integrationStatusQueryKey(provider),
    queryFn: async () => {
      const res = await fetch(`/api/integrations/${config.slug}/status`)
      if (!res.ok) throw new Error(`Failed to fetch ${config.label} status`)
      return (await res.json()) as StatusResponse
    },
  })

  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: integrationStatusQueryKey(provider),
    })

  const connect = useMutation({
    mutationFn: async (nextToken: string) => {
      const res = await fetch(`/api/integrations/${config.slug}/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: nextToken }),
      })
      const body = (await res.json()) as {
        ok?: boolean
        error?: string
        data?: { displayName: string | null }
      }
      if (!res.ok || !body.ok) {
        throw new Error(body.error ?? `Could not connect ${config.label}`)
      }
      return body.data
    },
    onSuccess: async account => {
      toast({
        title: `${config.label} account connected`,
        description: account?.displayName ?? undefined,
      })
      setToken('')
      setDialogOpen(false)
      await invalidate()
    },
    onError: (error: unknown) => {
      toast({
        title: 'Connection failed',
        description: error instanceof Error ? error.message : String(error),
        variant: 'destructive',
      })
    },
  })

  const disconnect = useMutation({
    mutationFn: async (connectionId: string) => {
      const res = await fetch(`/api/integrations/${config.slug}/disconnect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionId }),
      })
      if (!res.ok) throw new Error('Failed to disconnect')
    },
    onSuccess: async () => {
      // Personal tokens have no revocation API: the portal has dropped its
      // copy, but the token itself stays valid until deleted at the provider.
      toast({
        title: `${config.label} account disconnected`,
        description: `The token is still valid in ${config.label}. Delete it from your ${config.label} account settings to fully revoke it.`,
      })
      await invalidate()
    },
    onError: (error: unknown) => {
      toast({
        title: 'Disconnect failed',
        description: error instanceof Error ? error.message : String(error),
        variant: 'destructive',
      })
    },
  })

  const accounts: ConnectedAccount[] = (data?.accounts ?? []).map(account => ({
    id: account.id,
    email: account.email,
    displayName: account.displayName,
    status: account.status,
    connectedAt: account.connectedAt,
  }))

  const openDialog = () => setDialogOpen(true)

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (token.trim().length === 0 || connect.isPending) return
    connect.mutate(token.trim())
  }

  return (
    <>
      <Card>
        <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
          <div className='flex flex-col space-y-1.5'>
            <CardTitle className='flex items-center gap-2'>
              <IntegrationProviderIcon provider={provider} className='h-5 w-5' />
              {config.label}
            </CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className='text-muted-foreground text-sm'>
              Checking status...
            </div>
          ) : accounts.length > 0 ? (
            <ConnectedAccountsList
              provider={config.slug as 'vercel' | 'supabase'}
              accounts={accounts}
              onDisconnect={async id => disconnect.mutateAsync(id)}
              onAddAccount={openDialog}
            />
          ) : (
            <div className='flex items-center justify-between'>
              <span className='text-muted-foreground text-sm'>
                Not connected
              </span>
              <Button variant='outline' onClick={openDialog}>
                Connect {config.label} Account
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Connect {config.label}</DialogTitle>
            <DialogDescription>
              Paste a personal access token. It reaches every {config.ownerNoun}{' '}
              your {config.label} account belongs to, and is stored encrypted.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className='space-y-4 pt-2'>
            <div className='space-y-2'>
              <label
                htmlFor={`${config.slug}-token`}
                className='text-sm font-medium'
              >
                Access token
              </label>
              <Input
                id={`${config.slug}-token`}
                type='password'
                autoComplete='off'
                spellCheck={false}
                placeholder={config.tokenPlaceholder}
                value={token}
                onChange={event => setToken(event.target.value)}
                disabled={connect.isPending}
              />
              <a
                href={config.tokenSettingsUrl}
                target='_blank'
                rel='noopener noreferrer'
                className='text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs'
              >
                Create a token in {config.label}
                <ExternalLink className='h-3 w-3' />
              </a>
            </div>
            <div className='flex justify-end gap-2'>
              <Button
                type='button'
                variant='outline'
                onClick={() => setDialogOpen(false)}
                disabled={connect.isPending}
              >
                Cancel
              </Button>
              <Button
                type='submit'
                disabled={connect.isPending || token.trim().length === 0}
              >
                {connect.isPending ? 'Verifying...' : 'Connect'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}

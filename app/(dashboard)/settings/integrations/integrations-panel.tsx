'use client'

import { siGithub, siSupabase, siVercel } from 'simple-icons/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { toast } from '@/components/ui/use-toast'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  ConnectedAccountsList,
  type ConnectedAccount,
} from '@/components/integrations/connected-accounts-list'

function SimpleIcon({
  icon,
  className,
  color,
}: {
  icon: { title: string; path: string; hex: string }
  className?: string
  color?: string
}) {
  return (
    <svg
      role='img'
      viewBox='0 0 24 24'
      className={className}
      xmlns='http://www.w3.org/2000/svg'
      fill={color || 'currentColor'}
    >
      <title>{icon.title}</title>
      <path d={icon.path} />
    </svg>
  )
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox='0 0 24 24'
      xmlns='http://www.w3.org/2000/svg'
    >
      <path
        d='M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z'
        fill='#4285F4'
      />
      <path
        d='M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z'
        fill='#34A853'
      />
      <path
        d='M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.26.81-.58z'
        fill='#FBBC05'
      />
      <path
        d='M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z'
        fill='#EA4335'
      />
    </svg>
  )
}

const OAUTH_MESSAGES: Record<
  string,
  { title: string; description?: string; variant?: 'destructive' }
> = {
  google_connected: {
    title: 'Connected',
    description: 'Google account connected successfully.',
  },
  github_connected: {
    title: 'Connected',
    description: 'GitHub account connected successfully.',
  },
  access_denied: {
    title: 'Access Denied',
    description: 'You denied access to the account.',
    variant: 'destructive',
  },
  invalid_request: {
    title: 'Invalid Request',
    description: 'OAuth request failed. Please try again.',
    variant: 'destructive',
  },
  invalid_state: {
    title: 'Security Error',
    description: 'State validation failed. Please try again.',
    variant: 'destructive',
  },
  oauth_failed: {
    title: 'Connection Failed',
    description: 'Failed to connect account.',
    variant: 'destructive',
  },
}

interface AccountsResponse {
  connected: boolean
  accounts: Array<{
    id: string
    email: string | null
    displayName: string | null
    status: string
    login?: string
    scopes: string[]
    lastSyncAt: string | null
    connectedAt: string
    metadata: {
      picture?: string
      avatar_url?: string
      name?: string
      login?: string
    }
  }>
}

export function IntegrationsPanel() {
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const [isRedirectingGoogle, setIsRedirectingGoogle] = useState(false)
  const [isRedirectingGitHub, setIsRedirectingGitHub] = useState(false)

  useEffect(() => {
    const success = searchParams.get('success')
    const error = searchParams.get('error')
    const key = success || error

    if (key && OAUTH_MESSAGES[key]) {
      const msg = OAUTH_MESSAGES[key]
      toast({
        title: msg.title,
        description: msg.description,
        variant: msg.variant,
      })
      window.history.replaceState({}, '', '/settings/integrations')
    }
  }, [searchParams])

  // Google accounts query
  const { data: googleData, isLoading: googleLoading } = useQuery({
    queryKey: ['googleIntegrationStatus'],
    queryFn: async () => {
      const res = await fetch('/api/integrations/google/status')
      if (!res.ok) throw new Error('Failed to fetch Google status')
      return (await res.json()) as AccountsResponse
    },
  })

  // GitHub accounts query
  const { data: githubData, isLoading: githubLoading } = useQuery({
    queryKey: ['githubIntegrationStatus'],
    queryFn: async () => {
      const res = await fetch('/api/integrations/github/status')
      if (!res.ok) throw new Error('Failed to fetch GitHub status')
      return (await res.json()) as AccountsResponse
    },
  })

  // Google disconnect mutation
  const disconnectGoogle = useMutation({
    mutationFn: async (connectionId: string) => {
      const res = await fetch('/api/integrations/google/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionId }),
      })
      if (!res.ok) throw new Error('Failed to disconnect')
    },
    onSuccess: async () => {
      toast({ title: 'Google account disconnected' })
      await queryClient.invalidateQueries({
        queryKey: ['googleIntegrationStatus'],
      })
    },
    onError: (err: unknown) => {
      toast({
        title: 'Disconnect failed',
        description: String(err),
        variant: 'destructive',
      })
    },
  })

  // GitHub disconnect mutation
  const disconnectGitHub = useMutation({
    mutationFn: async (connectionId: string) => {
      const res = await fetch('/api/integrations/github/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionId }),
      })
      if (!res.ok) throw new Error('Failed to disconnect')
    },
    onSuccess: async () => {
      toast({ title: 'GitHub account disconnected' })
      await queryClient.invalidateQueries({
        queryKey: ['githubIntegrationStatus'],
      })
    },
    onError: (err: unknown) => {
      toast({
        title: 'Disconnect failed',
        description: String(err),
        variant: 'destructive',
      })
    },
  })

  const handleConnectGoogle = () => {
    setIsRedirectingGoogle(true)
    window.location.href = '/api/auth/google'
  }

  const handleConnectGitHub = () => {
    setIsRedirectingGitHub(true)
    window.location.href = '/api/auth/github'
  }

  // Transform API response to ConnectedAccount format
  const transformAccounts = (
    accounts: AccountsResponse['accounts'] | undefined
  ): ConnectedAccount[] => {
    if (!accounts) return []
    return accounts.map(a => ({
      id: a.id,
      email: a.email,
      displayName: a.displayName,
      status: a.status,
      login: a.login || a.metadata?.login,
      lastSyncAt: a.lastSyncAt,
      connectedAt: a.connectedAt,
      metadata: a.metadata,
    }))
  }

  const googleAccounts = transformAccounts(googleData?.accounts)
  const githubAccounts = transformAccounts(githubData?.accounts)

  return (
    <div className='relative'>
      <div className='grid grid-cols-2 gap-6'>
        {/* Google Card */}
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <div className='flex flex-col space-y-1.5'>
              <CardTitle className='flex items-center gap-2'>
                <GoogleIcon className='h-5 w-5' />
                Google Workspace
              </CardTitle>
              <CardDescription>
                Connect your Google Workspace accounts to sync emails and
                contacts.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {googleLoading ? (
              <div className='text-muted-foreground text-sm'>
                Checking status...
              </div>
            ) : googleAccounts.length > 0 ? (
              <ConnectedAccountsList
                provider='google'
                accounts={googleAccounts}
                onDisconnect={async id => disconnectGoogle.mutateAsync(id)}
                onAddAccount={handleConnectGoogle}
              />
            ) : (
              <div className='flex items-center justify-between'>
                <span className='text-muted-foreground text-sm'>
                  Not connected
                </span>
                <Button
                  variant='outline'
                  disabled={isRedirectingGoogle}
                  onClick={handleConnectGoogle}
                >
                  {isRedirectingGoogle
                    ? 'Connecting...'
                    : 'Connect Google Account'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* GitHub Card */}
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <div className='flex flex-col space-y-1.5'>
              <CardTitle className='flex items-center gap-2'>
                <SimpleIcon icon={siGithub} className='h-5 w-5' />
                GitHub
              </CardTitle>
              <CardDescription>
                Connect your GitHub accounts to sync repositories and create
                PRs.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {githubLoading ? (
              <div className='text-muted-foreground text-sm'>
                Checking status...
              </div>
            ) : githubAccounts.length > 0 ? (
              <ConnectedAccountsList
                provider='github'
                accounts={githubAccounts}
                onDisconnect={async id => disconnectGitHub.mutateAsync(id)}
                onAddAccount={handleConnectGitHub}
              />
            ) : (
              <div className='flex items-center justify-between'>
                <span className='text-muted-foreground text-sm'>
                  Not connected
                </span>
                <Button
                  variant='outline'
                  disabled={isRedirectingGitHub}
                  onClick={handleConnectGitHub}
                >
                  {isRedirectingGitHub
                    ? 'Connecting...'
                    : 'Connect GitHub Account'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Vercel Card - Coming Soon */}
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <div className='flex flex-col space-y-1.5'>
              <CardTitle className='flex items-center gap-2'>
                <SimpleIcon icon={siVercel} className='h-5 w-5' />
                Vercel
              </CardTitle>
              <CardDescription>
                Connect your Vercel account to sync deployments and analytics.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button variant='outline' disabled>
                      Connect Vercel Account
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Coming soon</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </CardContent>
        </Card>

        {/* Supabase Card - Coming Soon */}
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <div className='flex flex-col space-y-1.5'>
              <CardTitle className='flex items-center gap-2'>
                <SimpleIcon
                  icon={siSupabase}
                  className='h-5 w-5'
                  color='#3ECF8E'
                />
                Supabase
              </CardTitle>
              <CardDescription>
                Connect your Supabase account to sync database and auth.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button variant='outline' disabled>
                      Connect Supabase Account
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Coming soon</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

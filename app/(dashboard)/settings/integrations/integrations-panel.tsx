'use client'

import { siGithub, siSupabase, siVercel } from 'simple-icons/icons'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
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

export function IntegrationsPanel() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['googleIntegrationStatus'],
    queryFn: async () => {
      const res = await fetch('/api/integrations/google/status')
      if (!res.ok) throw new Error('Failed to fetch Google status')
      return (await res.json()) as {
        connected: boolean
        email?: string
        status?: string
        connectedAt?: string
        lastSyncAt?: string
      }
    },
  })

  const [isRedirecting, setIsRedirecting] = useState(false)
  const disconnect = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/integrations/google/disconnect', {
        method: 'POST',
      })
      if (!res.ok) throw new Error('Failed to disconnect')
    },
    onSuccess: async () => {
      toast({ title: 'Google disconnected' })
      await refetch()
    },
    onError: (err: unknown) => {
      toast({ title: 'Disconnect failed', description: String(err) })
    },
  })

  return (
    <div className='relative'>
      <div className='grid gap-6'>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <div className='flex flex-col space-y-1.5'>
              <CardTitle className='flex items-center gap-2'>
                <GoogleIcon className='h-5 w-5' />
                Google Workspace
              </CardTitle>
              <CardDescription>
                Connect your Google Workspace account to sync emails, calendar,
                and contacts.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <div className='flex items-center justify-between'>
              <div className='text-sm text-muted-foreground'>
                {isLoading ? (
                  'Checking status…'
                ) : data?.connected ? (
                  <span>Connected as {data.email}</span>
                ) : (
                  <span>Not connected</span>
                )}
              </div>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      {data?.connected ? (
                        <Button
                          variant='outline'
                          disabled={disconnect.isPending}
                          onClick={() => disconnect.mutate()}
                        >
                          {disconnect.isPending ? 'Disconnecting…' : 'Disconnect'}
                        </Button>
                      ) : (
                        <Button
                          variant='outline'
                          disabled={isLoading || isRedirecting}
                          onClick={() => {
                            setIsRedirecting(true)
                            window.location.href = '/api/auth/google'
                          }}
                        >
                          {isLoading || isRedirecting
                            ? 'Preparing…'
                            : 'Connect Google Account'}
                        </Button>
                      )}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>
                      {isLoading
                        ? 'Loading status'
                        : data?.connected
                        ? 'Disconnect your Google account'
                        : 'Connect your Google account'}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <div className='flex flex-col space-y-1.5'>
              <CardTitle className='flex items-center gap-2'>
                <SimpleIcon icon={siGithub} className='h-5 w-5' />
                GitHub
              </CardTitle>
              <CardDescription>
                Connect your GitHub account to sync repositories and issues.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button variant='outline' disabled>
                      Connect GitHub Account
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

'use client'

import { useState } from 'react'
import { Loader2, Trash2, Plus } from 'lucide-react'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

export interface ConnectedAccount {
  id: string
  email: string | null
  displayName: string | null
  status: string
  login?: string // GitHub username
  lastSyncAt?: string | null
  connectedAt: string
  metadata?: {
    picture?: string
    avatar_url?: string
    name?: string
  }
}

interface ConnectedAccountsListProps {
  provider: 'google' | 'github'
  accounts: ConnectedAccount[]
  onDisconnect: (id: string) => Promise<void>
  onAddAccount: () => void
  isDisconnecting?: string
}

export function ConnectedAccountsList({
  provider,
  accounts,
  onDisconnect,
  onAddAccount,
  isDisconnecting,
}: ConnectedAccountsListProps) {
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null)
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)
  const [accountToDisconnect, setAccountToDisconnect] =
    useState<ConnectedAccount | null>(null)

  const handleDisconnectClick = (account: ConnectedAccount) => {
    setAccountToDisconnect(account)
    setConfirmDialogOpen(true)
  }

  const handleConfirmDisconnect = async () => {
    if (!accountToDisconnect) return

    setDisconnectingId(accountToDisconnect.id)
    setConfirmDialogOpen(false)
    try {
      await onDisconnect(accountToDisconnect.id)
    } finally {
      setDisconnectingId(null)
      setAccountToDisconnect(null)
    }
  }

  const handleCancelDisconnect = () => {
    setConfirmDialogOpen(false)
    setAccountToDisconnect(null)
  }

  const getAvatarUrl = (account: ConnectedAccount) => {
    if (provider === 'google') {
      return account.metadata?.picture
    }
    return account.metadata?.avatar_url
  }

  const getDisplayLabel = (account: ConnectedAccount) => {
    if (provider === 'github' && account.login) {
      return `@${account.login}`
    }
    return account.displayName || account.email || 'Unknown'
  }

  const getInitials = (account: ConnectedAccount) => {
    const name = account.displayName || account.email || '?'
    return name[0].toUpperCase()
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const providerName = provider === 'google' ? 'Google' : 'GitHub'
  const activeAccounts = accounts.filter(a => a.status === 'ACTIVE')

  if (activeAccounts.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-6 text-center">
        <p className="text-sm text-muted-foreground">
          No {providerName} accounts connected
        </p>
        <Button onClick={onAddAccount} variant="outline" size="sm">
          <Plus className="mr-2 h-4 w-4" />
          Connect {providerName} Account
        </Button>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-3">
        {activeAccounts.map(account => {
          const isCurrentlyDisconnecting =
            disconnectingId === account.id || isDisconnecting === account.id

          return (
            <div
              key={account.id}
              className="flex items-center justify-between rounded-lg border p-3"
            >
              <div className="flex items-center gap-3">
                <Avatar className="h-9 w-9">
                  <AvatarImage src={getAvatarUrl(account)} />
                  <AvatarFallback>{getInitials(account)}</AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                  <span className="text-sm font-medium">
                    {getDisplayLabel(account)}
                  </span>
                  {account.email && provider === 'github' && (
                    <span className="text-xs text-muted-foreground">
                      {account.email}
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground">
                    Connected {formatDate(account.connectedAt)}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Badge
                  variant={account.status === 'ACTIVE' ? 'default' : 'secondary'}
                  className="text-xs"
                >
                  {account.status}
                </Badge>

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  disabled={isCurrentlyDisconnecting}
                  onClick={() => handleDisconnectClick(account)}
                >
                  {isCurrentlyDisconnecting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          )
        })}

        <Button
          onClick={onAddAccount}
          variant="outline"
          size="sm"
          className="w-full"
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Another {providerName} Account
        </Button>
      </div>

      <ConfirmDialog
        open={confirmDialogOpen}
        title="Disconnect Account"
        description={
          accountToDisconnect
            ? `Are you sure you want to disconnect ${getDisplayLabel(accountToDisconnect)}? This will revoke access to this ${providerName} account.`
            : ''
        }
        confirmLabel="Disconnect"
        confirmVariant="destructive"
        onConfirm={handleConfirmDisconnect}
        onCancel={handleCancelDisconnect}
      />
    </>
  )
}

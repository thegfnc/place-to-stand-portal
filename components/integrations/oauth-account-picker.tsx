'use client'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

export interface OAuthAccount {
  id: string
  email: string | null
  displayName: string | null
  status: string
  login?: string // GitHub username
  metadata?: {
    picture?: string
    avatar_url?: string
    name?: string
  }
}

interface OAuthAccountPickerProps {
  provider: 'google' | 'github'
  accounts: OAuthAccount[]
  selectedId?: string
  onSelect: (id: string) => void
  disabled?: boolean
  placeholder?: string
}

export function OAuthAccountPicker({
  provider,
  accounts,
  selectedId,
  onSelect,
  disabled,
  placeholder = 'Select account...',
}: OAuthAccountPickerProps) {
  const activeAccounts = accounts.filter(a => a.status === 'ACTIVE')

  if (activeAccounts.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">
        No {provider === 'google' ? 'Google' : 'GitHub'} accounts connected
      </div>
    )
  }

  const getAvatarUrl = (account: OAuthAccount) => {
    if (provider === 'google') {
      return account.metadata?.picture
    }
    return account.metadata?.avatar_url
  }

  const getDisplayLabel = (account: OAuthAccount) => {
    if (provider === 'github' && account.login) {
      return `@${account.login}`
    }
    return account.displayName || account.email || 'Unknown'
  }

  const getInitials = (account: OAuthAccount) => {
    const name = account.displayName || account.email || '?'
    return name[0].toUpperCase()
  }

  return (
    <Select value={selectedId} onValueChange={onSelect} disabled={disabled}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {activeAccounts.map(account => (
          <SelectItem key={account.id} value={account.id}>
            <div className="flex items-center gap-2">
              <Avatar className="h-5 w-5">
                <AvatarImage src={getAvatarUrl(account)} />
                <AvatarFallback className="text-xs">
                  {getInitials(account)}
                </AvatarFallback>
              </Avatar>
              <span>{getDisplayLabel(account)}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

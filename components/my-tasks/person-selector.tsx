'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useCallback, useMemo } from 'react'

import {
  SearchableCombobox,
  type SearchableComboboxItem,
} from '@/components/ui/searchable-combobox'
import type { DbUser } from '@/lib/types'

type PersonSelectorProps = {
  admins: DbUser[]
  selectedUserId: string
  currentUserId: string
  disabled?: boolean
}

export function PersonSelector({
  admins,
  selectedUserId,
  currentUserId,
  disabled = false,
}: PersonSelectorProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const items: SearchableComboboxItem[] = useMemo(
    () => {
      const mappedItems = admins.map(admin => ({
        value: admin.id,
        label: admin.full_name ?? admin.email ?? 'Unknown',
        avatarUrl: admin.avatar_url,
        userId: admin.id,
      }))

      // Sort: current user first, then alphabetically by label
      return mappedItems.sort((a, b) => {
        if (a.userId === currentUserId) return -1
        if (b.userId === currentUserId) return 1
        return a.label.localeCompare(b.label)
      })
    },
    [admins, currentUserId]
  )

  const handleChange = useCallback(
    (userId: string) => {
      const params = new URLSearchParams(searchParams.toString())

      if (userId) {
        params.set('assignee', userId)
      } else {
        params.delete('assignee')
      }

      const search = params.toString()
      const url = search ? `${pathname}?${search}` : pathname

      router.push(url, { scroll: false })
    },
    [pathname, router, searchParams]
  )

  return (
    <SearchableCombobox
      items={items}
      value={selectedUserId}
      onChange={handleChange}
      placeholder="Select person"
      searchPlaceholder="Search team members..."
      emptyMessage="No team members found."
      disabled={disabled}
      className="w-auto min-w-[240px]"
      triggerClassName="h-9 text-sm"
    />
  )
}

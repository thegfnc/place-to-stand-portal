'use client'

import { useCallback } from 'react'
import { useRouter } from 'next/navigation'

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

type ClientsNavTab = 'clients' | 'archive' | 'activity'

type ClientsTabsNavProps = {
  activeTab: ClientsNavTab
  className?: string
}

const CLIENT_TABS: Array<{ label: string; value: ClientsNavTab; href: string }> = [
  { label: 'All Clients', value: 'clients', href: '/clients' },
  { label: 'Archive', value: 'archive', href: '/clients/archive' },
  { label: 'Activity', value: 'activity', href: '/clients/activity' },
]

export function ClientsTabsNav({ activeTab, className }: ClientsTabsNavProps) {
  const router = useRouter()

  const handleValueChange = useCallback(
    (nextValue: string) => {
      const target = CLIENT_TABS.find(tab => tab.value === nextValue)
      if (target) {
        router.push(target.href)
      }
    },
    [router]
  )

  return (
    <Tabs
      value={activeTab}
      onValueChange={handleValueChange}
      className={cn('w-full sm:w-auto', className)}
    >
      <TabsList className="gap-2">
        {CLIENT_TABS.map(tab => (
          <TabsTrigger key={tab.value} value={tab.value} className='px-3 py-1.5'>
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}

'use client'

import { useCallback } from 'react'
import { useRouter } from 'next/navigation'

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

export type ProjectsNavTab = 'projects' | 'archive' | 'activity'

type ProjectsTabsNavProps = {
  activeTab: ProjectsNavTab
  className?: string
}

const PROJECT_TABS: Array<{ label: string; value: ProjectsNavTab; href: string }> = [
  { label: 'All Projects', value: 'projects', href: '/projects' },
  { label: 'Archive', value: 'archive', href: '/projects/archive' },
  { label: 'Activity', value: 'activity', href: '/projects/activity' },
]

export function ProjectsTabsNav({ activeTab, className }: ProjectsTabsNavProps) {
  const router = useRouter()

  const handleValueChange = useCallback(
    (nextValue: string) => {
      const target = PROJECT_TABS.find(tab => tab.value === nextValue)
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
      <TabsList className='gap-2'>
        {PROJECT_TABS.map(tab => (
          <TabsTrigger key={tab.value} value={tab.value} className='px-3 py-1.5'>
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}

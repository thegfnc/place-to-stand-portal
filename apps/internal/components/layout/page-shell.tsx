'use client'

import { Fragment, type ReactNode } from 'react'

import { cn } from '@/lib/utils'
import type { Crumb } from '@/lib/navigation/breadcrumbs'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@pts/ui/breadcrumb'
import { Separator } from '@pts/ui/separator'
import { SidebarTrigger } from '@/components/ui/sidebar'

import { TabsNav, type TabsNavTab } from './tabs-nav'

/**
 * Count labels are declared as plural nouns ('users', 'archived leads');
 * all current labels pluralize with a plain trailing s, so a count of 1
 * just drops it. An irregular noun added later needs explicit handling.
 */
function singularizeLabel(label: string) {
  return label.endsWith('s') ? label.slice(0, -1) : label
}

type PageShellCount = {
  /** Plural noun, e.g. 'clients'. */
  label: string
  total: number
  /**
   * When filters/search are active (03): total matching rows. Renders
   * `Showing {filteredTotal} of {total}`; absent → `{total} {label}`.
   */
  filteredTotal?: number
}

type PageShellProps = {
  breadcrumbs: Crumb[]
  headerRight?: ReactNode
  tabs?: readonly TabsNavTab[]
  activeTab?: string
  count?: PageShellCount
  primaryAction?: ReactNode
  /** Extra classes for the content wrapper (e.g. board pages: `flex h-full min-h-0 flex-col`). */
  contentClassName?: string
  children: ReactNode
}

/**
 * The shared page shell (PRD 004 §01, D1/D2/D3/D11): one compact header
 * row (trigger · breadcrumb · palette affordance · optional right slot),
 * an optional toolbar row (tabs · count · primary action), then content.
 * Owns the page scroll pane — the body never scrolls.
 */
export function PageShell({
  breadcrumbs,
  headerRight,
  tabs,
  activeTab,
  count,
  primaryAction,
  contentClassName,
  children,
}: PageShellProps) {
  const hasToolbar = Boolean(tabs?.length || count || primaryAction)

  return (
    <div className='flex min-h-0 flex-1 flex-col'>
      <header className='bg-background flex items-center gap-3 border-b px-3 py-2 sm:px-4'>
        <SidebarTrigger className='text-muted-foreground -ml-1 shrink-0' />
        <Separator orientation='vertical' className='h-4 shrink-0' />
        <Breadcrumb className='min-w-0 flex-1'>
          <BreadcrumbList className='flex-nowrap overflow-hidden text-sm'>
            {breadcrumbs.map((crumb, index) => {
              const isLast = index === breadcrumbs.length - 1
              return (
                <Fragment key={`${crumb.label}-${index}`}>
                  <BreadcrumbItem
                    className={cn(!isLast && 'hidden sm:inline-flex')}
                  >
                    {isLast ? (
                      <BreadcrumbPage className='text-foreground truncate font-medium'>
                        {crumb.label}
                      </BreadcrumbPage>
                    ) : crumb.href ? (
                      <BreadcrumbLink href={crumb.href}>
                        {crumb.label}
                      </BreadcrumbLink>
                    ) : (
                      <span className='text-muted-foreground'>
                        {crumb.label}
                      </span>
                    )}
                  </BreadcrumbItem>
                  {!isLast ? (
                    <BreadcrumbSeparator className='hidden sm:block' />
                  ) : null}
                </Fragment>
              )
            })}
          </BreadcrumbList>
        </Breadcrumb>
        {headerRight ? (
          <div className='flex min-w-0 shrink-0 items-center'>{headerRight}</div>
        ) : null}
      </header>
      <main className='flex min-h-0 flex-1 flex-col overflow-y-auto p-3 sm:p-4'>
        {hasToolbar ? (
          <div className='mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
            {tabs?.length && activeTab ? (
              <TabsNav
                tabs={tabs}
                activeTab={activeTab}
                className='flex-1 sm:flex-none'
              />
            ) : (
              <div />
            )}
            <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-6'>
              {count ? (
                <span className='text-muted-foreground text-sm whitespace-nowrap'>
                  {count.filteredTotal !== undefined &&
                  count.filteredTotal !== count.total
                    ? `Showing ${count.filteredTotal} of ${count.total}`
                    : `${count.total} ${count.total === 1 ? singularizeLabel(count.label) : count.label}`}
                </span>
              ) : null}
              {primaryAction}
            </div>
          </div>
        ) : null}
        {/* min-h-fit lets document-flow content grow the wrapper so main's
            bottom padding stays inside the scrollable area. Viewport-pinned
            views (kanban boards) pass `h-full min-h-0` via contentClassName
            to reinstate the clamp — tailwind-merge lets it win. */}
        <div className={cn('min-h-fit flex-1', contentClassName)}>
          {children}
        </div>
      </main>
    </div>
  )
}

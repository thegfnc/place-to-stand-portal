'use client'

import * as React from 'react'

import { cn } from './cn'

// PRD 004 §04 (D10): density variant. 'compact' = h-8 text-xs heads +
// py-1.5 cells, promoted from the monthly-close tableClasses experiment.
type TableDensity = 'default' | 'compact'

// 'fixed' opts into table-layout: fixed so column widths come from the
// header row alone — sorting/paging in new rows can't reflow the grid.
// Width rule (apps/internal/docs/design-system.md → Table Column Widths):
// content-sized columns take a fixed rem width, text columns take none so
// they split the leftover, and secondary columns hide below `md`.
type TableLayout = 'auto' | 'fixed'

const TableDensityContext = React.createContext<TableDensity>('default')

function useTableDensity() {
  return React.useContext(TableDensityContext)
}

function Table({
  className,
  density = 'default',
  layout = 'auto',
  ...props
}: React.ComponentProps<'table'> & {
  density?: TableDensity
  layout?: TableLayout
}) {
  return (
    <TableDensityContext.Provider value={density}>
      <div
        data-slot='table-container'
        className='relative w-full overflow-x-auto'
      >
        <table
          data-slot='table'
          data-density={density}
          className={cn(
            'w-full caption-bottom text-sm',
            layout === 'fixed' && 'table-fixed',
            className
          )}
          {...props}
        />
      </div>
    </TableDensityContext.Provider>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<'thead'>) {
  return (
    <thead
      data-slot='table-header'
      className={cn('[&_tr]:border-b', className)}
      {...props}
    />
  )
}

function TableBody({ className, ...props }: React.ComponentProps<'tbody'>) {
  return (
    <tbody
      data-slot='table-body'
      className={cn('[&_tr:last-child]:border-0', className)}
      {...props}
    />
  )
}

function TableFooter({ className, ...props }: React.ComponentProps<'tfoot'>) {
  return (
    <tfoot
      data-slot='table-footer'
      className={cn(
        'bg-muted/50 border-t font-medium [&>tr]:last:border-b-0',
        className
      )}
      {...props}
    />
  )
}

function TableRow({ className, ...props }: React.ComponentProps<'tr'>) {
  return (
    <tr
      data-slot='table-row'
      className={cn(
        'hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors',
        className
      )}
      {...props}
    />
  )
}

function TableHead({ className, ...props }: React.ComponentProps<'th'>) {
  const density = useTableDensity()
  return (
    <th
      data-slot='table-head'
      className={cn(
        'text-foreground px-2 text-left align-middle font-medium whitespace-nowrap [&:has([role=checkbox])]:pr-0 *:[[role=checkbox]]:translate-y-0.5',
        density === 'compact' ? 'h-8 text-xs' : 'h-10',
        className
      )}
      {...props}
    />
  )
}

function TableCell({ className, ...props }: React.ComponentProps<'td'>) {
  const density = useTableDensity()
  return (
    <td
      data-slot='table-cell'
      className={cn(
        'align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 *:[[role=checkbox]]:translate-y-0.5',
        density === 'compact' ? 'px-2 py-1.5' : 'p-2',
        className
      )}
      {...props}
    />
  )
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<'caption'>) {
  return (
    <caption
      data-slot='table-caption'
      className={cn('text-muted-foreground mt-4 text-sm', className)}
      {...props}
    />
  )
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}

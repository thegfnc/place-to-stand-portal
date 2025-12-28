'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'

import { Button } from '@/components/ui/button'

type CursorPaginationProps = {
  mode?: 'cursor'
  hasNextPage: boolean
  hasPreviousPage: boolean
  onNext: () => void
  onPrevious: () => void
  disableAll?: boolean
}

type PagedPaginationProps = {
  mode: 'paged'
  currentPage: number
  totalPages: number
  totalItems: number
  pageSize: number
  onPageChange: (page: number) => void
  showCount?: boolean
}

type PaginationControlsProps = CursorPaginationProps | PagedPaginationProps

export function PaginationControls(props: PaginationControlsProps) {
  if (props.mode === 'paged') {
    return <PagedPagination {...props} />
  }
  return <CursorPagination {...props} />
}

function CursorPagination({
  hasNextPage,
  hasPreviousPage,
  onNext,
  onPrevious,
  disableAll = false,
}: CursorPaginationProps) {
  const isPrevDisabled = disableAll || !hasPreviousPage
  const isNextDisabled = disableAll || !hasNextPage

  if (!hasNextPage && !hasPreviousPage) {
    return null
  }

  return (
    <div className='flex justify-end gap-1'>
      <Button
        type='button'
        variant='outline'
        size='icon-sm'
        onClick={onPrevious}
        disabled={isPrevDisabled}
        aria-label='Previous page'
      >
        <ChevronLeft className='size-4' />
      </Button>
      <Button
        type='button'
        variant='outline'
        size='icon-sm'
        onClick={onNext}
        disabled={isNextDisabled}
        aria-label='Next page'
      >
        <ChevronRight className='size-4' />
      </Button>
    </div>
  )
}

function PagedPagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  showCount = true,
}: PagedPaginationProps) {
  if (totalPages <= 1) {
    return null
  }

  const controls = (
    <div className='flex items-center gap-1'>
      <Button
        type='button'
        variant='outline'
        size='icon-sm'
        onClick={() => onPageChange(Math.max(1, currentPage - 1))}
        disabled={currentPage === 1}
        aria-label='Previous page'
      >
        <ChevronLeft className='size-4' />
      </Button>
      <div className='flex items-center'>
        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
          let pageNum: number
          if (totalPages <= 5) {
            pageNum = i + 1
          } else if (currentPage <= 3) {
            pageNum = i + 1
          } else if (currentPage >= totalPages - 2) {
            pageNum = totalPages - 4 + i
          } else {
            pageNum = currentPage - 2 + i
          }
          return (
            <Button
              key={pageNum}
              type='button'
              variant={currentPage === pageNum ? 'default' : 'ghost'}
              size='xs'
              className='size-6 p-0'
              onClick={() => onPageChange(pageNum)}
              aria-label={`Page ${pageNum}`}
              aria-current={currentPage === pageNum ? 'page' : undefined}
            >
              {pageNum}
            </Button>
          )
        })}
      </div>
      <Button
        type='button'
        variant='outline'
        size='icon-sm'
        onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
        disabled={currentPage === totalPages}
        aria-label='Next page'
      >
        <ChevronRight className='size-4' />
      </Button>
    </div>
  )

  if (!showCount) {
    return controls
  }

  return (
    <div className='flex items-center justify-between'>
      <p className='text-muted-foreground text-sm tabular-nums'>
        {(currentPage - 1) * pageSize + 1}–
        {Math.min(currentPage * pageSize, totalItems)} of {totalItems}
      </p>
      {controls}
    </div>
  )
}

'use client'

import { Check, ChevronDown } from 'lucide-react'

import { Button } from '@pts/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@pts/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@pts/ui/select'
import { cn } from '@/lib/utils'

const ALL = 'all'

type FilterOption = {
  value: string
  label: string
  /** Optional badge class token for multi-mode triggers (project statuses). */
  badgeClassName?: string
}

type SingleProps = {
  mode?: 'single'
  /** Current validated value; undefined = All. */
  value: string | undefined
  onChange: (value: string | undefined) => void
  /** 'All …' placeholder — carries the filter's meaning (D5, no labels). */
  placeholder: string
  options: readonly FilterOption[]
  className?: string
}

type MultiProps = {
  mode: 'multi'
  values: readonly string[]
  onChange: (values: string[]) => void
  placeholder: string
  options: readonly FilterOption[]
  className?: string
}

export type FilterSelectProps = SingleProps | MultiProps

/**
 * The one filter control (PRD 004 §03): `single` = the users/submissions
 * Select idiom ('all' sentinel ↔ param removed); `multi` = the faceted
 * popover lifted from the old ProjectStatusFilter (badges-in-trigger,
 * Clear/Select-all footer). One standard trigger width.
 */
export function FilterSelect(props: FilterSelectProps) {
  if (props.mode === 'multi') {
    return <MultiFilterSelect {...props} />
  }
  return <SingleFilterSelect {...props} />
}

function SingleFilterSelect({
  value,
  onChange,
  placeholder,
  options,
  className,
}: SingleProps) {
  return (
    <Select
      value={value ?? ALL}
      onValueChange={next => onChange(next === ALL ? undefined : next)}
    >
      <SelectTrigger className={cn('w-40', className)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{placeholder}</SelectItem>
        {options.map(option => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function MultiFilterSelect({
  values,
  onChange,
  placeholder,
  options,
  className,
}: MultiProps) {
  const allSelected = values.length === options.length

  const toggle = (value: string) => {
    if (values.includes(value)) {
      onChange(values.filter(entry => entry !== value))
    } else {
      onChange([...values, value])
    }
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant='outline'
          className={cn(
            'h-auto min-h-9 w-full justify-start gap-2 px-3 py-1.5 font-normal sm:w-auto',
            className
          )}
        >
          {values.length === 0 ? (
            <span className='text-muted-foreground'>{placeholder}</span>
          ) : allSelected ? (
            <span className='text-muted-foreground'>{placeholder}: All</span>
          ) : (
            <span className='flex flex-wrap items-center gap-1'>
              {options
                .filter(option => values.includes(option.value))
                .map(option => (
                  <Badge
                    key={option.value}
                    variant='outline'
                    className={cn('font-normal', option.badgeClassName)}
                  >
                    {option.label}
                  </Badge>
                ))}
            </span>
          )}
          <ChevronDown className='text-muted-foreground ml-auto size-4 shrink-0' />
        </Button>
      </PopoverTrigger>
      <PopoverContent align='start' className='w-64 p-2'>
        <div className='flex flex-col gap-0.5'>
          {options.map(option => {
            const selected = values.includes(option.value)
            return (
              <button
                key={option.value}
                type='button'
                onClick={() => toggle(option.value)}
                className='hover:bg-muted flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-left text-sm'
              >
                <span
                  className={cn(
                    'border-input flex size-4 items-center justify-center rounded-sm border',
                    selected && 'bg-primary border-primary text-primary-foreground'
                  )}
                >
                  {selected ? <Check className='size-3' /> : null}
                </span>
                <span>{option.label}</span>
              </button>
            )
          })}
        </div>
        <div className='mt-2 flex items-center justify-between border-t pt-2'>
          <Button
            type='button'
            variant='ghost'
            size='xs'
            onClick={() => onChange([])}
          >
            Clear
          </Button>
          <Button
            type='button'
            variant='ghost'
            size='xs'
            onClick={() => onChange(options.map(option => option.value))}
          >
            Select all
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

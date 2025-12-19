'use client'

import * as React from 'react'
import { CheckIcon, ChevronsUpDownIcon, User } from 'lucide-react'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'

export type SearchableComboboxItem = {
  value: string
  label: string
  description?: string
  keywords?: string[]
  disabled?: boolean
  avatarUrl?: string | null
  userId?: string
  icon?: React.ComponentType<{ className?: string }>
}

export type SearchableComboboxGroup = {
  label: string
  items: SearchableComboboxItem[]
}

type SearchableComboboxProps = {
  items?: SearchableComboboxItem[]
  groups?: SearchableComboboxGroup[]
  value?: string | null
  onChange: (value: string) => void
  onBlur?: () => void
  name?: string
  id?: string
  placeholder?: string
  searchPlaceholder?: string
  emptyMessage?: string
  disabled?: boolean
  className?: string
  triggerClassName?: string
  ariaLabel?: string
  ariaLabelledBy?: string
  ariaDescribedBy?: string
  ariaInvalid?: boolean
  variant?: 'default' | 'heading'
}

const baseTriggerClasses =
  "border-input data-[placeholder=true]:text-muted-foreground [&_svg:not([class*='text-'])]:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 dark:hover:bg-input/50 flex w-full items-center justify-between gap-2 rounded-md border bg-background px-3 py-2 text-left text-sm font-normal shadow-xs transition-[color,box-shadow] outline-hidden focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50"

const itemWrapperClasses = 'flex flex-col text-sm leading-tight'

export const SearchableCombobox = React.forwardRef<
  HTMLButtonElement,
  SearchableComboboxProps
>(
  (
    {
      items = [],
      groups,
      value,
      onChange,
      onBlur,
      name,
      id,
      placeholder,
      searchPlaceholder = 'Search...',
      emptyMessage = 'No results found.',
      disabled,
      className,
      triggerClassName,
      ariaLabel,
      ariaLabelledBy,
      ariaDescribedBy,
      ariaInvalid,
      variant = 'default',
    },
    forwardedRef
  ) => {
    const [open, setOpen] = React.useState(false)
    const triggerRef = React.useRef<HTMLButtonElement | null>(null)
    const [contentWidth, setContentWidth] = React.useState<number>()

    const mergedRef = React.useMemo(() => {
      if (!forwardedRef) {
        return (node: HTMLButtonElement | null) => {
          triggerRef.current = node
        }
      }

      if (typeof forwardedRef === 'function') {
        return (node: HTMLButtonElement | null) => {
          triggerRef.current = node
          forwardedRef(node)
        }
      }

      return (node: HTMLButtonElement | null) => {
        triggerRef.current = node
        forwardedRef.current = node
      }
    }, [forwardedRef])

    const resolvedGroups = React.useMemo(
      () => groups?.filter(group => group.items.length > 0) ?? [],
      [groups]
    )

    const flattenedItems = React.useMemo(() => {
      if (resolvedGroups.length > 0) {
        return resolvedGroups.flatMap(group => group.items)
      }

      return items
    }, [items, resolvedGroups])

    const selectedItem = React.useMemo(
      () => flattenedItems.find(item => item.value === (value ?? '')) ?? null,
      [flattenedItems, value]
    )

    React.useEffect(() => {
      if (!open) {
        return
      }

      if (triggerRef.current) {
        setContentWidth(triggerRef.current.offsetWidth)
      }
    }, [open])

    const handleOpenChange = (next: boolean) => {
      if (disabled) {
        setOpen(false)
        return
      }

      setOpen(next)

      if (!next && onBlur) {
        onBlur()
      }
    }

    const handleSelect = (nextValue: string) => {
      if (disabled) {
        return
      }

      onChange(nextValue)
      setOpen(false)

      if (onBlur) {
        onBlur()
      }
    }

    const resolvedPlaceholder = placeholder ?? searchPlaceholder

    const stopScrollPropagation = React.useCallback(
      (event: React.SyntheticEvent) => {
        event.stopPropagation()
      },
      []
    )

    const contentStyle = React.useMemo<React.CSSProperties>(() => {
      const maxHeight =
        'min(320px, var(--radix-popover-content-available-height))'
      return {
        maxHeight,
        overflowY: 'auto',
        overscrollBehavior: 'contain',
        ...(contentWidth ? { width: contentWidth } : {}),
      }
    }, [contentWidth])

    const selectedTextClasses =
      variant === 'heading' ? 'text-foreground font-semibold' : 'font-medium'
    const placeholderTextClasses =
      variant === 'heading'
        ? 'text-foreground/60 font-semibold'
        : 'text-muted-foreground'

    return (
      <div className={cn('w-full', className)}>
        <input type='hidden' name={name} value={value ?? ''} />
        <Popover open={open} onOpenChange={handleOpenChange}>
          <PopoverTrigger asChild>
            <Button
              ref={mergedRef}
              type='button'
              variant='outline'
              role='combobox'
              aria-expanded={open}
              aria-haspopup='listbox'
              aria-label={ariaLabel}
              aria-labelledby={ariaLabelledBy}
              aria-describedby={ariaDescribedBy}
              aria-invalid={ariaInvalid ? true : undefined}
              disabled={disabled}
              data-placeholder={selectedItem ? undefined : true}
              id={id}
              className={cn(
                baseTriggerClasses,
                variant === 'heading' &&
                  'hover:bg-accent/50 hover:text-accent-foreground data-[state=open]:bg-accent/50 dark:hover:bg-accent/50 dark:data-[state=open]:bg-accent/50 -ml-2 h-auto cursor-pointer border-none bg-transparent px-2 py-2 text-left text-3xl font-semibold tracking-tight shadow-none transition-colors dark:bg-transparent',
                triggerClassName
              )}
            >
              <div className='flex flex-1 items-center gap-2'>
                {selectedItem?.userId ? (
                  <Avatar className='h-5 w-5 shrink-0'>
                    {selectedItem.avatarUrl && (
                      <AvatarImage
                        src={`/api/storage/user-avatar/${selectedItem.userId}`}
                      />
                    )}
                    <AvatarFallback className='text-[9px]'>
                      {selectedItem.label.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                ) : selectedItem?.icon ? (
                  <selectedItem.icon className='text-muted-foreground h-5 w-5 shrink-0' />
                ) : null}
                <span
                  className={cn(
                    variant !== 'heading' && 'line-clamp-1',
                    selectedItem ? selectedTextClasses : placeholderTextClasses
                  )}
                >
                  {selectedItem?.label ?? resolvedPlaceholder}
                </span>
              </div>
              <ChevronsUpDownIcon className='size-4 shrink-0 opacity-50' />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align='start'
            className='w-full max-w-full overflow-hidden p-0'
            sideOffset={8}
            style={contentStyle}
          >
            <Command className='max-h-80'>
              <CommandInput
                placeholder={searchPlaceholder ?? resolvedPlaceholder}
                className='h-9'
              />
              <CommandEmpty>{emptyMessage}</CommandEmpty>
              <CommandList
                className='max-h-[min(60vh,260px)] overflow-y-auto overscroll-contain'
                onWheel={stopScrollPropagation}
                onTouchMove={stopScrollPropagation}
              >
                {resolvedGroups.length > 0 ? (
                  resolvedGroups.map(group => (
                    <CommandGroup key={group.label} heading={group.label}>
                      {group.items.map(item => {
                        const searchValue = [
                          item.label,
                          ...(item.keywords ?? []),
                        ]
                          .join(' ')
                          .trim()

                        return (
                          <CommandItem
                            key={`${group.label}-${item.value}`}
                            value={
                              searchValue.length > 0 ? searchValue : item.value
                            }
                            onSelect={() => handleSelect(item.value)}
                            disabled={item.disabled}
                            className='pr-3'
                          >
                            <CheckIcon
                              className={cn(
                                'mr-2 size-4',
                                selectedItem?.value === item.value
                                  ? 'opacity-100'
                                  : 'opacity-0'
                              )}
                            />
                            {item.userId ? (
                              <Avatar className='mr-2 h-5 w-5'>
                                {item.avatarUrl && (
                                  <AvatarImage
                                    src={`/api/storage/user-avatar/${item.userId}`}
                                  />
                                )}
                                <AvatarFallback className='text-[9px]'>
                                  {item.label.slice(0, 2).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                            ) : item.icon ? (
                              <item.icon className='text-muted-foreground mr-2 h-5 w-5' />
                            ) : null}
                            <div className={itemWrapperClasses}>
                              <span className='font-medium'>{item.label}</span>
                              {item.description ? (
                                <span className='text-muted-foreground text-xs'>
                                  {item.description}
                                </span>
                              ) : null}
                            </div>
                          </CommandItem>
                        )
                      })}
                    </CommandGroup>
                  ))
                ) : (
                  <CommandGroup>
                    {flattenedItems.map(item => {
                      const searchValue = [item.label, ...(item.keywords ?? [])]
                        .join(' ')
                        .trim()

                      return (
                        <CommandItem
                          key={item.value}
                          value={
                            searchValue.length > 0 ? searchValue : item.value
                          }
                          onSelect={() => handleSelect(item.value)}
                          disabled={item.disabled}
                          className='pr-3'
                        >
                          <CheckIcon
                            className={cn(
                              'mr-2 size-4',
                              selectedItem?.value === item.value
                                ? 'opacity-100'
                                : 'opacity-0'
                            )}
                          />
                          {item.userId ? (
                            <Avatar className='mr-2 h-5 w-5'>
                              {item.avatarUrl && (
                                <AvatarImage
                                  src={`/api/storage/user-avatar/${item.userId}`}
                                />
                              )}
                              <AvatarFallback className='text-[9px]'>
                                {item.label.slice(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                          ) : item.icon ? (
                            <item.icon className='text-muted-foreground mr-2 h-5 w-5' />
                          ) : null}
                          <div className={itemWrapperClasses}>
                            <span className='font-medium'>{item.label}</span>
                            {item.description ? (
                              <span className='text-muted-foreground text-xs'>
                                {item.description}
                              </span>
                            ) : null}
                          </div>
                        </CommandItem>
                      )
                    })}
                  </CommandGroup>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
    )
  }
)

SearchableCombobox.displayName = 'SearchableCombobox'

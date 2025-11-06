import { ChevronsUpDown, UserPlus, X } from 'lucide-react'
import { useMemo } from 'react'

import { Button } from '@/components/ui/button'
import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { FormLabel } from '@/components/ui/form'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { PROJECT_SHEET_PENDING_REASON } from '@/lib/settings/projects/project-sheet-contractors'
import type { ContractorUserSummary } from '@/lib/settings/projects/use-project-sheet-state'
import type { ContractorButtonState } from '@/lib/settings/projects/project-sheet-contractors'

export type ProjectContractorsSectionProps = {
  availableContractors: ContractorUserSummary[]
  selectedContractors: ContractorUserSummary[]
  contractorButton: ContractorButtonState
  isContractorPickerOpen: boolean
  isPending: boolean
  onContractorPickerOpenChange: (open: boolean) => void
  onAddContractor: (user: ContractorUserSummary) => void
  onRequestContractorRemoval: (user: ContractorUserSummary) => void
}

export function ProjectContractorsSection(
  props: ProjectContractorsSectionProps
) {
  const {
    availableContractors,
    selectedContractors,
    contractorButton,
    isContractorPickerOpen,
    isPending,
    onContractorPickerOpenChange,
    onAddContractor,
    onRequestContractorRemoval,
  } = props

  const contractorLabel = useMemo(() => {
    if (availableContractors.length > 0) {
      return 'Add contractor'
    }

    return 'All contractors assigned'
  }, [availableContractors.length])

  return (
    <div className='space-y-2'>
      <FormLabel>Contractors</FormLabel>
      <Popover
        open={isContractorPickerOpen}
        onOpenChange={onContractorPickerOpenChange}
      >
        <DisabledFieldTooltip
          disabled={contractorButton.disabled}
          reason={contractorButton.reason}
        >
          <div className='w-full'>
            <PopoverTrigger asChild>
              <Button
                type='button'
                variant='outline'
                className='w-full justify-between'
                disabled={contractorButton.disabled}
              >
                <span className='flex items-center gap-2'>
                  <UserPlus className='h-4 w-4' />
                  {contractorLabel}
                </span>
                <ChevronsUpDown className='h-4 w-4 opacity-50' />
              </Button>
            </PopoverTrigger>
          </div>
        </DisabledFieldTooltip>
        <PopoverContent className='w-[320px] p-0' align='start'>
          <Command>
            <CommandInput placeholder='Search contractors...' />
            <CommandEmpty>No matching contractors.</CommandEmpty>
            <CommandList>
              <CommandGroup heading='Contractors'>
                {availableContractors.map(contractor => {
                  const displayName = contractor.fullName?.trim()
                    ? contractor.fullName.trim()
                    : contractor.email

                  return (
                    <CommandItem
                      key={contractor.id}
                      value={`${displayName} ${contractor.email}`}
                      onSelect={() => onAddContractor(contractor)}
                    >
                      <div className='flex flex-col'>
                        <span className='font-medium'>{displayName}</span>
                        <span className='text-muted-foreground text-xs'>
                          {contractor.email}
                        </span>
                      </div>
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <p className='text-muted-foreground text-xs'>
        Assigned contractors can collaborate on this project&apos;s tasks.
      </p>
      <div className='space-y-2'>
        {selectedContractors.length === 0 ? (
          <p className='text-muted-foreground text-sm'>
            No contractors assigned yet.
          </p>
        ) : (
          selectedContractors.map(contractor => {
            const displayName = contractor.fullName?.trim()
              ? contractor.fullName.trim()
              : contractor.email

            return (
              <div
                key={contractor.id}
                className='bg-muted/40 flex items-center justify-between rounded-md border px-3 py-2'
              >
                <div className='flex flex-col text-sm leading-tight'>
                  <span className='font-medium'>{displayName}</span>
                  <span className='text-muted-foreground text-xs'>
                    {contractor.email}
                  </span>
                </div>
                <DisabledFieldTooltip
                  disabled={isPending}
                  reason={isPending ? PROJECT_SHEET_PENDING_REASON : null}
                >
                  <Button
                    type='button'
                    variant='ghost'
                    size='icon'
                    className='text-muted-foreground hover:text-destructive'
                    onClick={() => onRequestContractorRemoval(contractor)}
                    disabled={isPending}
                    aria-label={`Remove ${displayName}`}
                  >
                    <X className='h-4 w-4' />
                  </Button>
                </DisabledFieldTooltip>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

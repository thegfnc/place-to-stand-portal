'use client'

import { useMemo } from 'react'
import { useWatch, type Control } from 'react-hook-form'

import { Badge } from '@/components/ui/badge'
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { PhoneInput } from '@/components/ui/phone-input'
import { RichTextEditor } from '@/components/ui/rich-text-editor'
import { SearchableCombobox } from '@/components/ui/searchable-combobox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@pts/ui/select'
import { cn } from '@/lib/utils'
import { isSelectableUser } from '@/lib/users/selectable'
import {
  LEAD_SOURCE_LABELS,
  LEAD_SOURCE_TYPES,
  LEAD_STATUS_LABELS,
  LEAD_STATUS_ORDER,
  getLeadStatusToken,
  type LeadSourceTypeValue,
  type LeadStatusValue,
} from '@/lib/leads/constants'
import type { LeadAssigneeOption } from '@/lib/leads/types'

import type { LeadFormValues } from './types'

type LeadSheetFormFieldsProps = {
  control: Control<LeadFormValues>
  assignees: LeadAssigneeOption[]
  selectedSourceType: LeadSourceTypeValue | null | undefined
}

export function LeadSheetFormFields({
  control,
  assignees,
  selectedSourceType,
}: LeadSheetFormFieldsProps) {
  // Disabled admins are not offered, but a lead they already hold keeps
  // them as a disabled entry so the picker still names the assignee.
  const currentAssigneeId = useWatch({ control, name: 'assigneeId' }) ?? null
  const assigneeItems = useMemo(
    () => [
      {
        value: '',
        label: 'Unassigned',
        description: 'Leave unassigned for now.',
      },
      ...assignees
        .filter(
          assignee =>
            isSelectableUser(assignee) || assignee.id === currentAssigneeId
        )
        .map(assignee => ({
          value: assignee.id,
          label: assignee.name,
          description: assignee.email ?? undefined,
          userId: assignee.id,
          avatarUrl: assignee.avatarUrl,
          disabled: !isSelectableUser(assignee),
        })),
    ],
    [assignees, currentAssigneeId]
  )

  const leadStatuses = useMemo(
    () =>
      LEAD_STATUS_ORDER.map(status => ({
        value: status,
        label: LEAD_STATUS_LABELS[status],
        token: getLeadStatusToken(status),
      })),
    []
  )

  return (
    <div className='space-y-6'>
      <FormField
        control={control}
        name='contactName'
        render={({ field }) => (
          <FormItem>
            <FormLabel>Contact Name</FormLabel>
            <FormControl>
              <Input
                {...field}
                value={field.value ?? ''}
                placeholder='Jordan Smith'
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <div className='grid gap-4 sm:grid-cols-2'>
        <FormField
          control={control}
          name='contactEmail'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Contact Email</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  value={field.value ?? ''}
                  type='email'
                  placeholder='name@org.com'
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name='contactPhone'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Contact Phone</FormLabel>
              <FormControl>
                <PhoneInput
                  value={field.value ?? ''}
                  onChange={field.onChange}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
      <div className='grid gap-4 sm:grid-cols-2'>
        <FormField
          control={control}
          name='companyName'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Company Name</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  value={field.value ?? ''}
                  placeholder='Acme Corporation'
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name='companyWebsite'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Company Website</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  value={field.value ?? ''}
                  type='url'
                  placeholder='https://acme.com'
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
      <div className='grid gap-4 sm:grid-cols-2'>
        <FormField
          control={control}
          name='sourceType'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Source</FormLabel>
              <Select
                value={field.value ?? 'none'}
                onValueChange={(value: string) =>
                  field.onChange(
                    value === 'none' ? null : (value as LeadSourceTypeValue)
                  )
                }
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder='Select source'>
                      {field.value ? (
                        LEAD_SOURCE_LABELS[field.value]
                      ) : (
                        <span className='text-muted-foreground'>Not set</span>
                      )}
                    </SelectValue>
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value='none'>
                    <span className='text-muted-foreground'>Not set</span>
                  </SelectItem>
                  {LEAD_SOURCE_TYPES.map(source => (
                    <SelectItem key={source} value={source}>
                      {LEAD_SOURCE_LABELS[source]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name='sourceDetail'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Source Info</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  value={field.value ?? ''}
                  placeholder='Referral name, site URL, or event title'
                  disabled={!selectedSourceType}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
      <div className='grid gap-4 sm:grid-cols-2'>
        <FormField
          control={control}
          name='status'
          render={({ field }) => {
            const selectedStatus = leadStatuses.find(
              status => status.value === field.value
            )

            return (
              <FormItem>
                <FormLabel>Status</FormLabel>
                <Select
                  value={field.value}
                  onValueChange={(value: LeadStatusValue) =>
                    field.onChange(value)
                  }
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder='Select status'>
                        {selectedStatus ? (
                          <Badge
                            variant='outline'
                            className={cn(
                              'text-xs font-semibold tracking-wide uppercase',
                              selectedStatus.token
                            )}
                          >
                            {selectedStatus.label}
                          </Badge>
                        ) : null}
                      </SelectValue>
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {leadStatuses.map(status => (
                      <SelectItem key={status.value} value={status.value}>
                        <Badge
                          variant='outline'
                          className={cn(
                            'text-xs font-semibold tracking-wide uppercase',
                            status.token
                          )}
                        >
                          {status.label}
                        </Badge>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )
          }}
        />
        <FormField
          control={control}
          name='assigneeId'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Assignee</FormLabel>
              <FormControl>
                <SearchableCombobox
                  items={assigneeItems}
                  value={field.value ?? ''}
                  onChange={value =>
                    field.onChange(value.length ? value : null)
                  }
                  placeholder='Assign teammate'
                  searchPlaceholder='Search teammates'
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
      <FormField
        control={control}
        name='notes'
        render={({ field }) => (
          <FormItem>
            <FormLabel>Notes</FormLabel>
            <FormControl>
              <RichTextEditor
                id='lead-notes'
                value={field.value ?? ''}
                onChange={field.onChange}
                contentMinHeightClassName='[&_.ProseMirror]:min-h-[180px]'
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  )
}

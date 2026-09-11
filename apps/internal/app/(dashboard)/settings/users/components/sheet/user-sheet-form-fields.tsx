import { useEffect, useRef } from 'react'
import type React from 'react'
import type { UseFormReturn } from 'react-hook-form'

import { AvatarUploadField } from '@/components/forms/avatar-upload-field'
import { SheetSection } from '@/components/sheets/sheet-section'
import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@pts/ui/select'
import { Separator } from '@pts/ui/separator'
import { Switch } from '@pts/ui/switch'

import { cn } from '@/lib/utils'

import { USER_ROLES } from '@/lib/settings/users/user-validation'
import type { UserFormValues } from './form-schema'

type UserSheetFormFieldsProps = {
  form: UseFormReturn<UserFormValues>
  isPending: boolean
  pendingReason: string
  emailDisabled: boolean
  emailDisabledReason: string | null
  roleDisabled: boolean
  roleDisabledReason: string | null
  accessToggleDisabled: boolean
  accessToggleDisabledReason: string | null
  avatarFieldKey: number
  avatarInitials: string
  onAvatarUploadingChange: (uploading: boolean) => void
  avatarDisplayName: string | null
  targetUserId: string | null
  isEditing: boolean
  isSheetOpen: boolean
}

export function UserSheetFormFields({
  form,
  isPending,
  pendingReason,
  emailDisabled,
  emailDisabledReason,
  roleDisabled,
  roleDisabledReason,
  accessToggleDisabled,
  accessToggleDisabledReason,
  avatarFieldKey,
  avatarInitials,
  onAvatarUploadingChange,
  avatarDisplayName,
  targetUserId,
  isEditing,
  isSheetOpen,
}: UserSheetFormFieldsProps) {
  const firstFieldRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isSheetOpen && firstFieldRef.current) {
      // Small delay to ensure sheet animation completes
      const timeoutId = setTimeout(() => {
        firstFieldRef.current?.focus()
      }, 100)
      return () => clearTimeout(timeoutId)
    }
  }, [isSheetOpen])

  const fieldDisabledReason = isPending ? pendingReason : null

  return (
    <>
      <FormField
        control={form.control}
        name='avatarPath'
        render={({ field }) => (
          <FormItem>
            <FormControl>
              <AvatarUploadField
                key={avatarFieldKey}
                value={field.value ?? null}
                onChange={next => {
                  form.setValue('avatarPath', next, { shouldDirty: true })
                }}
                onRemovalChange={removed => {
                  form.setValue('avatarRemoved', removed, {
                    shouldDirty: true,
                  })
                }}
                onUploadingChange={onAvatarUploadingChange}
                initials={avatarInitials}
                displayName={avatarDisplayName}
                disabled={isPending}
                targetUserId={targetUserId ?? undefined}
                existingUserId={targetUserId}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <Separator />

      <SheetSection title='Profile'>
        <div className='grid items-start gap-4 sm:grid-cols-2'>
          <FormField
            control={form.control}
            name='fullName'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Full name</FormLabel>
                <FormControl>
                  <DisabledFieldTooltip
                    disabled={isPending}
                    reason={fieldDisabledReason}
                  >
                    <Input
                      {...field}
                      data-autofocus
                      ref={node => {
                        firstFieldRef.current = node
                        if (typeof field.ref === 'function') {
                          field.ref(node)
                        } else if (field.ref) {
                          ;(
                            field.ref as React.MutableRefObject<HTMLInputElement | null>
                          ).current = node
                        }
                      }}
                      placeholder='Ada Lovelace'
                      disabled={isPending}
                      aria-required
                      aria-invalid={Boolean(form.formState.errors.fullName)}
                    />
                  </DisabledFieldTooltip>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name='email'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <DisabledFieldTooltip
                    disabled={emailDisabled}
                    reason={emailDisabledReason}
                  >
                    <Input
                      {...field}
                      value={field.value ?? ''}
                      type='email'
                      placeholder='ada@example.com'
                      disabled={emailDisabled}
                      aria-required
                      aria-invalid={Boolean(form.formState.errors.email)}
                    />
                  </DisabledFieldTooltip>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </SheetSection>

      <Separator />

      <SheetSection title='Sign-in'>
        <div
          className={cn(
            'grid items-start gap-4',
            isEditing && 'sm:grid-cols-2'
          )}
        >
          <FormField
            control={form.control}
            name='role'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Role</FormLabel>
                <FormControl>
                  <DisabledFieldTooltip
                    disabled={roleDisabled}
                    reason={roleDisabledReason}
                  >
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      disabled={roleDisabled}
                    >
                      <SelectTrigger aria-required>
                        <SelectValue placeholder='Select a role' />
                      </SelectTrigger>
                      <SelectContent>
                        {USER_ROLES.map(role => (
                          <SelectItem key={role} value={role}>
                            {role.charAt(0) + role.slice(1).toLowerCase()}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </DisabledFieldTooltip>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          {isEditing ? (
            <FormField
              control={form.control}
              name='accessEnabled'
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor='user-sheet-access-toggle'>
                    Access
                  </FormLabel>
                  <FormControl>
                    <DisabledFieldTooltip
                      disabled={accessToggleDisabled}
                      reason={accessToggleDisabledReason}
                      className='w-auto'
                    >
                      <div className='flex h-9 items-center gap-2'>
                        <Switch
                          id='user-sheet-access-toggle'
                          checked={field.value ?? true}
                          onCheckedChange={field.onChange}
                          disabled={accessToggleDisabled}
                          className='data-[state=checked]:bg-emerald-500 dark:data-[state=checked]:bg-emerald-500'
                          aria-label={
                            (field.value ?? true)
                              ? `Disable sign-in for ${avatarDisplayName ?? 'this user'}`
                              : `Enable sign-in for ${avatarDisplayName ?? 'this user'}`
                          }
                        />
                        <span className='text-sm'>
                          {(field.value ?? true) ? 'Enabled' : 'Disabled'}
                        </span>
                      </div>
                    </DisabledFieldTooltip>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          ) : null}
        </div>
        {isEditing ? (
          <FormField
            control={form.control}
            name='password'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Temporary password</FormLabel>
                <FormControl>
                  <DisabledFieldTooltip
                    disabled={isPending}
                    reason={fieldDisabledReason}
                  >
                    <Input
                      {...field}
                      type='password'
                      value={field.value ?? ''}
                      placeholder='••••••••'
                      disabled={isPending}
                      aria-invalid={Boolean(form.formState.errors.password)}
                    />
                  </DisabledFieldTooltip>
                </FormControl>
                <FormDescription>
                  Setting one forces a reset on next sign-in. 8+ characters.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        ) : null}
      </SheetSection>
    </>
  )
}

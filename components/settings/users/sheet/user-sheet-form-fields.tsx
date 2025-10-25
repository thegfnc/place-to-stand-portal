import type { UseFormReturn } from 'react-hook-form'

import { AvatarUploadField } from '@/components/forms/avatar-upload-field'
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
} from '@/components/ui/select'

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
  avatarFieldKey: number
  avatarInitials: string
  avatarDisplayName: string | null
  targetUserId: string | null
  isEditing: boolean
}

export function UserSheetFormFields({
  form,
  isPending,
  pendingReason,
  emailDisabled,
  emailDisabledReason,
  roleDisabled,
  roleDisabledReason,
  avatarFieldKey,
  avatarInitials,
  avatarDisplayName,
  targetUserId,
  isEditing,
}: UserSheetFormFieldsProps) {
  return (
    <>
      <FormField
        control={form.control}
        name='avatarPath'
        render={({ field }) => (
          <FormItem>
            <FormLabel>Avatar</FormLabel>
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
                initials={avatarInitials}
                displayName={avatarDisplayName}
                disabled={isPending}
                targetUserId={targetUserId ?? undefined}
                existingUserId={targetUserId}
              />
            </FormControl>
            <FormDescription>
              This image appears anywhere their initials would otherwise
              display.
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name='fullName'
        render={({ field }) => (
          <FormItem>
            <FormLabel>Full name</FormLabel>
            <FormControl>
              <DisabledFieldTooltip
                disabled={isPending}
                reason={isPending ? pendingReason : null}
              >
                <Input
                  {...field}
                  value={field.value ?? ''}
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
          name='password'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Temporary password</FormLabel>
              <FormDescription>
                Provide a password to force a reset on next login (8+
                characters).
              </FormDescription>
              <FormControl>
                <DisabledFieldTooltip
                  disabled={isPending}
                  reason={isPending ? pendingReason : null}
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
              <FormMessage />
            </FormItem>
          )}
        />
      ) : null}
    </>
  )
}

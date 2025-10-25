'use client'

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Form } from '@/components/ui/form'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { useToast } from '@/components/ui/use-toast'
import {
  createUser,
  softDeleteUser,
  updateUser,
} from '@/app/(dashboard)/settings/users/actions'
import { useUnsavedChangesWarning } from '@/lib/hooks/use-unsaved-changes-warning'

import type { UserSheetProps } from './types'
import {
  createUserFormResolver,
  editUserFormResolver,
  type UserFormValues,
} from './form-schema'
import { deriveInitials } from './derive-initials'
import { UserSheetFormFields } from './user-sheet-form-fields'

export function UserSheet({
  open,
  onOpenChange,
  onComplete,
  user,
  currentUserId,
}: UserSheetProps) {
  const isEditing = Boolean(user)
  const editingSelf = isEditing && user?.id === currentUserId
  const resolver = useMemo(
    () => (isEditing ? editUserFormResolver : createUserFormResolver),
    [isEditing]
  )

  const form = useForm<UserFormValues>({
    resolver,
    defaultValues: {
      fullName: user?.full_name ?? '',
      email: user?.email ?? '',
      role: user?.role ?? 'CONTRACTOR',
      password: '',
      avatarPath: user?.avatar_url ?? null,
      avatarRemoved: false,
    },
  })

  const { toast } = useToast()
  const [feedback, setFeedback] = useState<string | null>(null)
  const [avatarFieldKey, setAvatarFieldKey] = useState(0)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const pendingReason = 'Please wait for the current request to finish.'
  const emailChangeRestriction =
    'Email cannot be changed after the account is created.'
  const roleChangeRestriction = 'You cannot change your own role.'

  const { requestConfirmation, dialog: unsavedChangesDialog } =
    useUnsavedChangesWarning({ isDirty: form.formState.isDirty })

  const resetFormState = useCallback(() => {
    form.reset({
      fullName: user?.full_name ?? '',
      email: user?.email ?? '',
      role: user?.role ?? 'CONTRACTOR',
      password: '',
      avatarPath: user?.avatar_url ?? null,
      avatarRemoved: false,
    })
    form.clearErrors()
    setFeedback(null)
    setAvatarFieldKey(key => key + 1)
  }, [form, user])

  useEffect(() => {
    if (!open) {
      return
    }

    startTransition(() => {
      resetFormState()
    })
  }, [open, resetFormState, startTransition])

  const handleSheetOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      requestConfirmation(() => {
        startTransition(() => {
          resetFormState()
        })
        onOpenChange(false)
      })
      return
    }

    onOpenChange(nextOpen)
  }

  const onSubmit = (values: UserFormValues) => {
    startTransition(async () => {
      setFeedback(null)

      const trimmedPassword = values.password?.trim() ?? ''
      const normalizedAvatarPath = values.avatarPath?.trim()
        ? values.avatarPath.trim()
        : undefined
      const avatarRemoved = Boolean(values.avatarRemoved)

      if (isEditing && user) {
        const result = await updateUser({
          id: user.id,
          fullName: values.fullName,
          role: editingSelf ? user.role : values.role,
          password: trimmedPassword.length >= 8 ? trimmedPassword : undefined,
          avatarPath: normalizedAvatarPath,
          avatarRemoved,
        })

        if (result.error) {
          setFeedback(result.error)
          return
        }

        toast({
          title: 'User updated',
          description: 'Changes saved successfully.',
        })
      } else {
        const result = await createUser({
          email: values.email,
          fullName: values.fullName,
          role: values.role,
          avatarPath: normalizedAvatarPath,
        })

        if (result.error) {
          setFeedback(result.error)
          return
        }

        toast({
          title: 'Invite sent',
          description:
            'The new teammate received their login details via email.',
        })
      }

      resetFormState()
      onOpenChange(false)
      onComplete()
    })
  }

  const handleRequestDelete = () => {
    if (!user) {
      return
    }

    if (user.id === currentUserId) {
      setFeedback('You cannot delete your own account.')
      return
    }

    if (isPending) {
      return
    }

    setIsDeleteDialogOpen(true)
  }

  const handleCancelDelete = () => {
    if (isPending) {
      return
    }

    setIsDeleteDialogOpen(false)
  }

  const handleConfirmDelete = () => {
    if (!user || user.id === currentUserId || isPending) {
      return
    }

    setIsDeleteDialogOpen(false)

    startTransition(async () => {
      setFeedback(null)
      const result = await softDeleteUser({ id: user.id })

      if (result.error) {
        setFeedback(result.error)
        return
      }

      onOpenChange(false)
      onComplete()
      toast({
        title: 'User deleted',
        description: `${user.full_name ?? user.email} can no longer access the portal.`,
      })
    })
  }

  const deleteDisabled = isPending || user?.id === currentUserId
  const deleteDisabledReason = deleteDisabled
    ? isPending
      ? pendingReason
      : 'You cannot delete your own account.'
    : null

  const submitDisabled = isPending
  const submitDisabledReason = submitDisabled ? pendingReason : null

  const watchedFullName = useWatch({ control: form.control, name: 'fullName' })
  const watchedEmail = useWatch({ control: form.control, name: 'email' })
  const avatarInitials = deriveInitials(
    watchedFullName || user?.full_name,
    watchedEmail || user?.email
  )
  const avatarDisplayName = watchedFullName || user?.full_name || null

  const emailDisabled = isPending || isEditing
  const emailDisabledReason = emailDisabled
    ? isPending
      ? pendingReason
      : emailChangeRestriction
    : null

  const roleDisabled = isPending || editingSelf
  const roleDisabledReason = roleDisabled
    ? isPending
      ? pendingReason
      : editingSelf
        ? roleChangeRestriction
        : null
    : null

  return (
    <>
      <Sheet open={open} onOpenChange={handleSheetOpenChange}>
        <SheetContent className='flex w-full flex-col gap-6 overflow-y-auto sm:max-w-lg'>
          <SheetHeader className='px-6 pt-6'>
            <SheetTitle>{isEditing ? 'Edit user' : 'Add user'}</SheetTitle>
            <SheetDescription>
              {isEditing
                ? "Update the member's access level or reset their credentials."
                : 'Provision a new teammate with immediate access to the portal.'}
            </SheetDescription>
          </SheetHeader>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className='flex flex-1 flex-col gap-5 px-6 pb-6'
            >
              <UserSheetFormFields
                form={form}
                isPending={isPending}
                pendingReason={pendingReason}
                emailDisabled={emailDisabled}
                emailDisabledReason={emailDisabledReason}
                roleDisabled={roleDisabled}
                roleDisabledReason={roleDisabledReason}
                avatarFieldKey={avatarFieldKey}
                avatarInitials={avatarInitials}
                avatarDisplayName={avatarDisplayName}
                targetUserId={user?.id ?? null}
                isEditing={isEditing}
              />
              {feedback ? (
                <p className='text-destructive text-sm'>{feedback}</p>
              ) : null}
              <SheetFooter className='flex items-center justify-between gap-3 px-0 pt-6 pb-0'>
                <DisabledFieldTooltip
                  disabled={submitDisabled}
                  reason={submitDisabledReason}
                >
                  <Button type='submit' disabled={submitDisabled}>
                    {isEditing ? 'Save changes' : 'Send invite'}
                  </Button>
                </DisabledFieldTooltip>
                {isEditing ? (
                  <DisabledFieldTooltip
                    disabled={deleteDisabled}
                    reason={deleteDisabledReason}
                  >
                    <Button
                      type='button'
                      variant='destructive'
                      onClick={handleRequestDelete}
                      disabled={deleteDisabled}
                      aria-label='Delete user'
                    >
                      <Trash2 className='h-4 w-4' />
                    </Button>
                  </DisabledFieldTooltip>
                ) : null}
              </SheetFooter>
            </form>
          </Form>
        </SheetContent>
      </Sheet>
      <ConfirmDialog
        open={isDeleteDialogOpen}
        title='Delete user?'
        description='Deleting this user removes their access but keeps historical records intact.'
        confirmLabel='Delete'
        confirmVariant='destructive'
        confirmDisabled={isPending}
        onCancel={handleCancelDelete}
        onConfirm={handleConfirmDelete}
      />
      {unsavedChangesDialog}
    </>
  )
}

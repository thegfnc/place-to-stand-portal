import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { useForm, useWatch, type UseFormReturn } from 'react-hook-form'

import {
  createUser,
  softDeleteUser,
  updateUser,
} from '@/app/(dashboard)/settings/users/actions'
import { useUnsavedChangesWarning } from '@/lib/hooks/use-unsaved-changes-warning'
import { useToast } from '@/components/ui/use-toast'
import {
  finishSettingsInteraction,
  startSettingsInteraction,
} from '@/lib/posthog/settings'

import { deriveInitials } from './derive-initials'
import {
  createUserFormResolver,
  editUserFormResolver,
  type UserFormValues,
} from './form-schema'
import type { UserSheetProps } from './types'

const PENDING_REASON = 'Please wait for the current request to finish.'
const EMAIL_CHANGE_RESTRICTION =
  'Email cannot be changed after the account is created.'
const ROLE_CHANGE_RESTRICTION = 'You cannot change your own role.'
const SELF_DELETE_RESTRICTION = 'You cannot delete your own account.'

export type UseUserSheetStateReturn = {
  form: UseFormReturn<UserFormValues>
  isEditing: boolean
  isPending: boolean
  feedback: string | null
  avatarFieldKey: number
  avatarInitials: string
  avatarDisplayName: string | null
  emailDisabled: boolean
  emailDisabledReason: string | null
  roleDisabled: boolean
  roleDisabledReason: string | null
  submitDisabled: boolean
  submitDisabledReason: string | null
  deleteDisabled: boolean
  deleteDisabledReason: string | null
  isDeleteDialogOpen: boolean
  pendingReason: string
  unsavedChangesDialog: ReturnType<typeof useUnsavedChangesWarning>['dialog']
  handleSheetOpenChange: (open: boolean) => void
  handleFormSubmit: (values: UserFormValues) => void
  handleRequestDelete: () => void
  handleCancelDelete: () => void
  handleConfirmDelete: () => void
}

export const useUserSheetState = ({
  open,
  onOpenChange,
  onComplete,
  user,
  currentUserId,
}: UserSheetProps): UseUserSheetStateReturn => {
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
      role: user?.role ?? 'CLIENT',
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

  const { requestConfirmation, dialog: unsavedChangesDialog } =
    useUnsavedChangesWarning({ isDirty: form.formState.isDirty })

  const resetFormState = useCallback(() => {
    form.reset({
      fullName: user?.full_name ?? '',
      email: user?.email ?? '',
      role: user?.role ?? 'CLIENT',
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

  const handleSheetOpenChange = useCallback(
    (nextOpen: boolean) => {
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
    },
    [onOpenChange, requestConfirmation, resetFormState, startTransition]
  )

  const handleFormSubmit = useCallback(
    (values: UserFormValues) => {
      startTransition(async () => {
        setFeedback(null)

        const trimmedPassword = values.password?.trim() ?? ''
        const normalizedAvatarPath = values.avatarPath?.trim()
          ? values.avatarPath.trim()
          : undefined
        const avatarRemoved = Boolean(values.avatarRemoved)
        const baseInteraction = startSettingsInteraction({
          entity: 'user',
          mode: isEditing ? 'edit' : 'create',
          targetId: user?.id ?? null,
          metadata: {
            role: values.role,
            editingSelf,
          },
        })

        if (isEditing && user) {
          try {
            const result = await updateUser({
              id: user.id,
              fullName: values.fullName,
              role: editingSelf ? user.role : values.role,
              password:
                trimmedPassword.length >= 8 ? trimmedPassword : undefined,
              avatarPath: normalizedAvatarPath,
              avatarRemoved,
            })

            if (result.error) {
              finishSettingsInteraction(baseInteraction, {
                status: 'error',
                targetId: user.id,
                error: result.error,
              })
              setFeedback(result.error)
              return
            }

            finishSettingsInteraction(baseInteraction, {
              status: 'success',
              targetId: user.id,
            })

            toast({
              title: 'User updated',
              description: 'Changes saved successfully.',
            })
          } catch (error) {
            finishSettingsInteraction(baseInteraction, {
              status: 'error',
              targetId: user.id,
              error: error instanceof Error ? error.message : 'Unknown error',
            })
            setFeedback('We could not update this user. Please try again.')
            return
          }
        } else {
          try {
            const result = await createUser({
              email: values.email,
              fullName: values.fullName,
              role: values.role,
              avatarPath: normalizedAvatarPath,
            })

            if (result.error) {
              finishSettingsInteraction(baseInteraction, {
                status: 'error',
                error: result.error,
              })
              setFeedback(result.error)
              return
            }

            const createdUserId =
              (result as { userId?: string | null }).userId ?? null

            finishSettingsInteraction(baseInteraction, {
              status: 'success',
              targetId: createdUserId,
            })

            toast({
              title: 'Invite sent',
              description:
                'The new teammate received their login details via email.',
            })
          } catch (error) {
            finishSettingsInteraction(baseInteraction, {
              status: 'error',
              error: error instanceof Error ? error.message : 'Unknown error',
            })
            setFeedback('We could not create this user. Please try again.')
            return
          }
        }

        resetFormState()
        onOpenChange(false)
        onComplete()
      })
    },
    [
      editingSelf,
      isEditing,
      onComplete,
      onOpenChange,
      resetFormState,
      startTransition,
      toast,
      user,
    ]
  )

  const handleRequestDelete = useCallback(() => {
    if (!user) {
      return
    }

    if (user.id === currentUserId) {
      setFeedback(SELF_DELETE_RESTRICTION)
      return
    }

    if (isPending) {
      return
    }

    setIsDeleteDialogOpen(true)
  }, [currentUserId, isPending, user])

  const handleCancelDelete = useCallback(() => {
    if (isPending) {
      return
    }

    setIsDeleteDialogOpen(false)
  }, [isPending])

  const handleConfirmDelete = useCallback(() => {
    if (!user || user.id === currentUserId || isPending) {
      return
    }

    setIsDeleteDialogOpen(false)

    startTransition(async () => {
      setFeedback(null)
      const interaction = startSettingsInteraction({
        entity: 'user',
        mode: 'delete',
        targetId: user.id,
        metadata: {
          email: user.email,
        },
      })

      try {
        const result = await softDeleteUser({ id: user.id })

        if (result.error) {
          finishSettingsInteraction(interaction, {
            status: 'error',
            targetId: user.id,
            error: result.error,
          })
          setFeedback(result.error)
          return
        }

        finishSettingsInteraction(interaction, {
          status: 'success',
          targetId: user.id,
        })

        onOpenChange(false)
        onComplete()
        toast({
          title: 'User deleted',
          description: `${user.full_name ?? user.email} can no longer access the portal.`,
        })
      } catch (error) {
        finishSettingsInteraction(interaction, {
          status: 'error',
          targetId: user.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
        setFeedback('We could not delete this user. Please try again.')
      }
    })
  }, [
    currentUserId,
    isPending,
    onComplete,
    onOpenChange,
    startTransition,
    toast,
    user,
  ])

  const emailDisabled = isPending || isEditing
  const emailDisabledReason = emailDisabled
    ? isPending
      ? PENDING_REASON
      : EMAIL_CHANGE_RESTRICTION
    : null

  const roleDisabled = isPending || editingSelf
  const roleDisabledReason = roleDisabled
    ? isPending
      ? PENDING_REASON
      : editingSelf
        ? ROLE_CHANGE_RESTRICTION
        : null
    : null

  const submitDisabled = isPending
  const submitDisabledReason = submitDisabled ? PENDING_REASON : null

  const deleteDisabled = isPending || user?.id === currentUserId
  const deleteDisabledReason = deleteDisabled
    ? isPending
      ? PENDING_REASON
      : SELF_DELETE_RESTRICTION
    : null

  const watchedFullName = useWatch({ control: form.control, name: 'fullName' })
  const watchedEmail = useWatch({ control: form.control, name: 'email' })

  const avatarInitials = deriveInitials(
    watchedFullName || user?.full_name,
    watchedEmail || user?.email
  )
  const avatarDisplayName = watchedFullName || user?.full_name || null

  return {
    form,
    isEditing,
    isPending,
    feedback,
    avatarFieldKey,
    avatarInitials,
    avatarDisplayName,
    emailDisabled,
    emailDisabledReason,
    roleDisabled,
    roleDisabledReason,
    submitDisabled,
    submitDisabledReason,
    deleteDisabled,
    deleteDisabledReason,
    isDeleteDialogOpen,
    pendingReason: PENDING_REASON,
    unsavedChangesDialog,
    handleSheetOpenChange,
    handleFormSubmit,
    handleRequestDelete,
    handleCancelDelete,
    handleConfirmDelete,
  }
}

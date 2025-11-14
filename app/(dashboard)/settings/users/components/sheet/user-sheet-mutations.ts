"use client"

import type { TransitionStartFunction } from "react"

import {
  createUser,
  softDeleteUser,
  updateUser,
} from "@/app/(dashboard)/settings/users/actions"
import { finishSettingsInteraction, startSettingsInteraction } from "@/lib/posthog/settings"
import { toast } from "@/components/ui/use-toast"

import {
  EMAIL_CHANGE_RESTRICTION,
  PENDING_REASON,
  ROLE_CHANGE_RESTRICTION,
  SELF_DELETE_RESTRICTION,
} from "./constants"
import type { UserFormValues } from "./form-schema"
import type { UserRow } from "./types"

type SubmitHandlerArgs = {
  isEditing: boolean
  editingSelf: boolean
  user: UserRow | null
  onComplete: () => void
  onClose: (open: boolean) => void
  resetFormState: () => void
  setFeedback: (value: string | null) => void
  transition: TransitionStartFunction
}

export function createSubmitHandler({
  isEditing,
  editingSelf,
  user,
  onComplete,
  onClose,
  resetFormState,
  setFeedback,
  transition,
}: SubmitHandlerArgs) {
  return (values: UserFormValues) => {
    transition(async () => {
      setFeedback(null)

      const trimmedPassword = values.password?.trim() ?? ""
      const normalizedAvatarPath = values.avatarPath?.trim()
        ? values.avatarPath.trim()
        : undefined
      const avatarRemoved = Boolean(values.avatarRemoved)
      const baseInteraction = startSettingsInteraction({
        entity: "user",
        mode: isEditing ? "edit" : "create",
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
            password: trimmedPassword.length >= 8 ? trimmedPassword : undefined,
            avatarPath: normalizedAvatarPath,
            avatarRemoved,
          })

          if (result.error) {
            finishSettingsInteraction(baseInteraction, {
              status: "error",
              targetId: user.id,
              error: result.error,
            })
            setFeedback(result.error)
            return
          }

          finishSettingsInteraction(baseInteraction, {
            status: "success",
            targetId: user.id,
          })

          toast({
            title: "User updated",
            description: "Changes saved successfully.",
          })
        } catch (error) {
          finishSettingsInteraction(baseInteraction, {
            status: "error",
            targetId: user.id,
            error: error instanceof Error ? error.message : "Unknown error",
          })
          setFeedback("We could not update this user. Please try again.")
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
              status: "error",
              error: result.error,
            })
            setFeedback(result.error)
            return
          }

          const createdUserId =
            (result as { userId?: string | null }).userId ?? null

          finishSettingsInteraction(baseInteraction, {
            status: "success",
            targetId: createdUserId,
          })

          toast({
            title: "Invite sent",
            description:
              "The new teammate received their login details via email.",
          })
        } catch (error) {
          finishSettingsInteraction(baseInteraction, {
            status: "error",
            error: error instanceof Error ? error.message : "Unknown error",
          })
          setFeedback("We could not create this user. Please try again.")
          return
        }
      }

      resetFormState()
      onClose(false)
      onComplete()
    })
  }
}

type DeleteHandlerArgs = {
  user: UserRow | null
  currentUserId: string
  isPending: boolean
  setFeedback: (value: string | null) => void
  setIsDeleteDialogOpen: (open: boolean) => void
  onClose: (open: boolean) => void
  onComplete: () => void
  transition: TransitionStartFunction
}

export function createDeleteRequestHandler({
  user,
  currentUserId,
  isPending,
  setFeedback,
  setIsDeleteDialogOpen,
}: DeleteHandlerArgs) {
  return () => {
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
  }
}

export function createDeleteCancelHandler({
  isPending,
  setIsDeleteDialogOpen,
}: Pick<DeleteHandlerArgs, "isPending" | "setIsDeleteDialogOpen">) {
  return () => {
    if (isPending) {
      return
    }

    setIsDeleteDialogOpen(false)
  }
}

export function createDeleteConfirmHandler({
  user,
  currentUserId,
  isPending,
  setIsDeleteDialogOpen,
  setFeedback,
  onClose,
  onComplete,
  transition,
}: DeleteHandlerArgs) {
  return () => {
    if (!user || user.id === currentUserId || isPending) {
      return
    }

    setIsDeleteDialogOpen(false)

    transition(async () => {
      setFeedback(null)
      const interaction = startSettingsInteraction({
        entity: "user",
        mode: "delete",
        targetId: user.id,
        metadata: {
          email: user.email,
        },
      })

      try {
        const result = await softDeleteUser({ id: user.id })

        if (result.error) {
          finishSettingsInteraction(interaction, {
            status: "error",
            targetId: user.id,
            error: result.error,
          })
          setFeedback(result.error)
          return
        }

        finishSettingsInteraction(interaction, {
          status: "success",
          targetId: user.id,
        })

        onClose(false)
        onComplete()
        toast({
          title: "User deleted",
          description: `${
            user.full_name ?? user.email
          } can no longer access the portal.`,
        })
      } catch (error) {
        finishSettingsInteraction(interaction, {
          status: "error",
          targetId: user.id,
          error: error instanceof Error ? error.message : "Unknown error",
        })
        setFeedback("We could not delete this user. Please try again.")
      }
    })
  }
}

export function getEmailDisabledReason(isPending: boolean, isEditing: boolean) {
  if (!isPending && !isEditing) {
    return null
  }

  return isPending ? PENDING_REASON : EMAIL_CHANGE_RESTRICTION
}

export function getRoleDisabledReason(
  isPending: boolean,
  editingSelf: boolean
) {
  if (!isPending && !editingSelf) {
    return null
  }

  if (isPending) {
    return PENDING_REASON
  }

  return ROLE_CHANGE_RESTRICTION
}

export function getSubmitDisabledReason(isPending: boolean) {
  return isPending ? PENDING_REASON : null
}

export function getDeleteDisabledReason(
  isPending: boolean,
  disable: boolean
) {
  if (!disable && !isPending) {
    return null
  }

  return isPending ? PENDING_REASON : SELF_DELETE_RESTRICTION
}


import { zodResolver } from '@hookform/resolvers/zod'
import type { Resolver } from 'react-hook-form'
import { z } from 'zod'

import { USER_ROLES } from '@/src/lib/settings/users/user-validation'

const baseSchema = z.object({
  fullName: z.string().trim().min(1, 'Full name is required'),
  email: z.string().trim().email('Provide a valid email'),
  role: z.enum(USER_ROLES),
  avatarPath: z.string().trim().min(1).max(255).optional().nullable(),
  avatarRemoved: z.boolean().optional(),
})

const editSchema = baseSchema.extend({
  password: z
    .string()
    .optional()
    .superRefine((value, ctx) => {
      const trimmed = value?.trim() ?? ''

      if (trimmed.length > 0 && trimmed.length < 8) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Password must be at least 8 characters.',
        })
      }
    }),
})

export type UserFormValues = z.infer<typeof editSchema>

export const createUserFormResolver = zodResolver(
  baseSchema.extend({ password: z.string().optional() })
) as Resolver<UserFormValues>

export const editUserFormResolver: Resolver<UserFormValues> =
  zodResolver(editSchema)

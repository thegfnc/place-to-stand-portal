import { z } from 'zod'

export const USER_ROLES = ['ADMIN', 'CONTRACTOR', 'CLIENT'] as const

export const createUserSchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(1),
  role: z.enum(USER_ROLES),
  avatarPath: z.string().min(1).max(255).optional(),
})

export const updateUserSchema = z.object({
  id: z.string().uuid(),
  fullName: z.string().min(1),
  role: z.enum(USER_ROLES),
  password: z.string().min(8).optional(),
  avatarPath: z.string().min(1).max(255).optional(),
  avatarRemoved: z.boolean().optional(),
})

export const deleteUserSchema = z.object({
  id: z.string().uuid(),
})

export const restoreUserSchema = z.object({
  id: z.string().uuid(),
})

export type CreateUserInput = z.infer<typeof createUserSchema>
export type UpdateUserInput = z.infer<typeof updateUserSchema>
export type DeleteUserInput = z.infer<typeof deleteUserSchema>
export type RestoreUserInput = z.infer<typeof restoreUserSchema>

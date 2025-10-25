import { z } from 'zod'

export const taskSheetFormSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional().nullable(),
  status: z.enum([
    'BACKLOG',
    'ON_DECK',
    'IN_PROGRESS',
    'IN_REVIEW',
    'BLOCKED',
    'DONE',
    'ARCHIVED',
  ] as const),
  dueOn: z.string().optional(),
  assigneeId: z.string().uuid().optional().nullable(),
})

export type TaskSheetFormValues = z.infer<typeof taskSheetFormSchema>

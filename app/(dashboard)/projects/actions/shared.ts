import { z } from 'zod'

export const TASK_STATUSES = [
  'BACKLOG',
  'ON_DECK',
  'IN_PROGRESS',
  'BLOCKED',
  'IN_REVIEW',
  'DONE',
  'ARCHIVED',
] as const

export const statusSchema = z.enum(TASK_STATUSES)

const attachmentToAttachSchema = z.object({
  path: z.string().min(1),
  originalName: z.string().min(1),
  mimeType: z.string().min(1),
  fileSize: z.number().int().min(1),
})

export const attachmentsSchema = z.object({
  toAttach: z.array(attachmentToAttachSchema).default([]),
  toRemove: z.array(z.string().uuid()).default([]),
})

export const baseTaskSchema = z.object({
  id: z.string().uuid().optional(),
  projectId: z.string().uuid(),
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  status: statusSchema.default('BACKLOG'),
  dueOn: z.string().optional().nullable(),
  assigneeIds: z.array(z.string().uuid()).default([]),
  attachments: attachmentsSchema.optional(),
})

export type BaseTaskInput = z.infer<typeof baseTaskSchema>
export type AttachmentPayload = z.infer<typeof attachmentsSchema>

export type ActionResult = {
  error?: string
}

import { z } from 'zod'

import { statusSchema } from '@/app/(dashboard)/projects/actions/shared-schemas'

/**
 * `baseTaskSchema` types `dueOn` as a bare string, so a malformed date reaches
 * Postgres and comes back as a raw driver error. Constrain it here rather than
 * in the shared schema, which would change browser behaviour too.
 */
const dueOnSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'dueOn must be an ISO date (YYYY-MM-DD).')

const titleSchema = z.string().trim().min(1, 'title is required.').max(500)

/** A project UUID or slug — resolved server-side, since agents know slugs. */
const projectRefSchema = z.string().trim().min(1, 'project is required.')

/** A user UUID or email address — resolved server-side, same reasoning. */
const assigneeRefSchema = z.array(z.string().trim().min(1))

export const cliCreateTaskSchema = z.object({
  title: titleSchema,
  project: projectRefSchema,
  description: z.string().nullish(),
  status: statusSchema.default('ON_DECK'),
  dueOn: dueOnSchema.nullish(),
  assigneeIds: assigneeRefSchema.default([]),
  leadId: z.string().uuid().nullish(),
})

/**
 * Every field optional: an omitted key keeps its current value, while an
 * explicit `null` clears it. Zod's `.optional()` vs `.nullable()` split is
 * what carries that distinction through to the merge.
 */
export const cliUpdateTaskSchema = z
  .object({
    title: titleSchema.optional(),
    project: projectRefSchema.optional(),
    description: z.string().nullable().optional(),
    status: statusSchema.optional(),
    dueOn: dueOnSchema.nullable().optional(),
    assigneeIds: assigneeRefSchema.optional(),
    leadId: z.string().uuid().nullable().optional(),
  })
  .refine(payload => Object.keys(payload).length > 0, {
    message: 'Provide at least one field to update.',
  })
export const cliTaskListQuerySchema = z.object({
  project: projectRefSchema.optional(),
  status: statusSchema.optional(),
  assignee: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
})

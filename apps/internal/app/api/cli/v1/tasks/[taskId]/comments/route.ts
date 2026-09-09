import { z } from 'zod'

import { toRichTextHtml } from '@/lib/cli/description'
import { jsonOk, readJsonBody, withCliAuth } from '@/lib/cli/handler'
import { serializeComment } from '@/lib/cli/serializers/comment'
import {
  createTaskComment,
  listTaskComments,
} from '@/lib/queries/task-comments'

type Params = { taskId: string }

const createCommentSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, 'body is required.')
    .max(10_000, 'body exceeds the maximum length.'),
})

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
})

export const GET = withCliAuth<Params>(async ({ user, request, params }) => {
  const query = listQuerySchema.parse(
    Object.fromEntries(new URL(request.url).searchParams)
  )

  const page = await listTaskComments(user, params.taskId, {
    limit: query.limit,
  })

  return jsonOk(page.items.map(serializeComment), {
    meta: { hasNextPage: page.pageInfo.hasNextPage },
  })
})

export const POST = withCliAuth<Params>(async ({ user, request, params }) => {
  const payload = createCommentSchema.parse(await readJsonBody(request))

  // Comments render through `sanitizeEditorHtml`, same as descriptions, so
  // plain text needs the same conversion to survive with its structure.
  const body = toRichTextHtml(payload.body)

  // `createTaskComment` writes the activity row itself; only the source
  // distinguishes a CLI comment from a browser one.
  const { commentId } = await createTaskComment(
    user,
    { taskId: params.taskId, body },
    { source: 'CLI' }
  )

  const page = await listTaskComments(user, params.taskId, { limit: 1 })
  const created = page.items.find(item => item.id === commentId)

  return jsonOk(
    created ? serializeComment(created) : { id: commentId, taskId: params.taskId },
    { status: 201 }
  )
})

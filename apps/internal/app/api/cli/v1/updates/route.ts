import { jsonOk, readJsonBody, withCliAuth } from '@/lib/cli/handler'
import {
  cliCreateUpdateSchema,
  cliUpdateListQuerySchema,
} from '@/lib/cli/schemas/updates'
import { serializeClientUpdate } from '@/lib/cli/serializers/client-update'
import { resolveClientIdentifier } from '@/lib/data/clients'
import { createUpdateDraft, listClientUpdates } from '@/lib/updates'

export const GET = withCliAuth(async ({ user, request }) => {
  const query = cliUpdateListQuerySchema.parse(
    Object.fromEntries(new URL(request.url).searchParams)
  )

  const clientId = query.client
    ? (await resolveClientIdentifier(user, query.client)).resolvedId
    : undefined

  const rows = await listClientUpdates({
    clientId,
    status: query.status,
    limit: query.limit,
  })

  return rows.map(serializeClientUpdate)
})

export const POST = withCliAuth(async ({ user, request }) => {
  const payload = cliCreateUpdateSchema.parse(await readJsonBody(request))

  const update = await createUpdateDraft(user, {
    clientRef: payload.client,
    since: payload.since,
    subject: payload.subject,
    intro: payload.intro,
    items: payload.items,
    closing: payload.closing,
    source: 'CLI',
  })

  return jsonOk(serializeClientUpdate(update), { status: 201 })
})

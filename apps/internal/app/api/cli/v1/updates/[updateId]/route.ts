import { withCliAuth } from '@/lib/cli/handler'
import { serializeClientUpdate } from '@/lib/cli/serializers/client-update'
import { NotFoundError } from '@/lib/errors/http'
import { UUID_PATTERN } from '@/lib/sheets/entities'
import { fetchClientUpdate } from '@/lib/updates'

type Params = { updateId: string }

export const GET = withCliAuth<Params>(async ({ params }) => {
  // Guard before the query: a non-UUID would surface as a driver cast error.
  if (!UUID_PATTERN.test(params.updateId)) {
    throw new NotFoundError('Update not found')
  }

  return serializeClientUpdate(await fetchClientUpdate(params.updateId))
})

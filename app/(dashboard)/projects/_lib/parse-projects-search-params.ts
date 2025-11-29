type RawParams = Record<string, string | string[] | undefined>

export function parseProjectsSearchParams(params: RawParams) {
  const searchQuery = extractParam(params.q)
  const cursor = extractParam(params.cursor)
  const directionParam = extractParam(params.dir)
  const direction = directionParam === 'backward' ? 'backward' : ('forward' as const)
  const limitRaw = extractParam(params.limit)
  const limit = Number.parseInt(limitRaw ?? '', 10)

  return {
    searchQuery,
    cursor,
    direction,
    limit: Number.isFinite(limit) ? limit : undefined,
  }
}

function extractParam(value: string | string[] | undefined): string | null {
  if (typeof value === 'string') {
    return value
  }

  if (Array.isArray(value)) {
    return value[0] ?? null
  }

  return null
}

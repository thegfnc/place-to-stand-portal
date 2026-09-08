import 'server-only'

import { NextResponse } from 'next/server'

import {
  integrationProviderFromSlug,
  type IntegrationProvider,
} from '@/lib/types/integrations'

import { IntegrationNotConnectedError, InvalidIntegrationTokenError } from './connections'

/**
 * Resolves the `[provider]` segment of `/api/integrations/[provider]/...`.
 * Unknown slugs 404 so the dynamic segment never shadows the static GitHub
 * and Google routes that sit beside it.
 */
export function resolveProviderParam(
  slug: string
): { provider: IntegrationProvider } | { response: NextResponse } {
  const provider = integrationProviderFromSlug(slug)
  if (!provider) {
    return {
      response: NextResponse.json(
        { ok: false, error: 'Unknown integration provider' },
        { status: 404 }
      ),
    }
  }
  return { provider }
}

export function integrationErrorResponse(error: unknown): NextResponse {
  if (error instanceof IntegrationNotConnectedError) {
    return NextResponse.json(
      { ok: false, error: error.message, code: 'NOT_CONNECTED' },
      { status: 401 }
    )
  }
  if (error instanceof InvalidIntegrationTokenError) {
    return NextResponse.json(
      { ok: false, error: error.message, code: 'INVALID_TOKEN' },
      { status: 400 }
    )
  }
  console.error('[integrations] request failed:', error)
  return NextResponse.json(
    { ok: false, error: 'Integration request failed' },
    { status: 502 }
  )
}

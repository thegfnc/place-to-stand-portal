import { siSupabase, siVercel } from 'simple-icons/icons'

import type { IntegrationProvider } from '@/lib/types/integrations'
import { cn } from '@/lib/utils'

type SimpleIconShape = { title: string; path: string; hex: string }

const PROVIDER_ICONS: Record<
  IntegrationProvider,
  { icon: SimpleIconShape; color?: string }
> = {
  VERCEL: { icon: siVercel },
  // Supabase's brand green survives both themes; Vercel's triangle takes
  // currentColor so it flips with the theme like the GitHub mark does.
  SUPABASE: { icon: siSupabase, color: '#3ECF8E' },
}

export function IntegrationProviderIcon({
  provider,
  className,
}: {
  provider: IntegrationProvider
  className?: string
}) {
  const { icon, color } = PROVIDER_ICONS[provider]
  return (
    <svg
      role='img'
      viewBox='0 0 24 24'
      className={cn('shrink-0', className)}
      xmlns='http://www.w3.org/2000/svg'
      fill={color ?? 'currentColor'}
    >
      <title>{icon.title}</title>
      <path d={icon.path} />
    </svg>
  )
}

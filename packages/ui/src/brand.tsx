import { cn } from './cn'

/**
 * Place To Stand brand marks, matching the marketing site.
 *
 * `BrandLogo` is the marketing header lockup: the blueprint mark (an
 * accent-bordered square holding an accent dot) beside "Place To Stand" in
 * Space Grotesk. Every logo in both portals is this lockup — the signed-in
 * headers, the public share pages, and the auth screens. The "PTS" tile with
 * corner brackets is the favicon only (see `brand-icon-assets.ts`).
 *
 * The wordmark reads `--font-space-grotesk`, which both apps' root layouts
 * load.
 */

/** Marketing brand tokens — see the marketing site's globals.css. */
export const BRAND = {
  bg: '#0e0f11',
  bgPanel: 'rgba(22, 24, 28, 0.88)',
  border: '#2a2b30',
  borderLight: '#3a3b40',
  text: '#e8e6e3',
  textMuted: '#a8a8ac',
  accent: '#b5f542',
  gridDot: '#2a2b30',
} as const

/**
 * `theme` follows the portal's light/dark theme. The brand lime (#b5f542)
 * is built for the dark marketing ground and all but vanishes on white, so
 * light mode swaps in lime-600 for the mark. `brand` pins the dark marketing
 * colours, for the always-dark auth screens.
 */
type BrandTone = 'theme' | 'brand'

const TONE_CLASSES: Record<
  BrandTone,
  { frame: string; dot: string; word: string }
> = {
  theme: {
    frame: 'border-[#65a30d]/60 dark:border-[#b5f542]/50',
    dot: 'bg-[#65a30d] dark:bg-[#b5f542]',
    word: 'text-foreground',
  },
  brand: {
    frame: 'border-[#b5f542]/50',
    dot: 'bg-[#b5f542]',
    word: 'text-[#e8e6e3]',
  },
}

/**
 * The blueprint mark on its own — for spaces too tight for the wordmark
 * (the collapsed sidebar). Proportions follow the marketing header (24px
 * square, 8px dot, 1px frame) and share card (36px, 12px dot, 2px frame).
 */
export function BrandLogoMark({
  size = 24,
  tone = 'theme',
  className,
}: {
  size?: number
  tone?: BrandTone
  className?: string
}) {
  const dot = Math.round(size / 3)

  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex shrink-0 items-center justify-center border',
        TONE_CLASSES[tone].frame,
        className
      )}
      style={{ width: size, height: size, borderWidth: size >= 32 ? 2 : 1 }}
    >
      <span className={TONE_CLASSES[tone].dot} style={{ width: dot, height: dot }} />
    </span>
  )
}

const LOGO_SIZES = {
  sm: { mark: 16, text: 'text-[15px]', gap: 'gap-2' },
  md: { mark: 20, text: 'text-lg', gap: 'gap-2.5' },
  lg: { mark: 24, text: 'text-xl', gap: 'gap-3' },
} as const

/** Mark + wordmark, as in the marketing site header. `lg` is its exact size. */
export function BrandLogo({
  size = 'md',
  tone = 'theme',
  className,
}: {
  size?: keyof typeof LOGO_SIZES
  tone?: BrandTone
  className?: string
}) {
  const { mark, text, gap } = LOGO_SIZES[size]

  return (
    <span className={cn('inline-flex items-center', gap, className)}>
      <BrandLogoMark size={mark} tone={tone} />
      <span
        className={cn(
          'leading-none font-bold tracking-tight whitespace-nowrap',
          text,
          TONE_CLASSES[tone].word
        )}
        style={{ fontFamily: 'var(--font-space-grotesk, inherit)' }}
      >
        Place To Stand
      </span>
    </span>
  )
}

/**
 * Mark + wordmark + a mono micro-label naming which portal you are signing in
 * to. `label` is what distinguishes the two apps' screens from each other.
 */
export function BrandLockup({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-4">
      <BrandLogoMark size={36} tone="brand" />
      <div className="flex flex-col items-center gap-2">
        <span
          className="text-xl font-bold tracking-tight"
          style={{
            color: BRAND.text,
            fontFamily: 'var(--font-space-grotesk, inherit)',
          }}
        >
          Place To Stand
        </span>
        <span
          className="font-mono text-[11px] uppercase tracking-[0.1em]"
          style={{ color: BRAND.accent }}
        >
          {label}
        </span>
      </div>
    </div>
  )
}

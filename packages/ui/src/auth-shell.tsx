import type { ReactNode } from 'react'

import { BRAND, BRAND_DOT_GRID, BrandLockup } from './brand'
import { cn } from './cn'

/**
 * The signed-out chrome for both portals: the marketing site's dark blueprint
 * background, the PTS lockup, and a translucent panel for whatever form the
 * page owns.
 *
 * Dark regardless of the viewer's theme. The marketing identity is dark-only,
 * and these screens are the handoff from the marketing site — the signed-in
 * app picks the theme back up on the other side of the form.
 *
 * Only auth screens use this. Everything behind the login keeps its own
 * header and theme.
 */

type Props = {
  /** Mono micro-label under the wordmark, e.g. "Internal Portal". */
  label: string
  title: string
  description?: ReactNode
  /** The form. */
  children: ReactNode
  /** Secondary links ("Back to sign in"), rendered under the panel. */
  footer?: ReactNode
  /** Widen the panel for denser forms (password reset). */
  wide?: boolean
}

export function AuthShell({
  label,
  title,
  description,
  children,
  footer,
  wide = false,
}: Props) {
  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center px-6 py-12"
      style={{ backgroundColor: BRAND.bg, ...BRAND_DOT_GRID }}
    >
      <div className={cn('w-full space-y-8', wide ? 'max-w-md' : 'max-w-sm')}>
        <BrandLockup label={label} />

        <div
          className="space-y-6 border p-8"
          style={{
            backgroundColor: BRAND.bgPanel,
            borderColor: BRAND.border,
          }}
        >
          <div className="space-y-2 text-center">
            <h1
              className="text-2xl font-bold tracking-tight"
              style={{
                color: BRAND.text,
                fontFamily: 'var(--font-space-grotesk, inherit)',
              }}
            >
              {title}
            </h1>
            {description ? (
              <p className="text-sm" style={{ color: BRAND.textMuted }}>
                {description}
              </p>
            ) : null}
          </div>

          {children}
        </div>

        {footer ? (
          <div className="text-center text-sm" style={{ color: BRAND.textMuted }}>
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  )
}

/**
 * Control styling for forms rendered inside the shell.
 *
 * Exported as class strings rather than components because the two portals'
 * auth forms are structurally different (server actions vs. client state) and
 * only need to agree on how a field looks.
 */
export const authFieldLabelClass =
  'block font-mono text-[11px] uppercase tracking-[0.1em] text-[#a8a8ac]'

export const authInputClass =
  'w-full border border-[#2a2b30] bg-[#0e0f11] px-3 py-2 text-sm text-[#e8e6e3] placeholder:text-[#a8a8ac]/50 transition-colors focus:border-[#b5f542] focus:outline-none focus:ring-1 focus:ring-[#b5f542] disabled:opacity-50'

export const authPrimaryButtonClass =
  'inline-flex w-full cursor-pointer items-center justify-center gap-2 bg-[#b5f542] px-3 py-2 text-sm font-semibold text-[#0e0f11] transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#b5f542] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0e0f11] disabled:cursor-default disabled:opacity-50'

export const authSecondaryButtonClass =
  'inline-flex w-full cursor-pointer items-center justify-center gap-2 border border-[#3a3b40] bg-transparent px-3 py-2 text-sm font-medium text-[#e8e6e3] transition-colors hover:border-[#b5f542]/50 hover:text-[#b5f542] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#b5f542] disabled:cursor-default disabled:opacity-50'

export const authLinkClass =
  'font-medium text-[#b5f542] underline-offset-4 hover:underline'

export const authErrorClass =
  'border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300'

export const authNoticeClass =
  'border border-[#3a3b40] bg-[#0e0f11]/60 px-3 py-2 text-sm text-[#a8a8ac]'

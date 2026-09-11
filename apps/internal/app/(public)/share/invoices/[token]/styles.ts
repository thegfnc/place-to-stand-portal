/**
 * Type treatments shared by the invoice document (paper) and the side panel
 * (dark ground). The page pins its own colours rather than reading the theme,
 * so every value is literal.
 */

export const HEADLINE_FONT = 'font-[family-name:var(--font-space-grotesk)]'

/** Mono field label on the white document. */
export const PAPER_LABEL =
  'font-mono text-[11px] tracking-[0.1em] text-[#5b5d63] uppercase'

/** Mono field label on the dark panel. */
export const DARK_LABEL =
  'font-mono text-[11px] tracking-[0.1em] text-[#a8a8ac] uppercase'

/** The marketing site's section callout: tiny accent caps with a » terminal. */
export const SECTION_LABEL =
  "font-mono text-[10px] tracking-[0.2em] text-[#4d7c0f] uppercase after:ml-1.5 after:text-xs after:tracking-normal after:opacity-70 after:content-['»']"

export const PANEL_TITLE =
  'font-[family-name:var(--font-space-grotesk)] text-xl leading-tight font-bold tracking-[-0.02em] text-[#e8e6e3]'

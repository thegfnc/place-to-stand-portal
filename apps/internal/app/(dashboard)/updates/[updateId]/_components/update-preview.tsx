import { composeBodyHtml, type UpdateBody } from '@/lib/updates/body'
import { PORTAL_BUTTON_LABEL } from '@/lib/updates/branding'

type UpdatePreviewProps = UpdateBody & {
  portalHref: string
}

/**
 * Theme-coloured twin of the email's inline `update-*` class styles
 * (`lib/updates/render-email.ts`) — same structure, app palette.
 */
const BODY_CLASSES = [
  'text-foreground [&_a]:text-foreground [&_a]:underline [&_a]:underline-offset-4 [&_p]:my-3',
  '[&_.update-items]:mt-1 [&_.update-items]:mb-6 [&_.update-items]:border-b [&_.update-items]:border-border',
  '[&_.update-item]:w-full [&_.update-item]:border-collapse [&_.update-item]:border-t [&_.update-item]:border-border',
  '[&_.update-item-index]:w-8 [&_.update-item-index]:py-4 [&_.update-item-index]:align-top [&_.update-item-index]:font-mono [&_.update-item-index]:text-xs [&_.update-item-index]:leading-6 [&_.update-item-index]:text-[#4d7c0f] dark:[&_.update-item-index]:text-[#b5f542]',
  '[&_.update-item-body]:pt-4 [&_.update-item-body]:pb-1 [&_.update-item-body]:align-top [&_.update-item-body_p:first-child]:mt-0',
  '[&_.update-hours]:mb-6 [&_.update-hours]:w-full [&_.update-hours]:border-collapse [&_.update-hours]:border [&_.update-hours]:border-border [&_.update-hours]:bg-muted/40',
  '[&_.update-hours-label]:px-5 [&_.update-hours-label]:py-4 [&_.update-hours-label]:font-mono [&_.update-hours-label]:text-[11px] [&_.update-hours-label]:uppercase [&_.update-hours-label]:tracking-[0.1em] [&_.update-hours-label]:text-muted-foreground',
  '[&_.update-hours-value]:px-5 [&_.update-hours-value]:py-4 [&_.update-hours-value]:text-right [&_.update-hours-value]:font-[family-name:var(--font-space-grotesk)] [&_.update-hours-value]:text-[22px] [&_.update-hours-value]:leading-none [&_.update-hours-value]:font-bold [&_.update-hours-value]:tracking-[-0.02em] [&_.update-hours-value]:whitespace-nowrap',
].join(' ')

/** The body exactly as the email lays it out, plus the one button, minus the card chrome. */
export function UpdatePreview({ portalHref, ...body }: UpdatePreviewProps) {
  return (
    <div className='px-8 py-2 text-[15px] leading-relaxed'>
      <div
        className={BODY_CLASSES}
        // Our own renderer's output from escaped input — same trust as the email.
        dangerouslySetInnerHTML={{ __html: composeBodyHtml(body) }}
      />
      <p className='my-6'>
        <a
          href={portalHref}
          target='_blank'
          rel='noreferrer'
          className='inline-block border border-[#0e0f11] bg-[#0e0f11] px-7 py-3.5 text-[14px] font-bold tracking-[0.05em] text-[#b5f542] uppercase no-underline dark:border-[#3a3b40]'
        >
          {PORTAL_BUTTON_LABEL}
        </a>
      </p>
      <p className='text-muted-foreground mb-4 font-mono text-[12px] leading-relaxed'>
        Or paste this into your browser:
        <br />
        <span className='text-muted-foreground/70 break-all'>{portalHref}</span>
      </p>
    </div>
  )
}

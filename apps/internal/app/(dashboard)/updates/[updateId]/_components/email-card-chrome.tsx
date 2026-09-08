import {
  UPDATE_EMAIL_BRAND,
  UPDATE_EMAIL_FOOTER_LEAD,
} from '@/lib/updates/branding'

/**
 * The parts of the branded card that the shell adds at send, rendered on the
 * composer's page so what you see is what goes out. Mirrors
 * `renderShell` in packages/email/src/layout.ts — keep the two in step.
 */
export function EmailCardHeader() {
  return (
    <p className='text-foreground px-8 pt-7 pb-2 text-sm font-bold tracking-wide'>
      {UPDATE_EMAIL_BRAND}
    </p>
  )
}

export function EmailCardFooter({ replyTo }: { replyTo: string }) {
  return (
    <div className='px-8 pt-2 pb-7'>
      <hr className='border-border mb-6' />
      <p className='text-muted-foreground mb-2 text-[13px] leading-relaxed'>
        {UPDATE_EMAIL_FOOTER_LEAD}{' '}
        <span className='underline underline-offset-2'>{replyTo}</span>.
      </p>
      <p className='text-muted-foreground/70 text-[13px]'>
        — The {UPDATE_EMAIL_BRAND} Team
      </p>
    </div>
  )
}

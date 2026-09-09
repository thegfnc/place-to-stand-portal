import { composeBodyHtml, type UpdateBody } from '@/lib/updates/body'
import { PORTAL_BUTTON_LABEL } from '@/lib/updates/branding'

type UpdatePreviewProps = UpdateBody & {
  portalHref: string
}

/** The body exactly as the email lays it out, plus the one button, minus the card chrome. */
export function UpdatePreview({ portalHref, ...body }: UpdatePreviewProps) {
  return (
    <div className='px-8 py-2 text-[15px] leading-relaxed'>
      <div
        className='text-foreground [&_a]:text-foreground [&_a]:underline [&_a]:underline-offset-4 [&_p]:my-3'
        // Our own renderer's output from escaped input — same trust as the email.
        dangerouslySetInnerHTML={{ __html: composeBodyHtml(body) }}
      />
      <p className='my-6'>
        <a
          href={portalHref}
          target='_blank'
          rel='noreferrer'
          className='bg-foreground text-background inline-block rounded-md px-[22px] py-3 text-[15px] font-semibold no-underline'
        >
          {PORTAL_BUTTON_LABEL}
        </a>
      </p>
      <p className='text-muted-foreground mb-4 text-[13px] leading-relaxed'>
        Or paste this into your browser:
        <br />
        <span className='text-muted-foreground/70 break-all'>{portalHref}</span>
      </p>
    </div>
  )
}

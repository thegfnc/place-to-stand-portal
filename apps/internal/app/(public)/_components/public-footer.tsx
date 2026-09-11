const SITE_URL = 'https://placetostandagency.com'

/** The marketing site's bottom bar: copyright left, the site right. */
export function PublicFooter() {
  const year = new Date().getFullYear()

  return (
    <footer className='mt-16 border-t border-[#2a2b30] bg-[#1a1b1f] sm:mt-[72px]'>
      <div className='mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-6 lg:px-12'>
        <span className='text-[11px] tracking-[0.1em] text-[#a8a8ac] uppercase sm:text-xs'>
          © {year} Place To Stand. All rights reserved.
        </span>
        <a
          href={SITE_URL}
          className='font-mono text-[10px] tracking-[0.1em] text-[#a8a8ac] uppercase transition-colors hover:text-[#b5f542] sm:text-[11px]'
        >
          placetostandagency.com
        </a>
      </div>
    </footer>
  )
}

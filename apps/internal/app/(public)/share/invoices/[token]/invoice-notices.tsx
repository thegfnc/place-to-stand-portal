import { Info, XCircle } from 'lucide-react'

type Props = {
  paymentCancelled: boolean
  isDraft: boolean
  isVoid: boolean
}

const NOTICE = 'flex items-center gap-3 border px-4 py-3 text-sm leading-normal'

/** One-line notices above the document, in the auth screens' notice styles. */
export function InvoiceNotices({ paymentCancelled, isDraft, isVoid }: Props) {
  if (!paymentCancelled && !isDraft && !isVoid) return null

  return (
    <div className='mb-5 flex flex-col gap-3 sm:mb-6'>
      {paymentCancelled ? (
        <div className={`${NOTICE} border-[#3a3b40] bg-[#0e0f11]/60 text-[#a8a8ac]`}>
          <Info className='size-[18px] shrink-0 text-[#e8e6e3]' strokeWidth={1.5} />
          <p>Payment was cancelled. You can try again below.</p>
        </div>
      ) : null}

      {isDraft ? (
        <div className={`${NOTICE} border-[#b5f542]/30 bg-[#b5f542]/[0.06] text-[#e8e6e3]`}>
          <span className='shrink-0 border border-[#b5f542]/50 px-2 py-0.5 font-mono text-[10px] tracking-[0.2em] text-[#b5f542] uppercase'>
            Draft
          </span>
          <p>
            This invoice has not been finalized. Payment is not available
            until it is issued.
          </p>
        </div>
      ) : null}

      {isVoid ? (
        <div className={`${NOTICE} border-red-500/40 bg-red-500/10 text-red-300`}>
          <XCircle className='size-[18px] shrink-0' strokeWidth={1.5} />
          <p>This invoice has been voided and is no longer payable.</p>
        </div>
      ) : null}
    </div>
  )
}

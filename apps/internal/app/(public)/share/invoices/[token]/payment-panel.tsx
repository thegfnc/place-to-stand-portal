'use client'

import { useEffect, useRef, useState } from 'react'
import { loadStripe, type Appearance } from '@stripe/stripe-js'
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from '@stripe/react-stripe-js'
import { Loader2, Lock } from 'lucide-react'

import { authErrorClass, authPrimaryButtonClass } from '@pts/ui/auth-shell'

import { cn } from '@/lib/utils'

import { formatCurrency } from './format'
import { DARK_LABEL, HEADLINE_FONT, PANEL_TITLE } from './styles'

const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  : null

export const isStripeConfigured = stripePromise !== null

/**
 * Stripe renders the fields in its own iframe; this is the part of the look
 * it lets us set — the panel's ground, square corners, the lime focus ring,
 * and the mono labels. Field order and card-brand icons stay Stripe's.
 */
const APPEARANCE: Appearance = {
  theme: 'night',
  variables: {
    colorPrimary: '#b5f542',
    colorBackground: '#0e0f11',
    colorText: '#e8e6e3',
    colorTextSecondary: '#a8a8ac',
    colorTextPlaceholder: '#8a8c93',
    colorDanger: '#fca5a5',
    colorIcon: '#a8a8ac',
    fontFamily: 'Geist, system-ui, sans-serif',
    fontSizeBase: '14px',
    borderRadius: '0px',
    gridRowSpacing: '14px',
    gridColumnSpacing: '12px',
  },
  rules: {
    '.Label': {
      fontFamily: '"Geist Mono", ui-monospace, monospace',
      fontSize: '11px',
      letterSpacing: '0.1em',
      textTransform: 'uppercase',
      color: '#a8a8ac',
    },
    '.Input': {
      border: '1px solid #3a3b40',
      boxShadow: 'none',
      padding: '12px',
    },
    '.Input:focus': {
      border: '1px solid #b5f542',
      boxShadow: '0 0 0 1px #b5f542',
    },
    '.Input--invalid': {
      border: '1px solid #f87171',
      boxShadow: 'none',
    },
    '.AccordionItem': {
      border: '1px solid #3a3b40',
      backgroundColor: '#0e0f11',
      boxShadow: 'none',
    },
    '.Tab': {
      border: '1px solid #3a3b40',
      backgroundColor: '#0e0f11',
      boxShadow: 'none',
    },
    '.Tab--selected': {
      border: '1px solid #b5f542',
      boxShadow: '0 0 0 1px #b5f542',
    },
    '.Error': {
      color: '#fca5a5',
    },
  },
}

const STRIPE_FONTS = [
  {
    cssSrc:
      'https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500&display=swap',
  },
]

type PaymentPanelProps = {
  total: string
  shareToken: string
  /** Prepaid clients are told work starts on payment; net-30 work already has. */
  isPrepaid: boolean
}

export function PaymentPanel({ total, shareToken, isPrepaid }: PaymentPanelProps) {
  const [checkoutError, setCheckoutError] = useState<string | null>(null)
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [isFetchingSecret, setIsFetchingSecret] = useState(false)
  const fetchedRef = useRef(false)

  useEffect(() => {
    if (fetchedRef.current) return
    fetchedRef.current = true
    setIsFetchingSecret(true)

    fetch(`/api/public/invoices/${shareToken}/checkout`, { method: 'POST' })
      .then(res => res.json())
      .then(data => {
        if (!data.ok || !data.data?.clientSecret) {
          setCheckoutError(data.error ?? 'Unable to start checkout.')
          return
        }
        setClientSecret(data.data.clientSecret)
      })
      .catch(() => {
        setCheckoutError('Unable to connect to payment provider.')
      })
      .finally(() => {
        setIsFetchingSecret(false)
      })
  }, [shareToken])

  const returnUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/share/invoices/${shareToken}?payment=success`
      : ''

  return (
    <>
      <div className='flex flex-col gap-2'>
        <h2 className={PANEL_TITLE}>Pay this invoice</h2>
        <p className='text-sm leading-normal text-[#a8a8ac]'>
          {isPrepaid ? 'Work on this invoice begins once it is paid. ' : ''}
          Pay securely below.
        </p>
      </div>

      <div className='flex items-baseline justify-between border-y border-[#2a2b30] py-3.5'>
        <span className={DARK_LABEL}>Amount due</span>
        <span
          className={cn(
            HEADLINE_FONT,
            'text-[22px] leading-none font-bold tracking-[-0.02em] tabular-nums'
          )}
        >
          {formatCurrency(total)}
        </span>
      </div>

      {checkoutError ? <p className={authErrorClass}>{checkoutError}</p> : null}

      {isFetchingSecret ? (
        <div className='flex items-center justify-center py-10'>
          <Loader2 className='size-5 animate-spin text-[#a8a8ac]' />
        </div>
      ) : null}

      {clientSecret && stripePromise ? (
        <Elements
          stripe={stripePromise}
          options={{ clientSecret, fonts: STRIPE_FONTS, appearance: APPEARANCE }}
        >
          <PaymentForm total={total} returnUrl={returnUrl} />
        </Elements>
      ) : null}
    </>
  )
}

function PaymentForm({ total, returnUrl }: { total: string; returnUrl: string }) {
  const stripe = useStripe()
  const elements = useElements()
  // Until Stripe fires `ready` there is no Element to confirm against, and
  // `confirmPayment` throws rather than returning an error.
  const [isReady, setIsReady] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!stripe || !elements || !isReady) return

    setIsProcessing(true)
    setError(null)

    try {
      const { error: stripeError } = await stripe.confirmPayment({
        elements,
        confirmParams: { return_url: returnUrl },
      })

      if (stripeError) {
        setError(stripeError.message ?? 'Payment failed. Please try again.')
      }
    } catch {
      setError('Payment failed. Please try again.')
    } finally {
      // Without this a thrown error left the button stuck on "Processing…".
      setIsProcessing(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className='flex flex-col gap-5'>
      <PaymentElement
        onReady={() => setIsReady(true)}
        onLoadError={() =>
          setError(
            'The payment form could not load. Refresh the page to try again.'
          )
        }
      />
      {error ? <p className={authErrorClass}>{error}</p> : null}
      <div className='flex flex-col gap-3.5'>
        <button
          type='submit'
          disabled={!stripe || !isReady || isProcessing}
          className={cn(
            authPrimaryButtonClass,
            'h-11 font-bold tracking-[0.05em] uppercase'
          )}
        >
          {isProcessing ? (
            <>
              <Loader2 className='size-4 animate-spin' />
              Processing…
            </>
          ) : (
            <>Pay {formatCurrency(total)}</>
          )}
        </button>
        <p className='flex items-center justify-center gap-2 font-mono text-[11px] tracking-[0.08em] text-[#a8a8ac]'>
          <Lock className='size-3.5' strokeWidth={1.5} />
          Secured by Stripe
        </p>
      </div>
    </form>
  )
}

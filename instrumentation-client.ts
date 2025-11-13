import posthog from 'posthog-js'

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST

if (!POSTHOG_KEY || !POSTHOG_HOST) {
  if (process.env.NODE_ENV !== 'production') {
    console.warn(
      '[posthog] Missing NEXT_PUBLIC_POSTHOG_KEY or NEXT_PUBLIC_POSTHOG_HOST environment variables.'
    )
  }
} else {
  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    capture_pageview: true,
    capture_pageleave: true,
    session_recording: {
      maskAllInputs: false,
    },
    persistence: 'localStorage+cookie',
    defaults: '2025-05-24',
    loaded: client => {
      if (process.env.NODE_ENV === 'development') {
        client.debug()
      }
    },
  })
}

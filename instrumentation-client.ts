import posthog from 'posthog-js'

posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
  api_host: '/relay-HVAq/',
  ui_host: process.env.NEXT_PUBLIC_POSTHOG_HOST!,
  defaults: '2025-05-24',
  capture_exceptions: true,
  capture_heatmaps: true,
  capture_dead_clicks: true,
  capture_pageleave: true,
  capture_pageview: true,
  capture_performance: true,
})

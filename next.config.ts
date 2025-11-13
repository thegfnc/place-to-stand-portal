import type { NextConfig } from 'next'
import { withPostHogConfig } from '@posthog/nextjs-config'

const nextConfig: NextConfig = {
  cacheComponents: false,
  reactCompiler: true,
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/ingest/static/:path*',
        destination: 'https://us-assets.i.posthog.com/static/:path*',
      },
      {
        source: '/ingest/:path*',
        destination: 'https://us.i.posthog.com/:path*',
      },
    ]
  },
  // This is required to support PostHog trailing slash API requests
  skipTrailingSlashRedirect: true,
}

export default withPostHogConfig(nextConfig, {
  personalApiKey: process.env.NEXT_PUBLIC_POSTHOG_KEY!, // Your personal API key from PostHog settings
  envId: '248520', // Your environment ID (project ID)
  host: 'https://us.i.posthog.com', // Optional: Your PostHog instance URL, defaults to https://us.posthog.com
  sourcemaps: {
    // Optional
    enabled: process.env.NODE_ENV === 'production', // Optional: Enable sourcemaps generation and upload, defaults to true on production builds
    project: 'place-to-stand-portal', // Optional: Project name, defaults to git repository name
    version: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA!, // Optional: Release version, defaults to current git commit
  },
})

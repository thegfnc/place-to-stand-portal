import type { Metadata } from 'next'

import { renderReviewRoute, reviewMetadata } from '../../review-route'

type PageProps = {
  params: Promise<{
    clientSlug: string
    projectSlug: string
    taskId: string
  }>
}

export const metadata: Metadata = reviewMetadata

export default async function ProjectReviewTaskPage({ params }: PageProps) {
  const resolvedParams = await params
  return renderReviewRoute(resolvedParams)
}

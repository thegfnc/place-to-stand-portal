import type { InferSelectModel } from 'drizzle-orm'
import type { githubRepoLinks } from '@/lib/db/schema'

export type GitHubRepoLink = InferSelectModel<typeof githubRepoLinks>

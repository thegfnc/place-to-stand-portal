import type { InferSelectModel, InferInsertModel } from 'drizzle-orm'
import type { githubRepoLinks } from '@/lib/db/schema'

// Re-export PRSuggestionWithContext for backwards compatibility
export type { PRSuggestionWithContext } from './suggestions'

// Base types from schema
export type GitHubRepoLink = InferSelectModel<typeof githubRepoLinks>
export type NewGitHubRepoLink = InferInsertModel<typeof githubRepoLinks>

// Extended types with relations
export interface GitHubRepoLinkWithProject extends GitHubRepoLink {
  project: {
    id: string
    name: string
  }
}

export interface GitHubRepoLinkWithOAuth extends GitHubRepoLink {
  oauthConnection: {
    id: string
    providerEmail: string | null
    displayName: string | null
  }
}

// GitHub API response types
export interface GitHubRepository {
  id: number
  name: string
  full_name: string
  owner: {
    login: string
    avatar_url: string
  }
  description: string | null
  private: boolean
  default_branch: string
  html_url: string
  permissions?: {
    admin: boolean
    push: boolean
    pull: boolean
  }
}

export interface GitHubPullRequest {
  id: number
  number: number
  title: string
  body: string | null
  state: 'open' | 'closed'
  html_url: string
  head: {
    ref: string
    sha: string
  }
  base: {
    ref: string
    sha: string
  }
  user: {
    login: string
    avatar_url: string
  }
  created_at: string
  updated_at: string
  merged_at: string | null
}

export interface CreatePullRequestParams {
  owner: string
  repo: string
  title: string
  body: string
  head: string // Branch name
  base: string // Target branch (e.g., 'main')
  draft?: boolean
}

export interface CreatePullRequestResult {
  success: boolean
  prNumber?: number
  prUrl?: string
  error?: string
}

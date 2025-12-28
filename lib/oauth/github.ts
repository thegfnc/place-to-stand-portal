import { serverEnv } from '@/lib/env.server'

// GitHub OAuth scopes for repo access
export const GITHUB_SCOPES = [
  'user:email',
  'read:user',
  'repo',
  'read:org',
]

export interface GitHubTokenResponse {
  access_token: string
  token_type: string
  scope: string
  refresh_token?: string
  expires_in?: number
  refresh_token_expires_in?: number
}

export interface GitHubUserInfo {
  id: number
  login: string
  email: string | null
  name: string | null
  avatar_url: string
}

/**
 * Generate GitHub OAuth authorization URL
 */
export function getGitHubAuthUrl(state: string): string {
  if (!serverEnv.GITHUB_CLIENT_ID || !serverEnv.GITHUB_REDIRECT_URI) {
    throw new Error('GitHub OAuth not configured')
  }

  const params = new URLSearchParams({
    client_id: serverEnv.GITHUB_CLIENT_ID,
    redirect_uri: serverEnv.GITHUB_REDIRECT_URI,
    scope: GITHUB_SCOPES.join(' '),
    state,
  })

  return `https://github.com/login/oauth/authorize?${params.toString()}`
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(
  code: string
): Promise<GitHubTokenResponse> {
  if (!serverEnv.GITHUB_CLIENT_ID || !serverEnv.GITHUB_CLIENT_SECRET || !serverEnv.GITHUB_REDIRECT_URI) {
    throw new Error('GitHub OAuth not configured')
  }

  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      client_id: serverEnv.GITHUB_CLIENT_ID,
      client_secret: serverEnv.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: serverEnv.GITHUB_REDIRECT_URI,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Token exchange failed: ${error}`)
  }

  const data = await response.json()

  if (data.error) {
    throw new Error(`GitHub OAuth error: ${data.error_description || data.error}`)
  }

  return data
}

/**
 * Get user info from GitHub
 */
export async function getGitHubUserInfo(
  accessToken: string
): Promise<GitHubUserInfo> {
  const response = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github.v3+json',
    },
  })

  if (!response.ok) {
    throw new Error('Failed to get GitHub user info')
  }

  const user = await response.json()

  // If email is not public, fetch from emails endpoint
  if (!user.email) {
    const emailResponse = await fetch('https://api.github.com/user/emails', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github.v3+json',
      },
    })

    if (emailResponse.ok) {
      const emails = await emailResponse.json()
      const primaryEmail = emails.find(
        (e: { primary: boolean; verified: boolean }) => e.primary && e.verified
      )
      if (primaryEmail) {
        user.email = primaryEmail.email
      }
    }
  }

  return user
}

/**
 * Revoke a GitHub token (delete authorization)
 */
export async function revokeToken(accessToken: string): Promise<void> {
  if (!serverEnv.GITHUB_CLIENT_ID || !serverEnv.GITHUB_CLIENT_SECRET) {
    return
  }

  // GitHub uses Basic auth with client_id:client_secret to revoke
  const credentials = Buffer.from(
    `${serverEnv.GITHUB_CLIENT_ID}:${serverEnv.GITHUB_CLIENT_SECRET}`
  ).toString('base64')

  await fetch(
    `https://api.github.com/applications/${serverEnv.GITHUB_CLIENT_ID}/token`,
    {
      method: 'DELETE',
      headers: {
        Authorization: `Basic ${credentials}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ access_token: accessToken }),
    }
  )
  // Ignore errors - token may already be invalid
}

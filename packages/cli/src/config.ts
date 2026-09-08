import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'

const CONFIG_DIR = join(homedir(), '.pts')
const CONFIG_PATH = join(CONFIG_DIR, 'config.json')
const CREDENTIALS_PATH = join(CONFIG_DIR, 'credentials.json')

/**
 * The portal URL cannot come from an env var: `pts` runs on a laptop outside
 * the repo, so it never sees `APP_BASE_URL` or a `.env` file. Fetching it from
 * the portal is circular — you need the URL to reach the portal. So it is a
 * constant, which costs nothing: a portal URL is a public website address.
 */
export const PRODUCTION_API_URL = 'https://portal.placetostandagency.com'
export const LOCAL_API_URL = 'http://localhost:3000'

/** Production, so a teammate's fresh install works with no setup at all. */
const DEFAULT_API_URL = PRODUCTION_API_URL

export type StoredCredentials = {
  email: string
  accessToken: string
  refreshToken: string
}

/** Keyed by portal URL so local and production sessions can coexist. */
type CredentialsFile = Record<string, StoredCredentials>

function normalizeApiUrl(url: string): string {
  return url.replace(/\/+$/, '')
}

async function readJsonFile<T>(path: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as T
  } catch {
    // Missing or unparseable — either way there is nothing usable here.
    return null
  }
}

export async function resolveApiUrl(override?: string): Promise<string> {
  const configured =
    override ??
    process.env.PTS_API_URL ??
    (await readJsonFile<{ apiUrl?: string }>(CONFIG_PATH))?.apiUrl ??
    DEFAULT_API_URL

  return normalizeApiUrl(configured)
}

export async function readCredentials(
  apiUrl: string
): Promise<StoredCredentials | null> {
  const file = await readJsonFile<CredentialsFile>(CREDENTIALS_PATH)

  return file?.[normalizeApiUrl(apiUrl)] ?? null
}

export async function writeCredentials(
  apiUrl: string,
  credentials: StoredCredentials
): Promise<void> {
  const file = (await readJsonFile<CredentialsFile>(CREDENTIALS_PATH)) ?? {}

  file[normalizeApiUrl(apiUrl)] = credentials

  await mkdir(CONFIG_DIR, { recursive: true, mode: 0o700 })
  await writeFile(CREDENTIALS_PATH, `${JSON.stringify(file, null, 2)}\n`, {
    mode: 0o600,
  })
  // `mode` on writeFile only applies when the file is created, so an existing
  // file keeps whatever permissions it had. Re-assert them every write.
  await chmod(CREDENTIALS_PATH, 0o600)
}

export async function clearCredentials(apiUrl: string): Promise<boolean> {
  const file = await readJsonFile<CredentialsFile>(CREDENTIALS_PATH)
  const key = normalizeApiUrl(apiUrl)

  if (!file?.[key]) {
    return false
  }

  delete file[key]

  await writeFile(CREDENTIALS_PATH, `${JSON.stringify(file, null, 2)}\n`, {
    mode: 0o600,
  })
  await chmod(CREDENTIALS_PATH, 0o600)

  return true
}

/**
 * Persist the default portal URL so someone who works mostly against one
 * environment stops having to pass a flag. `--local`/`--prod`/`--api-url` and
 * `PTS_API_URL` still override it.
 */
export async function writeApiUrl(apiUrl: string): Promise<string> {
  const normalized = normalizeApiUrl(apiUrl)
  const file = (await readJsonFile<Record<string, unknown>>(CONFIG_PATH)) ?? {}

  file.apiUrl = normalized

  await mkdir(CONFIG_DIR, { recursive: true, mode: 0o700 })
  await writeFile(CONFIG_PATH, `${JSON.stringify(file, null, 2)}\n`)

  return normalized
}

export const credentialsPath = CREDENTIALS_PATH
export const configPath = CONFIG_PATH

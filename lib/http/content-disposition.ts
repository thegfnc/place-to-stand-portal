import 'server-only'

export type ContentDispositionType = 'inline' | 'attachment'

const DEFAULT_FILENAME = 'download'
const MAX_FALLBACK_LENGTH = 150

function sanitizeAsciiFilenameFallback(filename: string) {
  const normalized = (filename || DEFAULT_FILENAME)
    .replace(/[\0]/g, '')
    .replace(/[/\\]/g, '_')
    .normalize('NFKD')
    // Header values must be byte strings; keep only printable ASCII.
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  const clipped = normalized.slice(0, MAX_FALLBACK_LENGTH).trim()

  if (!clipped) {
    return DEFAULT_FILENAME
  }

  // Escape quoted-string per RFC 2616 (quoted-pair).
  return clipped.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

// RFC 5987 encoding for `filename*` (UTF-8 then percent-encode).
function encodeRFC5987ValueChars(value: string) {
  return encodeURIComponent(value).replace(/[!'()*]/g, char => {
    return `%${char.charCodeAt(0).toString(16).toUpperCase()}`
  })
}

export function buildContentDispositionHeader({
  disposition,
  filename,
}: {
  disposition: ContentDispositionType
  filename: string | null | undefined
}) {
  const rawFilename = (filename ?? '').trim() || DEFAULT_FILENAME
  const fallback = sanitizeAsciiFilenameFallback(rawFilename)
  const encoded = encodeRFC5987ValueChars(rawFilename)

  // ASCII-only header value: fallback quoted-string + RFC5987 encoded filename*
  return `${disposition}; filename="${fallback}"; filename*=UTF-8''${encoded}`
}

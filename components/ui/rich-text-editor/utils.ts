export const sanitizeHtml = (content: string) =>
  content
    .replace(/<br\s*\/?>(\s|&nbsp;|\u00a0)*/gi, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

export const isContentEmpty = (content: string) =>
  sanitizeHtml(content).length === 0

export const ensureUrlProtocol = (value: string) => {
  if (!value) return ''
  const trimmed = value.trim()
  if (trimmed.length === 0) return ''

  const hasProtocol = /^[a-zA-Z][\w+.-]*:/.test(trimmed)
  if (hasProtocol) {
    return trimmed
  }

  return `https://${trimmed}`
}

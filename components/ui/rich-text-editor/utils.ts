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

// Allowlist the minimal tags produced by the editor to prevent unsafe markup.
const ALLOWED_RICH_TEXT_TAGS = new Set([
  'A',
  'BLOCKQUOTE',
  'BR',
  'CODE',
  'EM',
  'HR',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'LI',
  'OL',
  'P',
  'PRE',
  'S',
  'SPAN',
  'STRONG',
  'U',
  'UL',
])

const unwrapElement = (element: Element) => {
  const parent = element.parentNode
  if (!parent) {
    element.remove()
    return
  }

  while (element.firstChild) {
    parent.insertBefore(element.firstChild, element)
  }

  parent.removeChild(element)
}

const sanitizeElement = (element: Element) => {
  if (element.tagName === 'A') {
    const href = element.getAttribute('href') ?? ''
    const safeHref = ensureUrlProtocol(href)
    if (!safeHref) {
      unwrapElement(element)
      return
    }

    element.setAttribute('href', safeHref)
    element.setAttribute('target', '_blank')
    element.setAttribute('rel', 'noreferrer noopener')

    const allowedAttributes = new Set(['href', 'target', 'rel'])
    Array.from(element.attributes).forEach(attribute => {
      if (!allowedAttributes.has(attribute.name)) {
        element.removeAttribute(attribute.name)
      }
    })
  } else {
    Array.from(element.attributes).forEach(attribute => {
      element.removeAttribute(attribute.name)
    })
  }
}

const sanitizeNode = (node: Node) => {
  if (node.nodeType === Node.ELEMENT_NODE) {
    const element = node as Element
    if (!ALLOWED_RICH_TEXT_TAGS.has(element.tagName)) {
      if (element.tagName === 'SCRIPT' || element.tagName === 'STYLE') {
        element.remove()
      } else {
        unwrapElement(element)
      }
      return
    }

    sanitizeElement(element)
    Array.from(element.childNodes).forEach(sanitizeNode)
    return
  }

  if (node.nodeType === Node.COMMENT_NODE) {
    node.parentNode?.removeChild(node)
  }
}

export const sanitizeEditorHtml = (content: string) => {
  if (typeof window === 'undefined' || typeof DOMParser === 'undefined') {
    return content
  }

  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(content, 'text/html')
    const { body } = doc

    Array.from(body.childNodes).forEach(sanitizeNode)

    return body.innerHTML
  } catch (error) {
    console.warn('Failed to sanitize rich text content', error)
    return content
  }
}

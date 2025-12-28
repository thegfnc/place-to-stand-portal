'use client'

import { useRef, useEffect, useState, useCallback } from 'react'

type EmailIframeProps = {
  html: string
  className?: string
}

/**
 * Renders email HTML content in an isolated iframe to prevent
 * email styles from leaking into the parent document.
 */
export function EmailIframe({ html, className }: EmailIframeProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [height, setHeight] = useState(200)

  // Wrap HTML with basic styling and dark mode support
  const wrappedHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    *, *::before, *::after {
      box-sizing: border-box;
    }
    html, body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: 14px;
      line-height: 1.6;
      color: #1a1a1a;
      background: transparent;
      overflow-x: hidden;
    }
    @media (prefers-color-scheme: dark) {
      html, body {
        color: #e5e5e5;
      }
      a {
        color: #60a5fa;
      }
    }
    body {
      padding: 0;
    }
    img {
      max-width: 100%;
      height: auto;
    }
    a {
      color: #2563eb;
    }
    pre, code {
      white-space: pre-wrap;
      word-break: break-word;
    }
    table {
      max-width: 100%;
    }
    /* Hide CID images (embedded attachments not yet supported) */
    img[src^="cid:"] {
      display: none;
    }
  </style>
</head>
<body>${html}</body>
</html>
`

  const updateHeight = useCallback(() => {
    if (!iframeRef.current?.contentDocument?.body) return
    const scrollHeight = iframeRef.current.contentDocument.body.scrollHeight
    // Add small buffer and set minimum height
    setHeight(Math.max(100, scrollHeight + 16))
  }, [])

  useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe) return

    const handleLoad = () => {
      updateHeight()
      // Also update after images load
      const doc = iframe.contentDocument
      if (doc) {
        const images = doc.querySelectorAll('img')
        images.forEach(img => {
          if (!img.complete) {
            img.addEventListener('load', updateHeight)
            img.addEventListener('error', updateHeight)
          }
        })
      }
    }

    iframe.addEventListener('load', handleLoad)
    return () => iframe.removeEventListener('load', handleLoad)
  }, [updateHeight])

  // Update when html changes
  useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe) return

    // Small delay to let iframe render
    const timer = setTimeout(updateHeight, 100)
    return () => clearTimeout(timer)
  }, [html, updateHeight])

  return (
    <iframe
      ref={iframeRef}
      srcDoc={wrappedHtml}
      className={className}
      style={{
        width: '100%',
        height: `${height}px`,
        border: 'none',
        display: 'block',
      }}
      sandbox="allow-same-origin"
      title="Email content"
    />
  )
}

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Editor } from '@tiptap/react'

// --- Hooks ---
import { useTiptapEditor } from '@/hooks/use-tiptap-editor'

// --- Icons ---
import { ExternalLinkIcon } from '@/components/tiptap-icons/external-link-icon'
import { LinkIcon } from '@/components/tiptap-icons/link-icon'
import { TrashIcon } from '@/components/tiptap-icons/trash-icon'
import { CopyIcon } from '@/components/tiptap-icons/copy-icon'
import { PencilIcon } from '@/components/tiptap-icons/pencil-icon'

// --- UI Primitives ---
import { Button, ButtonGroup } from '@/components/tiptap-ui-primitive/button'
import { Separator } from '@/components/tiptap-ui-primitive/separator'
import {
  Card,
  CardBody,
  CardItemGroup,
} from '@/components/tiptap-ui-primitive/card'

// --- Lib ---
import { sanitizeUrl } from '@/lib/tiptap-utils'

import './link-floating-menu.scss'

export interface LinkFloatingMenuProps {
  editor?: Editor | null
}

interface MenuPosition {
  x: number
  y: number
}

function truncateUrl(url: string, maxLength: number = 35): string {
  if (url.length <= maxLength) return url

  try {
    const urlObj = new URL(url)
    const domain = urlObj.hostname
    const path = urlObj.pathname + urlObj.search

    if (domain.length >= maxLength - 3) {
      return domain.slice(0, maxLength - 3) + '...'
    }

    const remainingLength = maxLength - domain.length - 3
    if (path.length > remainingLength) {
      return domain + path.slice(0, remainingLength) + '...'
    }

    return domain + path
  } catch {
    return url.slice(0, maxLength - 3) + '...'
  }
}

export function LinkFloatingMenu({
  editor: providedEditor,
}: LinkFloatingMenuProps) {
  const { editor } = useTiptapEditor(providedEditor)
  const [url, setUrl] = useState<string>('')
  const [position, setPosition] = useState<MenuPosition | null>(null)
  const [isVisible, setIsVisible] = useState(false)
  const [copied, setCopied] = useState(false)

  const menuRef = useRef<HTMLDivElement>(null)
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const copyTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const hoveredLinkRef = useRef<HTMLElement | null>(null)
  const isHoveringMenuRef = useRef(false)
  const isCursorInLinkRef = useRef(false)

  const clearHideTimeout = useCallback(() => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current)
      hideTimeoutRef.current = null
    }
  }, [])

  const scheduleHide = useCallback(() => {
    clearHideTimeout()
    hideTimeoutRef.current = setTimeout(() => {
      if (!isHoveringMenuRef.current && !isCursorInLinkRef.current) {
        setIsVisible(false)
        hoveredLinkRef.current = null
      }
    }, 150)
  }, [clearHideTimeout])

  const showMenu = useCallback(
    (linkElement: HTMLElement, linkUrl: string) => {
      clearHideTimeout()
      const rect = linkElement.getBoundingClientRect()
      setUrl(linkUrl)
      setPosition({
        x: rect.left + rect.width / 2,
        y: rect.bottom + 8,
      })
      setIsVisible(true)
      hoveredLinkRef.current = linkElement
    },
    [clearHideTimeout]
  )

  // Handle cursor position in editor (selection in link)
  useEffect(() => {
    if (!editor) return

    const updateCursorState = () => {
      const isInLink = editor.isActive('link')
      isCursorInLinkRef.current = isInLink

      if (isInLink) {
        const { href } = editor.getAttributes('link')
        if (href) {
          // Find the link element at cursor position
          const { from } = editor.state.selection
          const domAtPos = editor.view.domAtPos(from)

          let linkElement: HTMLElement | null = null
          if (domAtPos.node) {
            const node =
              domAtPos.node instanceof Element
                ? domAtPos.node
                : domAtPos.node.parentElement
            linkElement = node?.closest('a') as HTMLElement | null
          }

          if (linkElement) {
            showMenu(linkElement, href)
          }
        }
      } else {
        // Cursor left the link
        if (!isHoveringMenuRef.current) {
          scheduleHide()
        }
      }
    }

    editor.on('selectionUpdate', updateCursorState)
    editor.on('transaction', updateCursorState)

    return () => {
      editor.off('selectionUpdate', updateCursorState)
      editor.off('transaction', updateCursorState)
    }
  }, [editor, showMenu, scheduleHide])

  // Hide when editor loses focus
  useEffect(() => {
    if (!editor) return

    const handleBlur = () => {
      // Small delay to allow clicking menu buttons
      setTimeout(() => {
        if (!isHoveringMenuRef.current) {
          setIsVisible(false)
          hoveredLinkRef.current = null
        }
      }, 100)
    }

    editor.on('blur', handleBlur)

    return () => {
      editor.off('blur', handleBlur)
    }
  }, [editor])

  // Hide when clicking outside the editor and menu
  useEffect(() => {
    if (!isVisible || !editor) return

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node
      const editorDom = editor.view.dom
      const menu = menuRef.current

      // Check if click is outside both editor and menu
      const isOutsideEditor = !editorDom.contains(target)
      const isOutsideMenu = !menu || !menu.contains(target)

      if (isOutsideEditor && isOutsideMenu) {
        setIsVisible(false)
        hoveredLinkRef.current = null
      }
    }

    document.addEventListener('mousedown', handleClickOutside)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isVisible, editor])

  // Cleanup timeouts
  useEffect(() => {
    return () => {
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current)
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current)
    }
  }, [])

  const handleMenuMouseEnter = useCallback(() => {
    isHoveringMenuRef.current = true
    clearHideTimeout()
  }, [clearHideTimeout])

  const handleMenuMouseLeave = useCallback(() => {
    isHoveringMenuRef.current = false
    scheduleHide()
  }, [scheduleHide])

  const handleEdit = useCallback(() => {
    if (!editor) return
    editor.chain().focus().extendMarkRange('link').run()
    setTimeout(() => {
      const event = new CustomEvent('tiptap:openLinkPopover')
      editor.view.dom.dispatchEvent(event)
    }, 0)
    setIsVisible(false)
  }, [editor])

  const handleOpen = useCallback(() => {
    if (!url) return
    const safeUrl = sanitizeUrl(url, window.location.href)
    if (safeUrl !== '#') {
      window.open(safeUrl, '_blank', 'noopener,noreferrer')
    }
  }, [url])

  const handleCopy = useCallback(async () => {
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current)
      }
      copyTimeoutRef.current = setTimeout(() => {
        setCopied(false)
      }, 2000)
    } catch (err) {
      console.error('Failed to copy URL:', err)
    }
  }, [url])

  const handleRemove = useCallback(() => {
    if (!editor) return
    editor
      .chain()
      .focus()
      .extendMarkRange('link')
      .unsetLink()
      .setMeta('preventAutolink', true)
      .run()
    setIsVisible(false)
  }, [editor])

  if (!isVisible || !position) return null

  return createPortal(
    <div
      ref={menuRef}
      className='link-floating-menu'
      style={{
        left: position.x,
        top: position.y,
      }}
      onMouseEnter={handleMenuMouseEnter}
      onMouseLeave={handleMenuMouseLeave}
    >
      <Card className='link-floating-menu-card'>
        <CardBody>
          <CardItemGroup orientation='horizontal'>
            <a
              href={url}
              target='_blank'
              rel='noopener noreferrer'
              className='link-floating-menu-url'
              title={url}
              onClick={e => {
                e.preventDefault()
                handleOpen()
              }}
            >
              <LinkIcon className='link-floating-menu-url-icon' />
              <span className='link-floating-menu-url-text'>
                {truncateUrl(url)}
              </span>
            </a>

            <Separator />

            <ButtonGroup orientation='horizontal'>
              <Button
                type='button'
                onClick={handleEdit}
                data-style='ghost'
                tooltip='Edit link'
                aria-label='Edit link'
              >
                <PencilIcon className='tiptap-button-icon' />
              </Button>

              <Button
                type='button'
                onClick={handleCopy}
                data-style='ghost'
                tooltip={copied ? 'Copied!' : 'Copy link'}
                aria-label='Copy link'
              >
                <CopyIcon className='tiptap-button-icon' />
              </Button>

              <Button
                type='button'
                onClick={handleOpen}
                data-style='ghost'
                tooltip='Open in new tab'
                aria-label='Open in new tab'
              >
                <ExternalLinkIcon className='tiptap-button-icon' />
              </Button>

              <Button
                type='button'
                onClick={handleRemove}
                data-style='ghost'
                tooltip='Remove link'
                aria-label='Remove link'
              >
                <TrashIcon className='tiptap-button-icon' />
              </Button>
            </ButtonGroup>
          </CardItemGroup>
        </CardBody>
      </Card>
    </div>,
    document.body
  )
}

export default LinkFloatingMenu

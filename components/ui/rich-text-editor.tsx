'use client'

import { useEffect, useMemo, type ReactNode } from 'react'
import type { Editor as TipTapEditor } from '@tiptap/core'
import { EditorContent, useEditor } from '@tiptap/react'
import LinkExtension from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import Underline from '@tiptap/extension-underline'
import StarterKit from '@tiptap/starter-kit'
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Link as LinkIcon,
  Strikethrough,
  Underline as UnderlineIcon,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type RichTextEditorProps = {
  id?: string
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

const sanitizeHtml = (content: string) =>
  content
    .replace(/<br\s*\/?>(\s|&nbsp;|\u00a0)*/gi, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const isContentEmpty = (content: string) => sanitizeHtml(content).length === 0

const ensureUrlProtocol = (value: string) => {
  if (!value) return ''
  const trimmed = value.trim()
  if (trimmed.length === 0) return ''

  const hasProtocol = /^[a-zA-Z][\w+.-]*:/.test(trimmed)
  if (hasProtocol) {
    return trimmed
  }

  return `https://${trimmed}`
}

let editorStylesElement: HTMLStyleElement | null = null

const ensureEditorStyles = () => {
  if (typeof document === 'undefined') {
    return
  }

  if (!editorStylesElement) {
    editorStylesElement = document.createElement('style')
    editorStylesElement.setAttribute('data-rich-text-editor-styles', 'true')
    document.head.appendChild(editorStylesElement)
  }

  editorStylesElement.textContent = `
    .rich-text-editor .ProseMirror p.is-editor-empty:first-child::before {
      color: var(--muted-foreground);
      content: attr(data-placeholder);
      float: left;
      height: 0;
      pointer-events: none;
    }

    .rich-text-editor .ProseMirror ul,
    .rich-text-editor .ProseMirror ol {
      padding-left: 1.25rem;
      margin: 0.5rem 0;
    }

    .rich-text-editor .ProseMirror li {
      margin: 0.25rem 0;
    }

    .rich-text-editor .ProseMirror p {
      margin: 0.5rem 0;
    }

    .rich-text-editor .ProseMirror:focus {
      outline: none;
    }
  `
}

type ToolbarButtonProps = {
  onClick: () => void
  active?: boolean
  disabled?: boolean
  icon: ReactNode
  label: string
}

function ToolbarButton({
  onClick,
  active,
  disabled,
  icon,
  label,
}: ToolbarButtonProps) {
  return (
    <Button
      type='button'
      variant='ghost'
      size='icon-sm'
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active ?? false}
      className={cn(
        'h-8 w-8 rounded-md',
        active && 'bg-accent text-accent-foreground'
      )}
    >
      {icon}
    </Button>
  )
}

export function RichTextEditor({
  id,
  value,
  onChange,
  onBlur,
  placeholder,
  disabled = false,
  className,
}: RichTextEditorProps) {
  useEffect(() => {
    ensureEditorStyles()
  }, [])

  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({
          bulletList: {
            keepMarks: true,
          },
          orderedList: {
            keepMarks: true,
          },
          strike: {
            HTMLAttributes: {
              class: 'line-through',
            },
          },
        }),
        Underline,
        LinkExtension.configure({
          openOnClick: false,
          autolink: true,
          linkOnPaste: true,
          HTMLAttributes: {
            rel: 'noreferrer noopener',
            target: '_blank',
            class: 'underline underline-offset-4 text-primary',
          },
        }),
        Placeholder.configure({
          placeholder: placeholder ?? 'Write a description...',
        }),
      ],
      content: value || '',
      editable: !disabled,
      immediatelyRender: false,
      onUpdate: ({ editor }: { editor: TipTapEditor }) => {
        onChange(editor.getHTML())
      },
    },
    [placeholder]
  )

  useEffect(() => {
    if (!editor) return

    const incoming = value || ''
    const current = editor.getHTML()

    if (isContentEmpty(incoming) && isContentEmpty(current)) {
      return
    }

    if (incoming !== current) {
      editor.commands.setContent(incoming || '')
    }
  }, [editor, value])

  useEffect(() => {
    if (!editor) return
    editor.setEditable(!disabled)
  }, [editor, disabled])

  useEffect(() => {
    if (!editor || !onBlur) return

    const handleBlur = () => {
      onBlur()
    }

    editor.on('blur', handleBlur)
    return () => {
      editor.off('blur', handleBlur)
    }
  }, [editor, onBlur])

  const toolbarDisabled = disabled || !editor

  const runCommand = (command: (instance: TipTapEditor) => void) => {
    if (!editor || disabled) {
      return
    }
    command(editor)
  }

  const handleLinkClick = () => {
    if (!editor || disabled) {
      return
    }

    if (editor.isActive('link')) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }

    if (typeof window === 'undefined') {
      return
    }

    const previousUrl = editor.getAttributes('link')?.href ?? ''
    const userInput = window.prompt('Enter URL', previousUrl)

    if (userInput === null) {
      return
    }

    const trimmed = userInput.trim()

    if (trimmed.length === 0) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }

    const normalizedUrl = ensureUrlProtocol(trimmed)
    const { from, to } = editor.state.selection
    const chain = editor.chain().focus()

    if (from === to) {
      chain
        .insertContent(trimmed)
        .setTextSelection({ from, to: from + trimmed.length })
    }

    chain.extendMarkRange('link').setLink({ href: normalizedUrl }).run()
  }

  const wrapperClasses = cn(
    'rich-text-editor group flex flex-col overflow-hidden rounded-md border bg-background shadow-xs transition',
    !disabled &&
      'focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/40',
    disabled && 'opacity-60',
    className
  )

  const contentClasses = useMemo(
    () =>
      cn(
        'w-full flex-1 text-sm',
        '[&_.ProseMirror]:min-h-[160px]',
        '[&_.ProseMirror]:px-3 [&_.ProseMirror]:py-2',
        '[&_.ProseMirror]:leading-relaxed [&_.ProseMirror]:text-foreground [&_.ProseMirror]:bg-transparent',
        '[&_.ProseMirror]:outline-none [&_.ProseMirror]:focus:outline-none',
        '[&_.ProseMirror_p]:my-2',
        '[&_.ProseMirror_ul]:list-disc [&_.ProseMirror_ul]:pl-4',
        '[&_.ProseMirror_ol]:list-decimal [&_.ProseMirror_ol]:pl-4',
        '[&_.ProseMirror li]:my-1',
        disabled && '[&_.ProseMirror]:cursor-not-allowed'
      ),
    [disabled]
  )

  return (
    <div id={id} data-disabled={disabled} className={wrapperClasses}>
      <div className='bg-muted/30 border-b px-2 py-1'>
        <div className='flex flex-wrap items-center gap-1.5'>
          <ToolbarButton
            onClick={() =>
              runCommand(instance => {
                instance.chain().focus().toggleBold().run()
              })
            }
            active={editor ? editor.isActive('bold') : false}
            disabled={toolbarDisabled}
            icon={<Bold className='h-4 w-4' />}
            label='Toggle bold'
          />
          <ToolbarButton
            onClick={() =>
              runCommand(instance => {
                instance.chain().focus().toggleItalic().run()
              })
            }
            active={editor ? editor.isActive('italic') : false}
            disabled={toolbarDisabled}
            icon={<Italic className='h-4 w-4' />}
            label='Toggle italic'
          />
          <ToolbarButton
            onClick={() =>
              runCommand(instance => {
                instance.chain().focus().toggleUnderline().run()
              })
            }
            active={editor ? editor.isActive('underline') : false}
            disabled={toolbarDisabled}
            icon={<UnderlineIcon className='h-4 w-4' />}
            label='Toggle underline'
          />
          <ToolbarButton
            onClick={() =>
              runCommand(instance => {
                instance.chain().focus().toggleStrike().run()
              })
            }
            active={editor ? editor.isActive('strike') : false}
            disabled={toolbarDisabled}
            icon={<Strikethrough className='h-4 w-4' />}
            label='Toggle strikethrough'
          />
          <ToolbarButton
            onClick={handleLinkClick}
            active={editor ? editor.isActive('link') : false}
            disabled={toolbarDisabled}
            icon={<LinkIcon className='h-4 w-4' />}
            label='Add or remove link'
          />
          <ToolbarButton
            onClick={() =>
              runCommand(instance => {
                instance.chain().focus().toggleBulletList().run()
              })
            }
            active={editor ? editor.isActive('bulletList') : false}
            disabled={toolbarDisabled}
            icon={<List className='h-4 w-4' />}
            label='Toggle bullet list'
          />
          <ToolbarButton
            onClick={() =>
              runCommand(instance => {
                instance.chain().focus().toggleOrderedList().run()
              })
            }
            active={editor ? editor.isActive('orderedList') : false}
            disabled={toolbarDisabled}
            icon={<ListOrdered className='h-4 w-4' />}
            label='Toggle ordered list'
          />
        </div>
      </div>
      <EditorContent editor={editor} className={contentClasses} />
    </div>
  )
}

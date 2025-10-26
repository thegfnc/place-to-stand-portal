import { useCallback, useEffect } from 'react'
import type { Editor as TipTapEditor } from '@tiptap/core'
import { useEditor } from '@tiptap/react'
import LinkExtension from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import Underline from '@tiptap/extension-underline'
import StarterKit from '@tiptap/starter-kit'
import type { StarterKitOptions } from '@tiptap/starter-kit'

import { ensureUrlProtocol, isContentEmpty } from './utils'

type UseRichTextEditorArgs = {
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  placeholder?: string
  disabled?: boolean
}

type UseRichTextEditorReturn = {
  editor: TipTapEditor | null
  executeCommand: (command: (editor: TipTapEditor) => void) => void
  toggleLink: () => void
}

const buildExtensions = (placeholder?: string) => {
  const starterKitConfig: Partial<StarterKitOptions> & { history?: boolean } = {
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
    history: false,
  }

  return [
    StarterKit.configure(starterKitConfig),
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
  ]
}

export function useRichTextEditor({
  value,
  onChange,
  onBlur,
  placeholder,
  disabled = false,
}: UseRichTextEditorArgs): UseRichTextEditorReturn {
  const editor = useEditor(
    {
      extensions: buildExtensions(placeholder),
      content: value || '',
      editable: !disabled,
      immediatelyRender: false,
      onUpdate: ({ editor: instance }) => {
        onChange(instance.getHTML())
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

  const executeCommand = useCallback(
    (command: (instance: TipTapEditor) => void) => {
      if (!editor || disabled) {
        return
      }
      command(editor)
    },
    [disabled, editor]
  )

  const toggleLink = useCallback(() => {
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
  }, [disabled, editor])

  return { editor, executeCommand, toggleLink }
}

import { useEffect } from 'react'
import type { Editor as TipTapEditor } from '@tiptap/core'
import { useEditor } from '@tiptap/react'
import { StarterKit } from '@tiptap/starter-kit'
import { Image } from '@tiptap/extension-image'
import { TaskItem, TaskList } from '@tiptap/extension-list'
import { TextAlign } from '@tiptap/extension-text-align'
import { Typography } from '@tiptap/extension-typography'
import { Highlight } from '@tiptap/extension-highlight'
import { Subscript } from '@tiptap/extension-subscript'
import { Superscript } from '@tiptap/extension-superscript'
import { Selection } from '@tiptap/extensions'
import LinkExtension from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import Underline from '@tiptap/extension-underline'
import { ImageUploadNode } from '@/components/tiptap-node/image-upload-node/image-upload-node-extension'
import { HorizontalRule } from '@/components/tiptap-node/horizontal-rule-node/horizontal-rule-node-extension'
import { handleImageUpload, MAX_FILE_SIZE } from '@/lib/tiptap-utils'

// Import node styles
import '@/components/tiptap-node/blockquote-node/blockquote-node.scss'
import '@/components/tiptap-node/code-block-node/code-block-node.scss'
import '@/components/tiptap-node/horizontal-rule-node/horizontal-rule-node.scss'
import '@/components/tiptap-node/list-node/list-node.scss'
import '@/components/tiptap-node/image-node/image-node.scss'
import '@/components/tiptap-node/heading-node/heading-node.scss'
import '@/components/tiptap-node/paragraph-node/paragraph-node.scss'

import { isContentEmpty } from './utils'

type UseRichTextEditorArgs = {
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  placeholder?: string
  disabled?: boolean
}

type UseRichTextEditorReturn = {
  editor: TipTapEditor | null
}

const buildExtensions = (placeholder?: string) => {
  return [
    StarterKit.configure({
      horizontalRule: false,
      // Disable history since form-level undo/redo is used
      // @ts-expect-error - history is a valid option but not in TypeScript types
      history: false,
      link: {
        openOnClick: false,
        enableClickSelection: true,
      },
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
    HorizontalRule,
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    TaskList,
    TaskItem.configure({ nested: true }),
    Highlight.configure({ multicolor: true }),
    Image,
    Typography,
    Superscript,
    Subscript,
    Selection,
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
    ImageUploadNode.configure({
      accept: 'image/*',
      maxSize: MAX_FILE_SIZE,
      limit: 3,
      upload: handleImageUpload,
      onError: error => console.error('Upload failed:', error),
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
      editorProps: {
        attributes: {
          autocomplete: 'off',
          autocorrect: 'off',
          autocapitalize: 'off',
          'aria-label': 'Rich text editor',
          class: 'tiptap ProseMirror',
        },
      },
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

  return { editor }
}

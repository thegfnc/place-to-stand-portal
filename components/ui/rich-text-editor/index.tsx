'use client'

import { useEffect, useMemo } from 'react'
import { EditorContent } from '@tiptap/react'

import { cn } from '@/lib/utils'

import { ensureEditorStyles } from './editor-styles'
import { RichTextToolbar } from './toolbar'
import { useRichTextEditor } from './use-rich-text-editor'

export type RichTextEditorProps = {
  id?: string
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  placeholder?: string
  disabled?: boolean
  className?: string
  contentMinHeightClassName?: string
}

export function RichTextEditor({
  id,
  value,
  onChange,
  onBlur,
  placeholder,
  disabled = false,
  className,
  contentMinHeightClassName = '[&_.ProseMirror]:min-h-[160px]',
}: RichTextEditorProps) {
  useEffect(() => {
    ensureEditorStyles()
  }, [])

  const { editor, executeCommand, toggleLink } = useRichTextEditor({
    value,
    onChange,
    onBlur,
    placeholder,
    disabled,
  })

  const wrapperClasses = useMemo(
    () =>
      cn(
        'rich-text-editor group flex flex-col overflow-hidden rounded-md border bg-background shadow-xs transition',
        !disabled &&
          'focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/40',
        disabled && 'opacity-60',
        className
      ),
    [className, disabled]
  )

  const contentClasses = useMemo(
    () =>
      cn(
        'w-full flex-1 text-sm',
        contentMinHeightClassName,
        '[&_.ProseMirror]:px-3 [&_.ProseMirror]:py-2',
        '[&_.ProseMirror]:leading-relaxed [&_.ProseMirror]:text-foreground [&_.ProseMirror]:bg-transparent',
        '[&_.ProseMirror]:outline-none [&_.ProseMirror]:focus:outline-none',
        '[&_.ProseMirror_p]:my-2',
        '[&_.ProseMirror_ul]:list-disc [&_.ProseMirror_ul]:pl-4',
        '[&_.ProseMirror_ol]:list-decimal [&_.ProseMirror_ol]:pl-4',
        '[&_.ProseMirror li]:my-1',
        disabled && '[&_.ProseMirror]:cursor-not-allowed'
      ),
    [contentMinHeightClassName, disabled]
  )

  return (
    <div id={id} data-disabled={disabled} className={wrapperClasses}>
      <RichTextToolbar
        editor={editor}
        disabled={disabled}
        executeCommand={executeCommand}
        onToggleLink={toggleLink}
      />
      <EditorContent editor={editor} className={contentClasses} />
    </div>
  )
}

'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { EditorContent, EditorContext } from '@tiptap/react'

import { cn } from '@/lib/utils'

// --- UI Primitives ---
import { Spacer } from '@/components/tiptap-ui-primitive/spacer'
import {
  Toolbar,
  ToolbarGroup,
  ToolbarSeparator,
} from '@/components/tiptap-ui-primitive/toolbar'

// --- Tiptap UI ---
import { HeadingDropdownMenu } from '@/components/tiptap-ui/heading-dropdown-menu'
import { ListDropdownMenu } from '@/components/tiptap-ui/list-dropdown-menu'
import { BlockquoteButton } from '@/components/tiptap-ui/blockquote-button'
import { CodeBlockButton } from '@/components/tiptap-ui/code-block-button'
import {
  ColorHighlightPopover,
  ColorHighlightPopoverContent,
  ColorHighlightPopoverButton,
} from '@/components/tiptap-ui/color-highlight-popover'
import {
  LinkPopover,
  LinkContent,
  LinkButton,
} from '@/components/tiptap-ui/link-popover'
import { MarkButton } from '@/components/tiptap-ui/mark-button'
import { TextAlignButton } from '@/components/tiptap-ui/text-align-button'

// --- Icons ---
import { ArrowLeftIcon } from '@/components/tiptap-icons/arrow-left-icon'
import { BanIcon } from '@/components/tiptap-icons/ban-icon'
import { HighlighterIcon } from '@/components/tiptap-icons/highlighter-icon'
import { LinkIcon } from '@/components/tiptap-icons/link-icon'

// --- Hooks ---
import { useIsMobile } from '@/hooks/use-mobile'
import { useWindowSize } from '@/hooks/use-window-size'
import { useCursorVisibility } from '@/hooks/use-cursor-visibility'
import { useTiptapEditor } from '@/hooks/use-tiptap-editor'

// --- UI Primitives ---
import { Button } from '@/components/tiptap-ui-primitive/button'

import { ensureEditorStyles } from './editor-styles'
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

const ClearFormattingButton = () => {
  const { editor } = useTiptapEditor()

  const handleClearFormatting = () => {
    if (!editor || !editor.isEditable) return

    editor.chain().focus().clearNodes().unsetAllMarks().run()
  }

  const canClear = editor?.isEditable && editor.can().clearNodes()

  return (
    <Button
      type='button'
      data-style='ghost'
      disabled={!canClear}
      data-disabled={!canClear}
      role='button'
      tabIndex={-1}
      aria-label='Clear formatting'
      tooltip='Clear formatting'
      onClick={handleClearFormatting}
    >
      <BanIcon className='tiptap-button-icon' />
    </Button>
  )
}

const MainToolbarContent = ({
  onHighlighterClick,
  onLinkClick,
  isMobile,
}: {
  onHighlighterClick: () => void
  onLinkClick: () => void
  isMobile: boolean
}) => {
  return (
    <>
      <Spacer size='8' />

      <ToolbarGroup>
        <HeadingDropdownMenu levels={[1, 2, 3, 4]} portal={isMobile} />
        <ListDropdownMenu
          types={['bulletList', 'orderedList', 'taskList']}
          portal={isMobile}
        />
        <BlockquoteButton />
        <CodeBlockButton />
      </ToolbarGroup>

      <ToolbarSeparator />

      <ToolbarGroup>
        <MarkButton type='bold' />
        <MarkButton type='italic' />
        <MarkButton type='strike' />
        <MarkButton type='code' />
        <MarkButton type='underline' />
        {!isMobile ? (
          <ColorHighlightPopover />
        ) : (
          <ColorHighlightPopoverButton onClick={onHighlighterClick} />
        )}
        {!isMobile ? <LinkPopover /> : <LinkButton onClick={onLinkClick} />}
      </ToolbarGroup>

      <ToolbarSeparator />

      <ToolbarGroup>
        <MarkButton type='superscript' />
        <MarkButton type='subscript' />
      </ToolbarGroup>

      <ToolbarSeparator />

      <ToolbarGroup>
        <TextAlignButton align='left' />
        <TextAlignButton align='center' />
        <TextAlignButton align='right' />
      </ToolbarGroup>

      <ToolbarSeparator />

      <ToolbarGroup>
        <ClearFormattingButton />
      </ToolbarGroup>

      <Spacer />
    </>
  )
}

const MobileToolbarContent = ({
  type,
  onBack,
}: {
  type: 'highlighter' | 'link'
  onBack: () => void
}) => (
  <>
    <ToolbarGroup>
      <Button data-style='ghost' onClick={onBack}>
        <ArrowLeftIcon className='tiptap-button-icon' />
        {type === 'highlighter' ? (
          <HighlighterIcon className='tiptap-button-icon' />
        ) : (
          <LinkIcon className='tiptap-button-icon' />
        )}
      </Button>
    </ToolbarGroup>

    <ToolbarSeparator />

    {type === 'highlighter' ? (
      <ColorHighlightPopoverContent />
    ) : (
      <LinkContent />
    )}
  </>
)

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

  const isMobile = useIsMobile()
  const { height } = useWindowSize()
  const [mobileView, setMobileView] = useState<'main' | 'highlighter' | 'link'>(
    'main'
  )
  const toolbarRef = useRef<HTMLDivElement>(null)
  const [toolbarHeight, setToolbarHeight] = useState(0)

  const { editor } = useRichTextEditor({
    value,
    onChange,
    onBlur,
    placeholder,
    disabled,
  })

  useEffect(() => {
    if (!toolbarRef.current) return

    const updateHeight = () => {
      setToolbarHeight(toolbarRef.current?.getBoundingClientRect().height ?? 0)
    }

    updateHeight()
    const resizeObserver = new ResizeObserver(updateHeight)
    resizeObserver.observe(toolbarRef.current)

    return () => resizeObserver.disconnect()
  }, [])

  const rect = useCursorVisibility({
    editor,
    overlayHeight: toolbarHeight,
  })

  useEffect(() => {
    if (!isMobile && mobileView !== 'main') {
      // Reset mobile view when switching to desktop
      setMobileView('main')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMobile])

  const wrapperClasses = useMemo(
    () =>
      cn(
        'rich-text-editor group flex w-full flex-shrink-0 flex-col overflow-hidden rounded-md border bg-background shadow-xs transition select-text',
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
        '[&_.ProseMirror]:select-text',
        '[&_.ProseMirror_p]:my-2',
        '[&_.ProseMirror_ul]:list-disc [&_.ProseMirror_ul]:pl-4',
        '[&_.ProseMirror_ol]:list-decimal [&_.ProseMirror_ol]:pl-4',
        '[&_.ProseMirror li]:my-1',
        disabled && '[&_.ProseMirror]:cursor-not-allowed'
      ),
    [contentMinHeightClassName, disabled]
  )

  if (!editor) {
    return null
  }

  return (
    <div
      id={id}
      data-disabled={disabled}
      data-rich-text-editor
      className={wrapperClasses}
      style={{ userSelect: 'text', WebkitUserSelect: 'text' }}
    >
      <EditorContext.Provider value={{ editor }}>
        <Toolbar
          ref={toolbarRef}
          style={{
            ...(isMobile
              ? {
                  bottom: `calc(100% - ${height - rect.y}px)`,
                }
              : {}),
          }}
        >
          {mobileView === 'main' ? (
            <MainToolbarContent
              onHighlighterClick={() => setMobileView('highlighter')}
              onLinkClick={() => setMobileView('link')}
              isMobile={isMobile}
            />
          ) : (
            <MobileToolbarContent
              type={mobileView === 'highlighter' ? 'highlighter' : 'link'}
              onBack={() => setMobileView('main')}
            />
          )}
        </Toolbar>

        <EditorContent editor={editor} className={contentClasses} />
      </EditorContext.Provider>
    </div>
  )
}

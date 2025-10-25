import type { Editor as TipTapEditor } from '@tiptap/core'
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Link as LinkIcon,
  Strikethrough,
  Underline as UnderlineIcon,
} from 'lucide-react'

import { ToolbarButton } from './toolbar-button'

type ExecuteCommand = (command: (editor: TipTapEditor) => void) => void

type RichTextToolbarProps = {
  editor: TipTapEditor | null
  disabled: boolean
  executeCommand: ExecuteCommand
  onToggleLink: () => void
}

export function RichTextToolbar({
  editor,
  disabled,
  executeCommand,
  onToggleLink,
}: RichTextToolbarProps) {
  const toolbarDisabled = disabled || !editor
  const isActive = (name: string) => (editor ? editor.isActive(name) : false)

  return (
    <div className='bg-muted/30 border-b px-2 py-1'>
      <div className='flex flex-wrap items-center gap-1.5'>
        <ToolbarButton
          onClick={() =>
            executeCommand(instance => {
              instance.chain().focus().toggleBold().run()
            })
          }
          active={isActive('bold')}
          disabled={toolbarDisabled}
          icon={<Bold className='h-4 w-4' />}
          label='Toggle bold'
        />
        <ToolbarButton
          onClick={() =>
            executeCommand(instance => {
              instance.chain().focus().toggleItalic().run()
            })
          }
          active={isActive('italic')}
          disabled={toolbarDisabled}
          icon={<Italic className='h-4 w-4' />}
          label='Toggle italic'
        />
        <ToolbarButton
          onClick={() =>
            executeCommand(instance => {
              instance.chain().focus().toggleUnderline().run()
            })
          }
          active={isActive('underline')}
          disabled={toolbarDisabled}
          icon={<UnderlineIcon className='h-4 w-4' />}
          label='Toggle underline'
        />
        <ToolbarButton
          onClick={() =>
            executeCommand(instance => {
              instance.chain().focus().toggleStrike().run()
            })
          }
          active={isActive('strike')}
          disabled={toolbarDisabled}
          icon={<Strikethrough className='h-4 w-4' />}
          label='Toggle strikethrough'
        />
        <ToolbarButton
          onClick={onToggleLink}
          active={isActive('link')}
          disabled={toolbarDisabled}
          icon={<LinkIcon className='h-4 w-4' />}
          label='Add or remove link'
        />
        <ToolbarButton
          onClick={() =>
            executeCommand(instance => {
              instance.chain().focus().toggleBulletList().run()
            })
          }
          active={isActive('bulletList')}
          disabled={toolbarDisabled}
          icon={<List className='h-4 w-4' />}
          label='Toggle bullet list'
        />
        <ToolbarButton
          onClick={() =>
            executeCommand(instance => {
              instance.chain().focus().toggleOrderedList().run()
            })
          }
          active={isActive('orderedList')}
          disabled={toolbarDisabled}
          icon={<ListOrdered className='h-4 w-4' />}
          label='Toggle ordered list'
        />
      </div>
    </div>
  )
}

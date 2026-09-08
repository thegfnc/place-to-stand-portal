'use client'

import { useState } from 'react'
import { ArrowDown, ArrowUp, Link2, Link2Off, Plus, Trash2 } from 'lucide-react'

import { Button } from '@pts/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@pts/ui/select'

import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import type { ComposerTaskOption } from '@/lib/updates/composer-data'
import type { ClientUpdateItem } from '@/lib/updates/types'

type UpdateItemsEditorProps = {
  items: ClientUpdateItem[]
  onChange: (items: ClientUpdateItem[]) => void
  taskOptions: ComposerTaskOption[]
  /** Latest comment per task id — a reminder while writing, never sent. */
  hints: Record<string, string>
  disabled?: boolean
}

const BODY_PLACEHOLDER =
  'What changed, for the client. **bold**, *italic*, [links](https://…) and line breaks are allowed.'

/**
 * One editable block per item: the bold run-in label, the body in minimal
 * markdown, and which task it links to. Order is the email's numbering.
 */
export function UpdateItemsEditor({
  items,
  onChange,
  taskOptions,
  hints,
  disabled,
}: UpdateItemsEditorProps) {
  const [pickingFor, setPickingFor] = useState<string | null>(null)

  const taskById = new Map(taskOptions.map(task => [task.id, task]))
  const linkedIds = new Set(items.map(item => item.taskId).filter(Boolean))

  const patch = (id: string, changes: Partial<ClientUpdateItem>) =>
    onChange(
      items.map(item => (item.id === id ? { ...item, ...changes } : item))
    )

  const move = (index: number, delta: number) => {
    const next = [...items]
    const target = index + delta
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(next)
  }

  const add = (taskId: string | null) => {
    const task = taskId ? taskById.get(taskId) : undefined
    onChange([
      ...items,
      { id: crypto.randomUUID(), taskId, label: task?.title ?? '', body: '' },
    ])
  }

  return (
    <div className='space-y-4'>
      {items.map((item, index) => {
        const task = item.taskId ? taskById.get(item.taskId) : undefined
        const hint = item.taskId ? hints[item.taskId] : undefined
        return (
          <div key={item.id} className='group rounded-md border p-3'>
            <div className='flex items-start gap-2'>
              <span className='text-muted-foreground w-5 pt-2 text-right text-sm tabular-nums'>
                {index + 1}.
              </span>
              <div className='min-w-0 flex-1 space-y-2'>
                <Input
                  value={item.label}
                  onChange={event =>
                    patch(item.id, { label: event.target.value })
                  }
                  placeholder='Label, e.g. Site speed'
                  disabled={disabled}
                  aria-label={`Item ${index + 1} label`}
                  className='font-semibold'
                />
                <Textarea
                  value={item.body}
                  onChange={event =>
                    patch(item.id, { body: event.target.value })
                  }
                  placeholder={BODY_PLACEHOLDER}
                  disabled={disabled}
                  aria-label={`Item ${index + 1} body`}
                  rows={3}
                  className='min-h-[72px] text-[15px] leading-relaxed'
                />
                {task ? (
                  <p className='text-muted-foreground flex items-center gap-1.5 text-xs'>
                    <Link2 className='h-3 w-3' />
                    Links to{' '}
                    <span className='text-foreground'>{task.title}</span>
                    <span>· {task.projectName}</span>
                  </p>
                ) : pickingFor === item.id ? (
                  <Select
                    onValueChange={value => {
                      patch(item.id, { taskId: value })
                      setPickingFor(null)
                    }}
                  >
                    <SelectTrigger
                      className='h-8 text-xs'
                      aria-label='Choose a task to link'
                    >
                      <SelectValue placeholder='Choose a task to link' />
                    </SelectTrigger>
                    <SelectContent>
                      {taskOptions
                        .filter(option => !linkedIds.has(option.id))
                        .map(option => (
                          <SelectItem key={option.id} value={option.id}>
                            {option.title}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                ) : null}
                {hint ? (
                  <p className='text-muted-foreground border-l-2 pl-2 text-xs italic'>
                    Latest comment: {hint}
                  </p>
                ) : null}
              </div>
              <div className='flex flex-col gap-0.5 opacity-60 transition group-hover:opacity-100'>
                <IconButton
                  label='Move up'
                  onClick={() => move(index, -1)}
                  disabled={disabled || index === 0}
                >
                  <ArrowUp className='h-3.5 w-3.5' />
                </IconButton>
                <IconButton
                  label='Move down'
                  onClick={() => move(index, 1)}
                  disabled={disabled || index === items.length - 1}
                >
                  <ArrowDown className='h-3.5 w-3.5' />
                </IconButton>
                {task ? (
                  <IconButton
                    label='Unlink task'
                    onClick={() => patch(item.id, { taskId: null })}
                    disabled={disabled}
                  >
                    <Link2Off className='h-3.5 w-3.5' />
                  </IconButton>
                ) : (
                  <IconButton
                    label='Link a task'
                    onClick={() => setPickingFor(item.id)}
                    disabled={disabled}
                  >
                    <Link2 className='h-3.5 w-3.5' />
                  </IconButton>
                )}
                <IconButton
                  label='Remove item'
                  onClick={() =>
                    onChange(items.filter(other => other.id !== item.id))
                  }
                  disabled={disabled}
                >
                  <Trash2 className='h-3.5 w-3.5' />
                </IconButton>
              </div>
            </div>
          </div>
        )
      })}

      <div className='flex flex-wrap items-center gap-2'>
        <Button
          type='button'
          size='sm'
          variant='outline'
          onClick={() => add(null)}
          disabled={disabled}
        >
          <Plus className='h-3.5 w-3.5' /> Add item
        </Button>
        <Select onValueChange={value => add(value)} disabled={disabled}>
          <SelectTrigger
            className='h-8 w-auto max-w-xs text-xs'
            aria-label='Add an item from a task'
          >
            <SelectValue placeholder='Add from a task…' />
          </SelectTrigger>
          <SelectContent>
            {taskOptions
              .filter(option => !linkedIds.has(option.id))
              .map(option => (
                <SelectItem key={option.id} value={option.id}>
                  {option.title}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}

function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <Button
      type='button'
      size='icon'
      variant='ghost'
      className='h-6 w-6'
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
    >
      {children}
    </Button>
  )
}

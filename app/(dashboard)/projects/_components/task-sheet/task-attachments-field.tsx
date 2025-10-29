'use client'

import { useCallback, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { FileText, Loader2, Paperclip, Plus, X } from 'lucide-react'
import clsx from 'clsx'

import { Button } from '@/components/ui/button'
import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

import type { AttachmentItem } from '@/lib/projects/task-sheet/use-task-sheet-state'

type TaskAttachmentsFieldProps = {
  attachments: AttachmentItem[]
  onSelectFiles: (files: FileList | null) => void
  onRemove: (key: string) => void
  disabled: boolean
  disabledReason: string | null
  isUploading: boolean
  isDragActive: boolean
  acceptedMimeTypes: readonly string[]
  maxFileSize: number
}

const MAX_NAME_LENGTH = 64

const formatBytes = (bytes: number) => {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1
  )
  const value = bytes / Math.pow(1024, exponent)
  return `${value.toFixed(value >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]}`
}

const truncateName = (name: string) => {
  if (name.length <= MAX_NAME_LENGTH) {
    return name
  }
  const extensionIndex = name.lastIndexOf('.')
  if (extensionIndex === -1) {
    return `${name.slice(0, MAX_NAME_LENGTH - 3)}...`
  }
  const base = name.slice(0, extensionIndex)
  const extension = name.slice(extensionIndex)
  const available = MAX_NAME_LENGTH - extension.length - 3
  if (available <= 0) {
    return `${name.slice(0, MAX_NAME_LENGTH - 3)}...`
  }
  return `${base.slice(0, available)}...${extension}`
}

export function TaskAttachmentsField({
  attachments,
  onSelectFiles,
  onRemove,
  disabled,
  disabledReason,
  isUploading,
  isDragActive,
  acceptedMimeTypes,
  maxFileSize,
}: TaskAttachmentsFieldProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [pendingRemoval, setPendingRemoval] = useState<string | null>(null)

  const acceptValue = useMemo(
    () => acceptedMimeTypes.join(','),
    [acceptedMimeTypes]
  )

  const maxSizeLabel = useMemo(() => formatBytes(maxFileSize), [maxFileSize])

  const openFilePicker = useCallback(() => {
    if (disabled || isUploading) {
      return
    }
    fileInputRef.current?.click()
  }, [disabled, isUploading])

  const handleFileChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      onSelectFiles(event.target.files)
      event.target.value = ''
    },
    [onSelectFiles]
  )

  const handleConfirmRemove = useCallback(() => {
    if (pendingRemoval) {
      onRemove(pendingRemoval)
    }
    setPendingRemoval(null)
  }, [onRemove, pendingRemoval])

  const handleCancelRemove = useCallback(() => {
    setPendingRemoval(null)
  }, [])

  const renderAttachmentRow = useCallback(
    (attachment: AttachmentItem) => {
      const removalDisabled = disabled || isUploading
      const content = attachment.url ? (
        <a
          href={attachment.url}
          target='_blank'
          rel='noreferrer'
          className='text-primary inline-flex items-center gap-2 truncate font-medium hover:underline'
        >
          <Paperclip className='h-4 w-4 shrink-0' />
          <span className='truncate'>{truncateName(attachment.name)}</span>
        </a>
      ) : (
        <span className='text-muted-foreground inline-flex items-center gap-2 truncate font-medium'>
          <FileText className='h-4 w-4 shrink-0' />
          <span className='truncate'>{truncateName(attachment.name)}</span>
        </span>
      )

      return (
        <li
          key={attachment.key}
          className='border-border bg-card flex items-center justify-between gap-4 rounded-md border px-3 py-2 text-sm'
        >
          <div className='flex min-w-0 flex-col gap-1'>
            {content}
            <div className='text-muted-foreground flex flex-wrap items-center gap-2 text-xs'>
              <span>{attachment.mimeType}</span>
              <span>•</span>
              <span>{formatBytes(attachment.size)}</span>
              {attachment.isPending ? (
                <span className='text-amber-600'>Pending save</span>
              ) : null}
            </div>
          </div>
          <DisabledFieldTooltip
            disabled={removalDisabled}
            reason={
              disabled
                ? disabledReason
                : isUploading
                  ? 'Please wait for uploads to finish.'
                  : null
            }
          >
            <Button
              type='button'
              size='icon'
              variant='ghost'
              className='text-muted-foreground hover:text-destructive'
              onClick={() => setPendingRemoval(attachment.key)}
              aria-label={`Remove ${attachment.name}`}
              disabled={removalDisabled}
            >
              <X className='h-4 w-4' />
            </Button>
          </DisabledFieldTooltip>
        </li>
      )
    },
    [disabled, disabledReason, isUploading]
  )

  const dropzoneClasses = clsx(
    'border-border/60 bg-muted/40 relative flex items-center justify-center gap-2 rounded-md border-2 border-dashed p-6 text-sm text-muted-foreground transition w-full',
    disabled ? 'opacity-60' : 'hover:border-primary',
    isDragActive ? 'border-primary bg-primary/5 text-primary' : null
  )

  return (
    <div className='space-y-1'>
      <div className='flex items-center justify-between gap-3'>
        <h3 className='text-sm font-medium'>Attachments</h3>
        <DisabledFieldTooltip
          disabled={disabled || isUploading}
          reason={
            disabled
              ? disabledReason
              : isUploading
                ? 'Please wait for uploads to finish.'
                : null
          }
        >
          <Button
            type='button'
            size='xs'
            variant='ghost'
            onClick={openFilePicker}
            disabled={disabled || isUploading}
            aria-label='Add attachment'
          >
            {isUploading ? (
              <Loader2 className='h-4 w-4 animate-spin' />
            ) : (
              <Plus className='h-4 w-4' />
            )}
          </Button>
        </DisabledFieldTooltip>
      </div>
      {attachments.length === 0 ? (
        <button
          type='button'
          className={dropzoneClasses}
          onClick={openFilePicker}
          disabled={disabled || isUploading}
        >
          <Paperclip className='text-muted-foreground/70 h-6 w-6' />
          <div className='text-left'>
            <p className='font-medium'>Drop files here or click to upload</p>
            <p className='text-muted-foreground text-xs'>
              Images, videos, PDFs, or ZIPs up to {maxSizeLabel}
            </p>
          </div>
        </button>
      ) : (
        <div className='relative'>
          <ul className='space-y-2'>{attachments.map(renderAttachmentRow)}</ul>
          {isDragActive ? (
            <div className='bg-background/95 border-border/60 text-muted-foreground absolute inset-0 flex items-center justify-center gap-3 rounded-md border-2 border-dashed text-sm'>
              <Paperclip className='text-muted-foreground/70 h-6 w-6' />
              <p className='font-medium'>Release to add files</p>
            </div>
          ) : null}
        </div>
      )}
      <input
        ref={fileInputRef}
        type='file'
        multiple
        accept={acceptValue}
        hidden
        onChange={handleFileChange}
        disabled={disabled}
      />
      <ConfirmDialog
        open={pendingRemoval !== null}
        title='Remove attachment?'
        description='This attachment will be removed after you save your changes.'
        confirmLabel='Remove'
        confirmVariant='destructive'
        onCancel={handleCancelRemove}
        onConfirm={handleConfirmRemove}
      />
    </div>
  )
}

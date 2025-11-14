"use client"

import { Button } from "@/components/tiptap-ui-primitive/button"
import { CloseIcon } from "@/components/tiptap-icons/close-icon"

import { CloudUploadIcon } from "./image-upload-icons"
import type { FileItem } from "./use-file-upload"

interface ImageUploadPreviewProps {
  /**
   * The file item to preview
   */
  fileItem: FileItem
  /**
   * Callback to remove this file from upload queue
   */
  onRemove: () => void
}

const SIZE_LABELS = ["Bytes", "KB", "MB", "GB"]

function formatFileSize(bytes: number) {
  if (bytes === 0) return "0 Bytes"
  const unit = 1024
  const index = Math.floor(Math.log(bytes) / Math.log(unit))
  return `${parseFloat((bytes / Math.pow(unit, index)).toFixed(2))} ${SIZE_LABELS[index]}`
}

/**
 * Component that displays a preview of an uploading file with progress
 */
export function ImageUploadPreview({ fileItem, onRemove }: ImageUploadPreviewProps) {
  return (
    <div className="tiptap-image-upload-preview">
      {fileItem.status === "uploading" && (
        <div
          className="tiptap-image-upload-progress"
          style={{ width: `${fileItem.progress}%` }}
        />
      )}

      <div className="tiptap-image-upload-preview-content">
        <div className="tiptap-image-upload-file-info">
          <div className="tiptap-image-upload-file-icon">
            <CloudUploadIcon />
          </div>
          <div className="tiptap-image-upload-details">
            <span className="tiptap-image-upload-text">{fileItem.file.name}</span>
            <span className="tiptap-image-upload-subtext">
              {formatFileSize(fileItem.file.size)}
            </span>
          </div>
        </div>
        <div className="tiptap-image-upload-actions">
          {fileItem.status === "uploading" && (
            <span className="tiptap-image-upload-progress-text">
              {fileItem.progress}%
            </span>
          )}
          <Button
            type="button"
            data-style="ghost"
            onClick={(event) => {
              event.stopPropagation()
              onRemove()
            }}
          >
            <CloseIcon className="tiptap-button-icon" />
          </Button>
        </div>
      </div>
    </div>
  )
}


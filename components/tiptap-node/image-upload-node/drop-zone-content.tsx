import { CloudUploadIcon, FileCornerIcon, FileIcon } from "./image-upload-icons"

interface DropZoneContentProps {
  maxSize: number
  limit: number
}

export function DropZoneContent({ maxSize, limit }: DropZoneContentProps) {
  return (
    <>
      <div className="tiptap-image-upload-dropzone">
        <FileIcon />
        <FileCornerIcon />
        <div className="tiptap-image-upload-icon-container">
          <CloudUploadIcon />
        </div>
      </div>

      <div className="tiptap-image-upload-content">
        <span className="tiptap-image-upload-text">
          <em>Click to upload</em> or drag and drop
        </span>
        <span className="tiptap-image-upload-subtext">
          Maximum {limit} file{limit === 1 ? "" : "s"},{" "}
          {maxSize / 1024 / 1024}MB each.
        </span>
      </div>
    </>
  )
}


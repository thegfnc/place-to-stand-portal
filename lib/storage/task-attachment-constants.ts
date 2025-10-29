export const TASK_ATTACHMENT_BUCKET = 'task-attachments'
export const MAX_TASK_ATTACHMENT_FILE_SIZE = 50 * 1024 * 1024 // 50MB
export const ACCEPTED_TASK_ATTACHMENT_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'application/pdf',
  'application/zip',
  'application/x-zip-compressed',
] as const

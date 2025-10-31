export const formatTaskStatusLabel = (status: string | null) => {
  if (!status) {
    return null
  }

  return status
    .toLowerCase()
    .split('_')
    .map(part => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join(' ')
}

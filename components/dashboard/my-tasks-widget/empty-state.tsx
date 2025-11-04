export function EmptyState() {
  return (
    <div className='text-muted-foreground flex h-full flex-col items-center justify-center gap-2 px-5 py-12 text-center text-sm'>
      <p>No tasks assigned to you yet.</p>
      <p className='max-w-xs text-xs'>
        Once teammates assign you to a task, it will appear here so you can jump
        straight into the right project.
      </p>
    </div>
  )
}

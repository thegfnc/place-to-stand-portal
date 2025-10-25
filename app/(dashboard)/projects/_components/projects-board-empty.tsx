type ProjectsBoardEmptyProps = {
  title: string
  description: string
}

export function ProjectsBoardEmpty({
  title,
  description,
}: ProjectsBoardEmptyProps) {
  return (
    <div className='grid h-full w-full place-items-center rounded-xl border border-dashed p-12 text-center'>
      <div className='space-y-2'>
        <h2 className='text-lg font-semibold'>{title}</h2>
        <p className='text-muted-foreground text-sm'>{description}</p>
      </div>
    </div>
  )
}

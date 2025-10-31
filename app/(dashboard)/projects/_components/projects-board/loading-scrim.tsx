import { Loader2 } from 'lucide-react'

export type LoadingScrimProps = {
  visible: boolean
}

export function LoadingScrim({ visible }: LoadingScrimProps) {
  if (!visible) {
    return null
  }

  return (
    <div className='bg-background/60 pointer-events-none absolute inset-0 flex items-center justify-center'>
      <Loader2 className='text-muted-foreground h-6 w-6 animate-spin' />
    </div>
  )
}

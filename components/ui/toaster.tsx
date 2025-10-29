'use client'

import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import { subscribe, type ToastMessage } from './toast'

const TOAST_GAP = 12

export function Toaster() {
  const [toasts, setToasts] = useState<ToastMessage[]>([])
  const timeoutsRef = useRef<Map<string, number>>(new Map())

  useEffect(() => {
    const timeouts = timeoutsRef.current
    const unsubscribe = subscribe(toast => {
      setToasts(current => [...current, toast])

      if (toast.duration && toast.duration > 0) {
        const timeoutId = window.setTimeout(() => {
          timeouts.delete(toast.id)
          setToasts(current => current.filter(item => item.id !== toast.id))
        }, toast.duration)

        timeouts.set(toast.id, timeoutId)
      }
    })

    return () => {
      unsubscribe()
      timeouts.forEach(timeoutId => window.clearTimeout(timeoutId))
      timeouts.clear()
    }
  }, [])

  const dismiss = (id: string) => {
    const timeoutId = timeoutsRef.current.get(id)
    if (typeof timeoutId === 'number') {
      window.clearTimeout(timeoutId)
      timeoutsRef.current.delete(id)
    }

    setToasts(current => current.filter(toast => toast.id !== id))
  }

  if (toasts.length === 0) {
    return null
  }

  return (
    <div
      className='pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4 sm:items-end'
      style={{ gap: TOAST_GAP }}
    >
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={cn(
            'bg-background pointer-events-auto w-full max-w-sm rounded-lg border p-4 shadow-lg transition',
            toast.variant === 'destructive'
              ? 'border-destructive/40 bg-destructive text-white'
              : 'border-border'
          )}
        >
          <div className='flex items-start gap-3'>
            <div className='flex-1 space-y-1'>
              <p className='text-sm leading-none font-medium'>{toast.title}</p>
              {toast.description ? (
                <p className='text-sm'>{toast.description}</p>
              ) : null}
            </div>
            <Button
              variant='ghost'
              size='icon'
              onClick={() => dismiss(toast.id)}
              className='h-8 w-8 shrink-0'
            >
              <X className='h-4 w-4' />
              <span className='sr-only'>Dismiss</span>
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}

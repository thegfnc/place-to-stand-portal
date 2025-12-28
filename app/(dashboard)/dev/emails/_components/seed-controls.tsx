"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export function SeedControls() {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function seed() {
    setPending(true)
    setError(null)
    try {
      const res = await fetch('/api/dev/seed', { method: 'POST' })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || `Seed failed with status ${res.status}`)
      }
      router.refresh()
    } catch (e) {
      setError(String(e))
    } finally {
      setPending(false)
    }
  }

  return (
    <Card>
      <CardContent className="py-4 flex items-center gap-3">
        <Button size="sm" variant="outline" onClick={seed} disabled={pending}>
          {pending ? 'Seeding…' : 'Seed sample data'}
        </Button>
        {error ? <span className="text-sm text-destructive">{error}</span> : null}
      </CardContent>
    </Card>
  )
}


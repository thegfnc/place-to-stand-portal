import { NextResponse } from 'next/server'
import { z } from 'zod'

import { requireUser } from '@/lib/auth/session'
import { fetchHoursSnapshot } from '@/lib/data/dashboard/hours'

const schema = z.object({
  year: z.number().int().min(2000).max(3000),
  month: z.number().int().min(1).max(12),
})

export async function POST(request: Request) {
  const user = await requireUser()

  let payload: z.infer<typeof schema>
  try {
    payload = schema.parse(await request.json())
  } catch (error) {
    console.error('Invalid payload for hours snapshot', error)
    return NextResponse.json(
      { error: 'Invalid request payload.' },
      { status: 400 }
    )
  }

  try {
    const snapshot = await fetchHoursSnapshot(user, payload)
    return NextResponse.json(snapshot)
  } catch (error) {
    console.error('Failed to load hours snapshot', error)
    return NextResponse.json(
      { error: 'Unable to load hours summary right now.' },
      { status: 500 }
    )
  }
}

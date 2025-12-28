import { NextResponse } from 'next/server'

import { requireUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function POST() {
  // Hard guard: never available in production
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available' }, { status: 404 })
  }

  const user = await requireUser()

  await db.update(users).set({ role: 'ADMIN' }).where(eq(users.id, user.id))

  return NextResponse.json({ ok: true, userId: user.id, role: 'ADMIN' })
}


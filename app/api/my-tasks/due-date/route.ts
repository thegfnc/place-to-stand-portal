import { NextResponse } from 'next/server'
import { z } from 'zod'

import { changeTaskDueDate } from '@/app/(dashboard)/projects/actions/change-task-due-date'

const payloadSchema = z.object({
  taskId: z.string().uuid(),
  dueOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

export async function POST(request: Request) {
  let body: unknown

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid payload.' }, { status: 400 })
  }

  const parsed = payloadSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload.' }, { status: 400 })
  }

  const result = await changeTaskDueDate(parsed.data)

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}


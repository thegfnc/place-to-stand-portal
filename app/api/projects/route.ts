import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/session'
import { getProjectsForDropdown } from '@/lib/data/suggestions'

export async function GET() {
  await requireRole('ADMIN')

  const projects = await getProjectsForDropdown()

  return NextResponse.json(projects)
}

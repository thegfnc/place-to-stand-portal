import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { differenceInCalendarDays, isValid, parseISO } from 'date-fns'

import { getCurrentUser } from '@/lib/auth/session'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { fetchProjectCalendarTasks } from '@/lib/data/projects'

const MAX_RANGE_DAYS = 90

type RouteParams = {
  params: Promise<{
    projectId: string
  }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const resolvedParams = await params
  const projectId = resolvedParams.projectId

  if (!projectId) {
    return NextResponse.json(
      { error: 'Project id is required.' },
      { status: 400 }
    )
  }

  const url = new URL(request.url)
  const startParam = url.searchParams.get('start')
  const endParam = url.searchParams.get('end')

  if (!startParam || !endParam) {
    return NextResponse.json(
      { error: 'start and end query parameters are required.' },
      { status: 400 }
    )
  }

  const startDate = parseISO(startParam)
  const endDate = parseISO(endParam)

  if (!isValid(startDate) || !isValid(endDate)) {
    return NextResponse.json(
      { error: 'start and end must be valid ISO dates (YYYY-MM-DD).' },
      { status: 400 }
    )
  }

  if (differenceInCalendarDays(endDate, startDate) < 0) {
    return NextResponse.json(
      { error: 'end must be equal to or after start.' },
      { status: 400 }
    )
  }

  if (differenceInCalendarDays(endDate, startDate) > MAX_RANGE_DAYS) {
    return NextResponse.json(
      { error: 'Requested range is too large.' },
      { status: 400 }
    )
  }

  const supabase = getSupabaseServerClient()

  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .is('deleted_at', null)
    .maybeSingle()

  if (projectError) {
    console.error('Failed to load project for calendar tasks', projectError)
    return NextResponse.json(
      { error: 'Unable to verify project access.' },
      { status: 500 }
    )
  }

  if (!project) {
    return NextResponse.json({ error: 'Project not found.' }, { status: 404 })
  }

  try {
    const tasks = await fetchProjectCalendarTasks({
      supabase,
      projectId,
      start: startParam,
      end: endParam,
    })

    return NextResponse.json({ tasks })
  } catch (error) {
    console.error('Failed to resolve calendar tasks', error)
    return NextResponse.json(
      { error: 'Unable to load calendar tasks.' },
      { status: 500 }
    )
  }
}

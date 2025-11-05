'use server'

import { revalidatePath } from 'next/cache'

export async function revalidateProjectTaskViews() {
  await Promise.all([
    revalidatePath('/projects'),
    revalidatePath('/projects/[clientSlug]/[projectSlug]/board', 'page'),
    revalidatePath('/projects/[clientSlug]/[projectSlug]/calendar', 'page'),
    revalidatePath('/projects/[clientSlug]/[projectSlug]/backlog', 'page'),
    revalidatePath('/projects/[clientSlug]/[projectSlug]/activity', 'page'),
    revalidatePath('/projects/[clientSlug]/[projectSlug]/review', 'page'),
  ])
}

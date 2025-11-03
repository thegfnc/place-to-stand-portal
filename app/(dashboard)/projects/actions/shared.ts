'use server'

import { revalidatePath } from 'next/cache'

export async function revalidateProjectTaskViews() {
  await Promise.all([
    revalidatePath('/projects'),
    revalidatePath('/projects/[clientSlug]/[projectSlug]/board'),
    revalidatePath('/projects/[clientSlug]/[projectSlug]/calendar'),
    revalidatePath('/projects/[clientSlug]/[projectSlug]/refine'),
    revalidatePath('/projects/[clientSlug]/[projectSlug]/activity'),
    revalidatePath('/projects/[clientSlug]/[projectSlug]/review'),
  ])
}

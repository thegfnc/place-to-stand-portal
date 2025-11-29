'use server'

import { revalidatePath } from 'next/cache'

export async function revalidateProjectSettings() {
  revalidatePath('/projects')
  revalidatePath('/projects/archive')
  revalidatePath('/projects/activity')
}

export async function revalidateProjectDetailRoutes() {
  revalidatePath('/projects')
  revalidatePath('/projects/[clientSlug]/[projectSlug]/board')
}

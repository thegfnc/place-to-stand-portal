'use server'

import { revalidatePath } from 'next/cache'

export async function revalidateProjectSettings() {
  revalidatePath('/settings/projects')
}

export async function revalidateProjectDetailRoutes() {
  revalidatePath('/projects')
  revalidatePath('/projects/[clientSlug]/[projectSlug]/board')
}

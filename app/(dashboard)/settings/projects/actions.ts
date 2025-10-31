'use server'

import type {
  DeleteProjectInput,
  DestroyProjectInput,
  ProjectActionResult,
  ProjectInput,
  RestoreProjectInput,
} from '@/lib/settings/projects/project-service'

import { saveProject as saveProjectAction } from '@/lib/settings/projects/actions/save-project'
import { softDeleteProject as softDeleteProjectAction } from '@/lib/settings/projects/actions/soft-delete-project'
import { restoreProject as restoreProjectAction } from '@/lib/settings/projects/actions/restore-project'
import { destroyProject as destroyProjectAction } from '@/lib/settings/projects/actions/destroy-project'

export async function saveProject(
  input: ProjectInput
): Promise<ProjectActionResult> {
  return saveProjectAction(input)
}

export async function softDeleteProject(
  input: DeleteProjectInput
): Promise<ProjectActionResult> {
  return softDeleteProjectAction(input)
}

export async function restoreProject(
  input: RestoreProjectInput
): Promise<ProjectActionResult> {
  return restoreProjectAction(input)
}

export async function destroyProject(
  input: DestroyProjectInput
): Promise<ProjectActionResult> {
  return destroyProjectAction(input)
}

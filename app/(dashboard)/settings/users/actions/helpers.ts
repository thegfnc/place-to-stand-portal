import { revalidatePath } from 'next/cache'

export const USERS_PATH = '/settings/users'
const RELATED_SETTINGS_PATHS = [
  '/clients',
  '/clients/archive',
  '/clients/activity',
  '/settings/projects',
]

export const revalidateUsers = () => {
  revalidatePath(USERS_PATH)
}

export const revalidateUsersAndRelated = () => {
  revalidateUsers()
  RELATED_SETTINGS_PATHS.forEach(path => {
    revalidatePath(path)
  })
}

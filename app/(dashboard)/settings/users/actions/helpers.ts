import { revalidatePath } from 'next/cache'

export const USERS_PATH = '/settings/users'
const RELATED_SETTINGS_PATHS = ['/settings/clients', '/settings/projects']

export const revalidateUsers = () => {
  revalidatePath(USERS_PATH)
}

export const revalidateUsersAndRelated = () => {
  revalidateUsers()
  RELATED_SETTINGS_PATHS.forEach(path => {
    revalidatePath(path)
  })
}

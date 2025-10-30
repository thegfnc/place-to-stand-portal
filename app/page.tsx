import { redirect } from 'next/navigation'

import { getCurrentUser } from '@/lib/auth/session'

export default async function IndexPage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/sign-in')
  }

  redirect('/home')
}

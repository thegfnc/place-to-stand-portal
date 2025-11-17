import { redirect } from 'next/navigation'

const DEFAULT_MY_TASKS_VIEW = 'board'

export default function MyTasksIndexRoute() {
  redirect(`/my-tasks/${DEFAULT_MY_TASKS_VIEW}`)
}


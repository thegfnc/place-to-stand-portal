'use client'

import { UserPlus } from 'lucide-react'

import { Button } from '@/components/ui/button'

type UsersTableToolbarProps = {
  onAddUser: () => void
}

export function UsersTableToolbar({ onAddUser }: UsersTableToolbarProps) {
  return (
    <div className='flex items-center justify-between'>
      <div>
        <h2 className='text-xl font-semibold'>Team members</h2>
        <p className='text-muted-foreground text-sm'>
          Invite administrators, contractors, and clients to collaborate inside
          the portal.
        </p>
      </div>
      <Button onClick={onAddUser}>
        <UserPlus className='h-4 w-4' /> Add user
      </Button>
    </div>
  )
}

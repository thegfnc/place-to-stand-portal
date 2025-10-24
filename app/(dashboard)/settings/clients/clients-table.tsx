'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Building2, Pencil, Plus, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useToast } from '@/components/ui/use-toast'
import type { Database } from '@/supabase/types/database'

import { cn } from '@/lib/utils'
import { getStatusBadgeToken } from '@/lib/constants'

import { ClientSheet } from '@/app/(dashboard)/settings/clients/clients-sheet'
import { softDeleteClient } from './actions'

type ClientRow = Database['public']['Tables']['clients']['Row'] & {
  projects?: Array<{
    id: string
    deleted_at: string | null
    status: string | null
  }> | null
}

type ClientUserSummary = {
  id: string
  email: string
  fullName: string | null
}

type Props = {
  clients: ClientRow[]
  clientUsers: ClientUserSummary[]
  membersByClient: Record<string, ClientUserSummary[]>
}

export function ClientsSettingsTable({
  clients,
  clientUsers,
  membersByClient,
}: Props) {
  const router = useRouter()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [selectedClient, setSelectedClient] = useState<ClientRow | null>(null)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ClientRow | null>(null)
  const [isPending, startTransition] = useTransition()
  const { toast } = useToast()

  const sortedClients = useMemo(
    () =>
      clients
        .filter(client => !client.deleted_at)
        .sort((a, b) =>
          a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
        ),
    [clients]
  )

  const openCreate = () => {
    setSelectedClient(null)
    setSheetOpen(true)
  }

  const openEdit = (client: ClientRow) => {
    setSelectedClient(client)
    setSheetOpen(true)
  }

  const handleClosed = () => {
    setSheetOpen(false)
  }

  const handleRequestDelete = (client: ClientRow) => {
    if (client.deleted_at || isPending) {
      return
    }

    setDeleteTarget(client)
  }

  const handleCancelDelete = () => {
    if (isPending) {
      return
    }

    setDeleteTarget(null)
  }

  const handleConfirmDelete = () => {
    if (!deleteTarget || deleteTarget.deleted_at) {
      setDeleteTarget(null)
      return
    }

    const client = deleteTarget
    setDeleteTarget(null)
    setPendingDeleteId(client.id)
    startTransition(async () => {
      try {
        const result = await softDeleteClient({ id: client.id })

        if (result.error) {
          toast({
            title: 'Unable to delete client',
            description: result.error,
            variant: 'destructive',
          })
          return
        }

        toast({
          title: 'Client deleted',
          description: `${client.name} is hidden from selectors but remains available for history.`,
        })
        router.refresh()
      } finally {
        setPendingDeleteId(null)
      }
    })
  }

  return (
    <div className='space-y-6'>
      <div className='flex items-center justify-between'>
        <div>
          <ConfirmDialog
            open={Boolean(deleteTarget)}
            title='Delete client?'
            description='Deleting this client hides it from selectors and reporting. Existing projects stay linked.'
            confirmLabel='Delete'
            confirmVariant='destructive'
            confirmDisabled={isPending}
            onCancel={handleCancelDelete}
            onConfirm={handleConfirmDelete}
          />
          <h2 className='text-xl font-semibold'>Clients</h2>
          <p className='text-muted-foreground text-sm'>
            Track active organizations and control which projects roll up to
            each client.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className='h-4 w-4' /> Add client
        </Button>
      </div>
      <div className='overflow-hidden rounded-xl border'>
        <Table>
          <TableHeader>
            <TableRow className='bg-muted/40'>
              <TableHead>Name</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Active projects</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className='w-28 text-right'>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedClients.map(client => {
              const activeProjects =
                client.projects?.filter(project => {
                  if (project.deleted_at) {
                    return false
                  }

                  const status = (project.status ?? '').toLowerCase()
                  return status === 'active'
                }).length ?? 0
              const statusLabel = client.deleted_at ? 'Archived' : 'Active'
              const statusTone = client.deleted_at ? 'archived' : 'active'
              const deleting = isPending && pendingDeleteId === client.id
              const deleteDisabled = deleting || Boolean(client.deleted_at)

              return (
                <TableRow
                  key={client.id}
                  className={client.deleted_at ? 'opacity-60' : undefined}
                >
                  <TableCell>
                    <div className='flex items-center gap-2'>
                      <Building2 className='text-muted-foreground h-4 w-4' />
                      <span className='font-medium'>{client.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className='text-muted-foreground text-sm'>
                    {client.slug ?? '—'}
                  </TableCell>
                  <TableCell className='text-sm'>{activeProjects}</TableCell>
                  <TableCell>
                    <Badge
                      className={cn('text-xs', getStatusBadgeToken(statusTone))}
                    >
                      {statusLabel}
                    </Badge>
                  </TableCell>
                  <TableCell className='text-right'>
                    <div className='flex justify-end gap-2'>
                      <Button
                        variant='outline'
                        size='icon'
                        onClick={() => openEdit(client)}
                        title='Edit client'
                        disabled={deleting}
                      >
                        <Pencil className='h-4 w-4' />
                      </Button>
                      <Button
                        variant='destructive'
                        size='icon'
                        onClick={() => handleRequestDelete(client)}
                        title={
                          deleteDisabled
                            ? 'Client already deleted'
                            : 'Delete client'
                        }
                        aria-label='Delete client'
                        disabled={deleteDisabled}
                      >
                        <Trash2 className='h-4 w-4' />
                        <span className='sr-only'>Delete</span>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
            {sortedClients.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className='text-muted-foreground py-10 text-center text-sm'
                >
                  No clients yet. Create one to begin organizing projects.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
      <ClientSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onComplete={handleClosed}
        client={selectedClient}
        allClientUsers={clientUsers}
        clientMembers={membersByClient}
      />
    </div>
  )
}

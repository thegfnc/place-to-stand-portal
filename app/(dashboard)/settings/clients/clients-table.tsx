'use client'

import { useMemo, useState, useTransition } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import {
  Archive,
  Building2,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
import { destroyClient, restoreClient, softDeleteClient } from './actions'

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

type ClientsTab = 'clients' | 'archive' | 'activity'

const ClientsActivityFeed = dynamic(
  () =>
    import('@/components/activity/activity-feed').then(
      module => module.ActivityFeed
    ),
  {
    ssr: false,
    loading: () => (
      <div className='text-muted-foreground text-sm'>
        Loading recent activity…
      </div>
    ),
  }
)

export function ClientsSettingsTable({
  clients,
  clientUsers,
  membersByClient,
}: Props) {
  const router = useRouter()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [selectedClient, setSelectedClient] = useState<ClientRow | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ClientRow | null>(null)
  const [destroyTarget, setDestroyTarget] = useState<ClientRow | null>(null)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [pendingRestoreId, setPendingRestoreId] = useState<string | null>(null)
  const [pendingDestroyId, setPendingDestroyId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<ClientsTab>('clients')
  const [isPending, startTransition] = useTransition()
  const { toast } = useToast()

  const pendingReason = 'Please wait for the current request to finish.'

  const activeClients = useMemo(
    () =>
      clients
        .filter(client => !client.deleted_at)
        .sort((a, b) =>
          a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
        ),
    [clients]
  )

  const archivedClients = useMemo(
    () =>
      clients
        .filter(client => Boolean(client.deleted_at))
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
    setSelectedClient(null)
    router.refresh()
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

  const handleRestore = (client: ClientRow) => {
    if (!client.deleted_at || isPending) {
      return
    }

    setPendingRestoreId(client.id)
    startTransition(async () => {
      try {
        const result = await restoreClient({ id: client.id })

        if (result.error) {
          toast({
            title: 'Unable to restore client',
            description: result.error,
            variant: 'destructive',
          })
          return
        }

        toast({
          title: 'Client restored',
          description: `${client.name} is active again.`,
        })
        router.refresh()
      } finally {
        setPendingRestoreId(null)
      }
    })
  }

  const handleRequestDestroy = (client: ClientRow) => {
    if (!client.deleted_at || isPending) {
      return
    }

    setDestroyTarget(client)
  }

  const handleCancelDestroy = () => {
    if (isPending) {
      return
    }

    setDestroyTarget(null)
  }

  const handleConfirmDestroy = () => {
    if (!destroyTarget || !destroyTarget.deleted_at) {
      setDestroyTarget(null)
      return
    }

    const client = destroyTarget
    setDestroyTarget(null)
    setPendingDestroyId(client.id)

    startTransition(async () => {
      try {
        const result = await destroyClient({ id: client.id })

        if (result.error) {
          toast({
            title: 'Unable to permanently delete client',
            description: result.error,
            variant: 'destructive',
          })
          return
        }

        toast({
          title: 'Client permanently deleted',
          description: `${client.name} has been removed.`,
        })
        router.refresh()
      } finally {
        setPendingDestroyId(null)
      }
    })
  }

  return (
    <div className='space-y-6'>
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title='Archive client?'
        description={
          deleteTarget
            ? `Archiving ${deleteTarget.name} hides it from selectors and reporting. Existing projects stay linked.`
            : 'Archiving this client hides it from selectors and reporting. Existing projects stay linked.'
        }
        confirmLabel='Archive'
        confirmVariant='destructive'
        confirmDisabled={isPending}
        onCancel={handleCancelDelete}
        onConfirm={handleConfirmDelete}
      />
      <ConfirmDialog
        open={Boolean(destroyTarget)}
        title='Permanently delete client?'
        description={
          destroyTarget
            ? `Permanently deleting ${destroyTarget.name} removes this client and its memberships. This action cannot be undone.`
            : 'Permanently deleting this client removes it and its memberships. This action cannot be undone.'
        }
        confirmLabel='Delete forever'
        confirmVariant='destructive'
        confirmDisabled={isPending}
        onCancel={handleCancelDestroy}
        onConfirm={handleConfirmDestroy}
      />
      <Tabs
        value={activeTab}
        onValueChange={value => setActiveTab(value as ClientsTab)}
        className='space-y-6'
      >
        <div className='flex flex-wrap items-center justify-between gap-4'>
          <TabsList>
            <TabsTrigger value='clients'>Clients</TabsTrigger>
            <TabsTrigger value='archive'>Archive</TabsTrigger>
            <TabsTrigger value='activity'>Activity</TabsTrigger>
          </TabsList>
          {activeTab === 'clients' ? (
            <Button onClick={openCreate}>
              <Plus className='h-4 w-4' /> Add client
            </Button>
          ) : null}
        </div>
        <TabsContent value='clients' className='space-y-6'>
          <ClientsTableSection
            clients={activeClients}
            mode='active'
            onEdit={openEdit}
            onRequestDelete={handleRequestDelete}
            onRestore={handleRestore}
            onRequestDestroy={handleRequestDestroy}
            isPending={isPending}
            pendingReason={pendingReason}
            pendingDeleteId={pendingDeleteId}
            pendingRestoreId={pendingRestoreId}
            pendingDestroyId={pendingDestroyId}
            emptyMessage='No clients yet. Create one to begin organizing projects.'
          />
        </TabsContent>
        <TabsContent value='archive' className='space-y-6'>
          <ClientsTableSection
            clients={archivedClients}
            mode='archive'
            onEdit={openEdit}
            onRequestDelete={handleRequestDelete}
            onRestore={handleRestore}
            onRequestDestroy={handleRequestDestroy}
            isPending={isPending}
            pendingReason={pendingReason}
            pendingDeleteId={pendingDeleteId}
            pendingRestoreId={pendingRestoreId}
            pendingDestroyId={pendingDestroyId}
            emptyMessage='No archived clients. Archived clients appear here once deleted.'
          />
        </TabsContent>
        <TabsContent value='activity' className='space-y-3'>
          <div className='space-y-3 p-1'>
            <div>
              <h3 className='text-lg font-semibold'>Recent activity</h3>
              <p className='text-muted-foreground text-sm'>
                Review client creation, edits, archives, and restorations in one
                place.
              </p>
            </div>
            <ClientsActivityFeed
              targetType='CLIENT'
              pageSize={20}
              emptyState='No recent client activity.'
              requireContext={false}
            />
          </div>
        </TabsContent>
      </Tabs>
      <ClientSheet
        open={sheetOpen}
        onOpenChange={open => {
          setSheetOpen(open)
          if (!open) {
            setSelectedClient(null)
          }
        }}
        onComplete={handleClosed}
        client={selectedClient}
        allClientUsers={clientUsers}
        clientMembers={membersByClient}
      />
    </div>
  )
}

type ClientsTableSectionProps = {
  clients: ClientRow[]
  mode: 'active' | 'archive'
  onEdit: (client: ClientRow) => void
  onRequestDelete: (client: ClientRow) => void
  onRestore: (client: ClientRow) => void
  onRequestDestroy: (client: ClientRow) => void
  isPending: boolean
  pendingReason: string
  pendingDeleteId: string | null
  pendingRestoreId: string | null
  pendingDestroyId: string | null
  emptyMessage: string
}

function ClientsTableSection({
  clients,
  mode,
  onEdit,
  onRequestDelete,
  onRestore,
  onRequestDestroy,
  isPending,
  pendingReason,
  pendingDeleteId,
  pendingRestoreId,
  pendingDestroyId,
  emptyMessage,
}: ClientsTableSectionProps) {
  return (
    <div className='overflow-hidden rounded-xl border'>
      <Table>
        <TableHeader>
          <TableRow className='bg-muted/40'>
            <TableHead>Name</TableHead>
            <TableHead>Slug</TableHead>
            <TableHead>Active projects</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className='w-32 text-right'>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {clients.map(client => {
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

            const isDeleting = isPending && pendingDeleteId === client.id
            const isRestoring = isPending && pendingRestoreId === client.id
            const isDestroying = isPending && pendingDestroyId === client.id

            const deleteDisabled =
              isDeleting ||
              isRestoring ||
              isDestroying ||
              Boolean(client.deleted_at)
            const deleteDisabledReason = deleteDisabled
              ? isDeleting || isRestoring || isDestroying
                ? pendingReason
                : client.deleted_at
                  ? 'Client already archived.'
                  : null
              : null

            const restoreDisabled = isRestoring || isDeleting || isDestroying
            const restoreDisabledReason = restoreDisabled ? pendingReason : null

            const destroyDisabled =
              isDestroying || isDeleting || isRestoring || !client.deleted_at
            const destroyDisabledReason = destroyDisabled
              ? !client.deleted_at
                ? 'Archive the client before permanently deleting.'
                : pendingReason
              : null

            const editDisabled = isDeleting || isRestoring || isDestroying
            const editDisabledReason = editDisabled ? pendingReason : null

            const showEdit = mode === 'active'
            const showSoftDelete = mode === 'active'
            const showRestore = mode === 'archive'
            const showDestroy = mode === 'archive'

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
                    {showEdit ? (
                      <DisabledFieldTooltip
                        disabled={editDisabled}
                        reason={editDisabledReason}
                      >
                        <Button
                          variant='outline'
                          size='icon'
                          onClick={() => onEdit(client)}
                          title='Edit client'
                          disabled={editDisabled}
                        >
                          <Pencil className='h-4 w-4' />
                        </Button>
                      </DisabledFieldTooltip>
                    ) : null}
                    {showRestore ? (
                      <DisabledFieldTooltip
                        disabled={restoreDisabled}
                        reason={restoreDisabledReason}
                      >
                        <Button
                          variant='secondary'
                          size='icon'
                          onClick={() => onRestore(client)}
                          title='Restore client'
                          aria-label='Restore client'
                          disabled={restoreDisabled}
                        >
                          <RefreshCw className='h-4 w-4' />
                          <span className='sr-only'>Restore</span>
                        </Button>
                      </DisabledFieldTooltip>
                    ) : null}
                    {showSoftDelete ? (
                      <DisabledFieldTooltip
                        disabled={deleteDisabled}
                        reason={deleteDisabledReason}
                      >
                        <Button
                          variant='destructive'
                          size='icon'
                          onClick={() => onRequestDelete(client)}
                          title='Delete client'
                          aria-label='Delete client'
                          disabled={deleteDisabled}
                        >
                          <Archive className='h-4 w-4' />
                          <span className='sr-only'>Archive</span>
                        </Button>
                      </DisabledFieldTooltip>
                    ) : null}
                    {showDestroy ? (
                      <DisabledFieldTooltip
                        disabled={destroyDisabled}
                        reason={destroyDisabledReason}
                      >
                        <Button
                          variant='destructive'
                          size='icon'
                          onClick={() => onRequestDestroy(client)}
                          title='Permanently delete client'
                          aria-label='Permanently delete client'
                          disabled={destroyDisabled}
                        >
                          <Trash2 className='h-4 w-4' />
                          <span className='sr-only'>Delete permanently</span>
                        </Button>
                      </DisabledFieldTooltip>
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            )
          })}
          {clients.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={5}
                className='text-muted-foreground py-10 text-center text-sm'
              >
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </div>
  )
}

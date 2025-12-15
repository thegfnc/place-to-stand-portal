'use client'

import { useState, useTransition } from 'react'
import { Mail, Plus, Pencil, Trash2, Star, Loader2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useToast } from '@/components/ui/use-toast'
import type { ClientContact } from '@/lib/types/client-contacts'
import {
  addClientContact,
  updateClientContact,
  deleteClientContact,
} from '../actions'

type Props = {
  clientId: string
  contacts: ClientContact[]
  canManage: boolean
}

type EditingContact = { id?: string; email: string; name: string; isPrimary: boolean }

const emptyContact: EditingContact = { email: '', name: '', isPrimary: false }

export function ClientContactsSection({ clientId, contacts, canManage }: Props) {
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()
  const [editing, setEditing] = useState<EditingContact | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ClientContact | null>(null)

  const handleSave = () => {
    if (!editing?.email) return

    startTransition(async () => {
      const result = editing.id
        ? await updateClientContact(editing.id, editing)
        : await addClientContact({ clientId, ...editing })

      if (result.success) {
        toast({ title: editing.id ? 'Contact updated' : 'Contact added' })
        setEditing(null)
      } else {
        toast({ title: 'Error', description: result.error, variant: 'destructive' })
      }
    })
  }

  const handleDelete = () => {
    if (!deleteTarget) return

    startTransition(async () => {
      const result = await deleteClientContact(deleteTarget.id)
      if (result.success) {
        toast({ title: 'Contact removed' })
      } else {
        toast({ title: 'Error', description: result.error, variant: 'destructive' })
      }
      setDeleteTarget(null)
    })
  }

  return (
    <section className='bg-card text-card-foreground overflow-hidden rounded-xl border shadow-sm'>
      <div className='bg-muted/30 flex items-center justify-between gap-3 border-b px-6 py-4'>
        <div className='flex items-center gap-3'>
          <div className='bg-background flex h-8 w-8 items-center justify-center rounded-md border shadow-sm'>
            <Mail className='text-muted-foreground h-4 w-4' />
          </div>
          <h2 className='text-lg font-semibold tracking-tight'>Contacts</h2>
          <Badge variant='secondary'>{contacts.length}</Badge>
        </div>
        {canManage && !editing && (
          <Button size='sm' onClick={() => setEditing(emptyContact)}>
            <Plus className='mr-1 h-4 w-4' /> Add
          </Button>
        )}
      </div>

      <div className='p-6'>
        {contacts.length === 0 && !editing ? (
          <div className='text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm'>
            No contacts. Add email addresses to enable automatic email linking.
          </div>
        ) : (
          <div className='space-y-2'>
            {contacts.map(c => (
              editing?.id === c.id ? (
                <ContactForm
                  key={c.id}
                  value={editing}
                  onChange={setEditing}
                  onSave={handleSave}
                  onCancel={() => setEditing(null)}
                  isPending={isPending}
                />
              ) : (
                <ContactRow
                  key={c.id}
                  contact={c}
                  canManage={canManage}
                  onEdit={() => setEditing({ id: c.id, email: c.email, name: c.name ?? '', isPrimary: c.isPrimary })}
                  onDelete={() => setDeleteTarget(c)}
                />
              )
            ))}
            {editing && !editing.id && (
              <ContactForm
                value={editing}
                onChange={setEditing}
                onSave={handleSave}
                onCancel={() => setEditing(null)}
                isPending={isPending}
              />
            )}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        title='Remove contact?'
        description={`Remove ${deleteTarget?.email}? Emails from this address will no longer auto-link to this client.`}
        confirmLabel='Remove'
        confirmVariant='destructive'
        confirmDisabled={isPending}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </section>
  )
}

function ContactRow({
  contact,
  canManage,
  onEdit,
  onDelete,
}: {
  contact: ClientContact
  canManage: boolean
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div className='flex items-center justify-between gap-4 py-2 px-3 rounded-md hover:bg-muted/50'>
      <div className='flex items-center gap-3 min-w-0'>
        <span className='font-medium truncate'>{contact.email}</span>
        {contact.name && <span className='text-muted-foreground text-sm truncate'>({contact.name})</span>}
        {contact.isPrimary && (
          <Badge variant='outline' className='shrink-0'>
            <Star className='mr-1 h-3 w-3 fill-current' /> Primary
          </Badge>
        )}
      </div>
      {canManage && (
        <div className='flex gap-1 shrink-0'>
          <Button variant='ghost' size='icon' className='h-8 w-8' onClick={onEdit}>
            <Pencil className='h-4 w-4' />
          </Button>
          <Button variant='ghost' size='icon' className='h-8 w-8' onClick={onDelete}>
            <Trash2 className='h-4 w-4' />
          </Button>
        </div>
      )}
    </div>
  )
}

function ContactForm({
  value,
  onChange,
  onSave,
  onCancel,
  isPending,
}: {
  value: EditingContact
  onChange: (v: EditingContact) => void
  onSave: () => void
  onCancel: () => void
  isPending: boolean
}) {
  return (
    <div className='flex flex-wrap items-center gap-2 py-2 px-3 rounded-md bg-muted/30'>
      <Input
        type='email'
        placeholder='email@example.com'
        value={value.email}
        onChange={e => onChange({ ...value, email: e.target.value })}
        className='w-56'
        disabled={isPending}
      />
      <Input
        placeholder='Name (optional)'
        value={value.name}
        onChange={e => onChange({ ...value, name: e.target.value })}
        className='w-40'
        disabled={isPending}
      />
      <label className='flex items-center gap-2 text-sm cursor-pointer'>
        <Checkbox
          checked={value.isPrimary}
          onCheckedChange={checked => onChange({ ...value, isPrimary: !!checked })}
          disabled={isPending}
        />
        Primary
      </label>
      <div className='flex gap-1 ml-auto'>
        <Button size='sm' variant='ghost' onClick={onCancel} disabled={isPending}>
          Cancel
        </Button>
        <Button size='sm' onClick={onSave} disabled={isPending || !value.email}>
          {isPending ? <Loader2 className='h-4 w-4 animate-spin' /> : 'Save'}
        </Button>
      </div>
    </div>
  )
}

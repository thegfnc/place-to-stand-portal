import type { ClientRow } from './hour-block-form'

export type ClientOption = {
  value: string
  label: string
  keywords: string[]
}

export const buildClientOptions = (clients: ClientRow[]): ClientOption[] =>
  clients.map(client => ({
    value: client.id,
    label: client.deleted_at ? `${client.name} (Deleted)` : client.name,
    keywords: client.deleted_at ? [client.name, 'deleted'] : [client.name],
  }))

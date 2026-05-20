import { api } from './client'
import type {
  Mailbox, Forwarder, DKIMKey, CatchAll,
  CreateMailboxRequest, UpdateMailboxRequest,
  CreateForwarderRequest, SetCatchAllRequest,
} from '@/types/mail.types'

export const mailApi = {
  listMailboxes: () =>
    api.get<{ mailboxes: Mailbox[]; total: number }>('/mail/mailboxes'),

  createMailbox: (data: CreateMailboxRequest) =>
    api.post<Mailbox>('/mail/mailboxes', data),

  updateMailbox: (id: string, data: UpdateMailboxRequest) =>
    api.patch<Mailbox>(`/mail/mailboxes/${id}`, data),

  changePassword: (id: string, password: string) =>
    api.put<{ success: boolean }>(`/mail/mailboxes/${id}/password`, { password }),

  suspendMailbox: (id: string) =>
    api.put<{ success: boolean }>(`/mail/mailboxes/${id}/suspend`, {}),

  unsuspendMailbox: (id: string) =>
    api.put<{ success: boolean }>(`/mail/mailboxes/${id}/unsuspend`, {}),

  deleteMailbox: (id: string) =>
    api.delete(`/mail/mailboxes/${id}`),

  listForwarders: () =>
    api.get<{ forwarders: Forwarder[]; total: number }>('/mail/forwarders'),

  createForwarder: (data: CreateForwarderRequest) =>
    api.post<Forwarder>('/mail/forwarders', data),

  deleteForwarder: (id: string) =>
    api.delete(`/mail/forwarders/${id}`),

  listDKIM: () =>
    api.get<{ keys: DKIMKey[] }>('/mail/dkim'),

  getDKIM: (domain: string) =>
    api.get<DKIMKey>(`/mail/dkim/${domain}`),

  generateDKIM: (data: { domain: string; selector?: string; key_size?: number }) =>
    api.post<DKIMKey>('/mail/dkim', data),

  deleteDKIM: (domain: string) =>
    api.delete(`/mail/dkim/${domain}`),

  getCatchAll: (domain?: string) =>
    api.get<{ catch_all: CatchAll | null }>(`/mail/catchall${domain ? `?domain=${encodeURIComponent(domain)}` : ''}`),

  setCatchAll: (data: SetCatchAllRequest) =>
    api.post<CatchAll>('/mail/catchall', data),

  deleteCatchAll: (domain: string) =>
    api.delete(`/mail/catchall?domain=${encodeURIComponent(domain)}`),

  listAliases: (domain?: string) =>
    api.get<{
      aliases: Array<{ id: string; source: string; destination: string; catch_all: boolean; active: boolean; created_at: string }>
      total: number
    }>(`/mail/aliases${domain ? `?domain=${encodeURIComponent(domain)}` : ''}`),

  createAlias: (data: { source: string; destination: string; catch_all?: boolean }) =>
    api.post<{ id: string }>('/mail/aliases', data),

  deleteAlias: (id: string) =>
    api.delete(`/mail/aliases/${id}`),

  getDMARCRecord: (domain: string, policy?: 'none' | 'quarantine' | 'reject') =>
    api.get<{
      domain: string
      record: string
      dns_name: string
      dns_type: string
      dns_value: string
      policy: string
      guidelines: string
    }>(`/mail/dmarc?domain=${encodeURIComponent(domain)}${policy ? `&policy=${policy}` : ''}`),
}

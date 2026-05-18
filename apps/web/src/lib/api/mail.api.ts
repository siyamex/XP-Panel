import { api } from './client'
import type {
  Mailbox, Forwarder, DKIMKey,
  CreateMailboxRequest, UpdateMailboxRequest,
  CreateForwarderRequest, GenerateDKIMRequest,
} from '@/types/mail.types'

export const mailApi = {
  listMailboxes: () =>
    api.get<{ mailboxes: Mailbox[]; total: number }>('/mail/mailboxes'),

  createMailbox: (data: CreateMailboxRequest) =>
    api.post<Mailbox>('/mail/mailboxes', data),

  updateMailbox: (id: string, data: UpdateMailboxRequest) =>
    api.put<Mailbox>(`/mail/mailboxes/${id}`, data),

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

  generateDKIM: (domain: string) =>
    api.post<DKIMKey>('/mail/dkim/generate', { domain }),

  deleteDKIM: (domain: string) =>
    api.delete(`/mail/dkim/${domain}`),
}
